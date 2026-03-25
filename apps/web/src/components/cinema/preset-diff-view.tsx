'use client';

import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible, FIELD_VISIBILITY } from '@/lib/complexity-fields';
import type { PresetDiffEntry } from '@airevstream/shared';
import { useState } from 'react';

interface PresetDiffViewProps {
  diff: PresetDiffEntry[];
}

export function PresetDiffView({ diff }: PresetDiffViewProps) {
  const { mode } = useComplexityMode();
  const [collapsed, setCollapsed] = useState(false);

  if (!isVisible(FIELD_VISIBILITY.presetDiff, mode)) return null;
  if (diff.length === 0) return null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-tertiary hover:bg-border text-sm font-medium text-text-primary transition-colors"
      >
        <span>Preset Changes ({diff.length})</span>
        <span className="text-text-tertiary">{collapsed ? '+' : '\u2212'}</span>
      </button>
      {!collapsed && (
        <div className="p-2 space-y-1">
          {diff.map((entry) => (
            <div key={entry.path} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-bg-primary">
              <span className="text-text-secondary font-mono min-w-[120px]">{entry.label}</span>
              {entry.before !== undefined ? (
                <>
                  <span className="text-amber-400">{formatValue(entry.before)}</span>
                  <span className="text-text-tertiary">&rarr;</span>
                  <span className="text-emerald-400">{formatValue(entry.after)}</span>
                </>
              ) : (
                <span className="text-emerald-400">+ {formatValue(entry.after)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === undefined) return '\u2014';
  if (val === null) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
