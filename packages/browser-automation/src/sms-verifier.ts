import type { Platform } from './types.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('sms-verifier');

// ─── Types ───

export interface SmsActivation {
  activationId: string;
  phoneNumber: string;
  platform: string;
}

/**
 * SMS verification via sms-activate.org API.
 *
 * Stub implementation (D064): throws a descriptive error when no API key
 * is configured; returns placeholder results when an API key is present.
 */
export class SmsVerifier {
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Request a phone number for SMS verification on the given platform.
   */
  async requestNumber(platform: Platform): Promise<SmsActivation> {
    this.ensureConfigured();

    logger.warn({ platform }, 'requestNumber called — placeholder implementation, returning stub activation');

    return {
      activationId: `stub-${Date.now()}`,
      phoneNumber: '+10000000000',
      platform,
    };
  }

  /**
   * Poll for the verification code sent to the activated number.
   */
  async getCode(activationId: string): Promise<string | null> {
    this.ensureConfigured();

    logger.warn({ activationId }, 'getCode called — placeholder implementation, returning null');

    // Stub: real implementation would poll sms-activate.org for the SMS code
    return null;
  }

  /**
   * Release a phone number back to the pool (cancel or mark complete).
   */
  async releaseNumber(activationId: string): Promise<void> {
    this.ensureConfigured();

    logger.warn({ activationId }, 'releaseNumber called — placeholder implementation, no-op');
  }

  // ─── Internal ───

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error(
        'SMS verifier not configured — requires sms-activate.org API key. Set SMS_VERIFIER_API_KEY in environment.',
      );
    }
  }
}
