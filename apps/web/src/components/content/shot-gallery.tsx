'use client';

import { cn } from '@/lib/utils';
import { Film, Clock, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { usePresignedUrl } from '@/hooks/use-presigned-url';
import { QualityBadge } from '@/components/ui/quality-badge';
import { EmptyState } from '@/components/ui/empty-state';

interface StoryboardShot {
  id: string;
  shotNumber: number;
  startSec: number;
  endSec: number;
  shotspec: Record<string, unknown> | null;
  keyframeUrls: string[] | null;
  status: string;
  qualityScore: number | null;
}

interface Storyboard {
  id: string;
  status: string;
  totalDurationSec: number | null;
  shots: StoryboardShot[];
}

function parseStorageUrl(url: string): { bucket: string; key: string } | null {
  // Format: "bucket/path/to/file" or "bucket-name/key"
  const slashIdx = url.indexOf('/');
  if (slashIdx <= 0) return null;
  return { bucket: url.slice(0, slashIdx), key: url.slice(slashIdx + 1) };
}

function KeyframeImage({ url }: { url: string }) {
  const parsed = parseStorageUrl(url);
  const { url: presignedUrl, isLoading } = usePresignedUrl(parsed?.bucket ?? null, parsed?.key ?? null);

  if (isLoading) {
    return (
      <div className="w-16 h-12 rounded bg-bg-tertiary flex items-center justify-center animate-pulse">
        <ImageIcon size={14} className="text-text-secondary opacity-40" />
      </div>
    );
  }

  if (!presignedUrl) {
    return (
      <div className="w-16 h-12 rounded bg-bg-tertiary flex items-center justify-center">
        <ImageIcon size={14} className="text-text-secondary opacity-40" />
      </div>
    );
  }

  return (
    <img
      src={presignedUrl}
      alt="Keyframe"
      className="w-16 h-12 rounded object-cover bg-bg-tertiary"
      loading="lazy"
    />
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ShotCard({ shot }: { shot: StoryboardShot }) {
  const [expanded, setExpanded] = useState(false);
  const spec = shot.shotspec as Record<string, unknown> | null;
  const duration = shot.endSec - shot.startSec;

  return (
    <div className="card p-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accent-purple/10 flex items-center justify-center text-accent-purple text-xs font-bold">
            {shot.shotNumber}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {(spec?.section as string) ?? `Shot ${shot.shotNumber}`}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock size={10} />
              <span>{formatDuration(duration)}</span>
              <span className={cn('badge text-xs', shot.status === 'generated' ? 'badge-active' : 'badge-idle')}>
                {shot.status}
              </span>
              {shot.qualityScore != null && <QualityBadge score={shot.qualityScore} size="sm" />}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {Boolean(spec?.text) && (
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Script</p>
              <p className="text-sm text-text-primary">{String(spec!.text)}</p>
            </div>
          )}
          {Boolean(spec?.visualDescription) && (
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Visual</p>
              <p className="text-sm text-text-primary">{String(spec!.visualDescription)}</p>
            </div>
          )}
          {Boolean(spec?.cameraMotion) && (
            <div className="flex items-center gap-1">
              <Film size={12} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">{String(spec!.cameraMotion)}</span>
            </div>
          )}
          {shot.keyframeUrls && shot.keyframeUrls.length > 0 && (
            <div className="flex gap-2 mt-2">
              {shot.keyframeUrls.map((url) => (
                <KeyframeImage key={url} url={url} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ShotGallery({ storyboards }: { storyboards: Storyboard[] }) {
  if (!storyboards || storyboards.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="No storyboards yet"
        description="Generate a storyboard to see shots here"
        className="py-6"
      />
    );
  }

  return (
    <div className="space-y-6">
      {storyboards.map((sb) => (
        <div key={sb.id}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={cn('badge text-xs', sb.status === 'approved' ? 'badge-active' : sb.status === 'in_production' ? 'badge-working' : 'badge-idle')}>
                {sb.status}
              </span>
              {sb.totalDurationSec != null && (
                <span className="text-xs text-text-secondary">{formatDuration(Number(sb.totalDurationSec))}</span>
              )}
            </div>
            <span className="text-xs text-text-secondary">{sb.shots.length} shots</span>
          </div>
          <div className="space-y-2">
            {sb.shots.map((shot) => (
              <ShotCard key={shot.id} shot={shot} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
