/**
 * Series Bible Resolver — deep-merges series-level bible overrides
 * on top of the channel's CinemaBible.
 *
 * Follows D101: series stores only diffs from channel bible.
 * Arrays are replaced, not concatenated. Null values remove keys.
 */

import type { LookBible, CharacterBible, EnvironmentBible, PromptBible } from './types.js';

export interface CinemaBibleData {
  look?: LookBible;
  character?: CharacterBible;
  environment?: EnvironmentBible;
  prompt?: PromptBible;
  [key: string]: unknown;
}

/**
 * Deep merge two objects. Arrays are replaced, not concatenated.
 * Null values in the overlay remove the key from the result.
 */
function deepMergeBible<T extends Record<string, unknown>>(
  base: T,
  overlay: Record<string, unknown>,
): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(overlay)) {
    const overlayVal = overlay[key];

    // Null in overlay = delete from result
    if (overlayVal === null) {
      delete result[key];
      continue;
    }

    const baseVal = result[key];

    if (
      overlayVal != null &&
      typeof overlayVal === 'object' &&
      !Array.isArray(overlayVal) &&
      baseVal != null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeBible(
        baseVal as Record<string, unknown>,
        overlayVal as Record<string, unknown>,
      );
    } else {
      result[key] = overlayVal;
    }
  }

  return result as T;
}

/**
 * Resolve a series bible by deep-merging overrides on top of the channel bible.
 *
 * @param channelBible - The channel's full CinemaBible data
 * @param seriesOverrides - Series-level overrides (only diffs)
 * @returns Merged bible data
 */
export function resolveSeriesBible(
  channelBible: CinemaBibleData,
  seriesOverrides: Record<string, unknown>,
): CinemaBibleData {
  if (!seriesOverrides || Object.keys(seriesOverrides).length === 0) {
    return channelBible;
  }
  return deepMergeBible(channelBible, seriesOverrides);
}
