/**
 * Workflow Registry — metadata catalog for ComfyUI workflow templates.
 *
 * Maps shot classes to workflow templates, providing a lookup layer
 * between the Director agent's shot classification and the actual
 * ComfyUI workflow JSON files used for generation.
 */

import type { ConstraintViolation } from './constraint-validator.js';
import type { ShotSpec } from './types.js';

// ─── Types ───

export type QualityTier = 'draft' | 'standard' | 'cinema';

export interface TierDefaults {
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  width?: number;
  height?: number;
  denoise?: number;
}

export interface WorkflowMetadata {
  /** Unique workflow ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver version */
  version: string;
  /** What this workflow is for */
  useCase: string;
  /** Which provider this workflow targets */
  provider: 'comfyui';
  /** Shot classes this workflow is suitable for */
  shotClasses: string[];
  /** Which ShotSpec fields can be overridden in this workflow */
  allowedOverrides: string[];
  /** Quality tiers this workflow supports */
  qualityTiers?: QualityTier[];
  /** Continuity tier capability */
  continuityTier?: 'none' | 'standard' | 'strong';
  /** Generation defaults per quality tier */
  tierDefaults?: Record<string, TierDefaults>;
  /** Output format specification */
  outputFormat?: { type: 'image' | 'video' | 'image+video'; formats: string[] };
  /** Estimated generation time in seconds per tier */
  estimatedTimeSec?: Record<string, number>;
  /** Fields required in ShotSpec for this workflow */
  requiredFields?: string[];
  /** Whether this workflow supports frame anchoring for continuity */
  supportsFrameAnchoring?: boolean;
  /** Searchable tags */
  tags?: string[];
}

// ─── Shot Classes ───

/**
 * Standard shot classes used by the Director agent to classify shots.
 * Each class maps to a specific workflow template with appropriate defaults.
 */
export const SHOT_CLASSES = [
  'Dialogue_Closeup',
  'Establishing_Wide',
  'Insert_Hands',
  'Action_Tracking',
  'Reaction_Medium',
  'Montage_Quick',
  'Reveal_Dolly',
  'POV_Handheld',
  'Macro_Insert',
  'Dutch_Angle',
  'Crane_Reveal',
] as const;

export type ShotClass = (typeof SHOT_CLASSES)[number];

// ─── Workflow Registry ───

/**
 * Metadata for all registered workflow templates.
 * References JSON files in the `comfyui-workflows/` directory.
 */
export const WORKFLOW_REGISTRY: WorkflowMetadata[] = [
  {
    id: 'storyboard-frame',
    name: 'Storyboard Frame',
    version: '1.0.0',
    useCase: 'General-purpose storyboard keyframe generation',
    provider: 'comfyui',
    shotClasses: ['Establishing_Wide', 'Montage_Quick'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler'],
    qualityTiers: ['draft', 'standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      draft: { steps: 15, cfg: 6, sampler: 'euler_ancestral', width: 768, height: 768 },
      standard: { steps: 25, cfg: 7, sampler: 'dpmpp_2m', width: 1024, height: 1024 },
      cinema: { steps: 40, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1344, height: 768 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { draft: 8, standard: 18, cinema: 40 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: true,
    tags: ['general', 'storyboard', 'keyframe'],
  },
  {
    id: 'avatar-generation',
    name: 'Avatar Generation',
    version: '1.0.0',
    useCase: 'Character avatar and portrait generation',
    provider: 'comfyui',
    shotClasses: ['Dialogue_Closeup', 'Reaction_Medium'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler'],
    qualityTiers: ['draft', 'standard', 'cinema'],
    continuityTier: 'strong',
    tierDefaults: {
      draft: { steps: 15, cfg: 6, sampler: 'euler_ancestral', width: 768, height: 1024 },
      standard: { steps: 28, cfg: 7.5, sampler: 'dpmpp_2m', width: 896, height: 1152 },
      cinema: { steps: 45, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1024, height: 1344 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { draft: 10, standard: 22, cinema: 50 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: true,
    tags: ['character', 'portrait', 'avatar', 'face'],
  },
  {
    id: 'scenery-generation',
    name: 'Scenery Generation',
    version: '1.0.0',
    useCase: 'Wide-angle environment and scenery generation',
    provider: 'comfyui',
    shotClasses: ['Establishing_Wide', 'Reveal_Dolly'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler', 'generation.scheduler'],
    qualityTiers: ['draft', 'standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      draft: { steps: 15, cfg: 6, sampler: 'euler_ancestral', width: 1024, height: 576 },
      standard: { steps: 25, cfg: 7, sampler: 'dpmpp_2m', width: 1344, height: 768 },
      cinema: { steps: 40, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1536, height: 896 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { draft: 10, standard: 20, cinema: 45 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: true,
    tags: ['scenery', 'environment', 'landscape', 'wide'],
  },
  {
    id: 'thumbnail-generation',
    name: 'Thumbnail Generation',
    version: '1.0.0',
    useCase: 'YouTube/social media thumbnail generation',
    provider: 'comfyui',
    shotClasses: [],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height'],
    qualityTiers: ['draft', 'standard'],
    continuityTier: 'none',
    tierDefaults: {
      draft: { steps: 15, cfg: 7, sampler: 'euler_ancestral', width: 1280, height: 720 },
      standard: { steps: 25, cfg: 7.5, sampler: 'dpmpp_2m', width: 1280, height: 720 },
    },
    outputFormat: { type: 'image', formats: ['png', 'jpg'] },
    estimatedTimeSec: { draft: 6, standard: 14 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: false,
    tags: ['thumbnail', 'social', 'still'],
  },
  // Shot-class-specific workflows
  {
    id: 'dialogue-closeup',
    name: 'Dialogue Close-up',
    version: '1.0.0',
    useCase: '85mm portrait with shallow DOF for dialogue scenes',
    provider: 'comfyui',
    shotClasses: ['Dialogue_Closeup'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler', 'generation.loras'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'strong',
    tierDefaults: {
      standard: { steps: 28, cfg: 7.5, sampler: 'dpmpp_2m', width: 896, height: 1152, denoise: 0.85 },
      cinema: { steps: 45, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1024, height: 1344, denoise: 0.9 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 24, cinema: 55 },
    requiredFields: ['promptBlocks', 'camera'],
    supportsFrameAnchoring: true,
    tags: ['dialogue', 'closeup', 'portrait', 'character'],
  },
  {
    id: 'establishing-wide',
    name: 'Establishing Wide',
    version: '1.0.0',
    useCase: '24mm wide angle with deep DOF for scene establishment',
    provider: 'comfyui',
    shotClasses: ['Establishing_Wide'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      standard: { steps: 25, cfg: 7, sampler: 'dpmpp_2m', width: 1344, height: 768 },
      cinema: { steps: 40, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1536, height: 896 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 20, cinema: 45 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: true,
    tags: ['establishing', 'wide', 'environment', 'opening'],
  },
  {
    id: 'insert-hands',
    name: 'Insert / Hands',
    version: '1.0.0',
    useCase: 'Macro extreme close-up for detail inserts',
    provider: 'comfyui',
    shotClasses: ['Insert_Hands'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      standard: { steps: 25, cfg: 7.5, sampler: 'dpmpp_2m', width: 1024, height: 1024 },
      cinema: { steps: 40, cfg: 8, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1344, height: 1344 },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 18, cinema: 40 },
    requiredFields: ['promptBlocks'],
    supportsFrameAnchoring: false,
    tags: ['insert', 'macro', 'detail', 'hands'],
  },
  {
    id: 'action-tracking',
    name: 'Action Tracking',
    version: '1.0.0',
    useCase: '35mm with motion blur hint for tracking shots',
    provider: 'comfyui',
    shotClasses: ['Action_Tracking'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      standard: { steps: 25, cfg: 7, sampler: 'dpmpp_2m', width: 1344, height: 768 },
      cinema: { steps: 40, cfg: 7.5, sampler: 'dpmpp_sde', scheduler: 'karras', width: 1536, height: 896 },
    },
    outputFormat: { type: 'image+video', formats: ['png', 'mp4'] },
    estimatedTimeSec: { standard: 22, cinema: 50 },
    requiredFields: ['promptBlocks', 'camera'],
    supportsFrameAnchoring: true,
    tags: ['action', 'tracking', 'motion', 'dynamic'],
  },
  // ── Macro Insert ──
  {
    id: 'macro-insert',
    name: 'Macro Insert',
    version: '1.0.0',
    useCase: 'Extreme close-up detail shots — product, texture, small objects',
    provider: 'comfyui',
    shotClasses: ['Macro_Insert'],
    allowedOverrides: ['steps', 'cfg', 'width', 'height', 'seed', 'prompt', 'negativePrompt'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'strong',
    tierDefaults: {
      standard: { steps: 30, cfg: 7.5, width: 1024, height: 1024, sampler: 'euler_ancestral' },
      cinema: { steps: 50, cfg: 8.0, width: 1536, height: 1536, sampler: 'dpmpp_2m_sde_karras' },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 35, cinema: 90 },
    requiredFields: ['prompt'],
    supportsFrameAnchoring: true,
    tags: ['character', 'detail', 'macro', 'product'],
  },
  // ── Dutch Angle ──
  {
    id: 'dutch-angle',
    name: 'Dutch Angle',
    version: '1.0.0',
    useCase: 'Tilted framing for psychological tension and unease',
    provider: 'comfyui',
    shotClasses: ['Dutch_Angle'],
    allowedOverrides: ['steps', 'cfg', 'width', 'height', 'seed', 'prompt', 'negativePrompt'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'standard',
    tierDefaults: {
      standard: { steps: 28, cfg: 7.0, width: 1344, height: 768, sampler: 'euler_ancestral' },
      cinema: { steps: 45, cfg: 7.5, width: 1536, height: 896, sampler: 'dpmpp_2m_sde_karras' },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 30, cinema: 75 },
    requiredFields: ['prompt'],
    supportsFrameAnchoring: false,
    tags: ['style', 'tension', 'psychological', 'dramatic'],
  },
  // ── Crane Reveal ──
  {
    id: 'crane-reveal',
    name: 'Crane Reveal',
    version: '1.0.0',
    useCase: 'High-angle descending to eye-level reveal for establishing shots',
    provider: 'comfyui',
    shotClasses: ['Crane_Reveal'],
    allowedOverrides: ['steps', 'cfg', 'width', 'height', 'seed', 'prompt', 'negativePrompt'],
    qualityTiers: ['standard', 'cinema'],
    continuityTier: 'strong',
    tierDefaults: {
      standard: { steps: 30, cfg: 7.0, width: 1344, height: 768, sampler: 'euler_ancestral' },
      cinema: { steps: 50, cfg: 7.5, width: 1920, height: 1080, sampler: 'dpmpp_2m_sde_karras' },
    },
    outputFormat: { type: 'image', formats: ['png'] },
    estimatedTimeSec: { standard: 35, cinema: 85 },
    requiredFields: ['prompt'],
    supportsFrameAnchoring: true,
    tags: ['environment', 'reveal', 'establishing', 'cinematic', 'crane'],
  },
];

/**
 * Find the best workflow template for a given shot class.
 * Returns the first workflow that lists the shot class in its shotClasses array.
 */
export function getWorkflowForShotClass(shotClass: string): WorkflowMetadata | undefined {
  return WORKFLOW_REGISTRY.find(w => w.shotClasses.includes(shotClass));
}

/**
 * Get all workflows for a given provider.
 */
export function getWorkflowsForProvider(provider: string): WorkflowMetadata[] {
  return WORKFLOW_REGISTRY.filter(w => w.provider === provider);
}

/**
 * Get a workflow for a shot class with quality tier defaults applied.
 * Returns the workflow metadata and the resolved generation defaults for the given tier.
 */
export function getWorkflowWithDefaults(
  shotClass: string,
  qualityTier: QualityTier,
): { workflow: WorkflowMetadata; defaults: TierDefaults } | undefined {
  const workflow = getWorkflowForShotClass(shotClass);
  if (!workflow) return undefined;

  // Check if workflow supports the requested tier
  if (workflow.qualityTiers && !workflow.qualityTiers.includes(qualityTier)) {
    // Fall back to the highest supported tier
    const fallbackTier = workflow.qualityTiers[workflow.qualityTiers.length - 1];
    if (!fallbackTier) return { workflow, defaults: {} };
    const defaults = workflow.tierDefaults?.[fallbackTier] ?? {};
    return { workflow, defaults };
  }

  const defaults = workflow.tierDefaults?.[qualityTier] ?? {};
  return { workflow, defaults };
}

/**
 * Validate that a ShotSpec meets the requirements of a workflow.
 * Returns an array of constraint violations (empty if valid).
 */
export function validateWorkflowRequirements(
  spec: Partial<ShotSpec>,
  workflow: WorkflowMetadata,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (!workflow.requiredFields) return violations;

  for (const field of workflow.requiredFields) {
    const value = getNestedValue(spec, field);
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      violations.push({
        field,
        message: `Workflow "${workflow.name}" requires field "${field}"`,
        severity: 'error',
      });
    }
  }

  return violations;
}

/**
 * Find workflows that match all of the given tags.
 */
export function getWorkflowsByTags(tags: string[]): WorkflowMetadata[] {
  if (tags.length === 0) return [...WORKFLOW_REGISTRY];
  return WORKFLOW_REGISTRY.filter(w =>
    tags.every(tag => w.tags?.includes(tag)),
  );
}

// ─── Helpers ───

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
