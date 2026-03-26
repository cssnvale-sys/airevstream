/**
 * Bug Class 5: Data shape mismatches between API and frontend
 *
 * Rule: Frontend destructured fields must match the Prisma include/select
 * in the API route. This test catches the most common sub-patterns.
 *
 * This is the most complex rule and will grow incrementally.
 *
 * @see .claude/rules/05-frontend.md — "The #1 Bug Class: Data Shape Mismatches"
 */

import { describe, it, expect } from 'vitest';
import { findApiRouteFiles, extractHandlers } from './audit-helpers';

describe('Bug Class 5: Data shape mismatches', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('routes with channel include should select at least id and name', () => {
    // False positives: routes where the regex matches a nested relation's select
    // (e.g., socialAccount select inside channel select). The actual channel select
    // in these routes includes id and name — the regex can't parse nested braces.
    const KNOWN_FALSE_POSITIVES = new Set([
      'cinema-bible/[id]/route.ts',
      'cinema-bible/route.ts',
      'content/viral-score/route.ts',
      'content/viral-suggestions/route.ts',
    ]);
    const violations: string[] = [];

    for (const route of routes) {
      // Look for channel includes
      const channelInclude = /include:\s*\{[^}]*channel:\s*\{[^}]*select:\s*\{([^}]+)\}/gs;
      let match: RegExpExecArray | null;

      while ((match = channelInclude.exec(route.content)) !== null) {
        const selectFields = match[1];
        if (!selectFields.includes('id') || !selectFields.includes('name')) {
          if (!KNOWN_FALSE_POSITIVES.has(route.relativePath)) {
            violations.push(
              `${route.relativePath} — channel select missing 'id' or 'name': ${selectFields.trim()}`,
            );
          }
        }
      }
    }

    expect(violations, `Channel includes missing required fields:\n${violations.join('\n')}`).toEqual([]);
  });

  it('routes should not mix paginated() with non-array data', () => {
    const violations: string[] = [];

    for (const route of routes) {
      const handlers = extractHandlers(route.content);
      for (const handler of handlers) {
        // Check for paginated() call with a non-array variable
        // Common mistake: paginated(item, ...) instead of paginated(items, ...)
        const paginatedCall = handler.body.match(/\bpaginated\(\s*(\w+)\s*,/);
        if (paginatedCall) {
          const varName = paginatedCall[1];
          // If it doesn't look like a plural/array variable, flag it
          if (!/(?:items|data|list|results|accounts|channels|entries|posts|products|shots|clicks|jobs|alerts|metrics|scores|budgets|templates|storefronts|messages|logs|subscriptions|keys|converted|mapped|serialized|conversations|paged|errors|users|families|services|avatars|bibles|pools|records|rows|cohorts|enrollments|presets|assets)\b/.test(varName)) {
            violations.push(
              `${route.relativePath}:${handler.startLine} — paginated() called with possibly non-array: ${varName}`,
            );
          }
        }
      }
    }

    expect(violations, `Possible paginated() with non-array:\n${violations.join('\n')}`).toEqual([]);
  });

  it('routes returning success() should not spread raw Prisma result for models with Decimal fields', () => {
    const violations: string[] = [];
    // Check for `return success(item)` pattern on models known to have Decimal fields
    // The decimal-wrapping test handles the specific fields, this catches the pattern
    const modelsWithDecimals = [
      'contentItem', 'aiService', 'affiliateProduct', 'storyboardShot',
      'costBudget', 'approvalTrustScore', 'promptTemplate', 'knowledgeBaseEntry',
      'systemMetric', 'storyboard', 'scheduledPost',
    ];

    for (const route of routes) {
      for (const model of modelsWithDecimals) {
        // Check if route queries this model and returns raw result
        const queriesModel = new RegExp(`ctx\\.db\\.${model}\\.(create|update|findUnique|findFirst)\\(`).test(route.content);
        if (!queriesModel) continue;

        // Check for raw return: `return success(variableName)` where the variable
        // is directly from a Prisma query without mapping
        const rawReturn = /return\s+success\(\s*(\w+)\s*\)/.test(route.content);
        if (!rawReturn) continue;

        // If there's a .map() or Number() or spread with transformation, it's fine
        const hasTransform = /\.map\(|Number\(|\.\.\.(?:\w+),/.test(route.content);
        if (hasTransform) continue;

        violations.push(
          `${route.relativePath} — may return raw ${model} result without Decimal transformation`,
        );
      }
    }

    // Advisory: these are potential issues, not guaranteed violations
    // Keeping as expect for now — will refine as false positives are identified
    expect(violations, `Routes potentially returning raw Decimal data:\n${violations.join('\n')}`).toEqual([]);
  });
});
