// ─── Storage Buckets ───
export const BUCKETS = {
  CONTENT: 'airevstream-content',
  THUMBNAILS: 'airevstream-thumbnails',
  AUDIO: 'airevstream-audio',
  AVATARS: 'airevstream-avatars',
  BRANDING: 'airevstream-branding',
  SCENERY: 'airevstream-scenery',
  EXPORTS: 'airevstream-exports',
  TEMP: 'airevstream-temp',
  PRODUCTION: 'airevstream-production',
  BACKUPS: 'airevstream-backups',
} as const;

// ─── Queue Names ───
export const QUEUES = {
  CONTENT: 'content',
  ACCOUNT: 'account',
  POSTING: 'posting',
  RESEARCH: 'research',
  MAINTENANCE: 'maintenance',
  PRODUCTION: 'production',
  SEASONING: 'seasoning',
  EXPERIMENT: 'experiment',
} as const;

// ─── JWT ───
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// ─── Pagination Defaults ───
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

// ─── Platform Limits ───
export const PLATFORM_LIMITS = {
  youtube: { titleMaxLength: 100, descriptionMaxLength: 5000, hashtagMax: 15 },
  tiktok: { captionMaxLength: 2200, hashtagMax: 30 },
  instagram: { captionMaxLength: 2200, hashtagMax: 30 },
  facebook: { postMaxLength: 63206 },
} as const;

// ─── Service Ports ───
export const PORTS = {
  WEB: 3000,
  WORKFLOW_ENGINE: 3001,
  PRODUCTION_PIPELINE: 3002,
  AI_ASSISTANT: 3003,
} as const;

// ─── AI Service Fallback Groups ───
export const FALLBACK_GROUPS = {
  TEXT_GEN: 'text_gen',
  IMAGE_GEN: 'image_gen',
  VIDEO_GEN: 'video_gen',
  VOICE_GEN: 'voice_gen',
} as const;

// ─── System Thresholds ───
export const SYSTEM_THRESHOLDS = {
  CPU_WARNING: 80,
  CPU_CRITICAL: 95,
  RAM_WARNING: 80,
  RAM_CRITICAL: 90,
  DISK_WARNING: 85,
  DISK_CRITICAL: 95,
  HEALTH_SCORE_WARNING: 70,
  HEALTH_SCORE_CRITICAL: 40,
} as const;

// ─── Approval Gate Defaults ───
export const APPROVAL_DEFAULTS = {
  INITIAL_GATE_WINDOW_HRS: 24,
  MIN_GATE_WINDOW_HRS: 0,
  MAX_GATE_WINDOW_HRS: 72,
  TRUST_SCORE_AUTO_APPROVE: 85,
  TRUST_SCORE_INCREMENT: 2,
  TRUST_SCORE_DECREMENT: 5,
} as const;

// ─── Beat Preset Audio Mapping ───
export const BEAT_AUDIO_PRESETS = {
  INTIMATE: { bed: 'ambient_soft', accent: 'breath_close' },
  TENSION: { bed: 'drone_low', accent: 'stinger_dissonant' },
  POWER: { bed: 'orchestral_march', accent: 'impact_hit' },
  AWE: { bed: 'choir_pad', accent: 'shimmer_rise' },
  PSYCHOLOGICAL: { bed: 'whisper_drone', accent: 'heartbeat_deep' },
  EMOTIONAL: { bed: 'piano_soft', accent: 'string_swell' },
  MOMENTUM: { bed: 'percussion_build', accent: 'whoosh_fast' },
  CALM: { bed: 'nature_ambient', accent: 'chime_soft' },
} as const;

// ─── Cinema Pipeline Presets ───
export const CINEMA_PRESETS = {
  ASPECT_RATIOS: {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '4:3': { width: 1440, height: 1080 },
    '2.39:1': { width: 2560, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
  },
  LENS_PRESETS: {
    'wide': { lens: '24mm', dof: 'deep' as const },
    'standard': { lens: '35mm', dof: 'medium' as const },
    'portrait': { lens: '85mm', dof: 'shallow' as const },
    'telephoto': { lens: '135mm', dof: 'shallow' as const },
    'anamorphic': { lens: 'anamorphic 50mm', dof: 'medium' as const },
  },
  CAMERA_MOVEMENTS: [
    'static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down',
    'dolly-in', 'dolly-out', 'crane-up', 'crane-down',
    'orbit-left', 'orbit-right', 'zoom-in', 'zoom-out',
    'tracking-left', 'tracking-right', 'handheld-subtle',
  ],
  COLOR_GRADE_PRESETS: {
    'film-noir': { contrast: 40, saturation: -60, shadows: -20, highlights: 10 },
    'wes-anderson': { saturation: 30, temperature: 15, tint: 5, contrast: 10 },
    'cyberpunk': { saturation: 40, tint: -30, contrast: 30, temperature: -20 },
    'warm-vintage': { temperature: 25, saturation: -15, contrast: 5, blacks: 10 },
    'cool-modern': { temperature: -15, contrast: 15, saturation: 5, highlights: 10 },
    'high-contrast-bw': { saturation: -100, contrast: 60, blacks: -20, whites: 20 },
  },
  LORA_CATEGORIES: ['style', 'character', 'environment', 'lighting'] as const,
  DEFAULT_GENERATION: {
    steps: 30,
    cfg: 7,
    sampler: 'dpmpp_2m',
    scheduler: 'karras',
    denoise: 1.0,
    width: 1024,
    height: 1024,
  },
} as const;

export const QUALITY_THRESHOLDS = {
  AUTO_APPROVE: 85,
  REVIEW_REQUIRED: 60,
  AUTO_REJECT: 30,
} as const;

// ─── Simple Mode Guardrails ───
export const SIMPLE_MODE_GUARDRAILS = {
  MAX_SHOTS: 9,
  MAX_DIALOGUE_LINES_PER_SHOT: 2,
  MAX_SHOT_DURATION_SEC: 8,
  DEFAULT_CHARACTER_COUNT: 1,
  MAX_CHARACTER_COUNT: 2,
  ALLOWED_DURATIONS: [15, 30, 60],
  DEFAULT_QUALITY_TIER: 'cinema',
} as const;

// ─── Pipeline Progress — Friendly Labels for Simple Mode ───
export const PIPELINE_SIMPLE_LABELS: Record<string, string> = {
  'Research':         'Writing your story',
  'Script':           'Writing your story',
  'Storyboard':       'Building visual bible',
  'Shot Generation':  'Creating shots',
  'QC Gate':          'Quality checking',
  'Audio Mix':        'Adding sound & music',
  'Video Render':     'Rendering clips',
  'Final Review':     'Final edit',
};
