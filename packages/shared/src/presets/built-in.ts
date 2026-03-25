/**
 * Built-in presets — shipped with the system.
 *
 * These are non-deletable presets covering the major families.
 */

import type { Preset, Recipe, ProductionDirectives, EngineRouting, RecipeConstraints } from './schema.js';

// ─── Default Engine Routing ───

const DEFAULT_ROUTING: EngineRouting = { keyframeEngine: 'comfyui', assemblyEngine: 'remotion' };
const CINEMATIC_ROUTING: EngineRouting = { keyframeEngine: 'comfyui', motionEngine: 'veo', assemblyEngine: 'remotion' };

// ─── Category Constraints ───

const ONE_OFF_CONSTRAINTS: RecipeConstraints = { maxRuntimeSeconds: 300, maxCostUsd: 25, allowedAspects: ['16:9', '9:16'], allowedFps: [24, 30] };
const SERIES_CONSTRAINTS: RecipeConstraints = { maxRuntimeSeconds: 600, maxCostUsd: 40, allowedAspects: ['16:9', '9:16'], allowedFps: [24, 30] };
const SHORTS_CONSTRAINTS: RecipeConstraints = { maxRuntimeSeconds: 90, maxCostUsd: 10, allowedAspects: ['9:16', '1:1'], allowedFps: [24, 30] };
const CINEMATIC_CONSTRAINTS: RecipeConstraints = { maxRuntimeSeconds: 600, maxCostUsd: 60, allowedAspects: ['16:9', '2.39:1'], allowedFps: [24] };

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
      generation: { steps: 35, cfg: 8, sampler: 'dpmpp_2m', scheduler: 'karras' },
      negativePrompt: 'color, vibrant, rainbow, saturated',
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
      postProcess: { filmGrain: 10, sharpen: 20 },
      generation: { steps: 30, cfg: 7.5, sampler: 'dpmpp_2m', scheduler: 'karras' },
      negativePrompt: 'soft focus, desaturated, vintage',
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
      postProcess: { sharpen: 15 },
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
  {
    id: 'visual.dark-thriller.v1',
    name: 'Dark Thriller',
    family: 'visual',
    description: 'Low-key lighting with desaturated cold tones for suspense',
    tags: ['dark', 'thriller', 'suspense', 'cold'],
    builtIn: true,
    overrides: {
      colorGrade: { contrast: 35, saturation: -30, temperature: -25, shadows: -30, highlights: -10 },
      postProcess: { filmGrain: 15, vignette: 25 },
      generation: { steps: 32, cfg: 7, sampler: 'dpmpp_2m', scheduler: 'karras' },
      negativePrompt: 'bright, cheerful, saturated, comedy',
    },
    ranges: { 'colorGrade.contrast': { min: 20, max: 50 }, 'colorGrade.shadows': { min: -50, max: -10 } },
  },
  {
    id: 'visual.bright-cartoon.v1',
    name: 'Bright Cartoon',
    family: 'visual',
    description: 'Vivid saturated colors with flat lighting for animated look',
    tags: ['bright', 'cartoon', 'vivid', 'fun'],
    builtIn: true,
    overrides: {
      colorGrade: { saturation: 50, contrast: -10, temperature: 5, highlights: 20 },
    },
    ranges: { 'colorGrade.saturation': { min: 30, max: 70 } },
  },
  {
    id: 'visual.retro-film.v1',
    name: 'Retro Film',
    family: 'visual',
    description: 'Faded film stock look with heavy grain and warm shift',
    tags: ['retro', 'film', 'vintage', '70s'],
    builtIn: true,
    overrides: {
      colorGrade: { saturation: -20, temperature: 20, contrast: 10, blacks: 15 },
      postProcess: { filmGrain: 35, vignette: 20 },
    },
    ranges: { 'postProcess.filmGrain': { min: 20, max: 50 } },
  },
  {
    id: 'visual.dreamy-soft.v1',
    name: 'Dreamy Soft',
    family: 'visual',
    description: 'Soft diffused light with gentle pastel tones',
    tags: ['dreamy', 'soft', 'pastel', 'gentle'],
    builtIn: true,
    overrides: {
      colorGrade: { saturation: -10, contrast: -15, temperature: 10, highlights: 15 },
      postProcess: { vignette: 10 },
      lighting: 'soft diffused backlight, overcast feel',
      generation: { steps: 28, cfg: 6.5, sampler: 'dpmpp_2m', scheduler: 'karras', denoise: 0.9 },
      negativePrompt: 'harsh, high-contrast, sharp edges, gritty',
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
      camera: { lens: '50mm', framing: 'medium', dof: 'medium', movement: 'dolly-in', stabilization: 'dolly' },
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
      camera: { lens: '50mm', framing: 'medium', dof: 'shallow', movement: 'orbit-left', stabilization: 'gimbal' },
    },
  },
  {
    id: 'camera.static-fifty.v1',
    name: 'Static 50mm',
    family: 'camera',
    description: 'Locked-off 50mm for clean dialogue coverage',
    tags: ['static', '50mm', 'clean', 'dialogue'],
    builtIn: true,
    overrides: {
      camera: { lens: '50mm', framing: 'medium', dof: 'medium', movement: 'static' },
    },
  },
  {
    id: 'camera.slow-pan.v1',
    name: 'Slow Pan',
    family: 'camera',
    description: 'Gentle horizontal pan for environmental reveals',
    tags: ['pan', 'slow', 'reveal', 'environmental'],
    builtIn: true,
    overrides: {
      camera: { lens: '35mm', framing: 'wide', dof: 'deep', movement: 'pan-right', stabilization: 'gimbal' },
    },
  },
  {
    id: 'camera.steadicam.v1',
    name: 'Steadicam',
    family: 'camera',
    description: 'Smooth floating follow-cam for immersive tracking',
    tags: ['steadicam', 'smooth', 'tracking', 'immersive'],
    builtIn: true,
    overrides: {
      camera: { lens: '35mm', framing: 'medium-wide', dof: 'medium', movement: 'dolly-in', stabilization: 'gimbal' },
    },
  },
  {
    id: 'camera.over-shoulder.v1',
    name: 'Over the Shoulder',
    family: 'camera',
    description: 'OTS framing for dialogue and reaction shots',
    tags: ['ots', 'dialogue', 'reaction', 'shoulder'],
    builtIn: true,
    overrides: {
      camera: { lens: '85mm', framing: 'medium', dof: 'shallow', movement: 'static' },
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
      audioPlan: { fg: { source: 'tts', volume: 0.9, levelDb: -10 } },
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
        bg: { source: 'generate', volume: 0.2, loop: true, fadeInMs: 2000, fadeOutMs: 2000, levelDb: -24 },
        fg: { source: 'tts', volume: 0.9, levelDb: -10, duckingDb: -8 },
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
        bg: { source: 'generate', volume: 0.35, loop: true, levelDb: -18 },
        fg: { source: 'tts', volume: 0.9, levelDb: -10, duckingDb: -10 },
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
        bg: { source: 'generate', volume: 0.3, loop: true, fadeInMs: 2000, fadeOutMs: 2000, levelDb: -24 },
        mg: { source: 'generate', volume: 0.5, levelDb: -18 },
        fg: { source: 'tts', volume: 0.9, levelDb: -10, duckingDb: -8 },
      },
    },
  },
  {
    id: 'audio.tense-suspense.v1',
    name: 'Tense Suspense',
    family: 'audio',
    description: 'Low drone with staccato hits for thriller pacing',
    tags: ['tense', 'suspense', 'thriller', 'drone'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.25, loop: true, fadeInMs: 3000, fadeOutMs: 1000, levelDb: -22 },
        mg: { source: 'generate', volume: 0.4, levelDb: -16 },
        fg: { source: 'tts', volume: 0.9, levelDb: -10, duckingDb: -10 },
      },
    },
  },
  {
    id: 'audio.documentary.v1',
    name: 'Documentary',
    family: 'audio',
    description: 'Understated ambient bed with clear narration priority',
    tags: ['documentary', 'narration', 'subtle', 'informative'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.15, loop: true, fadeInMs: 2000, fadeOutMs: 2000, levelDb: -30 },
        fg: { source: 'tts', volume: 0.95, levelDb: -9, duckingDb: -8 },
      },
    },
  },
  {
    id: 'audio.heroic-epic.v1',
    name: 'Heroic Epic',
    family: 'audio',
    description: 'Orchestral swells with powerful brass and percussion',
    tags: ['heroic', 'epic', 'orchestral', 'powerful'],
    builtIn: true,
    overrides: {
      audioPlan: {
        bg: { source: 'generate', volume: 0.35, loop: true, fadeInMs: 3000, fadeOutMs: 3000, levelDb: -18 },
        mg: { source: 'generate', volume: 0.5, levelDb: -14 },
        fg: { source: 'tts', volume: 0.85, levelDb: -10, duckingDb: -10 },
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
      _directives: { narrativeStructure: 'hicc', pacing: 'moderate', dialogueDensity: 'moderate' } satisfies ProductionDirectives,
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
      _directives: { narrativeStructure: 'three-act', pacing: 'slow', dialogueDensity: 'dense' } satisfies ProductionDirectives,
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
      _directives: { narrativeStructure: 'hook-loop', pacing: 'frenetic', dialogueDensity: 'sparse' } satisfies ProductionDirectives,
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
      _directives: { narrativeStructure: 'montage', pacing: 'moderate', dialogueDensity: 'none' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'story.setup-twist.v1',
    name: 'Setup & Twist',
    family: 'story',
    description: 'Build expectation then subvert with a reveal or twist',
    tags: ['twist', 'suspense', 'mystery', 'reveal'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'setup-twist', pacing: 'moderate', dialogueDensity: 'moderate' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'story.educational.v1',
    name: 'Educational',
    family: 'story',
    description: 'Clear concept introduction, demonstration, and summary',
    tags: ['educational', 'tutorial', 'howto', 'learn'],
    builtIn: true,
    overrides: {
      _directives: { narrativeStructure: 'educational', pacing: 'moderate', dialogueDensity: 'dense' } satisfies ProductionDirectives,
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
  {
    id: 'dialogue.no-dialogue.v1',
    name: 'No Dialogue',
    family: 'dialogue',
    description: 'Music and sound effects only, no spoken words',
    tags: ['silent', 'music-only', 'no-voice'],
    builtIn: true,
    overrides: {
      audioPlan: { bg: { source: 'generate', volume: 0.4, loop: true } },
    },
  },
  {
    id: 'dialogue.single-speaker.v1',
    name: 'Single Speaker',
    family: 'dialogue',
    description: 'One authoritative voice with subtle ambient bed',
    tags: ['single', 'speaker', 'authoritative'],
    builtIn: true,
    overrides: {
      audioPlan: { fg: { source: 'tts', volume: 0.9 }, bg: { source: 'generate', volume: 0.15, loop: true } },
    },
  },
  {
    id: 'dialogue.whispered.v1',
    name: 'Whispered',
    family: 'dialogue',
    description: 'Intimate whispered narration with ASMR-like presence',
    tags: ['whisper', 'asmr', 'intimate', 'soft'],
    builtIn: true,
    overrides: {
      audioPlan: { fg: { source: 'tts', volume: 0.95 }, bg: { source: 'generate', volume: 0.1, loop: true, fadeInMs: 3000, fadeOutMs: 3000 } },
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
      continuityLocks: { characterLock: 'strong', wardrobeLock: 'strong', environmentLock: 'strong' },
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
      continuityLocks: { characterLock: 'standard', wardrobeLock: 'standard', environmentLock: 'standard' },
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
      continuityLocks: { characterLock: 'off', wardrobeLock: 'off', environmentLock: 'off' },
    },
  },
  {
    id: 'continuity.episode-consistent.v1',
    name: 'Episode Consistent',
    family: 'continuity',
    description: 'Shot-offset seeds for within-episode consistency with minor variation',
    tags: ['episode', 'consistent', 'variation'],
    builtIn: true,
    overrides: {
      seedPolicy: 'shot-offset',
      continuityLocks: { characterLock: 'standard', wardrobeLock: 'standard', environmentLock: 'off' },
    },
  },
  {
    id: 'continuity.series-lock.v1',
    name: 'Series Lock',
    family: 'continuity',
    description: 'Full series-lock for cross-episode character and environment consistency',
    tags: ['series', 'locked', 'cross-episode'],
    builtIn: true,
    overrides: {
      seedPolicy: 'series-lock',
      continuityLocks: { characterLock: 'strong', wardrobeLock: 'strong', environmentLock: 'strong' },
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
      _directives: { avgShotLengthSec: 2, pacing: 'frenetic' } satisfies ProductionDirectives,
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
      _directives: { avgShotLengthSec: 4, pacing: 'slow' } satisfies ProductionDirectives,
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
      _directives: { avgShotLengthSec: 1.5, pacing: 'fast' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'edit.slow-burn.v1',
    name: 'Slow Burn',
    family: 'edit',
    description: 'Extended shots with minimal cuts for building tension',
    tags: ['slow', 'tension', 'long-take', 'deliberate'],
    builtIn: true,
    overrides: {
      transition: 'crossfade',
      duration: 6,
      _directives: { avgShotLengthSec: 6, pacing: 'slow' } satisfies ProductionDirectives,
    },
  },
  {
    id: 'edit.dramatic-reveal.v1',
    name: 'Dramatic Reveal',
    family: 'edit',
    description: 'Moderate pacing with strategic hard cuts for reveals',
    tags: ['dramatic', 'reveal', 'hard-cut', 'strategic'],
    builtIn: true,
    overrides: {
      transition: 'cut',
      duration: 3.5,
      _directives: { avgShotLengthSec: 3.5, pacing: 'moderate' } satisfies ProductionDirectives,
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
    routing: DEFAULT_ROUTING,
    constraints: ONE_OFF_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: ONE_OFF_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: ONE_OFF_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: SERIES_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: SERIES_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: SERIES_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: SHORTS_CONSTRAINTS,
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
    routing: DEFAULT_ROUTING,
    constraints: SHORTS_CONSTRAINTS,
    presetIds: [
      'visual.golden-hour.v1',
      'camera.orbit-reveal.v1',
      // No audio preset — character.no-dialogue provides bg-only audioPlan
      // Adding audio.ambient-narration would leak TTS via deep merge
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
    routing: DEFAULT_ROUTING,
    constraints: SHORTS_CONSTRAINTS,
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
    routing: CINEMATIC_ROUTING,
    constraints: CINEMATIC_CONSTRAINTS,
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
    routing: CINEMATIC_ROUTING,
    constraints: CINEMATIC_CONSTRAINTS,
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
    routing: CINEMATIC_ROUTING,
    constraints: CINEMATIC_CONSTRAINTS,
    presetIds: [
      'visual.golden-hour.v1',
      'camera.anamorphic-wide.v1',
      'audio.cinematic-full.v1',
      'story.three-act.v1',
      'character.narrator-broll.v1',
      'output.youtube-landscape.v1',
    ],
  },

  // ── New bundles ──
  {
    id: 'recipe.cinematic.thriller.v1',
    name: 'Thriller',
    description: 'Dark suspenseful tone with over-shoulder framing and tense audio',
    tags: ['thriller', 'suspense', 'dark', 'tension'],
    builtIn: true,
    category: 'cinematic',
    mood: 'Thriller',
    tier: 'simple',
    directives: { targetShotCount: 8, avgShotLengthSec: 4, pacing: 'moderate', dialogueDensity: 'moderate', lensPackage: 'portrait-heavy', narrativeStructure: 'setup-twist', seedPolicy: 'series-lock' },
    routing: CINEMATIC_ROUTING,
    constraints: CINEMATIC_CONSTRAINTS,
    presetIds: [
      'visual.dark-thriller.v1',
      'camera.over-shoulder.v1',
      'audio.tense-suspense.v1',
      'story.setup-twist.v1',
      'character.solo-speaker.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.one-off.educational.v1',
    name: 'Educational',
    description: 'Clear structured tutorial with cool modern look and documentary audio',
    tags: ['educational', 'tutorial', 'documentary', 'howto'],
    builtIn: true,
    category: 'one-off',
    mood: 'Educational',
    tier: 'simple',
    directives: { targetShotCount: 7, avgShotLengthSec: 5, pacing: 'moderate', dialogueDensity: 'dense', lensPackage: 'wide-only', narrativeStructure: 'educational', seedPolicy: 'scene-lock' },
    routing: DEFAULT_ROUTING,
    constraints: ONE_OFF_CONSTRAINTS,
    presetIds: [
      'visual.cool-modern.v1',
      'camera.wide-establishing.v1',
      'audio.documentary.v1',
      'story.educational.v1',
      'character.narrator-broll.v1',
      'output.youtube-landscape.v1',
    ],
  },
  {
    id: 'recipe.shorts.dreamy-asmr.v1',
    name: 'Dreamy ASMR',
    description: 'Soft dreamy visuals with whispered narration and gentle steadicam',
    tags: ['dreamy', 'asmr', 'soft', 'whisper'],
    builtIn: true,
    category: 'shorts',
    mood: 'Dreamy ASMR',
    tier: 'simple',
    directives: { targetShotCount: 6, avgShotLengthSec: 4, pacing: 'slow', dialogueDensity: 'sparse', lensPackage: 'standard-mix', narrativeStructure: 'montage', seedPolicy: 'free' },
    routing: DEFAULT_ROUTING,
    constraints: SHORTS_CONSTRAINTS,
    presetIds: [
      'visual.dreamy-soft.v1',
      'camera.steadicam.v1',
      'dialogue.whispered.v1',
      'story.montage.v1',
      'character.solo-speaker.v1',
      'output.reels-portrait.v1',
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
