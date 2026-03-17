// ─── Storage Buckets ───
export const BUCKETS = {
  CONTENT: 'airevstream-content',
  THUMBNAILS: 'airevstream-thumbnails',
  AUDIO: 'airevstream-audio',
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
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ─── Rate Limits ───
export const RATE_LIMITS = {
  API_GENERAL: { max: 100, window: '1m' },
  API_AUTH: { max: 10, window: '1m' },
  CONTENT_GENERATION: { max: 10, window: '1h' },
} as const;

// ─── Platform Limits ───
export const PLATFORM_LIMITS = {
  youtube: { titleMaxLength: 100, descriptionMaxLength: 5000 },
  tiktok: { titleMaxLength: 150, descriptionMaxLength: 2200 },
  instagram: { captionMaxLength: 2200 },
  twitter: { tweetMaxLength: 280 },
  facebook: { postMaxLength: 63206 },
} as const;
