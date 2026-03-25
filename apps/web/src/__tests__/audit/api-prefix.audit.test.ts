/**
 * Bug Class 10: Double /api/v1 prefix in frontend mutation helpers
 *
 * Rule: apiPost, apiPut, apiPatch, apiDelete, and useApi all auto-prepend
 * `/api/v1`. Passing a path that already starts with `/api/v1/` creates a
 * double-prefix 404 (e.g. `/api/v1/api/v1/experiments`).
 *
 * Found 12 instances across 2 sessions — this is a top-3 recurring bug.
 *
 * @see packages/shared MEMORY.md — "CRITICAL apiPost pattern"
 */

import { describe, it, expect } from 'vitest';
import { findFrontendSourceFiles } from './audit-helpers';

/**
 * Matches calls like:
 *   apiPost('/api/v1/...')
 *   apiPut(`/api/v1/...`)
 *   apiPatch("/api/v1/...")
 *   apiDelete('/api/v1/...')
 *   useApi('/api/v1/...')
 *   useApi<Type>('/api/v1/...')
 */
const DOUBLE_PREFIX_RE = /\b(apiPost|apiPut|apiPatch|apiDelete|useApi)\s*(<[^>]*>)?\s*\(\s*[`'"]\/?api\/v1\//;

describe('Bug Class 10: Double /api/v1 prefix', () => {
  const files = findFrontendSourceFiles();

  it('should have found frontend source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not use /api/v1 prefix in mutation helpers or useApi', () => {
    const violations: string[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        if (DOUBLE_PREFIX_RE.test(line)) {
          violations.push(`${file.relativePath}:${i + 1} — ${trimmed.trim()}`);
        }
      }
    }

    expect(
      violations,
      `Double /api/v1 prefix found (these helpers auto-prepend /api/v1):\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
