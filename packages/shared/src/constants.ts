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
} as const;

// ─── Queue Names ───
export const QUEUES = {
  CONTENT: 'content',
  ACCOUNT: 'account',
  POSTING: 'posting',
  RESEARCH: 'research',
  MAINTENANCE: 'maintenance',
  PRODUCTION: 'production',
} as const;

// ─── JWT ───
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// ─── Pagination Defaults ───
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

// ─── Rate Limits ───
export const RATE_LIMITS = {
  API_GENERAL: { max: 100, window: '15m' },
  API_AUTH: { max: 10, window: '1m' },
  AI_ASSISTANT: { max: 60, window: '1m' },
  CONTENT_GENERATION: { max: 10, window: '1h' },
} as const;

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
