'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useSeries } from '@/hooks/use-series';
import { cn } from '@/lib/utils';
import { Layers, Plus, BookOpen, Film, Archive } from 'lucide-react';
import Link from 'next/link';
import { CreateSeriesModal } from '@/components/series/create-series-modal';
import { EmptyState } from '@/components/ui/empty-state';

interface SeriesRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  coverImageUrl: string | null;
  tags: string[];
  createdAt: string;
  channel: { id: string; name: string };
  _count: { episodes: number };
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
  active: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
  archived: { bg: 'bg-accent-orange/10', text: 'text-accent-orange' },
};

export default function SeriesPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const { data: rawData, isLoading, mutate } = useSeries<SeriesRow[]>();

  const seriesList = rawData?.data ?? [];
  const total = rawData?.meta?.total ?? seriesList.length;

  const activeCount = seriesList.filter((s) => s.status === 'active').length;
  const draftCount = seriesList.filter((s) => s.status === 'draft').length;
  const archivedCount = seriesList.filter((s) => s.status === 'archived').length;
  const totalEpisodes = seriesList.reduce((sum, s) => sum + s._count.episodes, 0);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Series</h1>
          <p className="text-text-secondary mt-1">Organize content into themed series within channels.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Series
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total</span>
            <Layers size={18} className="text-accent-purple" />
          </div>
          <p className="text-page-title text-text-primary">{total}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Active</span>
            <Film size={18} className="text-accent-green" />
          </div>
          <p className="text-page-title text-text-primary">{activeCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Drafts</span>
            <BookOpen size={18} className="text-accent-blue" />
          </div>
          <p className="text-page-title text-text-primary">{draftCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total Episodes</span>
            <Archive size={18} className="text-accent-orange" />
          </div>
          <p className="text-page-title text-text-primary">{totalEpisodes}</p>
        </div>
      </div>

      {/* Series table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-bg-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="No series yet"
            description="Create a series to organize your content into themed collections."
            actionLabel="Create First Series"
            onAction={() => setShowCreate(true)}
          />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-caption text-text-secondary">
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Channel</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Episodes</th>
                <th scope="col" className="px-4 py-3 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {seriesList.map((s) => {
                const badge = STATUS_BADGES[s.status] ?? STATUS_BADGES.draft;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/series/${s.id}`} className="font-medium text-text-primary hover:text-accent-blue transition-colors">
                        {s.name}
                      </Link>
                      {s.description && (
                        <p className="text-caption text-text-secondary mt-0.5 truncate max-w-xs">{s.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body text-text-secondary">{s.channel.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', badge.bg, badge.text)}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-body text-text-secondary">{s._count.episodes}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(s.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary">{tag}</span>
                        ))}
                        {(s.tags ?? []).length > 3 && (
                          <span className="text-xs text-text-secondary">+{s.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateSeriesModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => { mutate(); if (id) router.push(`/series/${id}`); }} />
    </AppLayout>
  );
}
