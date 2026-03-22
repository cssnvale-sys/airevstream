/**
 * UI Complexity Mode — controls which fields/sections are visible
 * in the Studio shot editor and Create wizard.
 *
 * The backend resolver runs identically regardless of mode.
 * This is purely a UI filter stored in localStorage.
 */

export type ComplexityMode = 'simple' | 'advanced' | 'complex';

const MODE_RANK: Record<ComplexityMode, number> = {
  simple: 0,
  advanced: 1,
  complex: 2,
};

/** Returns true if the current mode meets or exceeds the minimum required mode. */
export function isVisible(minMode: ComplexityMode, currentMode: ComplexityMode): boolean {
  return MODE_RANK[currentMode] >= MODE_RANK[minMode];
}

/**
 * Field visibility map — minimum mode required to show each section/field.
 *
 * Usage:
 *   isVisible(FIELD_VISIBILITY.camera.movement, mode)
 */
export const FIELD_VISIBILITY = {
  // Prompt — always visible
  prompt: 'simple' as ComplexityMode,

  camera: {
    lens: 'simple' as ComplexityMode,
    framing: 'simple' as ComplexityMode,
    movement: 'advanced' as ComplexityMode,
    dof: 'advanced' as ComplexityMode,
  },

  // Generation section
  generation: 'advanced' as ComplexityMode,
  generationFields: {
    steps: 'advanced' as ComplexityMode,
    cfg: 'advanced' as ComplexityMode,
    seed: 'advanced' as ComplexityMode,
    sampler: 'complex' as ComplexityMode,
    scheduler: 'complex' as ComplexityMode,
    width: 'complex' as ComplexityMode,
    height: 'complex' as ComplexityMode,
  },

  // Color grade section
  colorGrade: 'advanced' as ComplexityMode,

  // Lighting section
  lighting: 'advanced' as ComplexityMode,

  // Timing fields
  timing: {
    duration: 'simple' as ComplexityMode,
    fps: 'advanced' as ComplexityMode,
  },

  // Complex-only sections
  postProcess: 'complex' as ComplexityMode,
  vfx: 'complex' as ComplexityMode,
  audioPlan: 'complex' as ComplexityMode,
  rawJson: 'complex' as ComplexityMode,

  // Timeline tracks
  timeline: {
    audio: 'advanced' as ComplexityMode,
    beats: 'advanced' as ComplexityMode,
  },

  // Create wizard
  create: {
    affiliate: 'advanced' as ComplexityMode,
  },
} as const;

export const STORAGE_KEY = 'airevstream_complexity_mode';
export const DEFAULT_MODE: ComplexityMode = 'simple';
