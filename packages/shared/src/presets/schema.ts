/**
 * Preset Schema — Zod schemas for pipeline presets.
 *
 * A preset is a named set of defaults that can be applied to a ShotSpec.
 * Presets are organized into families (visual, camera, audio, edit, output).
 */

import { z } from 'zod';

export const PresetFamilySchema = z.enum([
  'visual',
  'camera',
  'audio',
  'edit',
  'output',
  'project',
  'story',
  'dialogue',
  'continuity',
  'character',
]);
export type PresetFamily = z.infer<typeof PresetFamilySchema>;

export const PresetSchema = z.object({
  /** Semver-style ID, e.g. "visual.film-noir.v1" */
  id: z.string(),
  name: z.string(),
  family: PresetFamilySchema,
  description: z.string().optional(),
  /** Tags for search/filter */
  tags: z.array(z.string()).default([]),
  /** Whether this is a built-in (non-deletable) preset */
  builtIn: z.boolean().default(false),
  /** Partial ShotSpec overrides that this preset applies */
  overrides: z.record(z.unknown()),
  /** Complexity tier visibility — which modes can see this preset */
  tier: z.enum(['simple', 'advanced', 'complex']).optional(),
  /** Constrained ranges for numeric overrides */
  ranges: z.record(z.object({ min: z.number(), max: z.number() })).optional(),
  /** Semver version for preset data format tracking */
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});

export type Preset = z.infer<typeof PresetSchema>;

// ─── Production Directives ───

export const PacingSchema = z.enum(['slow', 'moderate', 'fast', 'frenetic']);
export const DialogueDensitySchema = z.enum(['none', 'sparse', 'moderate', 'dense']);
export const LensPackageSchema = z.enum(['wide-only', 'standard-mix', 'portrait-heavy', 'anamorphic']);
export const NarrativeStructureSchema = z.enum(['hicc', 'three-act', 'hook-loop', 'montage', 'setup-twist', 'educational']);

export const ProductionDirectivesSchema = z.object({
  targetShotCount: z.number().int().min(1).max(30).optional(),
  avgShotLengthSec: z.number().min(1).max(30).optional(),
  pacing: PacingSchema.optional(),
  dialogueDensity: DialogueDensitySchema.optional(),
  lensPackage: LensPackageSchema.optional(),
  narrativeStructure: NarrativeStructureSchema.optional(),
  seedPolicy: z.enum(['free', 'shot-offset', 'scene-lock', 'series-lock']).optional(),
}).strict();

export type ProductionDirectives = z.infer<typeof ProductionDirectivesSchema>;

// ─── Engine Routing ───

export const EngineRoutingSchema = z.object({
  keyframeEngine: z.enum(['comfyui', 'veo', 'sora', 'runway', 'kling']).optional(),
  motionEngine: z.enum(['comfyui', 'veo', 'sora', 'runway', 'kling']).optional(),
  assemblyEngine: z.enum(['remotion', 'ffmpeg']).optional(),
}).strict();

export type EngineRouting = z.infer<typeof EngineRoutingSchema>;

// ─── Recipe Constraints ───

export const RecipeConstraintsSchema = z.object({
  maxRuntimeSeconds: z.number().int().min(1).optional(),
  maxCostUsd: z.number().min(0).optional(),
  allowedAspects: z.array(z.string()).optional(),
  allowedFps: z.array(z.number()).optional(),
}).strict();

export type RecipeConstraints = z.infer<typeof RecipeConstraintsSchema>;

// ─── Continuity Lock Levels ───

export const ContinuityLockLevelSchema = z.enum(['off', 'standard', 'strong']);
export type ContinuityLockLevel = z.infer<typeof ContinuityLockLevelSchema>;

export const ContinuityLocksSchema = z.object({
  characterLock: ContinuityLockLevelSchema.optional(),
  wardrobeLock: ContinuityLockLevelSchema.optional(),
  environmentLock: ContinuityLockLevelSchema.optional(),
}).strict();

export type ContinuityLocks = z.infer<typeof ContinuityLocksSchema>;

// ─── Recipe Categories ───

export const RecipeCategorySchema = z.enum(['one-off', 'series', 'shorts', 'cinematic']);
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;

/**
 * A Recipe is a collection of presets from different families
 * that together define a complete look/feel.
 */
export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  builtIn: z.boolean().default(false),
  /** Preset IDs from each family */
  presetIds: z.array(z.string()),
  /** Category for master bundle grouping */
  category: RecipeCategorySchema.optional(),
  /** Mood label displayed in intake UI */
  mood: z.string().optional(),
  /** Complexity tier visibility */
  tier: z.enum(['simple', 'advanced', 'complex']).optional(),
  /** Production directives for agent pipeline */
  directives: ProductionDirectivesSchema.optional(),
  /** Engine routing — which engines this recipe uses */
  routing: EngineRoutingSchema.optional(),
  /** Budget and format constraints */
  constraints: RecipeConstraintsSchema.optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;
