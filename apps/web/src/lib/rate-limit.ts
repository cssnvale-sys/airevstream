/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with automatic cleanup.
 */

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
    if (store.size > 10000) {
      console.warn(`Rate limiter store has ${store.size} entries — possible memory issue`);
    }
  }, CLEANUP_INTERVAL);
  // Don't prevent process exit
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

type RateLimitConfig = {
  /** Maximum number of requests allowed in the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Check if a request is rate limited.
 * @param key - Unique identifier (e.g., IP address or "ip:email")
 * @param config - Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanup(config.windowMs);
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs);

  if (entry.timestamps.length >= config.maxAttempts) {
    const oldestInWindow = entry.timestamps[0]!;
    const retryAfterMs = config.windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxAttempts - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Pre-configured rate limits for common use cases.
 */
export const RATE_LIMITS = {
  /** Login: 5 attempts per 15 minutes per IP */
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  /** Registration: 3 attempts per 30 minutes per IP */
  register: { maxAttempts: 3, windowMs: 30 * 60 * 1000 },
  /** Forgot password: 3 attempts per hour per IP */
  forgotPassword: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  /** Reset password: 5 attempts per 15 minutes per IP */
  resetPassword: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  /** Content generation: 20 per hour per user */
  contentGeneration: { maxAttempts: 20, windowMs: 60 * 60 * 1000 },
  /** Bulk operations: 5 per hour per user */
  bulkOperation: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  /** Analytics export: 10 per hour per user */
  analyticsExport: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Extract client IP from a Next.js request.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return '127.0.0.1';
}
