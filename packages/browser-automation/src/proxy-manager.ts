import { chromium } from 'playwright';
import { createLogger } from '@airevstream/shared';
import type { ProxyConfig, ProxyHealth, ProxyPoolStats, ProxyVerificationResult } from './types.js';

const logger = createLogger('proxy-manager');

/** Default URL used to verify proxy connectivity and retrieve the external IP. */
const DEFAULT_VERIFY_URL = 'https://httpbin.org/ip';

/** Number of recent failures after which a proxy is considered blocked. */
const BLOCK_THRESHOLD = 5;

/** Milliseconds to wait before retrying a previously failed proxy. */
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a stable key for a proxy to use as a Map key.
 */
function proxyKey(proxy: ProxyConfig): string {
  return `${proxy.type}://${proxy.username ?? ''}@${proxy.server}`;
}

/**
 * Manages a pool of proxies with round-robin rotation, health tracking,
 * automatic failure cooldown, and verification via a headless browser.
 */
export class ProxyManager {
  private proxies: ProxyConfig[];
  private healthMap: Map<string, ProxyHealth> = new Map();
  private rotationIndex = 0;
  private verifyUrl: string;

  constructor(proxies: ProxyConfig[], verifyUrl?: string) {
    this.proxies = [...proxies];
    this.verifyUrl = verifyUrl ?? DEFAULT_VERIFY_URL;

    // Initialize health tracking for every proxy
    for (const proxy of this.proxies) {
      this.healthMap.set(proxyKey(proxy), {
        lastUsed: 0,
        failures: 0,
        lastFailedAt: null,
        blocked: false,
      });
    }

    logger.info({ count: proxies.length }, 'Proxy pool initialized');
  }

  /**
   * Round-robin rotation that skips proxies which have recently failed
   * or are blocked. Returns the next usable proxy, or null if none available.
   */
  rotateProxy(): ProxyConfig | null {
    const now = Date.now();
    const total = this.proxies.length;

    for (let attempt = 0; attempt < total; attempt++) {
      const index = this.rotationIndex % total;
      this.rotationIndex = (this.rotationIndex + 1) % total;

      const proxy = this.proxies[index];
      const health = this.healthMap.get(proxyKey(proxy));

      if (!health) continue;

      // Skip blocked proxies
      if (health.blocked) continue;

      // Skip proxies still in cooldown from recent failure
      if (
        health.lastFailedAt !== null &&
        now - health.lastFailedAt < FAILURE_COOLDOWN_MS &&
        health.failures > 0
      ) {
        continue;
      }

      // Mark as used and return
      health.lastUsed = now;
      logger.debug({ server: proxy.server, type: proxy.type }, 'Rotated to proxy');
      return proxy;
    }

    logger.warn('No healthy proxies available in the pool');
    return null;
  }

  /**
   * Verify a proxy by launching a headless browser through it, loading
   * the verification URL, and checking the response for the external IP.
   */
  async verifyProxy(proxy: ProxyConfig): Promise<ProxyVerificationResult> {
    const startTime = Date.now();
    let browser = null;

    try {
      browser = await chromium.launch({
        headless: true,
        proxy: {
          server: proxy.server,
          username: proxy.username,
          password: proxy.password,
        },
      });

      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
      });

      const page = await context.newPage();

      const response = await page.goto(this.verifyUrl, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      if (!response || !response.ok()) {
        const latencyMs = Date.now() - startTime;
        this.markFailed(proxy, `HTTP ${response?.status() ?? 'no response'}`);
        return {
          success: false,
          ip: '',
          latencyMs,
          blocked: true,
        };
      }

      const body = await page.textContent('body');
      const latencyMs = Date.now() - startTime;

      // Parse IP from httpbin.org/ip JSON response: {"origin": "1.2.3.4"}
      let ip = '';
      try {
        const parsed = JSON.parse(body ?? '{}') as { origin?: string };
        ip = parsed.origin ?? '';
      } catch (parseErr) {
        // If the verification URL doesn't return JSON, use the raw body
        logger.debug({ parseErr, server: proxy.server }, 'Verification URL returned non-JSON response, using raw body');
        ip = (body ?? '').trim().substring(0, 45);
      }

      await context.close();

      // Reset failure count on success
      const health = this.healthMap.get(proxyKey(proxy));
      if (health) {
        health.failures = 0;
        health.lastFailedAt = null;
        health.blocked = false;
      }

      logger.info({ server: proxy.server, ip, latencyMs }, 'Proxy verified successfully');

      return {
        success: true,
        ip,
        latencyMs,
        blocked: false,
        isResidential: proxy.type === 'residential',
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const reason = err instanceof Error ? err.message : 'Unknown error';
      this.markFailed(proxy, reason);

      logger.warn({ server: proxy.server, reason, latencyMs }, 'Proxy verification failed');

      return {
        success: false,
        ip: '',
        latencyMs,
        blocked: false,
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          logger.debug({ closeErr, server: proxy.server }, 'Error closing verification browser');
        }
      }
    }
  }

  /**
   * Iterate through the pool and return the first proxy that passes verification.
   * Returns null if no proxy is healthy.
   */
  async getHealthyProxy(): Promise<ProxyConfig | null> {
    const now = Date.now();

    // Sort proxies by least recently used, filtering out blocked ones
    const candidates = this.proxies
      .filter((p) => {
        const h = this.healthMap.get(proxyKey(p));
        return h && !h.blocked;
      })
      .sort((a, b) => {
        const ha = this.healthMap.get(proxyKey(a));
        const hb = this.healthMap.get(proxyKey(b));
        return (ha?.lastUsed ?? 0) - (hb?.lastUsed ?? 0);
      });

    for (const proxy of candidates) {
      const health = this.healthMap.get(proxyKey(proxy));

      // Skip if still in cooldown
      if (
        health?.lastFailedAt !== null &&
        health !== undefined &&
        now - (health.lastFailedAt ?? 0) < FAILURE_COOLDOWN_MS &&
        health.failures > 0
      ) {
        continue;
      }

      const result = await this.verifyProxy(proxy);
      if (result.success && !result.blocked) {
        if (health) {
          health.lastUsed = now;
        }
        return proxy;
      }
    }

    logger.error('No healthy proxy found in the entire pool');
    return null;
  }

  /**
   * Record a failure for a proxy. If failures exceed the block threshold,
   * the proxy is marked as blocked.
   */
  markFailed(proxy: ProxyConfig, reason: string): void {
    const key = proxyKey(proxy);
    const health = this.healthMap.get(key);

    if (!health) return;

    health.failures += 1;
    health.lastFailedAt = Date.now();
    health.lastFailReason = reason;

    if (health.failures >= BLOCK_THRESHOLD) {
      health.blocked = true;
      logger.warn(
        { server: proxy.server, failures: health.failures, reason },
        'Proxy blocked after exceeding failure threshold',
      );
    } else {
      logger.debug(
        { server: proxy.server, failures: health.failures, reason },
        'Proxy failure recorded',
      );
    }
  }

  /**
   * Unblock a proxy and reset its failure state.
   */
  unblock(proxy: ProxyConfig): void {
    const health = this.healthMap.get(proxyKey(proxy));
    if (health) {
      health.blocked = false;
      health.failures = 0;
      health.lastFailedAt = null;
      health.lastFailReason = undefined;
      logger.info({ server: proxy.server }, 'Proxy unblocked');
    }
  }

  /**
   * Return aggregate health statistics for the proxy pool.
   */
  getStats(): ProxyPoolStats {
    let healthy = 0;
    let blocked = 0;
    let failed = 0;
    const now = Date.now();

    for (const health of this.healthMap.values()) {
      if (health.blocked) {
        blocked++;
      } else if (
        health.lastFailedAt !== null &&
        now - health.lastFailedAt < FAILURE_COOLDOWN_MS &&
        health.failures > 0
      ) {
        failed++;
      } else {
        healthy++;
      }
    }

    return {
      total: this.proxies.length,
      healthy,
      blocked,
      failed,
      averageLatencyMs: 0, // Updated during verification
    };
  }

  /**
   * Add a new proxy to the pool at runtime.
   */
  addProxy(proxy: ProxyConfig): void {
    const key = proxyKey(proxy);
    if (this.healthMap.has(key)) {
      logger.debug({ server: proxy.server }, 'Proxy already in pool, skipping');
      return;
    }

    this.proxies.push(proxy);
    this.healthMap.set(key, {
      lastUsed: 0,
      failures: 0,
      lastFailedAt: null,
      blocked: false,
    });

    logger.info({ server: proxy.server }, 'Proxy added to pool');
  }

  /**
   * Remove a proxy from the pool.
   */
  removeProxy(proxy: ProxyConfig): void {
    const key = proxyKey(proxy);
    this.healthMap.delete(key);
    this.proxies = this.proxies.filter((p) => proxyKey(p) !== key);
    logger.info({ server: proxy.server }, 'Proxy removed from pool');
  }

  /**
   * Return the number of proxies in the pool.
   */
  get poolSize(): number {
    return this.proxies.length;
  }
}
