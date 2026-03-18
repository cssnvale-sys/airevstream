/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with automatic cleanup.
 */

type RateLimitEntry = {
  timestamps: number[];
  windowMs: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_STORE_SIZE = 50_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
    // Evict oldest entries if store grows too large
    if (store.size > MAX_STORE_SIZE) {
      console.warn(`Rate limiter store has ${store.size} entries — evicting oldest`);
      const entries = [...store.entries()].sort(
        (a, b) => (a[1].timestamps[0] ?? 0) - (b[1].timestamps[0] ?? 0),
      );
      const toRemove = entries.slice(0, store.size - MAX_STORE_SIZE);
      for (const [key] of toRemove) store.delete(key);
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
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [], windowMs: config.windowMs };
  // Update the window in case config changed
  entry.windowMs = config.windowMs;

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
  /** Standard write operations: 60 per minute per user */
  standardWrite: { maxAttempts: 60, windowMs: 60 * 1000 },
  /** Admin operations: 30 per minute per user */
  adminWrite: { maxAttempts: 30, windowMs: 60 * 1000 },
} as const;

const IP_PATTERN = /^[\d.:%a-fA-F]{1,45}$/;

/**
 * Extract client IP from a Next.js request.
 * Validates format to prevent rate-limit key pollution from spoofed headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]!.trim();
    if (IP_PATTERN.test(ip)) return ip;
  }
  const real = req.headers.get('x-real-ip');
  if (real && IP_PATTERN.test(real)) return real;
  return '127.0.0.1';
}
