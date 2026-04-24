'use client';

import { useState } from 'react';
import { useSeriesEpisodes } from '@/hooks/use-series';
import { cn, formatDate } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AddEpisodeModal } from './add-episode-modal';
import { apiDelete } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: rawData, isLoading, mutate } = useSeriesEpisodes<Episode[]>(seriesId);

  const episodes = rawData?.data ?? [];

  const handleDelete = async (episodeId: string) => {
    try {
      setDeletingId(episodeId);
      await apiDelete(`/series/${seriesId}/episodes/${episodeId}`);
      toast.success('Episode removed');
      setDeleteId(null);
      mutate();
    } catch (err) {
      console.error('Failed to remove episode:', err);
      toast.error('Failed to remove episode');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-card-title text-text-primary">Episodes ({episodes.length})</h3>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
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
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary text-sm inline-flex items-center gap-2">
            <Plus size={14} />
            Add First Episode
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full" aria-label="Episodes">
            <thead className="sticky top-0 z-10 bg-bg-primary">
              <tr className="border-b border-border text-left text-caption text-text-secondary">
                <th scope="col" className="px-3 py-2 font-medium w-10">#</th>
                <th scope="col" className="px-3 py-2 font-medium">Title</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Score</th>
                <th scope="col" className="px-3 py-2 font-medium">Published</th>
                <th scope="col" className="px-3 py-2 font-medium w-10"></th>
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
                    {ep.publishedAt ? <time dateTime={ep.publishedAt}>{formatDate(ep.publishedAt)}</time> : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setDeleteId(ep.id)}
                      disabled={deletingId === ep.id}
                      className="text-text-secondary hover:text-accent-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove episode"
                      aria-label="Remove episode"
                    >
                      {deletingId === ep.id ? (
                        <div className="inline-block animate-spin">
                          <Trash2 size={14} />
                        </div>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Remove Episode"
        message="Remove this episode from the series? The underlying content will not be deleted."
        confirmLabel="Remove"
        variant="danger"
        isLoading={deletingId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <AddEpisodeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        seriesId={seriesId}
        onAdded={() => mutate()}
      />
    </div>
  );
}
