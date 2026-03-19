/**
 * Bug Class 1: Silent catch blocks
 *
 * Rule: Every catch block MUST log the error (console.error, console.warn,
 * log.error) or rethrow it. Silent catches hide bugs and make debugging
 * impossible.
 *
 * @see .claude/rules/06-backend.md — "Error Handling"
 */

import { describe, it, expect } from 'vitest';
import { findApiRouteFiles, extractCatchBlocks, KNOWN_SILENT_CATCHES } from './audit-helpers';

/** Patterns that indicate the catch block is NOT silent */
const VALID_CATCH_PATTERNS = [
  /console\.(error|warn|log)\b/,
  /log\.(error|warn|info)\b/,
  /\bthrow\b/,
  /\breturn\s+error\b/,     // return error(...) in route handlers
  /\breturn\s+notFound\b/,
  /\breturn\s+forbidden\b/,
  /\breturn\s+validationError\b/,
];

/** Known false positives — catch blocks that intentionally swallow errors */
const INTENTIONAL_SWALLOW_PATTERNS = [
  // JWT verify catch that returns a proper error response
  /return\s+error\(/,
  // fire-and-forget update that's non-critical
  /\.catch\(\s*\(/,
];

describe('Bug Class 1: Silent catch blocks', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should not have silent catch blocks', () => {
    const violations: string[] = [];

    for (const route of routes) {
      const catchBlocks = extractCatchBlocks(route.content);

      for (const block of catchBlocks) {
        const body = block.body;

        // Check if any valid pattern matches
        const hasLogging = VALID_CATCH_PATTERNS.some((p) => p.test(body));
        if (hasLogging) continue;

        // Check if it's an intentional swallow
        const isIntentional = INTENTIONAL_SWALLOW_PATTERNS.some((p) => p.test(body));
        if (isIntentional) continue;

        const key = `${route.relativePath}:${block.lineNumber}`;
        // Skip known pre-existing violations
        if (KNOWN_SILENT_CATCHES.has(key)) continue;

        violations.push(`${key} — catch block without error logging`);
      }
    }

    expect(violations, `Silent catch blocks found:\n${violations.join('\n')}`).toEqual([]);
  });
});
