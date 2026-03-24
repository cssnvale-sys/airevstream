/**
 * Revision Presets — one-click plan adjustments for the simple mode review screen.
 *
 * Each revision is a deterministic preset swap (no LLM round-trip).
 * The UI applies overrides instantly and marks the plan as revised.
 */

export interface RevisionPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  overrides: Record<string, unknown>;
}

export const REVISION_PRESETS: RevisionPreset[] = [
  {
    id: 'revision.darker',
    label: 'Make it darker',
    icon: '🌑',
    description: 'Switch to Film Noir style with boosted contrast',
    overrides: {
      colorGrade: { contrast: 40, saturation: -60, shadows: -20, highlights: 10 },
      postProcess: { filmGrain: 25 },
      visualPresetId: 'visual.film-noir.v1',
    },
  },
  {
    id: 'revision.emotional',
    label: 'More emotional',
    icon: '💖',
    description: 'Warmer tones with cinematic full audio mix',
    overrides: {
      colorGrade: { temperature: 15 },
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, loop: true, fadeInMs: 2000, fadeOutMs: 2000 },
        mg: { source: 'generate', volume: 0.5 },
        fg: { source: 'tts', volume: 0.9 },
      },
      audioPresetId: 'audio.cinematic-full.v1',
    },
  },
  {
    id: 'revision.less-dialogue',
    label: 'Less dialogue',
    icon: '🤫',
    description: 'Halve the dialogue lines per shot',
    overrides: {
      dialogueReduction: 0.5,
    },
  },
  {
    id: 'revision.shorter',
    label: 'Make it shorter',
    icon: '⏩',
    description: 'Jump cuts with 70% duration multiplier',
    overrides: {
      transition: 'cut',
      durationMultiplier: 0.7,
      editPresetId: 'edit.jump-cut.v1',
    },
  },
  {
    id: 'revision.energy',
    label: 'More energy',
    icon: '⚡',
    description: 'Energetic beat + jump cuts + boosted saturation',
    overrides: {
      colorGrade: { saturation: 20 },
      audioPlan: {
        bg: { source: 'generate', volume: 0.35, loop: true },
        fg: { source: 'tts', volume: 0.9 },
      },
      transition: 'cut',
      audioPresetId: 'audio.energetic-beat.v1',
      editPresetId: 'edit.jump-cut.v1',
    },
  },
  {
    id: 'revision.cinematic',
    label: 'More cinematic',
    icon: '🎬',
    description: 'Anamorphic lens + film grain + vignette',
    overrides: {
      camera: { lens: 'anamorphic 50mm', framing: 'wide', dof: 'medium' },
      postProcess: { filmGrain: 25, vignette: 15 },
      cameraPresetId: 'camera.anamorphic-wide.v1',
    },
  },
];
