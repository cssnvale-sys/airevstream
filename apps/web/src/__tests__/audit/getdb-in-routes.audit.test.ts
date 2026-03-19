/**
 * Bug Class 2: getDb() used in authenticated API routes
 *
 * Rule: Authenticated routes MUST use ctx.db (tenant-scoped) instead of getDb().
 * Only unauthenticated auth routes (login, register, forgot-password, reset-password)
 * are allowed to use getDb() directly.
 *
 * @see .claude/rules/06-backend.md — "Critical: Tenant-Scoped Database Access"
 * @see KNOWN-ISSUES.md KI-009
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  matchesAllowlist,
  GETDB_ALLOWLIST,
  usesAuthentication,
  usesGetDb,
} from './audit-helpers';

describe('Bug Class 2: getDb() in authenticated API routes', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should not use getDb() in authenticated routes', () => {
    const violations: string[] = [];

    for (const route of routes) {
      // Skip allowlisted auth routes
      if (matchesAllowlist(route.relativePath, GETDB_ALLOWLIST)) continue;

      // Only check routes that use authentication
      if (!usesAuthentication(route.content)) continue;

      if (usesGetDb(route.content)) {
        violations.push(route.relativePath);
      }
    }

    expect(violations, `Routes using getDb() instead of ctx.db:\n${violations.join('\n')}`).toEqual([]);
  });
});
