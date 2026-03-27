'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiPost } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { Download } from 'lucide-react';
import { LoadingButton } from '@/components/ui/loading-button';

interface ExportVariantsProps {
  contentId: string;
  storyboardId: string;
  channelId: string;
  topic?: string;
  contentType?: string;
  qualityTier: string;
}

interface VariantOption {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  aspect: string;
  codec: 'h264' | 'prores';
}

const VARIANT_OPTIONS: VariantOption[] = [
  {
    id: 'youtube-16:9',
    label: 'YouTube (16:9)',
    description: '1920x1080, 24fps, h264',
    width: 1920, height: 1080, fps: 24,
    aspect: '16:9', codec: 'h264',
  },
  {
    id: 'reels-9:16',
    label: 'Reels / TikTok (9:16)',
    description: '1080x1920, 30fps, h264',
    width: 1080, height: 1920, fps: 30,
    aspect: '9:16', codec: 'h264',
  },
  {
    id: 'square-1:1',
    label: 'Square (1:1)',
    description: '1080x1080, 30fps, h264',
    width: 1080, height: 1080, fps: 30,
    aspect: '1:1', codec: 'h264',
  },
  {
    id: 'archive-prores',
    label: 'Archive (ProRes)',
    description: '1920x1080, 24fps, ProRes',
    width: 1920, height: 1080, fps: 24,
    aspect: '16:9', codec: 'prores',
  },
  {
    id: '4k-uhd',
    label: '4K UHD',
    description: '3840x2160 • 24fps • H.264',
    width: 3840, height: 2160, fps: 24,
    aspect: '16:9', codec: 'h264',
  },
  {
    id: 'stories-9:16',
    label: 'Mobile Stories',
    description: '1080x1920 • 15fps • H.264',
    width: 1080, height: 1920, fps: 15,
    aspect: '9:16', codec: 'h264',
  },
];

export function ExportVariants({ contentId, storyboardId, channelId, topic, contentType, qualityTier }: ExportVariantsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['youtube-16:9']));
  const [exporting, setExporting] = useState(false);

  const toggleVariant = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (selected.size === 0) {
      toast.error('Select at least one format');
      return;
    }

    setExporting(true);
    try {
      const variants = VARIANT_OPTIONS.filter((v) => selected.has(v.id));

      // Queue a render job for each selected variant
      for (const variant of variants) {
        await apiPost('/pipeline/cinema', {
          contentId,
          storyboardId,
          channelId,
          topic: topic ?? 'Untitled',
          contentType: contentType ?? 'short',
          qualityTier,
          exportVariant: {
            label: variant.label,
            width: variant.width,
            height: variant.height,
            fps: variant.fps,
            aspect: variant.aspect,
            codec: variant.codec,
          },
        });
      }

      toast.success(`${variants.length} export${variants.length > 1 ? 's' : ''} queued`);
    } catch (err) {
      console.error('Failed to queue exports:', err);
      toast.error('Failed to queue exports');
    } finally {
      setExporting(false);
    }
  }, [selected, contentId, storyboardId, channelId, topic, contentType, qualityTier]);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-bg-tertiary border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Export Variants</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelected(new Set(VARIANT_OPTIONS.map(v => v.id)))}
            className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
          >
            All
          </button>
          <LoadingButton
            onClick={handleExport}
            loading={exporting}
            disabled={selected.size === 0}
            loadingText={`Export (${selected.size})`}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Download size={12} />
            Export ({selected.size})
          </LoadingButton>
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {VARIANT_OPTIONS.map((variant) => (
          <label
            key={variant.id}
            className={cn(
              'flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors',
              selected.has(variant.id)
                ? 'border-accent-blue/50 bg-accent-blue/5'
                : 'border-border hover:bg-bg-tertiary',
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(variant.id)}
              onChange={() => toggleVariant(variant.id)}
              className="rounded border-border bg-bg-tertiary text-accent-blue focus:ring-accent-blue"
            />
            <div>
              <div className="text-xs font-medium text-text-primary">{variant.label}</div>
              <div className="text-[11px] text-text-tertiary">{variant.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
