/**
 * ComfyUI Workflow Composer
 *
 * Programmatically builds ComfyUI API-format workflow JSON from ShotSpec parameters.
 * Replaces static JSON templates with composable node graphs.
 *
 * ComfyUI API format:
 * - Each node has an integer string key ("1", "2", etc.)
 * - Nodes contain `class_type`, `inputs`, and optional `_meta`
 * - Node connections use [nodeId, outputIndex] tuples
 * - CheckpointLoaderSimple outputs: [MODEL, CLIP, VAE] at indices [0, 1, 2]
 */

import type {
  ShotSpec,
  SeedPolicy,
  LoraSpec,
  ControlNetSpec,
  UpscaleSpec,
  RefinerSpec,
  RepairSpec,
  PromptBible,
  FrameAnchor,
} from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('comfyui-composer');

// ─── ComfyUI Workflow Types ───

export interface ComfyUINode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}

export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode;
}

/** Tracks node IDs and wiring state as the workflow is composed. */
export interface WorkflowContext {
  nextId: number;
  modelNodeId: string;
  clipNodeId: string;
  clipSkipNodeId?: string;
  positiveCondNodeId: string;
  negativeCondNodeId: string;
  latentNodeId: string;
  samplerNodeId: string;
  vaeNodeId: string;
  vaeDecodeNodeId: string;
  imageOutputNodeId: string;
  resolvedSeed?: number;
}

/** Escape special regex characters in a string for safe use in `new RegExp()`. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Prompt Composition ───

/**
 * Compose positive and negative prompt strings from a ShotSpec and optional PromptBible.
 *
 * Assembly order (positive):
 *   qualityTokens → globalStyle → styleTokens → LoRA triggers → promptBlocks → camera → lighting
 *
 * Assembly order (negative):
 *   negativeBlock → avoidTokens → fallback defaults
 */
export function composePrompt(
  spec: ShotSpec,
  bible?: PromptBible,
): { positive: string; negative: string } {
  const parts: string[] = [];

  // Quality tokens from bible
  if (bible?.qualityTokens) parts.push(bible.qualityTokens);

  // Global style from bible
  if (bible?.globalStyle) parts.push(bible.globalStyle);
  if (bible?.styleTokens) parts.push(bible.styleTokens);

  // LoRA trigger words
  if (spec.generation?.loras) {
    for (const lora of spec.generation.loras) {
      if (lora.triggerWords?.length) {
        parts.push(lora.triggerWords.join(', '));
      }
    }
  }

  // Prompt slot substitution
  const processedBlocks = spec.promptBlocks.map(block => {
    let processed = block;
    // Replace {slotName} patterns with values from spec.promptSlots
    if (spec.promptSlots) {
      for (const [slot, value] of Object.entries(spec.promptSlots)) {
        processed = processed.replace(new RegExp(`\\{${escapeRegExp(slot)}\\}`, 'g'), value);
      }
    }
    // Per-character blocks from bible
    if (bible?.perCharacterBlocks) {
      for (const [charKey, blocks] of Object.entries(bible.perCharacterBlocks)) {
        processed = processed.replace(new RegExp(`\\{char:${escapeRegExp(charKey)}\\}`, 'g'), blocks.join(', '));
      }
    }
    // Per-environment blocks from bible
    if (bible?.perEnvironmentBlocks) {
      for (const [envKey, blocks] of Object.entries(bible.perEnvironmentBlocks)) {
        processed = processed.replace(new RegExp(`\\{env:${escapeRegExp(envKey)}\\}`, 'g'), blocks.join(', '));
      }
    }
    return processed;
  });

  // Validate slot values against rules (warnings only)
  if (spec.promptSlots && bible?.slotRules) {
    for (const [slot, value] of Object.entries(spec.promptSlots)) {
      const allowedValues = bible.slotRules[slot];
      if (allowedValues && !allowedValues.includes(value)) {
        logger.warn({ slot, value, allowedValues }, 'Slot value not in allowed list');
      }
    }
  }

  // Shot prompt blocks (with slots resolved)
  parts.push(...processedBlocks);

  // Camera/lighting descriptors
  if (spec.camera?.framing) parts.push(spec.camera.framing);
  if (spec.camera?.lens) parts.push(`${spec.camera.lens} lens`);
  if (spec.lighting) parts.push(spec.lighting);

  const positive = parts.filter(Boolean).join(', ');

  // Negative prompt
  const negParts: string[] = [];
  if (bible?.negativeBlock) negParts.push(bible.negativeBlock);
  if (bible?.avoidTokens) negParts.push(bible.avoidTokens);
  // Default negative if nothing specified
  if (negParts.length === 0) {
    negParts.push(
      'worst quality, low quality, blurry, deformed, distorted, disfigured, bad anatomy, watermark, text, signature',
    );
  }
  const negative = negParts.join(', ');

  return { positive, negative };
}

// ─── Seed Resolution ───

export interface SeedContext {
  shotIndex?: number;
  sceneId?: string;
  seriesId?: string;
}

/**
 * Resolve the seed for a shot based on its seed policy.
 *
 * Resolution order:
 *   1. If seedLocked=true, use spec.seed as-is (never override)
 *   2. If spec.seed is set and policy is 'free', use spec.seed
 *   3. Apply policy:
 *      - free: random
 *      - shot-offset: baseSeed + shotIndex
 *      - scene-lock: hash(baseSeed + sceneId)
 *      - series-lock: baseSeed (constant across all shots)
 */
export function resolveSeed(
  spec: ShotSpec,
  bible?: PromptBible,
  seedCtx?: SeedContext,
): number {
  // Locked seeds are never overridden
  if (spec.seedLocked && spec.seed != null) {
    return spec.seed;
  }

  const policy: SeedPolicy = spec.seedPolicy ?? bible?.defaultSeedPolicy ?? 'free';
  const baseSeed = bible?.baseSeed ?? spec.seed ?? Math.floor(Math.random() * 2147483647);

  switch (policy) {
    case 'free':
      return spec.seed ?? Math.floor(Math.random() * 2147483647);

    case 'shot-offset':
      return baseSeed + (seedCtx?.shotIndex ?? 0);

    case 'scene-lock': {
      // Simple hash: baseSeed XOR'd with sceneId character codes
      const sceneId = seedCtx?.sceneId ?? 'default';
      let hash = baseSeed;
      for (let i = 0; i < sceneId.length; i++) {
        hash = ((hash << 5) - hash + sceneId.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
    }

    case 'series-lock':
      return baseSeed;

    default:
      return spec.seed ?? Math.floor(Math.random() * 2147483647);
  }
}

// ─── Base Workflow Builder ───

/**
 * Build the core 7-node workflow:
 *   1. CheckpointLoaderSimple
 *   2. CLIPTextEncode (positive)
 *   3. CLIPTextEncode (negative)
 *   4. EmptyLatentImage
 *   5. KSampler
 *   6. VAEDecode
 *   7. SaveImage
 */
export function buildBaseWorkflow(
  spec: ShotSpec,
  bible?: PromptBible,
  seedCtx?: SeedContext,
): { workflow: ComfyUIWorkflow; ctx: WorkflowContext } {
  const gen = spec.generation ?? {};
  const seed = resolveSeed(spec, bible, seedCtx);
  const { positive, negative } = composePrompt(spec, bible);

  const workflow: ComfyUIWorkflow = {};

  // Node 1: CheckpointLoaderSimple
  workflow['1'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: spec.model ?? 'sd_xl_base_1.0.safetensors' },
    _meta: { title: 'Load Checkpoint' },
  };

  // Node 2: CLIPTextEncode (positive)
  workflow['2'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: positive,
      clip: ['1', 1], // checkpoint CLIP output
    },
    _meta: { title: 'Positive Prompt' },
  };

  // Node 3: CLIPTextEncode (negative)
  workflow['3'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: negative,
      clip: ['1', 1],
    },
    _meta: { title: 'Negative Prompt' },
  };

  // Node 4: EmptyLatentImage
  workflow['4'] = {
    class_type: 'EmptyLatentImage',
    inputs: {
      width: gen.width ?? 1024,
      height: gen.height ?? 1024,
      batch_size: gen.batchSize ?? 1,
    },
    _meta: { title: 'Empty Latent Image' },
  };

  // Node 5: KSampler
  workflow['5'] = {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0],
      seed,
      steps: gen.steps ?? 30,
      cfg: gen.cfg ?? 7,
      sampler_name: gen.sampler ?? 'dpmpp_2m',
      scheduler: gen.scheduler ?? 'karras',
      denoise: gen.denoise ?? 1.0,
    },
    _meta: { title: 'KSampler' },
  };

  // Node 6: VAEDecode
  workflow['6'] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['5', 0],
      vae: ['1', 2],
    },
    _meta: { title: 'VAE Decode' },
  };

  // Node 7: SaveImage
  workflow['7'] = {
    class_type: 'SaveImage',
    inputs: {
      images: ['6', 0],
      filename_prefix: 'airevstream',
    },
    _meta: { title: 'Save Image' },
  };

  const ctx: WorkflowContext = {
    nextId: 8,
    modelNodeId: '1',
    clipNodeId: '1',
    positiveCondNodeId: '2',
    negativeCondNodeId: '3',
    latentNodeId: '4',
    samplerNodeId: '5',
    vaeNodeId: '1',
    vaeDecodeNodeId: '6',
    imageOutputNodeId: '7',
    resolvedSeed: seed,
  };

  return { workflow, ctx };
}

// ─── LoRA Node Chain ───

/**
 * Insert LoraLoader nodes between the checkpoint and sampler.
 * Each LoRA chains model + CLIP through the previous one, then rewires
 * the sampler and prompt encoders to use the final LoRA output.
 */
export function addLoraNodes(
  workflow: ComfyUIWorkflow,
  ctx: WorkflowContext,
  loras: LoraSpec[],
): WorkflowContext {
  let currentModelSource = ctx.modelNodeId;
  let currentModelOutput = 0; // output index
  let currentClipSource = ctx.clipNodeId;
  let currentClipOutput = 1; // CLIP is output index 1 from checkpoint
  let updatedCtx = { ...ctx };

  for (const lora of loras) {
    const nodeId = String(updatedCtx.nextId++);
    workflow[nodeId] = {
      class_type: 'LoraLoader',
      inputs: {
        model: [currentModelSource, currentModelOutput],
        clip: [currentClipSource, currentClipOutput],
        lora_name: lora.name,
        strength_model: lora.strength,
        strength_clip: lora.clipStrength ?? lora.strength,
      },
      _meta: { title: `LoRA: ${lora.name}` },
    };

    // LoraLoader outputs: [MODEL:0, CLIP:1]
    currentModelSource = nodeId;
    currentModelOutput = 0;
    currentClipSource = nodeId;
    currentClipOutput = 1;
  }

  // Rewire sampler and prompt encoders to use the last LoRA's outputs
  if (loras.length > 0) {
    const lastLoraId = String(updatedCtx.nextId - 1);
    workflow[ctx.samplerNodeId].inputs.model = [lastLoraId, 0];
    // Rewire CLIP connections on positive and negative prompts
    workflow[ctx.positiveCondNodeId].inputs.clip = [lastLoraId, 1];
    workflow[ctx.negativeCondNodeId].inputs.clip = [lastLoraId, 1];

    updatedCtx.modelNodeId = lastLoraId;
    updatedCtx.clipNodeId = lastLoraId;
  }

  return updatedCtx;
}

// ─── ControlNet Stack ───

/**
 * Add ControlNet conditioning nodes. Each ControlNet loads a model,
 * optionally loads a source image, and applies conditioning that chains
 * from the previous positive conditioning.
 */
export function addControlNetNodes(
  workflow: ComfyUIWorkflow,
  ctx: WorkflowContext,
  controlNets: ControlNetSpec[],
): WorkflowContext {
  let updatedCtx = { ...ctx };
  let lastPositiveId = ctx.positiveCondNodeId;
  let lastPositiveOutput = 0;

  for (const cn of controlNets) {
    // Load ControlNet model
    const loaderNodeId = String(updatedCtx.nextId++);
    workflow[loaderNodeId] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: cn.model },
      _meta: { title: `Load ControlNet: ${cn.type}` },
    };

    // Apply ControlNet
    const applyNodeId = String(updatedCtx.nextId++);
    const inputs: Record<string, unknown> = {
      conditioning: [lastPositiveId, lastPositiveOutput],
      control_net: [loaderNodeId, 0],
      strength: cn.strength,
    };

    // If a source image is specified, load it
    if (cn.sourceImage) {
      const imageLoadId = String(updatedCtx.nextId++);
      workflow[imageLoadId] = {
        class_type: 'LoadImage',
        inputs: { image: cn.sourceImage },
        _meta: { title: `ControlNet Source: ${cn.type}` },
      };
      inputs.image = [imageLoadId, 0];
    }

    if (cn.startPercent !== undefined) inputs.start_percent = cn.startPercent;
    if (cn.endPercent !== undefined) inputs.end_percent = cn.endPercent;

    workflow[applyNodeId] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs,
      _meta: { title: `Apply ControlNet: ${cn.type}` },
    };

    lastPositiveId = applyNodeId;
    lastPositiveOutput = 0;
  }

  // Rewire sampler to use the last ControlNet's conditioning
  if (controlNets.length > 0) {
    workflow[ctx.samplerNodeId].inputs.positive = [lastPositiveId, 0];
    updatedCtx.positiveCondNodeId = lastPositiveId;
  }

  return updatedCtx;
}

// ─── First Frame Anchoring ───

/**
 * Add first-frame anchoring nodes. Two modes:
 *
 * - **img2img**: LoadImage → VAEEncode → replace EmptyLatentImage as KSampler input.
 *   Sets denoise = 1 - strength (lower denoise = closer to reference).
 *
 * - **controlnet**: Delegates to addControlNetNodes with the anchor frame as source.
 */
export function addFirstFrameNodes(
  workflow: ComfyUIWorkflow,
  ctx: WorkflowContext,
  anchor: FrameAnchor,
  spec: ShotSpec,
): WorkflowContext {
  const mode = anchor.mode ?? 'img2img';
  const strength = anchor.strength ?? 0.75;

  if (mode === 'controlnet') {
    // Delegate to ControlNet with the anchor frame as source
    const cnType = anchor.controlNetType ?? 'softedge';
    const cnModelMap: Record<string, string> = {
      depth: 'control_v11f1p_sd15_depth',
      canny: 'control_v11p_sd15_canny',
      softedge: 'control_v11p_sd15_softedge',
    };
    return addControlNetNodes(workflow, ctx, [{
      type: cnType,
      model: cnModelMap[cnType] ?? cnModelMap.softedge,
      strength,
      sourceImage: anchor.storageKey,
    }]);
  }

  // img2img mode: load image → VAE encode → rewire KSampler latent input
  let updatedCtx = { ...ctx };

  const loadImageId = String(updatedCtx.nextId++);
  workflow[loadImageId] = {
    class_type: 'LoadImage',
    inputs: { image: anchor.storageKey },
    _meta: { title: 'First Frame Reference' },
  };

  const vaeEncodeId = String(updatedCtx.nextId++);
  workflow[vaeEncodeId] = {
    class_type: 'VAEEncode',
    inputs: {
      pixels: [loadImageId, 0],
      vae: [ctx.vaeNodeId, 2], // VAE from checkpoint
    },
    _meta: { title: 'Encode First Frame' },
  };

  // Rewire KSampler to use encoded frame instead of EmptyLatentImage
  workflow[ctx.samplerNodeId].inputs.latent_image = [vaeEncodeId, 0];
  // Set denoise proportional to 1 - strength (stronger anchor = less noise)
  workflow[ctx.samplerNodeId].inputs.denoise = 1 - strength;

  // Remove the EmptyLatentImage node since it's no longer used
  delete workflow[ctx.latentNodeId];

  updatedCtx.latentNodeId = vaeEncodeId;
  return updatedCtx;
}

// ─── Upscale Chain ───

/**
 * Add model-based upscaling. Loads an upscale model, applies it to the
 * decoded image, and optionally runs a second low-denoise sampling pass
 * for detail refinement.
 */
export function addUpscaleNodes(
  workflow: ComfyUIWorkflow,
  ctx: WorkflowContext,
  upscale: UpscaleSpec,
  spec: ShotSpec,
): WorkflowContext {
  let updatedCtx = { ...ctx };

  // Load upscale model
  const modelLoadId = String(updatedCtx.nextId++);
  workflow[modelLoadId] = {
    class_type: 'UpscaleModelLoader',
    inputs: { model_name: upscale.model },
    _meta: { title: 'Load Upscale Model' },
  };

  // Apply upscale to image
  const upscaleId = String(updatedCtx.nextId++);
  workflow[upscaleId] = {
    class_type: 'ImageUpscaleWithModel',
    inputs: {
      upscale_model: [modelLoadId, 0],
      image: [ctx.vaeDecodeNodeId, 0],
    },
    _meta: { title: 'Upscale Image' },
  };

  // Optional: Second pass with low denoise for detail refinement
  if (upscale.denoiseAfter && upscale.denoiseAfter > 0) {
    // VAE source: use the current VAE node (may be refiner checkpoint if refiner was added)
    const vaeSource = ctx.vaeNodeId;

    // Encode upscaled image back to latent
    const encodeId = String(updatedCtx.nextId++);
    workflow[encodeId] = {
      class_type: 'VAEEncode',
      inputs: {
        pixels: [upscaleId, 0],
        vae: [vaeSource, 2],
      },
      _meta: { title: 'Encode Upscaled to Latent' },
    };

    // Second KSampler with low denoise
    const sampler2Id = String(updatedCtx.nextId++);
    workflow[sampler2Id] = {
      class_type: 'KSampler',
      inputs: {
        model: workflow[ctx.samplerNodeId].inputs.model,
        positive: workflow[ctx.samplerNodeId].inputs.positive,
        negative: workflow[ctx.samplerNodeId].inputs.negative,
        latent_image: [encodeId, 0],
        seed: (ctx.resolvedSeed ?? 0) + 1,
        steps: spec.generation?.steps ?? 30,
        cfg: spec.generation?.cfg ?? 7,
        sampler_name: spec.generation?.sampler ?? 'dpmpp_2m',
        scheduler: spec.generation?.scheduler ?? 'karras',
        denoise: upscale.denoiseAfter,
      },
      _meta: { title: 'Refine After Upscale' },
    };

    // Decode refined latent
    const decode2Id = String(updatedCtx.nextId++);
    workflow[decode2Id] = {
      class_type: 'VAEDecode',
      inputs: {
        samples: [sampler2Id, 0],
        vae: [vaeSource, 2],
      },
      _meta: { title: 'Decode Refined' },
    };

    // Rewire the save node to use the refined image
    workflow[ctx.imageOutputNodeId].inputs.images = [decode2Id, 0];
    updatedCtx.vaeDecodeNodeId = decode2Id;
  } else {
    // Just save the upscaled image directly
    workflow[ctx.imageOutputNodeId].inputs.images = [upscaleId, 0];
    updatedCtx.vaeDecodeNodeId = upscaleId;
  }

  updatedCtx.imageOutputNodeId = ctx.imageOutputNodeId;
  return updatedCtx;
}

// ─── Refiner ───

/**
 * Add SDXL refiner support. Modifies the base sampler to stop early (at switchAt %),
 * loads the refiner checkpoint, and runs a second sampler pass on the remaining steps.
 */
export function addRefinerNodes(
  workflow: ComfyUIWorkflow,
  ctx: WorkflowContext,
  refiner: RefinerSpec,
  spec: ShotSpec,
): WorkflowContext {
  let updatedCtx = { ...ctx };
  const switchAt = refiner.switchAt ?? 0.8;
  const totalSteps = spec.generation?.steps ?? 30;

  // Modify base sampler to stop early
  workflow[ctx.samplerNodeId].inputs.steps = Math.round(totalSteps * switchAt);

  // Load refiner checkpoint
  const refinerCheckpointId = String(updatedCtx.nextId++);
  workflow[refinerCheckpointId] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: refiner.model ?? 'sd_xl_refiner_1.0.safetensors' },
    _meta: { title: 'Load Refiner' },
  };

  // Refiner positive prompt — reuse the same text as the base
  const refinerPosId = String(updatedCtx.nextId++);
  workflow[refinerPosId] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: (workflow[ctx.positiveCondNodeId].inputs.text as string) ?? '',
      clip: [refinerCheckpointId, 1],
    },
    _meta: { title: 'Refiner Positive' },
  };

  // Refiner negative prompt
  const refinerNegId = String(updatedCtx.nextId++);
  workflow[refinerNegId] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: (workflow[ctx.negativeCondNodeId].inputs.text as string) ?? '',
      clip: [refinerCheckpointId, 1],
    },
    _meta: { title: 'Refiner Negative' },
  };

  // Refiner KSampler — picks up the latent from the base sampler
  const refinerSamplerId = String(updatedCtx.nextId++);
  const remainingSteps = Math.round(totalSteps * (1 - switchAt));
  workflow[refinerSamplerId] = {
    class_type: 'KSampler',
    inputs: {
      model: [refinerCheckpointId, 0],
      positive: [refinerPosId, 0],
      negative: [refinerNegId, 0],
      latent_image: [ctx.samplerNodeId, 0], // Take latent from base sampler
      seed: (ctx.resolvedSeed ?? 0) + 2,
      steps: remainingSteps,
      cfg: spec.generation?.cfg ?? 7,
      sampler_name: spec.generation?.sampler ?? 'dpmpp_2m',
      scheduler: spec.generation?.scheduler ?? 'karras',
      denoise: 1.0,
    },
    _meta: { title: 'Refiner Sampler' },
  };

  // Rewire VAE decode to use refiner output and refiner's VAE
  workflow[ctx.vaeDecodeNodeId].inputs.samples = [refinerSamplerId, 0];
  workflow[ctx.vaeDecodeNodeId].inputs.vae = [refinerCheckpointId, 2];

  updatedCtx.samplerNodeId = refinerSamplerId;
  updatedCtx.vaeNodeId = refinerCheckpointId;
  return updatedCtx;
}

// ─── Repair Workflow Builder ───

/**
 * Build a repair/inpainting workflow from a RepairSpec.
 *
 * Three repair modes:
 *   - inpaint: Load source + mask → SetLatentNoiseMask → low-denoise KSampler
 *   - face-fix: Load source → auto face-detect mask → inpaint pass
 *   - lighting-harmonize: Load source + reference → color-match → low-denoise pass
 *
 * Returns a standalone workflow (not composed onto an existing base).
 */
export function composeRepairWorkflow(
  repair: RepairSpec,
  model?: string,
  prompt?: string,
  negativePrompt?: string,
): ComfyUIWorkflow {
  const workflow: ComfyUIWorkflow = {};
  let nextId = 1;

  const positiveText = repair.repairPrompt ?? prompt ?? 'high quality, detailed, sharp';
  const negativeText = negativePrompt ?? 'worst quality, low quality, blurry, deformed';
  const denoise = repair.denoise ?? (repair.type === 'lighting-harmonize' ? 0.25 : 0.45);

  // Node: Load checkpoint
  const checkpointId = String(nextId++);
  workflow[checkpointId] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: model ?? 'sd_xl_base_1.0.safetensors' },
    _meta: { title: 'Load Checkpoint' },
  };

  // Node: Positive prompt
  const posPromptId = String(nextId++);
  workflow[posPromptId] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: positiveText, clip: [checkpointId, 1] },
    _meta: { title: 'Repair Positive Prompt' },
  };

  // Node: Negative prompt
  const negPromptId = String(nextId++);
  workflow[negPromptId] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: negativeText, clip: [checkpointId, 1] },
    _meta: { title: 'Repair Negative Prompt' },
  };

  // Node: Load source image
  const sourceImageId = String(nextId++);
  workflow[sourceImageId] = {
    class_type: 'LoadImage',
    inputs: { image: repair.sourceImage },
    _meta: { title: 'Source Image' },
  };

  // Node: VAE encode source image to latent
  const vaeEncodeId = String(nextId++);
  workflow[vaeEncodeId] = {
    class_type: 'VAEEncode',
    inputs: {
      pixels: [sourceImageId, 0],
      vae: [checkpointId, 2],
    },
    _meta: { title: 'Encode Source to Latent' },
  };

  let latentInputId = vaeEncodeId;

  if (repair.type === 'inpaint' || repair.type === 'face-fix') {
    // Load or generate mask
    let maskNodeId: string;

    if (repair.type === 'face-fix' || repair.autoFaceMask) {
      // Auto-detect face region as mask
      const faceDetectId = String(nextId++);
      workflow[faceDetectId] = {
        class_type: 'FaceDetectorCropAndPaste',
        inputs: {
          image: [sourceImageId, 0],
          threshold: 0.5,
          dilation: 30,
        },
        _meta: { title: 'Auto Face Mask' },
      };
      // Use a simpler approach — generate mask from face area
      const maskFromFaceId = String(nextId++);
      workflow[maskFromFaceId] = {
        class_type: 'ImageToMask',
        inputs: {
          image: [faceDetectId, 1], // mask output
          channel: 'red',
        },
        _meta: { title: 'Face Region Mask' },
      };
      maskNodeId = maskFromFaceId;
    } else if (repair.maskImage) {
      // Load explicit mask image
      const maskLoadId = String(nextId++);
      workflow[maskLoadId] = {
        class_type: 'LoadImage',
        inputs: { image: repair.maskImage },
        _meta: { title: 'Mask Image' },
      };
      const maskConvertId = String(nextId++);
      workflow[maskConvertId] = {
        class_type: 'ImageToMask',
        inputs: {
          image: [maskLoadId, 0],
          channel: 'red',
        },
        _meta: { title: 'Convert Mask' },
      };
      maskNodeId = maskConvertId;
    } else {
      // Fallback: full image pass (no mask)
      maskNodeId = '';
    }

    // Apply mask to latent for inpainting
    if (maskNodeId) {
      const setMaskId = String(nextId++);
      workflow[setMaskId] = {
        class_type: 'SetLatentNoiseMask',
        inputs: {
          samples: [vaeEncodeId, 0],
          mask: [maskNodeId, 0],
        },
        _meta: { title: 'Apply Inpaint Mask' },
      };
      latentInputId = setMaskId;
    }
  } else if (repair.type === 'lighting-harmonize' && repair.lightingRef) {
    // Load reference image for color matching
    const refImageId = String(nextId++);
    workflow[refImageId] = {
      class_type: 'LoadImage',
      inputs: { image: repair.lightingRef },
      _meta: { title: 'Lighting Reference' },
    };

    // Color match source to reference
    const colorMatchId = String(nextId++);
    workflow[colorMatchId] = {
      class_type: 'ColorMatch',
      inputs: {
        image: [sourceImageId, 0],
        reference: [refImageId, 0],
        method: 'mkl',
      },
      _meta: { title: 'Color Match to Reference' },
    };

    // Re-encode color-matched image
    const reEncodeId = String(nextId++);
    workflow[reEncodeId] = {
      class_type: 'VAEEncode',
      inputs: {
        pixels: [colorMatchId, 0],
        vae: [checkpointId, 2],
      },
      _meta: { title: 'Encode Color-Matched Latent' },
    };
    latentInputId = reEncodeId;
  }

  // KSampler — low-denoise pass for repair
  const samplerId = String(nextId++);
  workflow[samplerId] = {
    class_type: 'KSampler',
    inputs: {
      model: [checkpointId, 0],
      positive: [posPromptId, 0],
      negative: [negPromptId, 0],
      latent_image: [latentInputId, 0],
      seed: Math.floor(Math.random() * 2147483647),
      steps: 25,
      cfg: 7,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise,
    },
    _meta: { title: 'Repair Sampler' },
  };

  // VAE decode
  const decodeId = String(nextId++);
  workflow[decodeId] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: [samplerId, 0],
      vae: [checkpointId, 2],
    },
    _meta: { title: 'Decode Repaired' },
  };

  // Save image
  const saveId = String(nextId++);
  workflow[saveId] = {
    class_type: 'SaveImage',
    inputs: {
      images: [decodeId, 0],
      filename_prefix: 'airevstream_repair',
    },
    _meta: { title: 'Save Repaired Image' },
  };

  return workflow;
}

// ─── Main Composer (Public API) ───

/**
 * Compose a complete ComfyUI API-format workflow from a ShotSpec.
 *
 * Composition order:
 *   1. Base workflow (checkpoint, prompts, sampler, VAE decode, save)
 *   2. LoRA chain (rewires model + CLIP)
 *   3. ControlNet stack (rewires positive conditioning)
 *   4. Refiner (splits sampling into base + refiner passes)
 *   5. Upscale (model upscale + optional refinement pass)
 *
 * Returns the workflow JSON with an attached `resolvedSeed` for tracking.
 */
export function composeWorkflow(
  spec: ShotSpec,
  bible?: PromptBible,
  seedCtx?: SeedContext,
): ComfyUIWorkflow & { resolvedSeed?: number } {
  const { workflow, ctx } = buildBaseWorkflow(spec, bible, seedCtx);
  let currentCtx = ctx;

  // Add first frame anchoring if specified (before LoRA/ControlNet)
  if (spec.firstFrameRef) {
    currentCtx = addFirstFrameNodes(workflow, currentCtx, spec.firstFrameRef, spec);
  }

  // Add LoRA chain if specified
  if (spec.generation?.loras?.length) {
    currentCtx = addLoraNodes(workflow, currentCtx, spec.generation.loras);
  }

  // Add ControlNet stack if specified
  if (spec.generation?.controlNets?.length) {
    currentCtx = addControlNetNodes(workflow, currentCtx, spec.generation.controlNets);
  }

  // Add refiner if specified (before upscale)
  if (spec.generation?.refiner) {
    currentCtx = addRefinerNodes(workflow, currentCtx, spec.generation.refiner, spec);
  }

  // Add upscale chain if specified
  if (spec.generation?.upscale) {
    currentCtx = addUpscaleNodes(workflow, currentCtx, spec.generation.upscale, spec);
  }

  // Attach resolved seed for tracking
  const result = workflow as ComfyUIWorkflow & { resolvedSeed?: number };
  result.resolvedSeed = currentCtx.resolvedSeed;
  return result;
}

// ─── Preset Workflow Loader (backward compat) ───

export type PresetWorkflowName =
  | 'storyboard-frame'
  | 'avatar-generation'
  | 'scenery-generation'
  | 'thumbnail-generation';

/**
 * Get default ShotSpec values for a named preset.
 * These mirror the settings baked into the static JSON templates
 * in `comfyui-workflows/`, providing backward compatibility.
 */
export function getPresetDefaults(preset: PresetWorkflowName): Partial<ShotSpec> {
  switch (preset) {
    case 'storyboard-frame':
      return {
        generation: {
          steps: 25,
          cfg: 7,
          width: 1024,
          height: 576,
          sampler: 'dpmpp_2m',
          scheduler: 'karras',
        },
        aspect: '16:9',
      };
    case 'avatar-generation':
      return {
        generation: {
          steps: 30,
          cfg: 7.5,
          width: 512,
          height: 512,
          sampler: 'euler_ancestral',
          scheduler: 'normal',
        },
        aspect: '1:1',
      };
    case 'scenery-generation':
      return {
        generation: {
          steps: 35,
          cfg: 8,
          width: 1024,
          height: 576,
          sampler: 'dpmpp_sde',
          scheduler: 'karras',
        },
        aspect: '16:9',
      };
    case 'thumbnail-generation':
      return {
        generation: {
          steps: 25,
          cfg: 7,
          width: 1280,
          height: 720,
          sampler: 'dpmpp_2m',
          scheduler: 'karras',
        },
        aspect: '16:9',
      };
  }
}
