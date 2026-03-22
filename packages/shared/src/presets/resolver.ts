/**
 * Preset Resolver — merges presets into a ShotSpec using deterministic precedence.
 *
 * Resolution order (highest priority last):
 *   1. System defaults (from constants.ts DEFAULT_GENERATION)
 *   2. Recipe presets (in order)
 *   3. Individual component presets
 *   4. User overrides (explicit ShotSpec fields)
 *
 * Lower layers provide defaults; higher layers override them.
 */

import type { ShotSpec } from '../types.js';
import type { Preset, Recipe } from './schema.js';

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
  /** Individual presets to apply (in order, after recipe) */
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

  // Layer 2: Individual presets (in order)
  if (options.presets) {
    for (const preset of options.presets) {
      resolved = deepMerge(resolved, preset.overrides);
    }
  }

  // Layer 3: User overrides (highest priority)
  if (options.userOverrides) {
    resolved = deepMerge(resolved, options.userOverrides as Record<string, unknown>);
  }

  return resolved as unknown as ShotSpec;
}
