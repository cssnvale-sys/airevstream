import { mkdir, readFile, writeFile, unlink, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext } from 'playwright';
import { createLogger } from '@airevstream/shared';
import type { Platform, SessionState } from './types.js';

const logger = createLogger('session-manager');

/** Default directory for persisted session data. */
const DEFAULT_STORAGE_DIR = '.sessions';

/**
 * Manages browser session persistence by extracting and restoring
 * cookies and storage state from Playwright browser contexts.
 *
 * Session files are stored as JSON at:
 *   {storageDir}/{platform}/{accountId}.json
 */
export class SessionManager {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir ?? DEFAULT_STORAGE_DIR;
  }

  /**
   * Build the filesystem path for a given account's session file.
   */
  private sessionPath(accountId: string, platform: Platform): string {
    return join(this.storageDir, platform, `${accountId}.json`);
  }

  /**
   * Ensure the directory for a platform exists.
   */
  private async ensureDir(platform: Platform): Promise<void> {
    const dir = join(this.storageDir, platform);
    await mkdir(dir, { recursive: true });
  }

  /**
   * Save the current browser context state (cookies, storage) to a JSON file.
   * Extracts Playwright's storageState which includes cookies and origins data.
   */
  async saveSession(
    accountId: string,
    platform: Platform,
    context: BrowserContext,
  ): Promise<void> {
    await this.ensureDir(platform);

    const storageState = await context.storageState();

    // Get the last visited URL from any open page
    const pages = context.pages();
    const lastUrl = pages.length > 0 ? pages[pages.length - 1].url() : undefined;

    // Flatten origins' localStorage into a combined record
    const localStorageEntries: Record<string, string> = {};
    for (const origin of storageState.origins) {
      for (const entry of origin.localStorage) {
        const key = `${origin.origin}::${entry.name}`;
        localStorageEntries[key] = entry.value;
      }
    }

    const sessionState: SessionState = {
      cookies: storageState.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
      })),
      localStorage: Object.keys(localStorageEntries).length > 0 ? localStorageEntries : undefined,
      lastUrl: lastUrl !== 'about:blank' ? lastUrl : undefined,
    };

    const filePath = this.sessionPath(accountId, platform);
    await writeFile(filePath, JSON.stringify(sessionState, null, 2), 'utf-8');

    logger.info(
      { accountId, platform, cookies: sessionState.cookies.length, path: filePath },
      'Session saved',
    );
  }

  /**
   * Load a previously saved session into a browser context.
   * Restores cookies and navigates to the last URL if available.
   */
  async loadSession(
    accountId: string,
    platform: Platform,
    context: BrowserContext,
  ): Promise<boolean> {
    const filePath = this.sessionPath(accountId, platform);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      logger.debug({ accountId, platform }, 'No saved session found');
      return false;
    }

    let sessionState: SessionState;
    try {
      sessionState = JSON.parse(raw) as SessionState;
    } catch (err) {
      logger.warn({ accountId, platform, err }, 'Failed to parse session file');
      return false;
    }

    // Filter out expired cookies
    const now = Date.now() / 1000;
    const validCookies = sessionState.cookies.filter((c) => {
      if (c.expires === undefined || c.expires === -1) return true;
      return c.expires > now;
    });

    // Add cookies to context
    if (validCookies.length > 0) {
      await context.addCookies(
        validCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires ?? -1,
        })),
      );
    }

    // Restore localStorage by navigating to each origin and injecting values
    if (sessionState.localStorage && Object.keys(sessionState.localStorage).length > 0) {
      // Group entries by origin
      const byOrigin: Map<string, Array<{ name: string; value: string }>> = new Map();
      for (const [key, value] of Object.entries(sessionState.localStorage)) {
        const sepIndex = key.indexOf('::');
        if (sepIndex === -1) continue;
        const origin = key.substring(0, sepIndex);
        const name = key.substring(sepIndex + 2);
        if (!byOrigin.has(origin)) {
          byOrigin.set(origin, []);
        }
        byOrigin.get(origin)!.push({ name, value });
      }

      // For each origin, open a page and set localStorage
      for (const [origin, entries] of byOrigin) {
        try {
          const page = await context.newPage();
          await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.evaluate((items: Array<{ name: string; value: string }>) => {
            for (const item of items) {
              localStorage.setItem(item.name, item.value);
            }
          }, entries);
          await page.close();
        } catch (err) {
          logger.debug({ origin, err }, 'Failed to restore localStorage for origin');
        }
      }
    }

    logger.info(
      { accountId, platform, cookies: validCookies.length, skippedExpired: sessionState.cookies.length - validCookies.length },
      'Session loaded',
    );

    // Navigate to the last URL if available
    if (sessionState.lastUrl) {
      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();
      try {
        await page.goto(sessionState.lastUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (err) {
        logger.debug({ lastUrl: sessionState.lastUrl, err }, 'Failed to navigate to last URL');
      }
    }

    return true;
  }

  /**
   * Check whether a saved session file exists for the given account.
   */
  async hasSession(accountId: string, platform: Platform): Promise<boolean> {
    try {
      const filePath = this.sessionPath(accountId, platform);
      await stat(filePath);
      return true;
    } catch (err) {
      logger.debug({ accountId, platform, err }, 'No session file found');
      return false;
    }
  }

  /**
   * Delete the saved session file for an account.
   */
  async clearSession(accountId: string, platform: Platform): Promise<void> {
    const filePath = this.sessionPath(accountId, platform);
    try {
      await unlink(filePath);
      logger.info({ accountId, platform }, 'Session cleared');
    } catch (err) {
      // File might not exist; that's fine
      logger.debug({ accountId, platform, err }, 'No session to clear');
    }
  }

  /**
   * Check whether a saved session is older than the given maximum age.
   * Returns true if the session is expired or does not exist.
   */
  async isSessionExpired(
    accountId: string,
    platform: Platform,
    maxAgeHours: number,
  ): Promise<boolean> {
    try {
      const filePath = this.sessionPath(accountId, platform);
      const fileStat = await stat(filePath);
      const ageMs = Date.now() - fileStat.mtimeMs;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      return ageMs > maxAgeMs;
    } catch (err) {
      // No session file means it's "expired"
      logger.debug({ accountId, platform, err }, 'Session file not found — treating as expired');
      return true;
    }
  }

  /**
   * List all saved sessions for a specific platform.
   */
  async listSessions(platform: Platform): Promise<string[]> {
    const dir = join(this.storageDir, platform);
    try {
      const files = await readdir(dir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch (err) {
      logger.debug({ platform, err }, 'Failed to list sessions directory');
      return [];
    }
  }
}
