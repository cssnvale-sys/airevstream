'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useSeriesDetail } from '@/hooks/use-series';
import { cn } from '@/lib/utils';
import { Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EpisodeTable } from '@/components/series/episode-table';
import { SeriesAvatarManager } from '@/components/series/series-avatar-manager';
import { SeriesAnalytics } from '@/components/series/series-analytics';
import { apiPut } from '@/hooks/use-api';
import { toast } from '@/lib/toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';

interface SeriesDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  coverImageUrl: string | null;
  targetAudience: string | null;
  tags: string[];
  defaultPresetIds: string[];
  defaultRecipeId: string | null;
  bibleOverrides: Record<string, unknown>;
  postingCadence: Record<string, unknown>;
  youtubePlaylistId: string | null;
  baseSeed: number | null;
  channel: { id: string; name: string };
  seriesAvatars: Array<{
    seriesId: string;
    avatarId: string;
    isPrimary: boolean;
    role: string | null;
    avatar: { id: string; name: string; images: Record<string, unknown> };
  }>;
  _count: { episodes: number; contentItems: number };
}

type Tab = 'overview' | 'episodes' | 'avatars' | 'analytics';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'episodes', label: 'Episodes' },
  { key: 'avatars', label: 'Avatars' },
  { key: 'analytics', label: 'Analytics' },
];

const STATUS_OPTIONS = ['draft', 'active', 'archived'];

export default function SeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { data: rawData, isLoading, error: fetchError, mutate } = useSeriesDetail<SeriesDetail>(seriesId);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const series = rawData?.data;

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);
      await apiPut(`/series/${seriesId}`, { status: newStatus });
      toast.success(`Series status updated to ${newStatus}`);
      mutate();
    } catch (err) {
      console.error('Failed to update series status:', err);
      toast.error('Failed to update series status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-64 bg-bg-tertiary rounded" />
          <div className="h-40 bg-bg-tertiary rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (fetchError || !series) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <Layers size={48} className="mx-auto text-text-secondary mb-4" />
          <h2 className="text-lg font-semibold text-text-primary">{fetchError ? 'Failed to load series' : 'Series not found'}</h2>
          <Link href="/series" className="text-accent-blue hover:underline mt-2 inline-block">Back to series</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Breadcrumb items={[{ label: 'Series', href: '/series' }, { label: series?.name ?? 'Untitled', href: '#', isActive: true }]} />
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/series" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1 mb-2">
            <ArrowLeft size={14} />
            Back to Series
          </Link>
          <h1 className="text-page-title text-text-primary">{series.name}</h1>
          {series.description && <p className="text-text-secondary mt-1">{series.description}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-text-secondary">Channel: <span className="text-text-primary">{series.channel.name}</span></span>
            <span className="text-sm text-text-secondary">{series._count.episodes} episodes</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={series.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            aria-label="Series status"
            className="input text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div role="tablist" className="flex gap-6">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              id={`series-tab-${tab.key}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`series-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`series-panel-${activeTab}`} aria-labelledby={`series-tab-${activeTab}`}>
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-card-title text-text-primary mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-caption text-text-secondary">Target Audience</dt>
                <dd className="text-body text-text-primary">{series.targetAudience || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">Tags</dt>
                <dd className="flex gap-1 flex-wrap mt-1">
                  {(series.tags ?? []).length > 0 ? series.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary">{tag}</span>
                  )) : <span className="text-body text-text-secondary">No tags</span>}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">YouTube Playlist</dt>
                <dd className="text-body text-text-primary">{series.youtubePlaylistId || 'Not linked'}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">Base Seed</dt>
                <dd className="text-body text-text-primary">{series.baseSeed ?? 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">Default Recipe</dt>
                <dd className="text-body text-text-primary">{series.defaultRecipeId || 'None'}</dd>
              </div>
            </dl>
          </div>
          <div className="card">
            <h3 className="text-card-title text-text-primary mb-4">Posting Cadence</h3>
            {Object.keys(series.postingCadence).length > 0 ? (
              <pre className="text-xs text-text-secondary bg-bg-tertiary p-3 rounded overflow-auto">
                {JSON.stringify(series.postingCadence, null, 2)}
              </pre>
            ) : (
              <p className="text-text-secondary text-sm">No posting schedule configured.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'episodes' && (
        <EpisodeTable seriesId={seriesId} />
      )}

      {activeTab === 'avatars' && (
        <SeriesAvatarManager seriesId={seriesId} avatars={series.seriesAvatars} onUpdate={() => mutate()} />
      )}

      {activeTab === 'analytics' && (
        <SeriesAnalytics seriesId={seriesId} />
      )}
      </div>
    </AppLayout>
  );
}
