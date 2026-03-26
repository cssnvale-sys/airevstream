/**
 * Preset Resolver — merges presets into a ShotSpec using deterministic precedence.
 *
 * Resolution order (highest priority last):
 *   1. System defaults (from constants.ts DEFAULT_GENERATION)
 *   2. Recipe presets (in order)
 *   3. Series default presets (in order)
 *   4. Individual component presets
 *   5. User overrides (explicit ShotSpec fields)
 *
 * Lower layers provide defaults; higher layers override them.
 */

import type { ShotSpec } from '../types.js';
import type { Preset, Recipe, ProductionDirectives } from './schema.js';
import type { ConstraintViolation } from '../constraint-validator.js';
import { validateShotSpec, validateRecipeConstraints } from '../constraint-validator.js';
import type { ProviderName } from '../constraint-validator.js';

/**
 * Deep merge two objects. Arrays are replaced, not concatenated.
 */
function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(overlay)) {
    const baseVal = result[key];
    const overlayVal = overlay[key];

    if (
      overlayVal != null &&
      typeof overlayVal === 'object' &&
      !Array.isArray(overlayVal) &&
      baseVal != null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overlayVal as Record<string, unknown>,
      );
    } else {
      result[key] = overlayVal;
    }
  }

  return result as T;
}

export interface ResolveOptions {
  /** Recipe to apply (resolved first) */
  recipe?: Recipe;
  /** Series default presets (applied after recipe, before individual presets) */
  seriesPresets?: Preset[];
  /** Individual presets to apply (in order, after series presets) */
  presets?: Preset[];
  /** All available presets (for resolving recipe presetIds) */
  allPresets?: Preset[];
  /** User overrides (applied last, highest priority) */
  userOverrides?: Partial<ShotSpec>;
}

/**
 * Resolve a ShotSpec from layered preset sources.
 *
 * @param base - The starting ShotSpec (system defaults or existing shot)
 * @param options - Recipe, presets, and user overrides to layer on
 * @returns Fully resolved ShotSpec
 */
export function resolvePresets(
  base: ShotSpec,
  options: ResolveOptions,
): ShotSpec {
  let resolved = { ...base } as Record<string, unknown>;

  // Layer 1: Recipe presets (in order)
  if (options.recipe && options.allPresets) {
    for (const presetId of options.recipe.presetIds) {
      const preset = options.allPresets.find((p) => p.id === presetId);
      if (preset) {
        resolved = deepMerge(resolved, preset.overrides);
      }
    }
  }

  // Layer 2: Series default presets (in order, between recipe and individual)
  if (options.seriesPresets) {
    for (const preset of options.seriesPresets) {
      resolved = deepMerge(resolved, preset.overrides);
    }
  }

  // Layer 3: Individual presets (in order)
  if (options.presets) {
    for (const preset of options.presets) {
      resolved = deepMerge(resolved, preset.overrides);
    }
  }

  // Layer 4: User overrides (highest priority)
  if (options.userOverrides) {
    resolved = deepMerge(resolved, options.userOverrides as Record<string, unknown>);
  }

  return resolved as unknown as ShotSpec;
}

/**
 * Get active ranges from the preset stack.
 * Merges ranges from recipe presets and individual presets.
 * Later presets override earlier ones for the same range key.
 */
export function getActiveRanges(
  presets: Preset[],
  recipe?: Recipe,
  allPresets?: Preset[],
  seriesPresets?: Preset[],
): Record<string, { min: number; max: number }> {
  const ranges: Record<string, { min: number; max: number }> = {};

  // Layer 1: Recipe preset ranges
  if (recipe && allPresets) {
    for (const presetId of recipe.presetIds) {
      const preset = allPresets.find((p) => p.id === presetId);
      if (preset?.ranges) {
        for (const [key, range] of Object.entries(preset.ranges)) {
          ranges[key] = range;
        }
      }
    }
  }

  // Layer 2: Series preset ranges (override recipe)
  if (seriesPresets) {
    for (const preset of seriesPresets) {
      if (preset?.ranges) {
        for (const [key, range] of Object.entries(preset.ranges)) {
          ranges[key] = range;
        }
      }
    }
  }

  // Layer 3: Individual preset ranges (override series)
  for (const preset of presets) {
    if (preset?.ranges) {
      for (const [key, range] of Object.entries(preset.ranges)) {
        ranges[key] = range;
      }
    }
  }

  return ranges;
}

// ─── Directives-Aware Resolver ───

export interface ResolveWithDirectivesResult {
  shotSpec: ShotSpec;
  directives: ProductionDirectives;
  ranges: Record<string, { min: number; max: number }>;
}

/**
 * Resolve a ShotSpec and extract production directives from the preset stack.
 *
 * Directives come from two sources:
 *   1. `_directives` keys inside preset overrides (e.g. story presets)
 *   2. Recipe-level `directives` field (from master bundles)
 *
 * Recipe-level directives take precedence over preset-embedded ones.
 * The `_directives` key is stripped from the resolved ShotSpec.
 */
export function resolvePresetsWithDirectives(
  base: ShotSpec,
  options: ResolveOptions & { recipeDirectives?: ProductionDirectives },
): ResolveWithDirectivesResult {
  const resolved = resolvePresets(base, options);

  // Extract _directives from resolved spec
  const resolvedRec = resolved as unknown as Record<string, unknown>;
  const specDirectives = (resolvedRec._directives ?? {}) as ProductionDirectives;
  delete resolvedRec._directives;

  // Recipe-level directives override preset-embedded ones
  const directives: ProductionDirectives = { ...specDirectives, ...(options.recipeDirectives ?? {}) };

  const ranges = getActiveRanges(
    options.presets ?? [],
    options.recipe,
    options.allPresets,
    options.seriesPresets,
  );

  return { shotSpec: resolvedRec as unknown as ShotSpec, directives, ranges };
}

// ─── Resolve & Validate ───

export interface ResolveValidationResult extends ResolveWithDirectivesResult {
  violations: ConstraintViolation[];
}

/**
 * Resolve presets with directives, then validate against provider and recipe constraints.
 */
export function resolveAndValidate(
  base: ShotSpec,
  options: ResolveOptions & { recipeDirectives?: ProductionDirectives },
  provider?: ProviderName,
): ResolveValidationResult {
  const result = resolvePresetsWithDirectives(base, options);
  const violations: ConstraintViolation[] = [];

  // Validate against provider constraints
  if (provider) {
    violations.push(...validateShotSpec(result.shotSpec, provider));
  }

  // Validate against recipe constraints
  if (options.recipe?.constraints) {
    violations.push(...validateRecipeConstraints(result.shotSpec, options.recipe.constraints));
  }

  return { ...result, violations };
}

// ─── Sticky Override Tracking ───

export type StickyFields = Set<string>;

/**
 * Resolve presets, then restore user-edited fields from `stickyOverrides`.
 * Prevents preset swaps from silently overwriting user-tuned values.
 */
export function resolveWithStickyOverrides(
  base: ShotSpec,
  options: ResolveOptions,
  stickyFields: StickyFields,
  currentValues: Record<string, unknown>,
): ShotSpec {
  const resolved = resolvePresets(base, options);
  const resolvedRec = resolved as unknown as Record<string, unknown>;

  for (const path of stickyFields) {
    const parts = path.split('.');
    if (parts.length === 1) {
      if (path in currentValues) {
        resolvedRec[path] = currentValues[path];
      }
    } else if (parts.length === 2) {
      const [parent, child] = parts;
      const currentParent = currentValues[parent] as Record<string, unknown> | undefined;
      if (currentParent && child in currentParent) {
        const resolvedParent = { ...((resolvedRec[parent] as Record<string, unknown>) ?? {}) };
        resolvedParent[child] = currentParent[child];
        resolvedRec[parent] = resolvedParent;
      }
    }
  }

  return resolvedRec as unknown as ShotSpec;
}

// ─── Preset Diff Generation ───

export interface PresetDiffEntry {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

/**
 * Compare before/after states and generate a diff of changed fields.
 * Walks top-level keys and one level of nesting for objects.
 */
export function generatePresetDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): PresetDiffEntry[] {
  const entries: PresetDiffEntry[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const bVal = before[key];
    const aVal = after[key];

    // Skip internal keys
    if (key.startsWith('_')) continue;

    // Both are plain objects — diff one level deeper
    if (
      bVal != null && typeof bVal === 'object' && !Array.isArray(bVal) &&
      aVal != null && typeof aVal === 'object' && !Array.isArray(aVal)
    ) {
      const bObj = bVal as Record<string, unknown>;
      const aObj = aVal as Record<string, unknown>;
      const subKeys = new Set([...Object.keys(bObj), ...Object.keys(aObj)]);
      for (const sub of subKeys) {
        if (bObj[sub] !== aObj[sub]) {
          entries.push({
            path: `${key}.${sub}`,
            label: `${key}.${sub}`,
            before: bObj[sub],
            after: aObj[sub],
          });
        }
      }
    } else if (bVal !== aVal) {
      // Handle arrays — compare by JSON string
      if (Array.isArray(bVal) && Array.isArray(aVal)) {
        if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
          entries.push({ path: key, label: key, before: bVal, after: aVal });
        }
      } else {
        entries.push({ path: key, label: key, before: bVal, after: aVal });
      }
    }
  }

  return entries;
}
