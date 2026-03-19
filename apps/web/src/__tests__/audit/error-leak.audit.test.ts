/**
 * Bug Class 3: err.message leaked in error responses
 *
 * Rule: API routes MUST use static error message strings in error() calls.
 * Never pass err.message, error.message, or template literals containing
 * error details to the error() response helper.
 *
 * @see .claude/rules/06-backend.md — "Error Responses"
 * @see .claude/rules/07-security.md — "Error Sanitization"
 */

import { describe, it, expect } from 'vitest';
import { findApiRouteFiles } from './audit-helpers';

/** Patterns that indicate error message leaking in the error() response helper.
 *  Must NOT match console.error() — only the response helper error('CODE', msg).
 *  The response helper is always called as a standalone `error(` or `return error(`.
 */
const LEAK_PATTERNS = [
  // error('CODE', err.message, ...) — must be preceded by return/= or start of statement, NOT console.
  /(?<!\w\.)error\(\s*['"][A-Z_]+['"],\s*(?:err|error|e)\.message\b/,
  // error('CODE', `...${err...}...`, ...)
  /(?<!\w\.)error\(\s*['"][A-Z_]+['"],\s*`[^`]*\$\{(?:err|error|e)\b/,
  // error('CODE', String(err), ...)
  /(?<!\w\.)error\(\s*['"][A-Z_]+['"],\s*String\((?:err|error|e)\)/,
];

describe('Bug Class 3: err.message leaked in error responses', () => {
  const routes = findApiRouteFiles();

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should not leak error messages in error() calls', () => {
    const violations: string[] = [];

    for (const route of routes) {
      const lines = route.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

        for (const pattern of LEAK_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${route.relativePath}:${i + 1} — ${line.trim()}`);
            break;
          }
        }
      }
    }

    expect(violations, `Routes leaking error messages:\n${violations.join('\n')}`).toEqual([]);
  });
});
