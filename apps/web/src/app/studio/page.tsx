'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useApi } from '@/hooks/use-api';
import { cn, formatRelativeTime, statusColor } from '@/lib/utils';
import { Film, Search, ArrowRight, Clapperboard, AlertTriangle, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useDebounce } from '@/hooks/use-debounce';

interface StudioItem {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
  qualityScore: number | null;
  createdAt: string;
  updatedAt: string;
  channel: { id: string; name: string } | null;
}

export default function StudioIndexPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const query = new URLSearchParams({
    page: '1',
    limit: '50',
    sort: 'updatedAt',
    order: 'desc',
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const { data, isLoading, error, mutate } = useApi<StudioItem[]>(`/content?${query.toString()}`);

  const items: StudioItem[] = data?.data ?? [];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Studio</h1>
        <p className="text-sm text-text-secondary mt-1">
          Open content items in the cinema production studio to edit shots, timelines, and render videos.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search content"
          className="input pl-9 w-full max-w-md"
        />
      </div>

      {/* Content list */}
      {error ? (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-8 text-center">
          <AlertTriangle size={32} className="text-accent-red mx-auto mb-3" />
          <p className="text-accent-red font-medium mb-1">Failed to load content</p>
          <p className="text-sm text-text-secondary mb-4">Something went wrong. Please try again.</p>
          <button type="button" onClick={() => mutate()} className="btn-secondary btn-sm inline-flex items-center gap-2">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No content yet"
          description="Create content with Cinema quality tier to use the studio."
          actionLabel="Create content"
          actionHref="/create"
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/studio/${item.id}`}
              className="card flex items-center gap-4 hover:border-accent-blue/50 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                <Film size={18} className="text-accent-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate" title={item.title ?? 'Untitled'}>
                  {item.title ?? 'Untitled'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('badge text-xs', statusColor(item.status))}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-text-tertiary">{item.contentType.replace(/_/g, ' ')}</span>
                  {item.channel && (
                    <span className="text-xs text-text-secondary">{item.channel.name}</span>
                  )}
                  {item.qualityScore != null && (
                    <span className="text-xs text-text-secondary">
                      Score: {Number(item.qualityScore).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <time dateTime={item.updatedAt} className="text-xs text-text-tertiary">{formatRelativeTime(item.updatedAt)}</time>
                <ArrowRight size={14} className="text-text-tertiary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
