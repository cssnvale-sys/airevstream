/**
 * Application-wide constants
 * Centralized configuration for maintainability
 */

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// Content status values
export const CONTENT_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  GENERATED: 'generated',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  POSTED: 'posted',
  ARCHIVED: 'archived',
  FAILED: 'failed',
} as const;

export type ContentStatus = typeof CONTENT_STATUS[keyof typeof CONTENT_STATUS];

// Account/platform status values
export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  FLAGGED: 'flagged',
  PENDING: 'pending',
} as const;

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Platform types
export const PLATFORMS = {
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

// Content types
export const CONTENT_TYPES = {
  VIDEO_SHORT: 'video_short',
  VIDEO_LONG: 'video_long',
  IMAGE: 'image',
  TEXT: 'text',
  VOICE: 'voice',
  THUMBNAIL: 'thumbnail',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

// Quality tiers
export const QUALITY_TIERS = {
  QUICK: 'quick',
  STANDARD: 'standard',
  CINEMA: 'cinema',
} as const;

export type QualityTier = typeof QUALITY_TIERS[keyof typeof QUALITY_TIERS];

// API Rate limits (client-side guidance)
export const RATE_LIMITS = {
  STANDARD_READ: { maxAttempts: 100, windowMs: 60 * 1000 },
  STANDARD_WRITE: { maxAttempts: 30, windowMs: 60 * 1000 },
  SENSITIVE: { maxAttempts: 5, windowMs: 60 * 1000 },
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'airevstream_auth',
  REFRESH_TOKEN: 'airevstream_refresh',
  USER_PREFERENCES: 'airevstream_prefs',
  COMPLEXITY_MODE: 'airevstream_complexity',
  SIDEBAR_COLLAPSED: 'airevstream_sidebar',
} as const;

// Animation durations (in ms)
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// Debounce delays (in ms)
export const DEBOUNCE = {
  SEARCH: 300,
  INPUT: 500,
  RESIZE: 250,
} as const;

// File size limits (in bytes)
export const FILE_LIMITS = {
  IMAGE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  VIDEO_MAX_SIZE: 500 * 1024 * 1024, // 500MB
  AUDIO_MAX_SIZE: 50 * 1024 * 1024, // 50MB
} as const;

// Supported image formats
export const IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

// Supported video formats
export const VIDEO_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

// Date format strings
export const DATE_FORMATS = {
  SHORT: 'MMM d',
  MEDIUM: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  WITH_TIME: 'MMM d, yyyy h:mm a',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const;
