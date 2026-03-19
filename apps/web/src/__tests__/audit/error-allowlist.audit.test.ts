/**
 * Bug Class 7: Error message allowlist mismatch
 *
 * Rule: Auth frontend pages use a safeMessages allowlist to filter API error
 * messages. Every user-facing error message from the API must appear in the
 * frontend allowlist. If the API message changes, the allowlist must update.
 *
 * @see .claude/rules/05-frontend.md — "Error Message Contracts"
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  readAuthPage,
  extractErrorMessages,
  extractSafeMessages,
} from './audit-helpers';

/** Map of auth page name → API route relative path */
const AUTH_PAIRS: Array<{ page: string; apiRoute: string }> = [
  { page: 'login', apiRoute: 'auth/login/route.ts' },
  { page: 'register', apiRoute: 'auth/register/route.ts' },
  { page: 'forgot-password', apiRoute: 'auth/forgot-password/route.ts' },
  { page: 'reset-password', apiRoute: 'auth/reset-password/route.ts' },
];

/**
 * Error messages that are NOT user-facing and should be excluded from
 * allowlist comparison. These are either generic fallbacks or internal errors.
 */
const NON_USER_FACING = new Set([
  'An unexpected error occurred',        // 500 — never shown to users
  'Authentication service unavailable',  // 500 — infrastructure error
  'Missing or invalid token',            // 401 — handled by auth middleware redirect
  'Invalid token',                       // 401 — handled by auth middleware redirect
  'User not found',                      // 401 — handled by auth middleware redirect
  'Invalid or expired token',            // 401 — handled by auth middleware redirect
]);

describe('Bug Class 7: Error message allowlist mismatch', () => {
  it('should have all auth page pairs available', () => {
    for (const pair of AUTH_PAIRS) {
      const content = readAuthPage(pair.page);
      expect(content, `Auth page ${pair.page} not found`).not.toBeNull();
    }
  });

  for (const pair of AUTH_PAIRS) {
    it(`${pair.page}: API error messages should be in frontend safeMessages`, () => {
      const routes = findApiRouteFiles();
      const routeFile = routes.find((r) => r.relativePath === pair.apiRoute);
      expect(routeFile, `API route ${pair.apiRoute} not found`).toBeDefined();

      const pageContent = readAuthPage(pair.page);
      expect(pageContent, `Auth page ${pair.page} not found`).not.toBeNull();

      const apiMessages = extractErrorMessages(routeFile!.content)
        .filter((msg) => !NON_USER_FACING.has(msg));

      const safeMessages = extractSafeMessages(pageContent!);

      // Check: every user-facing API error message should be in the allowlist
      const missing = apiMessages.filter((msg) => !safeMessages.includes(msg));

      // Validation errors are dynamic (Zod) — skip them
      const realMissing = missing.filter((msg) =>
        !msg.includes('Validation') && !msg.includes('validation'));

      expect(
        realMissing,
        `${pair.page}: API messages not in safeMessages:\n${realMissing.map((m) => `  - "${m}"`).join('\n')}`,
      ).toEqual([]);
    });
  }
});
