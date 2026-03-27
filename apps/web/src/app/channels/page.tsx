'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useChannels } from '@/hooks/use-channels';
import { cn } from '@/lib/utils';
import { Radio, Hash, Globe, Film } from 'lucide-react';
import Link from 'next/link';

interface ChannelRow {
  id: string;
  name: string;
  niches: string[];
  tone: string | null;
  status: string;
  primaryLanguage: string;
  createdAt: string;
  socialAccount: {
    id: string;
    platform: string;
    username: string;
    status: string;
    healthScore: number | null;
  } | null;
  contentItemsCount: number;
  avatarsCount: number;
}

// useApi<T> returns SWR<{ success, data: T, meta }>
// For paginated endpoints, the raw JSON is { success, data: ChannelRow[], meta: { total, ... } }
// We type T as the data array, then access meta from the raw response via cast
type ChannelsRawResponse = { data: ChannelRow[]; meta: { total: number; page: number; limit: number; pages: number } };

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
  paused: { bg: 'bg-accent-orange/10', text: 'text-accent-orange' },
  disabled: { bg: 'bg-accent-red/10', text: 'text-accent-red' },
  archived: { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'text-accent-red',
  tiktok: 'text-accent-blue',
  instagram: 'text-accent-purple',
  facebook: 'text-accent-blue',
};

export default function ChannelsPage() {
  const [page, setPage] = useState(1);
  const { data: rawData, isLoading } = useChannels<ChannelRow[]>(`page=${page}&limit=20`);

  // Cast to access the full API response shape (paginated helper returns { data, meta })
  const response = rawData as unknown as ChannelsRawResponse | undefined;
  const channels = response?.data ?? [];
  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.pages ?? 1;

  const activeCount = channels.filter(c => c.status === 'active').length;
  const totalContent = channels.reduce((sum, c) => sum + c.contentItemsCount, 0);
  const platforms = new Set(channels.map(c => c.socialAccount?.platform).filter(Boolean));

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Channels</h1>
          <p className="text-text-secondary mt-1">Manage channel identities, niches, and viral performance.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total Channels</span>
            <Radio size={18} className="text-accent-blue" />
          </div>
          <p className="text-page-title text-text-primary">{total}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Active</span>
            <Globe size={18} className="text-accent-green" />
          </div>
          <p className="text-page-title text-text-primary">{activeCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Platforms</span>
            <Hash size={18} className="text-accent-purple" />
          </div>
          <p className="text-page-title text-text-primary">{platforms.size}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-text-secondary">Total Content</span>
            <Film size={18} className="text-accent-orange" />
          </div>
          <p className="text-page-title text-text-primary">{totalContent}</p>
        </div>
      </div>

      {/* Channels table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : channels.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Radio size={32} className="text-text-secondary mb-3" />
          <h3 className="text-lg font-medium text-text-primary">No channels yet</h3>
          <p className="text-sm text-text-secondary mt-1">
            Channels are created from the Accounts page when you add social accounts.
          </p>
          <Link href="/accounts" className="btn-primary mt-4">
            Go to Accounts
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Name</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Platform</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Niches</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Tone</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Content</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => {
                const badge = STATUS_BADGES[ch.status] ?? STATUS_BADGES.active;
                const platformColor = PLATFORM_COLORS[ch.socialAccount?.platform ?? ''] ?? 'text-text-secondary';
                return (
                  <tr key={ch.id} className="border-b border-border last:border-b-0 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/channels/${ch.id}`} className="text-text-primary hover:text-accent-blue font-medium">
                        {ch.name}
                      </Link>
                      {ch.socialAccount?.username && (
                        <p className="text-caption text-text-tertiary mt-0.5">@{ch.socialAccount.username}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('capitalize', platformColor)}>
                        {ch.socialAccount?.platform ?? '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {ch.niches.length > 0 ? ch.niches.slice(0, 3).map((niche) => (
                          <span key={niche} className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded text-caption">
                            {niche}
                          </span>
                        )) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                        {ch.niches.length > 3 && (
                          <span className="text-caption text-text-tertiary">+{ch.niches.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-secondary capitalize">{ch.tone ?? '-'}</td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded-full text-caption font-medium capitalize', badge.bg, badge.text)}>
                        {ch.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">{ch.contentItemsCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-4 py-2 border-t border-border flex items-center justify-between">
              <span className="text-caption text-text-tertiary">{total} channel{total !== 1 ? 's' : ''}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-caption text-text-secondary px-2 py-1">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary text-caption px-2 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
