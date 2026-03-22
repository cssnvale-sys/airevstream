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
});

export type Preset = z.infer<typeof PresetSchema>;

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
});

export type Recipe = z.infer<typeof RecipeSchema>;
