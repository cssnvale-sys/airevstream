/**
 * Bug Class: SWR hooks without error destructuring
 *
 * Rule: Every useApi(), useChannels(), useSeries(), useExperiments(), etc.
 * call that drives page-level or section-level rendering MUST destructure
 * `error` and display an error state when it's truthy. Otherwise, network
 * failures result in a silent blank screen.
 *
 * This test scans page files and key components for SWR hook calls and
 * verifies that `error` is destructured from the result.
 *
 * @see .claude/rules/05-frontend.md — "Data Fetching (SWR)"
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WEB_ROOT } from './audit-helpers';

/** Hook names that return SWR-style { data, error, isLoading } */
const SWR_HOOK_PATTERNS = [
  /\buse(?:Api|Channels|Channel|Series|SeriesDetail|SeriesAnalytics|SeriesEpisodes|Experiments|Experiment|ExperimentVariants|Approvals|Content|Workflows|SystemHealth|SystemMetrics|AffiliateProducts|AffiliateLinks|JobStatus|PresignedUrl|UserPresets)\b\s*[<(]/,
];

/** Known exceptions — hooks where error handling is deliberately omitted.
 *  These are dropdown/picker data sources where a silent empty fallback is acceptable. */
const KNOWN_EXCEPTIONS = new Set([
  // Filter dropdowns in library — empty array fallback is fine
  'src/app/library/page.tsx:useChannels',
  'src/app/library/page.tsx:useApi:/ai-services',
  // Dropdown data in content detail
  'src/app/content/[id]/page.tsx:useApi:/channels?limit=100',
  // Settings cinema-bible channel picker
  'src/app/settings/cinema-bible/page.tsx:useApi:/channels?limit=100',
  // Conditional fetch in approvals (trust scores only when panel open)
  'src/app/approvals/page.tsx:useApi:/approvals/trust-scores',
  // Analytics experiments tab — secondary data
  'src/app/analytics/page.tsx:useExperiments:limit=20',
  // Create page product picker — empty array fallback is fine
  'src/app/create/page.tsx:useAffiliateProducts',
  // Studio job status — shows placeholder when unavailable
  'src/app/studio/[contentId]/page.tsx:useJobStatus',
  // Presigned URL hooks — gracefully render placeholder when URL unavailable
  'src/app/assets/[assetId]/page.tsx:usePresignedUrl',
  'src/components/assets/asset-picker-modal.tsx:usePresignedUrl',
  'src/components/assets/avatar-card.tsx:usePresignedUrl',
  'src/components/assets/branding-editor.tsx:usePresignedUrl',
  'src/components/assets/scenery-card.tsx:usePresignedUrl',
  'src/components/channels/channel-assets-tab.tsx:usePresignedUrl',
  'src/components/content/shot-gallery.tsx:usePresignedUrl',
  // Component-level hooks with graceful empty fallback
  'src/components/accounts/avatar-assign-picker.tsx:useApi:avatars?limit=20',
  'src/components/assets/generation-status.tsx:useJobStatus',
  'src/components/cinema/pipeline-progress.tsx:useApi',
  'src/components/cinema/preset-picker.tsx:useUserPresets',
  'src/components/content/quality-breakdown.tsx:useApi',
  'src/components/layout/status-bar.tsx:useSystemMetrics',
  'src/components/series/create-series-modal.tsx:useApi:/channels?limit=100',
  'src/components/series/add-episode-modal.tsx:useApi',
  'src/components/series/episode-table.tsx:useSeriesEpisodes',
  'src/components/series/series-avatar-manager.tsx:useApi:/avatars?limit=100',
  'src/components/cinema/bible-editor.tsx:useApi:/comfyui/models',
  'src/components/cinema/provenance-viewer.tsx:useApi',
  'src/components/cinema/simple-create-wizard.tsx:useChannels',
  'src/components/cinema/viral-score-panel.tsx:useApi',
  'src/components/ui/command-palette.tsx:useApi',
]);

function findPageAndComponentFiles() {
  const dirs = [
    path.join(WEB_ROOT, 'src/app'),
    path.join(WEB_ROOT, 'src/components'),
  ];

  const files: Array<{ filePath: string; relativePath: string; content: string }> = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'api') continue;
        walk(full);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push({
          filePath: full,
          relativePath: path.relative(WEB_ROOT, full),
          content: fs.readFileSync(full, 'utf-8'),
        });
      }
    }
  }

  dirs.forEach(walk);
  return files;
}

describe('SWR error destructuring audit', () => {
  const files = findPageAndComponentFiles();

  it('should have found source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('all SWR hook calls should destructure error', () => {
    const violations: string[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line contains an SWR hook call
        const matchesHook = SWR_HOOK_PATTERNS.some((p) => p.test(line));
        if (!matchesHook) continue;

        // Extract the destructuring pattern: const { ... } = useXxx(...)
        const destructureMatch = line.match(/const\s*\{([^}]+)\}\s*=/);
        if (!destructureMatch) continue;

        const destructured = destructureMatch[1];

        // Check if 'error' is destructured (with or without alias like 'error: fetchError')
        const hasError = /\berror\b/.test(destructured);
        if (hasError) continue;

        // Build an exception key
        const hookName = line.match(/\b(use\w+)\s*[<(]/)?.[1] ?? 'unknown';
        const endpointMatch = line.match(/['"]([^'"]+)['"]/);
        const endpoint = endpointMatch ? `:${endpointMatch[1]}` : '';
        const key = `${file.relativePath}:${hookName}${endpoint}`;

        if (KNOWN_EXCEPTIONS.has(key)) continue;

        violations.push(`${file.relativePath}:${i + 1} — ${hookName}() missing error destructuring`);
      }
    }

    expect(
      violations,
      `SWR hooks without error destructuring:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
