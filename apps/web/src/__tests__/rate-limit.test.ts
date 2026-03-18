import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '../lib/rate-limit';

describe('rate-limit', () => {
  describe('checkRateLimit', () => {
    // Use unique keys per test to avoid cross-test state
    let keyCounter = 0;
    function uniqueKey() {
      return `test-key-${Date.now()}-${keyCounter++}`;
    }

    it('allows requests within the limit', () => {
      const key = uniqueKey();
      const config = { maxAttempts: 3, windowMs: 60_000 };

      const r1 = checkRateLimit(key, config);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
      expect(r1.retryAfterMs).toBe(0);

      const r2 = checkRateLimit(key, config);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(key, config);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it('blocks requests over the limit', () => {
      const key = uniqueKey();
      const config = { maxAttempts: 2, windowMs: 60_000 };

      checkRateLimit(key, config);
      checkRateLimit(key, config);
      const r3 = checkRateLimit(key, config);

      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
      expect(r3.retryAfterMs).toBeGreaterThan(0);
      expect(r3.retryAfterMs).toBeLessThanOrEqual(60_000);
    });

    it('allows requests after the window expires', () => {
      const key = uniqueKey();
      const config = { maxAttempts: 1, windowMs: 100 };

      const r1 = checkRateLimit(key, config);
      expect(r1.allowed).toBe(true);

      // Blocked immediately
      const r2 = checkRateLimit(key, config);
      expect(r2.allowed).toBe(false);

      // Mock time forward past the window
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      const r3 = checkRateLimit(key, config);
      expect(r3.allowed).toBe(true);

      vi.useRealTimers();
    });

    it('tracks different keys independently', () => {
      const key1 = uniqueKey();
      const key2 = uniqueKey();
      const config = { maxAttempts: 1, windowMs: 60_000 };

      checkRateLimit(key1, config);
      const r1 = checkRateLimit(key1, config);
      expect(r1.allowed).toBe(false);

      // Different key should still be allowed
      const r2 = checkRateLimit(key2, config);
      expect(r2.allowed).toBe(true);
    });

    it('handles maxAttempts of 0 (always blocked)', () => {
      const key = uniqueKey();
      const config = { maxAttempts: 0, windowMs: 60_000 };

      const r1 = checkRateLimit(key, config);
      expect(r1.allowed).toBe(false);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('extracts IP from x-real-ip header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '10.0.0.1',
        },
      });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('returns 127.0.0.1 when no IP headers are present', () => {
      const req = new Request('http://localhost');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('trims whitespace from x-forwarded-for', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' },
      });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });
  });

  describe('RATE_LIMITS presets', () => {
    it('has expected presets', () => {
      expect(RATE_LIMITS.login).toEqual({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
      expect(RATE_LIMITS.register).toEqual({ maxAttempts: 3, windowMs: 30 * 60 * 1000 });
      expect(RATE_LIMITS.forgotPassword).toEqual({ maxAttempts: 3, windowMs: 60 * 60 * 1000 });
      expect(RATE_LIMITS.standardWrite).toEqual({ maxAttempts: 60, windowMs: 60 * 1000 });
      expect(RATE_LIMITS.adminWrite).toEqual({ maxAttempts: 30, windowMs: 60 * 1000 });
    });
  });
});
