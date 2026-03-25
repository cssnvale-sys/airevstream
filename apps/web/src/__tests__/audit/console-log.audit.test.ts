/**
 * Bug Class 12: console.log / debugger in production code
 *
 * Rule: Production source files must not contain console.log() or debugger
 * statements. Use console.error/console.warn for legitimate logging, or
 * the pino logger for structured logging.
 *
 * Already in the bug catalog (#4) but was not automated until now.
 *
 * Excludes: test files, seed files, comments.
 * Allows: console.error, console.warn, console.debug (for dev-gated logging).
 *
 * @see .claude/rules/08-audit-process.md — Bug Pattern #4
 */

import { describe, it, expect } from 'vitest';
import { findProductionSourceFiles } from './audit-helpers';

const CONSOLE_LOG_RE = /\bconsole\.log\s*\(/;
const DEBUGGER_RE = /\bdebugger\b/;

/**
 * Known legitimate console.log usages.
 * Format: "relativePath" (from monorepo root)
 * Remove entries when the log is removed; the test ensures they don't come back.
 */
export const KNOWN_CONSOLE_LOGS = new Set<string>([
  // Add legitimate usages here if needed (e.g., startup banners in services)
]);

/** Check if a line is inside a comment */
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

describe('Bug Class 12: console.log / debugger in production code', () => {
  const files = findProductionSourceFiles();

  it('should have found production source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not have console.log or debugger in production code', () => {
    const violations: string[] = [];

    for (const file of files) {
      if (KNOWN_CONSOLE_LOGS.has(file.relativePath)) continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line)) continue;

        if (CONSOLE_LOG_RE.test(line)) {
          violations.push(`${file.relativePath}:${i + 1} — console.log() found`);
        }
        if (DEBUGGER_RE.test(line)) {
          // Extra check: skip if it's inside a string (e.g., 'debugger' as a keyword reference)
          const trimmed = line.trimStart();
          if (!trimmed.startsWith("'") && !trimmed.startsWith('"') && !trimmed.startsWith('`')) {
            violations.push(`${file.relativePath}:${i + 1} — debugger statement found`);
          }
        }
      }
    }

    expect(
      violations,
      `console.log / debugger found in production code:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
