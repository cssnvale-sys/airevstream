'use client';

import { useState } from 'react';
import { useSeriesEpisodes } from '@/hooks/use-series';
import { cn } from '@/lib/utils';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AddEpisodeModal } from './add-episode-modal';
import { apiDelete } from '@/hooks/use-api';
import { toast } from 'sonner';

interface Episode {
  id: string;
  episodeNumber: number;
  position: number;
  title: string | null;
  publishedAt: string | null;
  content: {
    id: string;
    title: string | null;
    status: string;
    contentType: string;
    thumbnailUrl: string | null;
    qualityScore: number | null;
  };
}

interface Props {
  seriesId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-text-secondary',
  generating: 'text-accent-purple',
  generated: 'text-accent-blue',
  approved: 'text-accent-green',
  posted: 'text-accent-green',
  failed: 'text-accent-red',
};

export function EpisodeTable({ seriesId }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: rawData, isLoading, mutate } = useSeriesEpisodes<Episode[]>(seriesId);

  const episodes = rawData?.data ?? [];

  const handleDelete = async (episodeId: string) => {
    if (!confirm('Remove this episode from the series?')) return;
    try {
      await apiDelete(`/series/${seriesId}/episodes/${episodeId}`);
      toast.success('Episode removed');
      mutate();
    } catch {
      toast.error('Failed to remove episode');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-card-title text-text-primary">Episodes ({episodes.length})</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} />
          Add Episode
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-text-secondary mb-3">No episodes yet. Add content items as episodes.</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm inline-flex items-center gap-2">
            <Plus size={14} />
            Add First Episode
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-caption text-text-secondary">
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Published</th>
                <th className="px-3 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} className="border-b border-border last:border-0 hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-3 py-2 text-sm text-text-secondary font-mono">{ep.episodeNumber}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/studio?content=${ep.content.id}`}
                      className="text-sm font-medium text-text-primary hover:text-accent-blue transition-colors"
                    >
                      {ep.title || ep.content.title || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-text-secondary">{ep.content.contentType}</td>
                  <td className="px-3 py-2">
                    <span className={cn('text-sm', STATUS_COLORS[ep.content.status] ?? 'text-text-secondary')}>
                      {ep.content.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-text-secondary">
                    {ep.content.qualityScore != null ? ep.content.qualityScore.toFixed(1) : '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-text-secondary">
                    {ep.publishedAt ? new Date(ep.publishedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="text-text-secondary hover:text-accent-red transition-colors"
                      title="Remove episode"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEpisodeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        seriesId={seriesId}
        onAdded={() => mutate()}
      />
    </div>
  );
}
