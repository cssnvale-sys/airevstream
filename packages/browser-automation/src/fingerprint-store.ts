import type { FingerprintConfig } from './types.js';

// Common user agents for fingerprint generation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 2560, height: 1440 },
  { width: 1440, height: 900 },
];

const WEBGL_VENDORS = ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)'];
const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
];

const LANGUAGES_OPTIONS = [
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['en-US', 'en', 'es'],
  ['en-US', 'en', 'fr'],
];

/**
 * Generates and caches deterministic browser fingerprints.
 * Given the same seed (enrollment ID), always produces the same fingerprint.
 * This ensures an account always looks like the same browser/device.
 */
export class FingerprintStore {
  private cache = new Map<string, FingerprintConfig>();

  /**
   * Generate a deterministic fingerprint from a seed string.
   * Same seed always produces the same fingerprint.
   */
  generateFingerprint(seed: string): FingerprintConfig {
    const cached = this.cache.get(seed);
    if (cached) return cached;

    // Seeded pseudo-random number generator (xorshift32)
    let state = seedToInt(seed);
    const next = (): number => {
      state ^= state << 13;
      state ^= state >> 17;
      state ^= state << 5;
      return (state >>> 0) / 0xffffffff;
    };

    const fingerprint: FingerprintConfig = {
      userAgent: USER_AGENTS[Math.floor(next() * USER_AGENTS.length)],
      platform: next() > 0.5 ? 'Win32' : 'MacIntel',
      webglVendor: WEBGL_VENDORS[Math.floor(next() * WEBGL_VENDORS.length)],
      webglRenderer: WEBGL_RENDERERS[Math.floor(next() * WEBGL_RENDERERS.length)],
      languages: LANGUAGES_OPTIONS[Math.floor(next() * LANGUAGES_OPTIONS.length)],
      screenResolution: SCREEN_RESOLUTIONS[Math.floor(next() * SCREEN_RESOLUTIONS.length)],
      colorDepth: next() > 0.3 ? 24 : 32,
      hardwareConcurrency: [4, 8, 12, 16][Math.floor(next() * 4)],
      deviceMemory: [4, 8, 16][Math.floor(next() * 3)],
    };

    this.cache.set(seed, fingerprint);
    return fingerprint;
  }

  /**
   * Get a previously generated fingerprint.
   * If not cached, generates a new one from the seed.
   */
  getFingerprint(fingerprintId: string): FingerprintConfig {
    return this.generateFingerprint(fingerprintId);
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

/** Convert a string seed to a 32-bit integer for the PRNG */
function seedToInt(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}
