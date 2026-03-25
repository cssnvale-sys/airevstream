/**
 * Bug Class 11: .strict() Zod schemas rejecting valid payloads
 *
 * Rule: .strict() on Zod schemas rejects any field not explicitly listed.
 * When the frontend sends extra fields (e.g. SWR cache keys, React state),
 * the request fails with a 400 even though the data is valid.
 *
 * Already in the bug catalog (#1) but was not automated until now.
 *
 * Strategy: All 78 .strict() uses were removed in Session 39 audit.
 * The allowlist is now empty. Any new .strict() addition will fail this test.
 *
 * @see .claude/rules/08-audit-process.md — Bug Pattern #1
 */

import { describe, it, expect } from 'vitest';
import { findApiRouteFiles } from './audit-helpers';

/**
 * Known .strict() usages — all 78 were removed in Session 39 audit.
 * Format: route relativePath (e.g. "accounts/[id]/route.ts")
 * If you must add .strict(), add the route here with justification.
 */
export const KNOWN_STRICT_SCHEMAS = new Set<string>([
  // Empty — all .strict() removed in Session 39
]);

describe('Bug Class 11: .strict() Zod schemas', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should not use .strict() on Zod schemas unless allowlisted', () => {
    const violations: string[] = [];

    for (const route of routes) {
      if (KNOWN_STRICT_SCHEMAS.has(route.relativePath)) continue;

      if (/\.strict\(\)/.test(route.content)) {
        violations.push(`${route.relativePath} — has .strict() on Zod schema (use .passthrough() or remove)`);
      }
    }

    expect(
      violations,
      `.strict() Zod schemas found (these reject valid payloads with extra fields):\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
