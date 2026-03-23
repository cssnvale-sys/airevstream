import type { Page } from 'playwright';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('captcha-solver');

// ─── Types ───

export interface CaptchaInfo {
  type: 'recaptcha' | 'hcaptcha' | 'funcaptcha' | 'unknown';
  siteKey?: string;
  pageUrl: string;
}

export interface CaptchaSolveResult {
  success: boolean;
  solution?: string;
  error?: string;
}

/**
 * CAPTCHA detection and solving via 2Captcha API.
 *
 * Stub implementation (D064): throws a descriptive error when no API key
 * is configured; returns placeholder results when an API key is present.
 */
export class CaptchaSolver {
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Detect whether the current page contains a CAPTCHA challenge.
   */
  async detectCaptcha(page: Page): Promise<CaptchaInfo | null> {
    this.ensureConfigured();

    logger.warn('detectCaptcha called — placeholder implementation, returning null');
    // Stub: no real detection logic yet
    const url = page.url();
    logger.debug({ url }, 'Scanned page for CAPTCHA elements');
    return null;
  }

  /**
   * Solve a detected CAPTCHA challenge.
   */
  async solve(page: Page, captchaInfo: CaptchaInfo): Promise<CaptchaSolveResult> {
    this.ensureConfigured();

    logger.warn(
      { type: captchaInfo.type, pageUrl: captchaInfo.pageUrl },
      'solve called — placeholder implementation, returning stub failure',
    );

    // Stub: real implementation would submit to 2Captcha and poll for result
    void page; // acknowledge param
    return {
      success: false,
      error: 'Stub implementation — CAPTCHA solving not yet wired to 2Captcha API',
    };
  }

  /**
   * Check remaining balance on the 2Captcha account.
   */
  async getBalance(): Promise<number> {
    this.ensureConfigured();

    logger.warn('getBalance called — placeholder implementation, returning 0');
    return 0;
  }

  // ─── Internal ───

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error(
        'CAPTCHA solver not configured — requires 2Captcha API key. Set CAPTCHA_SOLVER_API_KEY in environment.',
      );
    }
  }
}
