/**
 * Workflow Registry — metadata catalog for ComfyUI workflow templates.
 *
 * Maps shot classes to workflow templates, providing a lookup layer
 * between the Director agent's shot classification and the actual
 * ComfyUI workflow JSON files used for generation.
 */

// ─── Types ───

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
  },
  {
    id: 'avatar-generation',
    name: 'Avatar Generation',
    version: '1.0.0',
    useCase: 'Character avatar and portrait generation',
    provider: 'comfyui',
    shotClasses: ['Dialogue_Closeup', 'Reaction_Medium'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler'],
  },
  {
    id: 'scenery-generation',
    name: 'Scenery Generation',
    version: '1.0.0',
    useCase: 'Wide-angle environment and scenery generation',
    provider: 'comfyui',
    shotClasses: ['Establishing_Wide', 'Reveal_Dolly'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler', 'generation.scheduler'],
  },
  {
    id: 'thumbnail-generation',
    name: 'Thumbnail Generation',
    version: '1.0.0',
    useCase: 'YouTube/social media thumbnail generation',
    provider: 'comfyui',
    shotClasses: [],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height'],
  },
  // Shot-class-specific workflows (to be added in B4)
  {
    id: 'dialogue-closeup',
    name: 'Dialogue Close-up',
    version: '1.0.0',
    useCase: '85mm portrait with shallow DOF for dialogue scenes',
    provider: 'comfyui',
    shotClasses: ['Dialogue_Closeup'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler', 'generation.loras'],
  },
  {
    id: 'establishing-wide',
    name: 'Establishing Wide',
    version: '1.0.0',
    useCase: '24mm wide angle with deep DOF for scene establishment',
    provider: 'comfyui',
    shotClasses: ['Establishing_Wide'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler'],
  },
  {
    id: 'insert-hands',
    name: 'Insert / Hands',
    version: '1.0.0',
    useCase: 'Macro extreme close-up for detail inserts',
    provider: 'comfyui',
    shotClasses: ['Insert_Hands'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.sampler'],
  },
  {
    id: 'action-tracking',
    name: 'Action Tracking',
    version: '1.0.0',
    useCase: '35mm with motion blur hint for tracking shots',
    provider: 'comfyui',
    shotClasses: ['Action_Tracking'],
    allowedOverrides: ['generation.steps', 'generation.cfg', 'generation.width', 'generation.height', 'generation.sampler'],
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
