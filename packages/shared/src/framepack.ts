/**
 * FramePack Video Generation Workflow Builder
 *
 * Builds ComfyUI API-format workflows for the FramePack image-to-video model.
 * FramePack takes a single keyframe image + text prompt and generates a
 * short video clip (up to 120 seconds) with real motion.
 *
 * Model: FramePackI2V_HY (based on HunyuanVideo architecture)
 * Wrapper: kijai/ComfyUI-FramePackWrapper
 * Output: Video frames → VHS_VideoCombine → MP4
 */

import type { ComfyUIWorkflow } from './comfyui-composer.js';
import { createLogger } from './logger.js';

const logger = createLogger('framepack');

/** Parameters for FramePack video generation */
export interface FramePackParams {
  /** Path/filename of the keyframe image (must be in ComfyUI input directory or uploaded) */
  keyframeImage: string;
  /** Positive prompt describing the desired motion */
  positivePrompt: string;
  /** Negative prompt (optional, defaults to zeroed conditioning) */
  negativePrompt?: string;
  /** Duration of generated video in seconds (0.1 - 120, default 2.0) */
  durationSeconds: number;
  /** Random seed */
  seed: number;
  /** Number of sampling steps (default 25) */
  steps?: number;
  /** CFG scale (default 1.0 — FramePack uses low CFG with high guidance) */
  cfg?: number;
  /** Guidance scale (default 10.0) */
  guidanceScale?: number;
  /** Latent window size (default 9, controls temporal coherence) */
  latentWindowSize?: number;
  /** GPU memory preservation in GB (default 6.0) */
  gpuMemoryPreservation?: number;
  /** Use TeaCache for faster sampling (default true) */
  useTeaCache?: boolean;
  /** TeaCache L1 threshold (default 0.15) */
  teaCacheThreshold?: number;
  /** Base resolution for the image (default 640) */
  baseResolution?: number;
  /** Sampler name (default "unipc_bh1") */
  sampler?: string;
  /** Model filename in diffusion_models/ (default FramePackI2V_HY_fp8_e4m3fn.safetensors) */
  modelFile?: string;
  /** VAE path (default hyvid/hunyuan_video_vae_bf16.safetensors) */
  vaeFile?: string;
  /** CLIP text encoders: [clip_l, llava_llama3] */
  clipLFile?: string;
  clipLlamaFile?: string;
  /** SigCLIP vision model filename */
  sigclipFile?: string;
  /** Output filename prefix */
  filenamePrefix?: string;
  /** Output frame rate (default 30) */
  frameRate?: number;
  /** Output video format (default video/h264-mp4) */
  videoFormat?: string;
  /** CRF quality (default 20, lower = higher quality) */
  crf?: number;
}

/**
 * Build a ComfyUI API-format workflow for FramePack image-to-video generation.
 *
 * Node graph:
 *   1. LoadFramePackModel → FramePackMODEL
 *   2. DualCLIPLoader → CLIP (clip_l + llava_llama3)
 *   3. VAELoader → VAE (HunyuanVideo VAE)
 *   4. CLIPVisionLoader → CLIP_VISION (sigclip)
 *   5. LoadImage → IMAGE (keyframe)
 *   6. FramePackFindNearestBucket → width, height
 *   7. VAEEncode(image, vae) → LATENT (start_latent)
 *   8. CLIPVisionEncode(clip_vision, image) → CLIP_VISION_OUTPUT
 *   9. CLIPTextEncode(positive, clip) → CONDITIONING
 *  10. ConditioningZeroOut(conditioning) → CONDITIONING (negative)
 *  11. FramePackSampler(model, positive, negative, start_latent, image_embeds) → LATENT (video)
 *  12. VAEDecode(latent, vae) → IMAGE (frames batch)
 *  13. VHS_VideoCombine(images, frame_rate) → video file
 */
export function composeFramePackWorkflow(params: FramePackParams): ComfyUIWorkflow {
  const {
    keyframeImage,
    positivePrompt,
    durationSeconds,
    seed,
    steps = 25,
    cfg = 1.0,
    guidanceScale = 10.0,
    latentWindowSize = 9,
    gpuMemoryPreservation = 6.0,
    useTeaCache = true,
    teaCacheThreshold = 0.15,
    baseResolution = 640,
    sampler = 'unipc_bh1',
    modelFile = 'FramePackI2V_HY_fp8_e4m3fn.safetensors',
    vaeFile = 'hyvid/hunyuan_video_vae_bf16.safetensors',
    clipLFile = 'clip_l.safetensors',
    clipLlamaFile = 'llava_llama3_fp16.safetensors',
    sigclipFile = 'sigclip_vision_patch14_384.safetensors',
    filenamePrefix = 'airevstream_framepack',
    frameRate = 30,
    videoFormat = 'video/h264-mp4',
    crf = 20,
  } = params;

  const workflow: ComfyUIWorkflow = {};

  // Node 1: LoadFramePackModel
  workflow['1'] = {
    class_type: 'LoadFramePackModel',
    inputs: {
      model: modelFile,
      base_precision: 'bf16',
      quantization: 'disabled',
      load_device: 'main_device',
      attention_mode: 'sdpa',
    },
    _meta: { title: 'Load FramePack Model' },
  };

  // Node 2: DualCLIPLoader (clip_l + llava_llama3 for HunyuanVideo)
  workflow['2'] = {
    class_type: 'DualCLIPLoader',
    inputs: {
      clip_name1: clipLFile,
      clip_name2: clipLlamaFile,
      type: 'hunyuan_video',
      device: 'default',
    },
    _meta: { title: 'Dual CLIP Loader' },
  };

  // Node 3: VAELoader (HunyuanVideo VAE)
  workflow['3'] = {
    class_type: 'VAELoader',
    inputs: {
      vae_name: vaeFile,
    },
    _meta: { title: 'Load HunyuanVideo VAE' },
  };

  // Node 4: CLIPVisionLoader (sigclip)
  workflow['4'] = {
    class_type: 'CLIPVisionLoader',
    inputs: {
      clip_name: sigclipFile,
    },
    _meta: { title: 'Load SigCLIP' },
  };

  // Node 5: LoadImage (keyframe)
  workflow['5'] = {
    class_type: 'LoadImage',
    inputs: {
      image: keyframeImage,
    },
    _meta: { title: 'Keyframe Image' },
  };

  // Node 6: FramePackFindNearestBucket
  workflow['6'] = {
    class_type: 'FramePackFindNearestBucket',
    inputs: {
      image: ['5', 0],
      base_resolution: baseResolution,
    },
    _meta: { title: 'Find Nearest Bucket' },
  };

  // Node 7: VAEEncode (encode keyframe to latent as start_latent)
  workflow['7'] = {
    class_type: 'VAEEncode',
    inputs: {
      pixels: ['5', 0],
      vae: ['3', 0],
    },
    _meta: { title: 'VAE Encode Keyframe' },
  };

  // Node 8: CLIPVisionEncode (encode image for image embeddings)
  workflow['8'] = {
    class_type: 'CLIPVisionEncode',
    inputs: {
      clip_vision: ['4', 0],
      image: ['5', 0],
      crop: 'center',
    },
    _meta: { title: 'CLIP Vision Encode' },
  };

  // Node 9: CLIPTextEncode (positive prompt)
  workflow['9'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: positivePrompt,
      clip: ['2', 0],
    },
    _meta: { title: 'Positive Prompt' },
  };

  // Node 10: ConditioningZeroOut (negative = zeroed positive)
  workflow['10'] = {
    class_type: 'ConditioningZeroOut',
    inputs: {
      conditioning: ['9', 0],
    },
    _meta: { title: 'Negative (Zeroed)' },
  };

  // Node 11: FramePackSampler (the main video generation node)
  workflow['11'] = {
    class_type: 'FramePackSampler',
    inputs: {
      model: ['1', 0],
      positive: ['9', 0],
      negative: ['10', 0],
      start_latent: ['7', 0],
      image_embeds: ['8', 0],
      steps,
      use_teacache: useTeaCache,
      teacache_rel_l1_thresh: teaCacheThreshold,
      cfg,
      guidance_scale: guidanceScale,
      shift: 0.0,
      seed,
      latent_window_size: latentWindowSize,
      total_second_length: durationSeconds,
      gpu_memory_preservation: gpuMemoryPreservation,
      sampler,
    },
    _meta: { title: 'FramePack Sampler' },
  };

  // Node 12: VAEDecode (decode video latents to frame batch)
  workflow['12'] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['11', 0],
      vae: ['3', 0],
    },
    _meta: { title: 'VAE Decode Video' },
  };

  // Node 13: VHS_VideoCombine (combine frames into MP4 video)
  workflow['13'] = {
    class_type: 'VHS_VideoCombine',
    inputs: {
      images: ['12', 0],
      frame_rate: frameRate,
      loop_count: 0,
      filename_prefix: filenamePrefix,
      format: videoFormat,
      pix_fmt: 'yuv420p',
      crf,
      save_output: true,
      pingpong: false,
    },
    _meta: { title: 'Save Video (MP4)' },
  };

  logger.info(
    { keyframeImage, durationSeconds, seed, steps, modelFile },
    'Composed FramePack video workflow',
  );

  return workflow;
}

/** Default FramePack parameters optimized for AIRevStream shot generation */
export const FRAMEPACK_DEFAULTS: Partial<FramePackParams> = {
  steps: 25,
  cfg: 1.0,
  guidanceScale: 10.0,
  latentWindowSize: 9,
  gpuMemoryPreservation: 6.0,
  useTeaCache: true,
  teaCacheThreshold: 0.15,
  baseResolution: 640,
  sampler: 'unipc_bh1',
  modelFile: 'FramePackI2V_HY_fp8_e4m3fn.safetensors',
  vaeFile: 'hyvid/hunyuan_video_vae_bf16.safetensors',
  clipLFile: 'clip_l.safetensors',
  clipLlamaFile: 'llava_llama3_fp16.safetensors',
  sigclipFile: 'sigclip_vision_patch14_384.safetensors',
  frameRate: 30,
  videoFormat: 'video/h264-mp4',
  crf: 20,
};

/**
 * Build a FramePack workflow from a shot's prompt and keyframe.
 * Convenience wrapper that merges defaults with shot-specific params.
 */
export function composeFramePackForShot(
  keyframeImage: string,
  positivePrompt: string,
  seed: number,
  durationSeconds: number = 2.0,
  overrides?: Partial<FramePackParams>,
): ComfyUIWorkflow {
  return composeFramePackWorkflow({
    keyframeImage,
    positivePrompt,
    seed,
    durationSeconds,
    ...FRAMEPACK_DEFAULTS,
    ...overrides,
    filenamePrefix: `airevstream_shot_${seed}`,
  });
}