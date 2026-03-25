export {
  PresetSchema,
  RecipeSchema,
  PresetFamilySchema,
  ProductionDirectivesSchema,
  RecipeCategorySchema,
  PacingSchema,
  DialogueDensitySchema,
  LensPackageSchema,
  NarrativeStructureSchema,
  EngineRoutingSchema,
  RecipeConstraintsSchema,
  ContinuityLockLevelSchema,
  ContinuityLocksSchema,
} from './schema.js';
export type {
  Preset,
  Recipe,
  PresetFamily,
  ProductionDirectives,
  RecipeCategory,
  EngineRouting,
  RecipeConstraints,
} from './schema.js';

export {
  ALL_BUILT_IN_PRESETS,
  VISUAL_PRESETS,
  CAMERA_PRESETS,
  AUDIO_PRESETS,
  OUTPUT_PRESETS,
  PROJECT_PRESETS,
  CHARACTER_PRESETS,
  STORY_PRESETS,
  DIALOGUE_PRESETS,
  CONTINUITY_PRESETS,
  EDIT_PRESETS,
  BUILT_IN_RECIPES,
  LEGACY_RECIPES,
  MASTER_BUNDLES,
} from './built-in.js';

export { REVISION_PRESETS } from './revisions.js';
export type { RevisionPreset } from './revisions.js';

export { resolvePresets, getActiveRanges, resolvePresetsWithDirectives, resolveAndValidate, resolveWithStickyOverrides, generatePresetDiff } from './resolver.js';
export type { ResolveOptions, ResolveWithDirectivesResult, ResolveValidationResult, StickyFields, PresetDiffEntry } from './resolver.js';

export {
  FAMILY_OVERRIDE_KEYS,
  PRESET_GENERATION_SYSTEM_PROMPT,
  generatePresetId,
  validateAndNormalizeAiPreset,
} from './ai-generation.js';
