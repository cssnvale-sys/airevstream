/**
 * Bug Class 9: Missing rate limiting on write handlers
 *
 * Rule: Every write handler (POST, PUT, PATCH, DELETE) in authenticated routes
 * should have rate limiting via checkRateLimit(). This prevents abuse and
 * resource exhaustion.
 *
 * @see .claude/rules/07-security.md — "Access Control Checklist"
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  matchesAllowlist,
  RATE_LIMIT_EXEMPT,
  VIEWER_WRITE_EXEMPT,
  KNOWN_MISSING_RATE_LIMIT,
  extractHandlers,
  isWriteHandler,
  usesAuthentication,
} from './audit-helpers';

/** Patterns that indicate rate limiting is in place */
const RATE_LIMIT_PATTERNS = [
  /\bcheckRateLimit\b/,
  /\bRATE_LIMITS\b/,
  /\brl\.allowed\b/,
  /\bRATE_LIMITED\b/,
];

describe('Bug Class 9: Missing rate limiting on write handlers', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have rate limiting on write handlers', () => {
    const violations: string[] = [];

    for (const route of routes) {
      // Skip exempt routes
      if (matchesAllowlist(route.relativePath, RATE_LIMIT_EXEMPT)) continue;

      // Auth routes have their own rate limiting pattern (checked in file scope)
      if (matchesAllowlist(route.relativePath, VIEWER_WRITE_EXEMPT)) continue;

      // Only check authenticated routes
      if (!usesAuthentication(route.content)) continue;

      const handlers = extractHandlers(route.content);
      for (const handler of handlers) {
        if (!isWriteHandler(handler.method)) continue;

        // Check if rate limiting is in the handler body OR file-level (shared across handlers)
        const hasRateLimit = RATE_LIMIT_PATTERNS.some((p) => p.test(handler.body));
        const hasFileLevel = RATE_LIMIT_PATTERNS.some((p) => p.test(route.content));

        if (!hasRateLimit && !hasFileLevel) {
          const routeDir = route.relativePath.replace(/\/route\.ts$/, '');
          const key = `${routeDir}:${handler.method}`;
          // Skip known pre-existing violations
          if (KNOWN_MISSING_RATE_LIMIT.has(key)) continue;

          violations.push(
            `${route.relativePath}:${handler.startLine} — ${handler.method} handler missing rate limiting`,
          );
        }
      }
    }

    expect(violations, `Write handlers missing rate limiting:\n${violations.join('\n')}`).toEqual([]);
  });
});
