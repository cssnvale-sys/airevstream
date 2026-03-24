/**
 * Built-in presets — shipped with the system.
 *
 * These are non-deletable presets covering the major families.
 */

import type { Preset, Recipe, ProductionDirectives } from './schema.js';

// ─── Visual Presets (Color Grades) ───

export const VISUAL_PRESETS: Preset[] = [
  {
    id: 'visual.film-noir.v1',
    name: 'Film Noir',
    family: 'visual',
    description: 'High contrast B&W with deep shadows',
    tags: ['dramatic', 'classic', 'bw'],
    builtIn: true,
    overrides: {
      colorGrade: { contrast: 40, saturation: -60, shadows: -20, highlights: 10 },
    },
    ranges: { 'colorGrade.saturation': { min: -80, max: -30 }, 'colorGrade.contrast': { min: 20, max: 60 } },
  },
  {
    id: 'visual.wes-anderson.v1',
    name: 'Wes Anderson',
    family: 'visual',
    description: 'Warm pastels with symmetrical framing feel',
    tags: ['warm', 'stylized', 'indie'],
    builtIn: true,
    overrides: {
      colorGrade: { saturation: 30, temperature: 15, tint: 5, contrast: 10 },
    },
  },
  {
    id: 'visual.cyberpunk.v1',
    name: 'Cyberpunk',
    family: 'visual',
    description: 'Neon-saturated with cool blue tint',
    tags: ['sci-fi', 'neon', 'dark'],
    builtIn: true,
    overrides: {
      colorGrade: { saturation: 40, tint: -30, contrast: 30, temperature: -20 },
    },
    ranges: { 'colorGrade.tint': { min: -50, max: -10 }, 'colorGrade.saturation': { min: 20, max: 60 } },
  },
  {
    id: 'visual.warm-vintage.v1',
    name: 'Warm Vintage',
    family: 'visual',
    description: 'Nostalgic warm tones with slight desaturation',
    tags: ['retro', 'warm', 'film'],
    builtIn: true,
    overrides: {
      colorGrade: { temperature: 25, saturation: -15, contrast: 5 },
      postProcess: { filmGrain: 20, vignette: 15 },
    },
    ranges: { 'colorGrade.temperature': { min: 10, max: 40 } },
  },
  {
    id: 'visual.cool-modern.v1',
    name: 'Cool Modern',
    family: 'visual',
    description: 'Clean cool tones with moderate contrast',
    tags: ['clean', 'corporate', 'tech'],
    builtIn: true,
    overrides: {
      colorGrade: { temperature: -15, contrast: 15, saturation: 5, highlights: 10 },
    },
  },
  {
    id: 'visual.golden-hour.v1',
    name: 'Golden Hour',
    family: 'visual',
    description: 'Warm orange glow mimicking sunset light',
    tags: ['warm', 'outdoor', 'romantic'],
    builtIn: true,
    overrides: {
      colorGrade: { temperature: 35, saturation: 10, contrast: 5 },
      lighting: 'golden hour, warm backlight',
    },
  },
];

// ─── Camera Presets ───

export const CAMERA_PRESETS: Preset[] = [
  {
    id: 'camera.wide-establishing.v1',
    name: 'Wide Establishing',
    family: 'camera',
    description: 'Wide lens, deep DOF for scene establishment',
    tags: ['wide', 'establishing', 'landscape'],
    builtIn: true,
    overrides: {
      camera: { lens: '24mm', framing: 'wide', dof: 'deep', movement: 'static' },
    },
  },
  {
    id: 'camera.portrait-closeup.v1',
    name: 'Portrait Close-up',
    family: 'camera',
    description: 'Shallow DOF portrait with blurred background',
    tags: ['portrait', 'close-up', 'bokeh'],
    builtIn: true,
    overrides: {
      camera: { lens: '85mm', framing: 'close-up', dof: 'shallow', movement: 'static' },
    },
  },
  {
    id: 'camera.dolly-in.v1',
    name: 'Dolly In',
    family: 'camera',
    description: 'Standard lens with dolly-in movement',
    tags: ['movement', 'dramatic', 'approach'],
    builtIn: true,
    overrides: {
      camera: { lens: '50mm', framing: 'medium', dof: 'medium', movement: 'dolly-in' },
    },
  },
  {
    id: 'camera.anamorphic-wide.v1',
    name: 'Anamorphic Wide',
    family: 'camera',
    description: 'Cinematic anamorphic lens look',
    tags: ['cinematic', 'anamorphic', 'widescreen'],
    builtIn: true,
    overrides: {
      camera: { lens: 'anamorphic 50mm', framing: 'wide', dof: 'medium' },
      aspect: '2.39:1',
    },
  },
  {
    id: 'camera.orbit-reveal.v1',
    name: 'Orbit Reveal',
    family: 'camera',
    description: 'Orbiting camera for product reveals',
    tags: ['orbit', 'reveal', 'product'],
    builtIn: true,
    overrides: {
      camera: { lens: '50mm', framing: 'medium', dof: 'shallow', movement: 'orbit-left' },
    },
  },
];

// ─── Audio Presets ───

export const AUDIO_PRESETS: Preset[] = [
  {
    id: 'audio.narration-only.v1',
    name: 'Narration Only',
    family: 'audio',
    description: 'Clean voiceover with no background',
    tags: ['voice', 'clean', 'minimal'],
    builtIn: true,
    overrides: {
      audioPlan: { fg: { source: 'tts', volume: 0.9 } },
    },
  },
  {
    id: 'audio.ambient-narration.v1',
    name: 'Ambient + Narration',
    family: 'audio',
    description: 'Soft ambient background with voiceover',
    tags: ['ambient', 'voice', 'calm'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.2, loop: true, fadeInMs: 2000, fadeOutMs: 2000 },
        fg: { source: 'tts', volume: 0.9 },
      },
    },
  },
  {
    id: 'audio.energetic-beat.v1',
    name: 'Energetic Beat',
    family: 'audio',
    description: 'Upbeat background music with narration',
    tags: ['music', 'energetic', 'upbeat'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.35, loop: true },
        fg: { source: 'tts', volume: 0.9 },
      },
    },
  },
  {
    id: 'audio.cinematic-full.v1',
    name: 'Cinematic Full Mix',
    family: 'audio',
    description: 'Three-layer cinematic audio with foley',
    tags: ['cinematic', 'full', 'immersive'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, loop: true, fadeInMs: 2000, fadeOutMs: 2000 },
        mg: { source: 'generate', volume: 0.5 },
        fg: { source: 'tts', volume: 0.9 },
      },
    },
  },
];

// ─── Output Presets ───

export const OUTPUT_PRESETS: Preset[] = [
  {
    id: 'output.youtube-landscape.v1',
    name: 'YouTube Landscape',
    family: 'output',
    description: '1920x1080, 24fps, h264',
    tags: ['youtube', '16:9', 'landscape'],
    builtIn: true,
    overrides: {
      generation: { width: 1920, height: 1080 },
      fps: 24,
      aspect: '16:9',
      codec: 'h264',
    },
  },
  {
    id: 'output.reels-portrait.v1',
    name: 'Reels / TikTok',
    family: 'output',
    description: '1080x1920, 30fps, portrait',
    tags: ['reels', 'tiktok', '9:16', 'portrait'],
    builtIn: true,
    overrides: {
      generation: { width: 1080, height: 1920 },
      fps: 30,
      aspect: '9:16',
      codec: 'h264',
    },
  },
  {
    id: 'output.square-social.v1',
    name: 'Square Social',
    family: 'output',
    description: '1080x1080, 30fps, square',
    tags: ['instagram', 'square', '1:1'],
    builtIn: true,
    overrides: {
      generation: { width: 1080, height: 1080 },
      fps: 30,
      aspect: '1:1',
      codec: 'h264',
    },
  },
  {
    id: 'output.archive-prores.v1',
    name: 'Archive ProRes',
    family: 'output',
    description: 'ProRes mov for archival, 1920x1080, 24fps',
    tags: ['archive', 'prores', 'lossless'],
    builtIn: true,
    overrides: {
      generation: { width: 1920, height: 1080 },
      fps: 24,
      aspect: '16:9',
      codec: 'prores',
    },
  },
  {
    id: 'output.hevc-efficient.v1',
    name: 'HEVC Efficient',
    family: 'output',
    description: 'H.265 for efficient storage, 1920x1080, 30fps',
    tags: ['hevc', 'h265', 'efficient'],
    builtIn: true,
    overrides: {
      generation: { width: 1920, height: 1080 },
      fps: 30,
      aspect: '16:9',
      codec: 'h265',
    },
  },
];

// ─── Project Presets ───

export const PROJECT_PRESETS: Preset[] = [
  {
    id: 'project.explainer.v1',
    name: 'Explainer',
    family: 'project',
    description: 'Educational or how-to content with clear structure',
    tags: ['educational', 'howto', 'structured'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      fps: 24,
      aspect: '16:9',
      audioPlan: { fg: { source: 'tts', volume: 0.9 }, bg: { source: 'generate', volume: 0.2, loop: true } },
    },
  },
  {
    id: 'project.vlog.v1',
    name: 'Vlog',
    family: 'project',
    description: 'Casual, personality-driven content',
    tags: ['vlog', 'casual', 'personality'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      fps: 30,
      aspect: '16:9',
      camera: { lens: '35mm', framing: 'medium', dof: 'shallow', stabilization: 'gimbal' },
    },
  },
  {
    id: 'project.commercial.v1',
    name: 'Commercial',
    family: 'project',
    description: 'Polished product or brand content',
    tags: ['commercial', 'product', 'brand'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      fps: 24,
      aspect: '16:9',
      colorGrade: { contrast: 15, saturation: 10, highlights: 5 },
      postProcess: { sharpen: 30 },
    },
  },
  {
    id: 'project.cinematic-short.v1',
    name: 'Cinematic Short',
    family: 'project',
    description: 'Film-quality short with full audio mix',
    tags: ['cinematic', 'film', 'premium'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      fps: 24,
      aspect: '16:9',
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, loop: true, fadeInMs: 2000, fadeOutMs: 2000 },
        mg: { source: 'generate', volume: 0.5 },
        fg: { source: 'tts', volume: 0.9 },
      },
      postProcess: { filmGrain: 20, vignette: 10 },
      colorGrade: { contrast: 20 },
    },
  },
  {
    id: 'project.dramatic-reel.v1',
    name: 'Dramatic Reel',
    family: 'project',
    description: 'Punchy vertical format for social',
    tags: ['reel', 'vertical', 'social', 'dramatic'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      fps: 30,
      aspect: '9:16',
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, loop: true },
        fg: { source: 'tts', volume: 0.9 },
      },
      colorGrade: { contrast: 25, saturation: 5 },
    },
  },
];

// ─── Character Presets ───

export const CHARACTER_PRESETS: Preset[] = [
  {
    id: 'character.solo-speaker.v1',
    name: 'Solo Speaker',
    family: 'character',
    description: 'Single narrator or presenter',
    tags: ['solo', 'narrator', 'single'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      characterCount: 1,
      dialogueMode: 'narrator',
      audioPlan: { fg: { source: 'tts', volume: 0.9 } },
    },
  },
  {
    id: 'character.two-characters.v1',
    name: 'Two Characters',
    family: 'character',
    description: 'Conversational format with two speakers',
    tags: ['duo', 'conversational', 'dialogue'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      characterCount: 2,
      dialogueMode: 'conversational',
      audioPlan: { fg: { source: 'tts', volume: 0.85 }, mg: { source: 'generate', volume: 0.3 } },
    },
  },
  {
    id: 'character.narrator-broll.v1',
    name: 'Narrator + B-Roll',
    family: 'character',
    description: 'Voiceover narration with visual B-roll footage',
    tags: ['narrator', 'b-roll', 'documentary'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      characterCount: 0,
      dialogueMode: 'narrator',
      audioPlan: { fg: { source: 'tts', volume: 0.9 }, bg: { source: 'generate', volume: 0.2, loop: true } },
    },
  },
  {
    id: 'character.no-dialogue.v1',
    name: 'No Dialogue',
    family: 'character',
    description: 'Music-driven visuals with no speaking',
    tags: ['silent', 'music', 'visual'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      characterCount: 0,
      dialogueMode: 'none',
      audioPlan: { bg: { source: 'generate', volume: 0.4, loop: true } },
    },
  },
  {
    id: 'character.faceless-cinema.v1',
    name: 'Faceless Cinema',
    family: 'character',
    description: 'Narrated content without on-screen people',
    tags: ['faceless', 'narrator', 'anonymous'],
    builtIn: true,
    tier: 'simple',
    overrides: {
      characterCount: 0,
      dialogueMode: 'narrator',
      personGeneration: 'disallow',
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, loop: true },
        fg: { source: 'tts', volume: 0.9 },
      },
    },
  },
];

// ─── Story Presets ───

export const STORY_PRESETS: Preset[] = [
  {
    id: 'story.hicc-standard.v1',
    name: 'H.I.C.C. Standard',
    family: 'story',
    description: 'Hook-Interest-Content-CTA standard structure',
    tags: ['hicc', 'standard', 'youtube'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'hicc', pacing: 'moderate' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'story.three-act.v1',
    name: 'Three-Act',
    family: 'story',
    description: 'Classic three-act narrative structure',
    tags: ['narrative', 'three-act', 'story'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'three-act', pacing: 'slow' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'story.hook-loop.v1',
    name: 'Hook Loop',
    family: 'story',
    description: 'Repeated hook pattern for short-form retention',
    tags: ['hook', 'loop', 'tiktok', 'reels'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'hook-loop', pacing: 'frenetic' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'story.montage.v1',
    name: 'Montage',
    family: 'story',
    description: 'Rapid visual montage with no linear narrative',
    tags: ['montage', 'visual', 'aesthetic'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'montage', pacing: 'moderate' } satisfies ProductionDirectives,
    },
  },
];

// ─── Dialogue Presets ───

export const DIALOGUE_PRESETS: Preset[] = [
  {
    id: 'dialogue.narrator.v1',
    name: 'Narrator',
    family: 'dialogue',
    description: 'Single narrator voiceover style',
    tags: ['narrator', 'voiceover', 'single'],
    builtIn: true,
    overrides: {
      audioPlan: { fg: { source: 'tts', volume: 0.9 } },
    },
  },
  {
    id: 'dialogue.conversational.v1',
    name: 'Conversational',
    family: 'dialogue',
    description: 'Multi-speaker conversational style',
    tags: ['conversational', 'multi-speaker', 'dialogue'],
    builtIn: true,
    overrides: {
      audioPlan: { fg: { source: 'tts', volume: 0.85 }, mg: { source: 'generate', volume: 0.3 } },
    },
  },
];

// ─── Continuity Presets ───

export const CONTINUITY_PRESETS: Preset[] = [
  {
    id: 'continuity.strict-lock.v1',
    name: 'Strict Lock',
    family: 'continuity',
    description: 'Locked seeds and references for maximum consistency',
    tags: ['strict', 'consistent', 'locked'],
    builtIn: true,
    overrides: {
      seedPolicy: 'series-lock',
    },
  },
  {
    id: 'continuity.scene-consistent.v1',
    name: 'Scene Consistent',
    family: 'continuity',
    description: 'Consistent within scenes, variation between',
    tags: ['scene', 'consistent', 'balanced'],
    builtIn: true,
    overrides: {
      seedPolicy: 'scene-lock',
    },
  },
  {
    id: 'continuity.loose.v1',
    name: 'Loose',
    family: 'continuity',
    description: 'Free variation for montage or experimental content',
    tags: ['loose', 'free', 'variation'],
    builtIn: true,
    overrides: {
      seedPolicy: 'free',
    },
  },
];

// ─── Edit Presets ───

export const EDIT_PRESETS: Preset[] = [
  {
    id: 'edit.jump-cut.v1',
    name: 'Jump Cut',
    family: 'edit',
    description: 'Fast jump cuts for energetic pacing',
    tags: ['jump-cut', 'fast', 'energetic'],
    builtIn: true,
    overrides: {
      transition: 'cut',
      duration: 2,
    },
  },
  {
    id: 'edit.smooth-transition.v1',
    name: 'Smooth Transition',
    family: 'edit',
    description: 'Smooth crossfades between shots',
    tags: ['crossfade', 'smooth', 'cinematic'],
    builtIn: true,
    overrides: {
      transition: 'crossfade',
      duration: 4,
    },
  },
  {
    id: 'edit.montage.v1',
    name: 'Montage',
    family: 'edit',
    description: 'Quick montage with varied shot lengths',
    tags: ['montage', 'varied', 'dynamic'],
    builtIn: true,
    overrides: {
      transition: 'cut',
      duration: 1.5,
    },
  },
];

// ─── Legacy Recipes (updated with category/mood/directives) ───

export const LEGACY_RECIPES: Recipe[] = [
  {
    id: 'recipe.explainer.v1',
    name: 'Explainer Video',
    description: 'Clean corporate look with narration',
    tags: ['corporate', 'explainer', 'educational'],
    builtIn: true,
    category: 'one-off',
    mood: 'Explainer',
    directives: { targetShotCount: 6, avgShotLengthSec: 5, pacing: 'moderate', dialogueDensity: 'moderate', lensPackage: 'standard-mix', narrativeStructure: 'hicc' },
    presetIds: [
      'visual.cool-modern.v1',
      'camera.wide-establishing.v1',
      'audio.ambient-narration.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.cinematic-short.v1',
    name: 'Cinematic Short',
    description: 'Film-quality short with full audio mix',
    tags: ['cinematic', 'premium', 'short'],
    builtIn: true,
    category: 'cinematic',
    mood: 'Drama',
    directives: { targetShotCount: 9, avgShotLengthSec: 5, pacing: 'slow', dialogueDensity: 'dense', lensPackage: 'anamorphic', narrativeStructure: 'three-act', seedPolicy: 'series-lock' },
    presetIds: [
      'visual.warm-vintage.v1',
      'camera.anamorphic-wide.v1',
      'audio.cinematic-full.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.tiktok-hook.v1',
    name: 'TikTok Hook',
    description: 'Fast-paced portrait video with energetic beat',
    tags: ['tiktok', 'hook', 'fast'],
    builtIn: true,
    category: 'shorts',
    mood: 'TikTok Hook',
    directives: { targetShotCount: 5, avgShotLengthSec: 3, pacing: 'frenetic', dialogueDensity: 'sparse', lensPackage: 'standard-mix', narrativeStructure: 'hook-loop', seedPolicy: 'free' },
    presetIds: [
      'visual.cyberpunk.v1',
      'camera.dolly-in.v1',
      'audio.energetic-beat.v1',
      'output.reels-portrait.v1',
    ],
  },
];

// ─── Master Bundle Recipes ───

export const MASTER_BUNDLES: Recipe[] = [
  // ── One-off ──
  {
    id: 'recipe.one-off.explainer.v1',
    name: 'Explainer',
    description: 'Clean educational content with narration and modern look',
    tags: ['educational', 'explainer', 'howto'],
    builtIn: true,
    category: 'one-off',
    mood: 'Explainer',
    tier: 'simple',
    directives: { targetShotCount: 6, avgShotLengthSec: 5, pacing: 'moderate', dialogueDensity: 'moderate', lensPackage: 'standard-mix', narrativeStructure: 'hicc' },
    presetIds: [
      'visual.cool-modern.v1',
      'camera.wide-establishing.v1',
      'audio.ambient-narration.v1',
      'story.hicc-standard.v1',
      'character.solo-speaker.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.one-off.product-review.v1',
    name: 'Product Review',
    description: 'Warm, detailed product showcase with close-up reveals',
    tags: ['product', 'review', 'showcase'],
    builtIn: true,
    category: 'one-off',
    mood: 'Product Review',
    tier: 'simple',
    directives: { targetShotCount: 8, avgShotLengthSec: 4, pacing: 'moderate', dialogueDensity: 'dense', lensPackage: 'portrait-heavy', narrativeStructure: 'hicc' },
    presetIds: [
      'visual.warm-vintage.v1',
      'camera.orbit-reveal.v1',
      'audio.ambient-narration.v1',
      'story.hicc-standard.v1',
      'character.solo-speaker.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.one-off.social-clip.v1',
    name: 'Social Clip',
    description: 'Eye-catching vertical clip for social feeds',
    tags: ['social', 'clip', 'vertical'],
    builtIn: true,
    category: 'one-off',
    mood: 'Social Clip',
    tier: 'simple',
    directives: { targetShotCount: 5, avgShotLengthSec: 3, pacing: 'fast', dialogueDensity: 'sparse', lensPackage: 'standard-mix', narrativeStructure: 'hook-loop' },
    presetIds: [
      'visual.cyberpunk.v1',
      'camera.dolly-in.v1',
      'audio.energetic-beat.v1',
      'story.hook-loop.v1',
      'character.faceless-cinema.v1',
      'output.reels-portrait.v1',
    ],
  },

  // ── Series ──
  {
    id: 'recipe.series.educational.v1',
    name: 'Educational Series',
    description: 'Consistent educational format for recurring episodes',
    tags: ['educational', 'series', 'recurring'],
    builtIn: true,
    category: 'series',
    mood: 'Educational',
    tier: 'simple',
    directives: { targetShotCount: 8, avgShotLengthSec: 5, pacing: 'moderate', dialogueDensity: 'moderate', lensPackage: 'wide-only', narrativeStructure: 'hicc', seedPolicy: 'scene-lock' },
    presetIds: [
      'visual.cool-modern.v1',
      'camera.wide-establishing.v1',
      'audio.ambient-narration.v1',
      'story.hicc-standard.v1',
      'character.narrator-broll.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.series.vlog.v1',
    name: 'Personal Vlog',
    description: 'Personality-driven series with warm, intimate feel',
    tags: ['vlog', 'personal', 'warm'],
    builtIn: true,
    category: 'series',
    mood: 'Personal Vlog',
    tier: 'simple',
    directives: { targetShotCount: 6, avgShotLengthSec: 5, pacing: 'moderate', dialogueDensity: 'dense', lensPackage: 'portrait-heavy', narrativeStructure: 'three-act', seedPolicy: 'scene-lock' },
    presetIds: [
      'visual.wes-anderson.v1',
      'camera.portrait-closeup.v1',
      'audio.narration-only.v1',
      'story.three-act.v1',
      'character.solo-speaker.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.series.podcast-visual.v1',
    name: 'Podcast Visual',
    description: 'Visual podcast format with two-speaker dialogue',
    tags: ['podcast', 'dialogue', 'conversational'],
    builtIn: true,
    category: 'series',
    mood: 'Podcast Visual',
    tier: 'simple',
    directives: { targetShotCount: 6, avgShotLengthSec: 6, pacing: 'slow', dialogueDensity: 'dense', lensPackage: 'portrait-heavy', narrativeStructure: 'three-act', seedPolicy: 'series-lock' },
    presetIds: [
      'visual.film-noir.v1',
      'camera.portrait-closeup.v1',
      'audio.cinematic-full.v1',
      'story.three-act.v1',
      'character.two-characters.v1',
      'output.youtube-landscape.v1',
    ],
  },

  // ── Shorts ──
  {
    id: 'recipe.shorts.tiktok-hook.v1',
    name: 'TikTok Hook',
    description: 'Fast-paced hook for maximum short-form retention',
    tags: ['tiktok', 'hook', 'fast', 'reels'],
    builtIn: true,
    category: 'shorts',
    mood: 'TikTok Hook',
    tier: 'simple',
    directives: { targetShotCount: 5, avgShotLengthSec: 3, pacing: 'frenetic', dialogueDensity: 'sparse', lensPackage: 'standard-mix', narrativeStructure: 'hook-loop', seedPolicy: 'free' },
    presetIds: [
      'visual.cyberpunk.v1',
      'camera.dolly-in.v1',
      'audio.energetic-beat.v1',
      'story.hook-loop.v1',
      'character.faceless-cinema.v1',
      'output.reels-portrait.v1',
    ],
  },
  {
    id: 'recipe.shorts.aesthetic-reel.v1',
    name: 'Aesthetic Reel',
    description: 'Beautiful golden-hour montage with no dialogue',
    tags: ['aesthetic', 'montage', 'golden-hour'],
    builtIn: true,
    category: 'shorts',
    mood: 'Aesthetic Reel',
    tier: 'simple',
    directives: { targetShotCount: 6, avgShotLengthSec: 3, pacing: 'moderate', dialogueDensity: 'none', lensPackage: 'standard-mix', narrativeStructure: 'montage', seedPolicy: 'free' },
    presetIds: [
      'visual.golden-hour.v1',
      'camera.orbit-reveal.v1',
      'audio.ambient-narration.v1',
      'story.montage.v1',
      'character.no-dialogue.v1',
      'output.reels-portrait.v1',
    ],
  },
  {
    id: 'recipe.shorts.tutorial-quick.v1',
    name: 'Quick Tutorial',
    description: 'Snappy how-to in square format',
    tags: ['tutorial', 'quick', 'square'],
    builtIn: true,
    category: 'shorts',
    mood: 'Quick Tutorial',
    tier: 'simple',
    directives: { targetShotCount: 4, avgShotLengthSec: 4, pacing: 'fast', dialogueDensity: 'moderate', lensPackage: 'wide-only', narrativeStructure: 'hicc', seedPolicy: 'free' },
    presetIds: [
      'visual.cool-modern.v1',
      'camera.wide-establishing.v1',
      'audio.narration-only.v1',
      'story.hicc-standard.v1',
      'character.solo-speaker.v1',
      'output.square-social.v1',
    ],
  },

  // ── Cinematic ──
  {
    id: 'recipe.cinematic.drama.v1',
    name: 'Drama',
    description: 'Warm vintage film quality with full cinematic audio',
    tags: ['drama', 'cinematic', 'warm'],
    builtIn: true,
    category: 'cinematic',
    mood: 'Drama',
    tier: 'simple',
    directives: { targetShotCount: 9, avgShotLengthSec: 5, pacing: 'slow', dialogueDensity: 'dense', lensPackage: 'anamorphic', narrativeStructure: 'three-act', seedPolicy: 'series-lock' },
    presetIds: [
      'visual.warm-vintage.v1',
      'camera.anamorphic-wide.v1',
      'audio.cinematic-full.v1',
      'story.three-act.v1',
      'character.two-characters.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.cinematic.noir.v1',
    name: 'Noir',
    description: 'High-contrast noir with moody close-ups',
    tags: ['noir', 'dark', 'moody'],
    builtIn: true,
    category: 'cinematic',
    mood: 'Noir',
    tier: 'simple',
    directives: { targetShotCount: 8, avgShotLengthSec: 5, pacing: 'slow', dialogueDensity: 'moderate', lensPackage: 'portrait-heavy', narrativeStructure: 'three-act', seedPolicy: 'series-lock' },
    presetIds: [
      'visual.film-noir.v1',
      'camera.portrait-closeup.v1',
      'audio.cinematic-full.v1',
      'story.three-act.v1',
      'character.solo-speaker.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.cinematic.epic.v1',
    name: 'Epic',
    description: 'Grand golden-hour landscapes with anamorphic sweep',
    tags: ['epic', 'grand', 'landscape'],
    builtIn: true,
    category: 'cinematic',
    mood: 'Epic',
    tier: 'simple',
    directives: { targetShotCount: 9, avgShotLengthSec: 5, pacing: 'slow', dialogueDensity: 'sparse', lensPackage: 'anamorphic', narrativeStructure: 'three-act', seedPolicy: 'series-lock' },
    presetIds: [
      'visual.golden-hour.v1',
      'camera.anamorphic-wide.v1',
      'audio.cinematic-full.v1',
      'story.three-act.v1',
      'character.narrator-broll.v1',
      'output.youtube-landscape.v1',
    ],
  },
];

/** All built-in recipes (legacy + master bundles) */
export const BUILT_IN_RECIPES: Recipe[] = [
  ...LEGACY_RECIPES,
  ...MASTER_BUNDLES,
];

/** All built-in presets combined */
export const ALL_BUILT_IN_PRESETS: Preset[] = [
  ...VISUAL_PRESETS,
  ...CAMERA_PRESETS,
  ...AUDIO_PRESETS,
  ...OUTPUT_PRESETS,
  ...PROJECT_PRESETS,
  ...CHARACTER_PRESETS,
  ...STORY_PRESETS,
  ...DIALOGUE_PRESETS,
  ...CONTINUITY_PRESETS,
  ...EDIT_PRESETS,
];
