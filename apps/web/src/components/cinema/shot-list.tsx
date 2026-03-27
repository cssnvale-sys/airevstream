'use client';

import type { ShotData } from './shot-editor-panel';

interface ShotListProps {
  shots: ShotData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-accent-amber/20 text-accent-amber',
  generating: 'bg-accent-blue/20 text-accent-blue',
  generated: 'bg-accent-green/20 text-accent-green',
  approved: 'bg-accent-green/20 text-accent-green',
  failed: 'bg-accent-red/20 text-accent-red',
};

export function ShotList({ shots, selectedId, onSelect }: ShotListProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider px-2 py-1">
        Shots ({shots.length})
      </div>
      {shots.map((shot) => (
        <button
          type="button"
          key={shot.id}
          onClick={() => onSelect(shot.id)}
          className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
            selectedId === shot.id
              ? 'bg-accent-blue/10 text-text-primary border border-accent-blue/30'
              : 'text-text-secondary hover:bg-bg-tertiary border border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">Shot {shot.shotNumber}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[shot.status] ?? 'bg-bg-tertiary text-text-secondary'}`}>
              {shot.status}
            </span>
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {shot.startSec}s - {shot.endSec}s
            {shot.qualityScore != null && (
              <span className="ml-2">QC: {Number(shot.qualityScore)}</span>
            )}
          </div>
          {shot.keyframeUrls.length > 0 && (
            <div className="mt-1 h-8 bg-bg-tertiary rounded overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-accent-blue/20 to-accent-purple/20" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
