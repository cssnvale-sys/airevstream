/**
 * Bug Class 8: Missing viewer role checks on write handlers
 *
 * Rule: Every write handler (POST, PUT, PATCH, DELETE) in authenticated routes
 * must check for the viewer role and block the operation. Viewers should only
 * be able to read data.
 *
 * @see .claude/rules/07-security.md — "Access Control Checklist"
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  matchesAllowlist,
  VIEWER_WRITE_EXEMPT,
  KNOWN_MISSING_VIEWER_CHECKS,
  extractHandlers,
  isWriteHandler,
  usesAuthentication,
} from './audit-helpers';

/** Patterns that indicate a viewer role check */
const VIEWER_CHECK_PATTERNS = [
  /role\s*===?\s*['"]viewer['"]/,
  /['"]viewer['"]\s*===?\s*(?:ctx\.)?role/,
  /\bforbidden\b/,
  /\brequireAdmin\b/,
];

describe('Bug Class 8: Missing viewer role checks on write handlers', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should block viewers on all write handlers', () => {
    const violations: string[] = [];

    for (const route of routes) {
      // Skip exempt routes
      if (matchesAllowlist(route.relativePath, VIEWER_WRITE_EXEMPT)) continue;

      // Only check authenticated routes
      if (!usesAuthentication(route.content)) continue;

      const handlers = extractHandlers(route.content);
      for (const handler of handlers) {
        if (!isWriteHandler(handler.method)) continue;

        const hasCheck = VIEWER_CHECK_PATTERNS.some((p) => p.test(handler.body));
        if (!hasCheck) {
          const routeDir = route.relativePath.replace(/\/route\.ts$/, '');
          const key = `${routeDir}:${handler.method}`;
          // Skip known pre-existing violations
          if (KNOWN_MISSING_VIEWER_CHECKS.has(key)) continue;

          violations.push(
            `${route.relativePath}:${handler.startLine} — ${handler.method} handler missing viewer role check`,
          );
        }
      }
    }

    expect(violations, `Write handlers missing viewer role check:\n${violations.join('\n')}`).toEqual([]);
  });
});
