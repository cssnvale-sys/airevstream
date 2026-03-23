'use client';

import { cn } from '@/lib/utils';

interface Shot {
  id: string;
  shotNumber: number;
  startSec: number | null;
  endSec: number | null;
  status: string;
  qualityScore: number | null;
  keyframeUrls: string[] | null;
  shotspec: Record<string, unknown> | null;
}

interface ShotTableProps {
  shots: Shot[];
  selectedShotId?: string;
  onSelectShot: (shotId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  generating: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  generated: 'bg-green-500/20 text-green-400 border-green-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function formatTimecode(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function ShotTable({ shots, selectedShotId, onSelectShot }: ShotTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-tertiary border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-10">#</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-16">Thumb</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Duration</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Camera</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Dialogue</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-24">Status</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-16">QC</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary w-20">Timecode</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const spec = shot.shotspec ?? {};
            const camera = spec.camera as Record<string, string> | undefined;
            const dialogue = (spec.dialogue as string) ?? '';
            const duration = shot.endSec != null && shot.startSec != null
              ? Number(shot.endSec) - Number(shot.startSec)
              : null;
            const thumb = (shot.keyframeUrls as string[] | null)?.[0];

            return (
              <tr
                key={shot.id}
                onClick={() => onSelectShot(shot.id)}
                className={cn(
                  'border-b border-border cursor-pointer transition-colors',
                  selectedShotId === shot.id
                    ? 'bg-accent-blue/10'
                    : 'hover:bg-bg-tertiary/50',
                )}
              >
                <td className="px-3 py-2 text-text-primary font-medium">{shot.shotNumber}</td>
                <td className="px-3 py-2">
                  {thumb ? (
                    <div className="w-10 h-7 rounded bg-bg-tertiary overflow-hidden">
                      <img src={thumb} alt={`Shot ${shot.shotNumber}`} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-7 rounded bg-bg-tertiary" />
                  )}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {duration != null ? `${duration.toFixed(1)}s` : '--'}
                </td>
                <td className="px-3 py-2 text-text-secondary text-xs">
                  {camera ? `${camera.lens ?? ''} ${camera.framing ?? ''}`.trim() || '--' : '--'}
                </td>
                <td className="px-3 py-2 text-text-tertiary text-xs max-w-[200px] truncate">
                  {dialogue || '--'}
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border',
                    STATUS_COLORS[shot.status] ?? STATUS_COLORS['pending'],
                  )}>
                    {shot.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {shot.qualityScore != null ? Number(shot.qualityScore) : '--'}
                </td>
                <td className="px-3 py-2 text-text-tertiary font-mono text-xs">
                  {formatTimecode(shot.startSec != null ? Number(shot.startSec) : null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shots.length === 0 && (
        <div className="text-center py-8 text-text-tertiary text-sm">No shots yet</div>
      )}
    </div>
  );
}
