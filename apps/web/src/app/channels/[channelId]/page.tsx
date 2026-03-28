'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useChannel } from '@/hooks/use-channels';
import { useChannelViralStats } from '@/hooks/use-channel-viral';
import { apiPut } from '@/hooks/use-api';
import { LoadingButton } from '@/components/ui/loading-button';
import { NicheTagInput } from '@/components/channels/niche-tag-input';
import { ChannelViralDashboard } from '@/components/channels/channel-viral-dashboard';
import { cn } from '@/lib/utils';
import { Radio, ArrowLeft, Save, Layers } from 'lucide-react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useChannelSeries } from '@/hooks/use-series';
import { SeriesCard } from '@/components/series/series-card';
import { CreateSeriesModal } from '@/components/series/create-series-modal';
import { ChannelAssetsTab } from '@/components/channels/channel-assets-tab';

interface ChannelDetail {
  id: string;
  name: string;
  niches: string[];
  tone: string | null;
  personality: string | null;
  targetAudience: string | null;
  status: string;
  primaryLanguage: string;
  socialAccount: {
    id: string;
    platform: string;
    username: string;
    emailAccount?: { id: string; email: string; tier: string; status: string };
  };
  contentItemsCount: number;
}

// useApi<T>() returns SWR<{ success, data: T }> — rawData is the full response, rawData.data = T

interface ContentRow {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
  viralScore: number | null;
  viralTier: string | null;
  createdAt: string;
}

interface ViralStatsData {
  channel: { id: string; name: string };
  totalContent: number;
  scoredContent: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  topContent: ContentRow[];
  trend: Array<{ date: string; score: number | null }>;
  tierCounts: Record<string, number>;
}

type Tab = 'profile' | 'content' | 'series' | 'assets' | 'viral';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'content', label: 'Content' },
  { key: 'series', label: 'Series' },
  { key: 'assets', label: 'Assets' },
  { key: 'viral', label: 'Viral Analysis' },
];

const TONE_OPTIONS = [
  '', 'cinematic', 'dramatic', 'comedic', 'professional', 'casual', 'educational', 'energetic', 'calm', 'inspirational',
];

export default function ChannelDetailPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { data: rawData, isLoading, mutate } = useChannel<ChannelDetail>(channelId);
  const { data: viralRaw } = useChannelViralStats<ViralStatsData>(channelId);
  const { data: seriesRaw, mutate: mutateSeries } = useChannelSeries<Array<{ id: string; name: string; description: string | null; status: string; tags: string[]; _count: { episodes: number } }>>(channelId);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [showCreateSeries, setShowCreateSeries] = useState(false);

  // Editable profile state
  const channel = rawData?.data;
  const [niches, setNiches] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [personality, setPersonality] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Sync form state from fetched data (re-syncs after save + mutate)
  useEffect(() => {
    if (channel) {
      setNiches(channel.niches ?? []);
      setTone(channel.tone ?? '');
      setPersonality(channel.personality ?? '');
      setTargetAudience(channel.targetAudience ?? '');
    }
  }, [channel]);

  const viralStats = viralRaw?.data;

  const handleSaveProfile = async () => {
    if (!channel) return;
    setSaving(true);
    try {
      await apiPut(`/channels/${channel.id}`, {
        niches,
        tone: tone || null,
        personality: personality || null,
        targetAudience: targetAudience || null,
      });
      toast.success('Channel profile updated');
      mutate();
    } catch (err) {
      console.error('Failed to update channel:', err);
      toast.error('Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      </AppLayout>
    );
  }

  if (!channel) {
    return (
      <AppLayout>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Radio size={32} className="text-text-secondary mb-3" />
          <h3 className="text-lg font-medium text-text-primary">Channel not found</h3>
          <Link href="/channels" className="btn-primary mt-4 inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Channels
          </Link>
        </div>
      </AppLayout>
    );
  }

  const renderProfileTab = () => (
    <div className="space-y-6 max-w-2xl">
      {/* Channel info header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Radio size={20} className="text-accent-blue" />
          </div>
          <div>
            <h3 className="text-card-title text-text-primary">{channel.name}</h3>
            <p className="text-caption text-text-secondary capitalize">
              {channel.socialAccount?.platform} &middot; @{channel.socialAccount?.username}
            </p>
          </div>
        </div>
      </div>

      {/* Identity form */}
      <div className="card space-y-4">
        <h3 className="text-card-title text-text-primary">Channel Identity</h3>

        <div>
          <label className="text-caption text-text-secondary block mb-1">Niches</label>
          <NicheTagInput value={niches} onChange={setNiches} />
          <p className="text-caption text-text-tertiary mt-1">Press Enter to add a niche tag</p>
        </div>

        <div>
          <label htmlFor="channel-tone" className="text-caption text-text-secondary block mb-1">Tone</label>
          <select
            id="channel-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="input w-full"
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t || 'Select tone...'}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="channel-personality" className="text-caption text-text-secondary block mb-1">Personality</label>
          <textarea
            id="channel-personality"
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="input w-full resize-none"
            rows={3}
            placeholder="Describe the channel's personality and voice..."
          />
        </div>

        <div>
          <label htmlFor="channel-target-audience" className="text-caption text-text-secondary block mb-1">Target Audience</label>
          <textarea
            id="channel-target-audience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="input w-full resize-none"
            rows={3}
            placeholder="Describe the target audience..."
          />
        </div>

        <LoadingButton
          onClick={handleSaveProfile}
          loading={saving}
          loadingText="Saving..."
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          Save Profile
        </LoadingButton>
      </div>
    </div>
  );

  const renderContentTab = () => {
    const content = viralStats?.topContent ?? [];
    return (
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-card-title text-text-primary mb-4">Channel Content</h3>
          <div className="flex gap-4 mb-4">
            <div className="text-center">
              <p className="text-page-title text-text-primary">{viralStats?.totalContent ?? channel.contentItemsCount}</p>
              <p className="text-caption text-text-secondary">Total</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-text-primary">{viralStats?.scoredContent ?? 0}</p>
              <p className="text-caption text-text-secondary">Scored</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-accent-blue">{viralStats?.avgScore ?? 0}</p>
              <p className="text-caption text-text-secondary">Avg Score</p>
            </div>
          </div>
        </div>

        {content.length > 0 ? (
          <div className="card overflow-x-auto">
            <h3 className="text-card-title text-text-primary p-4 pb-2">Top Content by Viral Score</h3>
            <table className="w-full text-body" aria-label="Channel content">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="text-left py-2 px-4 text-text-secondary font-medium">Title</th>
                  <th scope="col" className="text-left py-2 px-4 text-text-secondary font-medium">Type</th>
                  <th scope="col" className="text-right py-2 px-4 text-text-secondary font-medium">Score</th>
                  <th scope="col" className="text-left py-2 px-4 text-text-secondary font-medium">Tier</th>
                </tr>
              </thead>
              <tbody>
                {content.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 px-4 text-text-primary">{item.title ?? 'Untitled'}</td>
                    <td className="py-2 px-4 text-text-secondary capitalize">{item.contentType}</td>
                    <td className="py-2 px-4 text-right font-mono text-text-primary">{item.viralScore ?? '-'}</td>
                    <td className="py-2 px-4">
                      {item.viralTier ? (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-caption font-medium capitalize',
                          item.viralTier === 'viral' ? 'bg-accent-green/10 text-accent-green' :
                          item.viralTier === 'high' ? 'bg-accent-blue/10 text-accent-blue' :
                          item.viralTier === 'medium' ? 'bg-accent-orange/10 text-accent-orange' :
                          'bg-accent-red/10 text-accent-red',
                        )}>
                          {item.viralTier}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center py-8 text-text-secondary">
            No scored content yet. Create content for this channel to see viral analysis.
          </div>
        )}
      </div>
    );
  };

  const renderViralTab = () => (
    <ChannelViralDashboard channelId={channel.id} />
  );

  const renderSeriesTab = () => {
    const channelSeries = seriesRaw?.data ?? [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-card-title text-text-primary">Series ({channelSeries.length})</h3>
          <button type="button" onClick={() => setShowCreateSeries(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Layers size={14} />
            New Series
          </button>
        </div>
        {channelSeries.length === 0 ? (
          <div className="card text-center py-8">
            <Layers size={32} className="mx-auto text-text-secondary mb-3" />
            <p className="text-text-secondary mb-3">No series for this channel yet.</p>
            <button type="button" onClick={() => setShowCreateSeries(true)} className="btn-primary text-sm">
              Create First Series
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channelSeries.map((s) => (
              <SeriesCard key={s.id} series={s} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/channels" className="p-1.5 rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors" aria-label="Back to channels">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-page-title text-text-primary">{channel.name}</h1>
          <p className="text-text-secondary capitalize">
            {channel.socialAccount?.platform} &middot; @{channel.socialAccount?.username}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Channel sections" className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            id={`channel-tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`channel-panel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-body font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`channel-panel-${activeTab}`} aria-labelledby={`channel-tab-${activeTab}`}>
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'content' && renderContentTab()}
        {activeTab === 'series' && renderSeriesTab()}
        {activeTab === 'assets' && <ChannelAssetsTab channelId={channelId} />}
        {activeTab === 'viral' && renderViralTab()}
      </div>

      <CreateSeriesModal
        open={showCreateSeries}
        onClose={() => setShowCreateSeries(false)}
        onCreated={() => mutateSeries()}
        defaultChannelId={channelId}
      />
    </AppLayout>
  );
}
