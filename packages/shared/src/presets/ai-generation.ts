/**
 * AI Preset Generation — validates and normalizes AI-generated presets.
 *
 * Used by the POST /api/v1/presets/generate endpoint to produce
 * a fully typed Preset from a natural language description.
 */

import { z } from 'zod';
import { PresetSchema, PresetFamilySchema } from './schema.js';
import type { Preset, PresetFamily } from './schema.js';

// ─── Family → valid override keys ───

export const FAMILY_OVERRIDE_KEYS: Record<PresetFamily, string[]> = {
  visual: ['colorGrade', 'postProcess', 'lighting'],
  camera: ['camera', 'aspect'],
  audio: ['audioPlan'],
  edit: ['transition', 'duration', '_directives'],
  output: ['generation', 'fps', 'aspect', 'codec'],
  project: ['fps', 'aspect', 'audioPlan', 'colorGrade', 'postProcess', 'camera'],
  character: ['characterCount', 'dialogueMode', 'personGeneration', 'audioPlan'],
  story: ['_directives'],
  dialogue: ['audioPlan'],
  continuity: ['seedPolicy'],
};

// ─── Preset ID generation ───

/**
 * Generate a deterministic preset ID from family and name.
 * Format: `{family}.{slug}.v1`
 */
export function generatePresetId(family: PresetFamily, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${family}.${slug}.v1`;
}

// ─── System prompt for AI generation ───

export const PRESET_GENERATION_SYSTEM_PROMPT = `You are an expert cinema pipeline preset designer. Given a natural language description, generate a valid preset object.

PRESET FAMILIES AND THEIR VALID OVERRIDE KEYS:

- visual: colorGrade (object with: contrast, saturation, temperature, tint, shadows, highlights, blacks, whites), postProcess (object with: filmGrain, vignette, sharpen), lighting (string description)
- camera: camera (object with: lens, framing, dof, movement, stabilization), aspect (string like "16:9")
- audio: audioPlan (object with bg/mg/fg layers, each: { source, volume, loop?, fadeInMs?, fadeOutMs? })
- edit: transition (string: "cut", "crossfade"), duration (number in seconds)
- output: generation (object with: width, height), fps (number), aspect (string), codec (string: "h264", "h265", "prores")
- project: fps, aspect, audioPlan, colorGrade, postProcess, camera (combines multiple families)
- character: characterCount (number), dialogueMode ("narrator"|"conversational"|"none"), personGeneration ("allow"|"disallow"), audioPlan
- story: _directives (object with optional: narrativeStructure, pacing — used to embed production directives)
- dialogue: audioPlan
- continuity: seedPolicy ("free"|"shot-offset"|"scene-lock"|"series-lock")

RULES:
1. Auto-detect the most appropriate family from the description
2. Only use override keys valid for the detected family
3. Keep numeric values reasonable (e.g., colorGrade values -100 to 100, volume 0 to 1)
4. Generate 2-5 relevant tags
5. Write a concise description (1-2 sentences)

RESPOND WITH ONLY valid JSON matching this schema:
{
  "name": "string (display name, max 60 chars)",
  "family": "one of: visual, camera, audio, edit, output, project, character, story, dialogue, continuity",
  "description": "string (1-2 sentences)",
  "tags": ["string", ...],
  "overrides": { ... valid keys for the family ... },
  "tier": "simple" or "advanced" or "complex" or null
}

EXAMPLES:

Input: "warm sunset look with soft focus"
Output: {"name":"Warm Sunset","family":"visual","description":"Warm golden tones mimicking a sunset with soft diffused highlights.","tags":["warm","sunset","golden","soft"],"overrides":{"colorGrade":{"temperature":30,"saturation":15,"contrast":5,"highlights":10},"postProcess":{"vignette":10},"lighting":"warm sunset backlight, soft diffusion"},"tier":null}

Input: "fast-paced montage with jump cuts"
Output: {"name":"Fast Montage","family":"edit","description":"Rapid jump cuts for high-energy montage sequences.","tags":["fast","montage","jump-cut","energetic"],"overrides":{"transition":"cut","duration":1.5},"tier":null}`;

// ─── Validation + normalization ───

const AiPresetOutputSchema = z.object({
  name: z.string().min(1).max(255),
  family: PresetFamilySchema,
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  overrides: z.record(z.unknown()).default({}),
  tier: z.enum(['simple', 'advanced', 'complex']).nullable().optional(),
});

/**
 * Validate and normalize raw AI output into a valid Preset.
 * Strips unknown override keys, generates an ID, and forces builtIn: false.
 */
export function validateAndNormalizeAiPreset(
  raw: unknown,
  description: string,
): { preset: Preset } | { error: string } {
  const parsed = AiPresetOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { error: `Invalid preset structure: ${msg}` };
  }

  const { name, family, tags, overrides, tier } = parsed.data;
  const validKeys = FAMILY_OVERRIDE_KEYS[family];

  // Strip any override keys not valid for this family
  const cleanOverrides: Record<string, unknown> = {};
  for (const key of Object.keys(overrides)) {
    if (validKeys.includes(key)) {
      cleanOverrides[key] = overrides[key];
    }
  }

  const presetId = generatePresetId(family, name);

  const preset: Preset = {
    id: presetId,
    name,
    family,
    description: parsed.data.description ?? description,
    tags,
    builtIn: false,
    overrides: cleanOverrides,
    ...(tier ? { tier } : {}),
  };

  // Final validation through the canonical PresetSchema
  const final = PresetSchema.safeParse(preset);
  if (!final.success) {
    return { error: `Preset validation failed: ${final.error.message}` };
  }

  return { preset: final.data };
}
