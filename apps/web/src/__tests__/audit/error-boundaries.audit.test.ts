import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const WEB_ROOT = path.resolve(__dirname, '../../..');
const APP_DIR = path.join(WEB_ROOT, 'src/app');

function findPageSegments(dir: string): string[] {
  const segments: string[] = [];

  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });

    // Check if this directory has a page.tsx
    const hasPage = entries.some(e => e.isFile() && e.name === 'page.tsx');
    if (hasPage) {
      segments.push(d);
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        walk(path.join(d, entry.name));
      }
    }
  }

  walk(dir);
  return segments;
}

describe('error boundaries coverage', () => {
  const segments = findPageSegments(APP_DIR);
  // Exclude API routes — they don't render UI
  const uiSegments = segments.filter(s => !s.includes('/api/'));

  it('should have found UI page segments', () => {
    expect(uiSegments.length).toBeGreaterThan(0);
  });

  it('all UI page segments should have an error.tsx', () => {
    const missing: string[] = [];
    for (const seg of uiSegments) {
      // Check this directory or any parent up to APP_DIR for error.tsx
      let dir = seg;
      let found = false;
      while (dir.length >= APP_DIR.length) {
        if (fs.existsSync(path.join(dir, 'error.tsx'))) {
          found = true;
          break;
        }
        dir = path.dirname(dir);
      }
      if (!found) {
        const rel = path.relative(APP_DIR, seg);
        missing.push(rel);
      }
    }
    expect(missing).toEqual([]);
  });
});
