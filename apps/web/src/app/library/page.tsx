'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useContent, useChannels, useApi } from '@/hooks/use-api';
import { cn, formatRelativeTime, statusColor } from '@/lib/utils';
import {
  Search, LayoutGrid, List, ChevronLeft, ChevronRight,
  FileText, Image, Film, Video, Mic, ImageIcon,
  Star, Calendar, SlidersHorizontal,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentItem {
  id: string;
  title: string | null;
  contentType: string;
  status: string;
  qualityScore: number | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  version: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  channel: { id: string; name: string; primaryLanguage: string } | null;
  aiService: { id: string; name: string } | null;
}

interface Channel {
  id: string;
  name: string;
}

interface AiService {
  id: string;
  name: string;
}

type ViewMode = 'grid' | 'list';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_TYPES = ['', 'text', 'image', 'video_short', 'video_long', 'voice', 'thumbnail'];
const STATUS_OPTIONS = [
  '', 'draft', 'generating', 'generated', 'pending_approval',
  'approved', 'scheduled', 'posted', 'archived', 'failed',
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'title:asc', label: 'Title A-Z' },
  { value: 'title:desc', label: 'Title Z-A' },
  { value: 'qualityScore:desc', label: 'Highest quality' },
  { value: 'qualityScore:asc', label: 'Lowest quality' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
];
const PER_PAGE_OPTIONS = [20, 40, 60];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentTypeIcon(type: string): typeof FileText {
  switch (type) {
    case 'text': return FileText;
    case 'image': return Image;
    case 'video_short': return Film;
    case 'video_long': return Video;
    case 'voice': return Mic;
    case 'thumbnail': return ImageIcon;
    default: return FileText;
  }
}

function contentTypeColor(type: string): string {
  switch (type) {
    case 'text': return 'bg-blue-500/20 text-blue-400';
    case 'image': return 'bg-purple-500/20 text-purple-400';
    case 'video_short': return 'bg-pink-500/20 text-pink-400';
    case 'video_long': return 'bg-red-500/20 text-red-400';
    case 'voice': return 'bg-green-500/20 text-green-400';
    case 'thumbnail': return 'bg-amber-500/20 text-amber-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function contentTypeBgColor(type: string): string {
  switch (type) {
    case 'text': return 'bg-blue-900/30';
    case 'image': return 'bg-purple-900/30';
    case 'video_short': return 'bg-pink-900/30';
    case 'video_long': return 'bg-red-900/30';
    case 'voice': return 'bg-green-900/30';
    case 'thumbnail': return 'bg-amber-900/30';
    default: return 'bg-gray-900/30';
  }
}

function contentTypeLabel(type: string): string {
  switch (type) {
    case 'text': return 'Text';
    case 'image': return 'Image';
    case 'video_short': return 'Short Video';
    case 'video_long': return 'Long Video';
    case 'voice': return 'Voice';
    case 'thumbnail': return 'Thumbnail';
    default: return type;
  }
}

function qualityColor(score: number | null): string {
  if (score === null) return 'text-text-secondary';
  if (score >= 8) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="card p-0 overflow-hidden">
          <div className="aspect-video animate-pulse bg-bg-tertiary rounded-t" />
          <div className="p-3 space-y-2">
            <div className="h-4 animate-pulse bg-bg-tertiary rounded w-3/4" />
            <div className="flex items-center gap-2">
              <div className="h-3 animate-pulse bg-bg-tertiary rounded w-16" />
              <div className="h-3 animate-pulse bg-bg-tertiary rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="w-14 h-10 animate-pulse bg-bg-tertiary rounded" />
          <div className="flex-1 h-4 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-20 h-3 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-24 h-3 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-20 h-3 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-12 h-3 animate-pulse bg-bg-tertiary rounded" />
          <div className="w-16 h-3 animate-pulse bg-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
      <FileText className="w-12 h-12 mb-4 opacity-40" />
      <p className="text-lg font-medium mb-1">No content found</p>
      <p className="text-sm">Create your first content piece or adjust the filters.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid Card
// ---------------------------------------------------------------------------

function ContentCard({ item }: { item: ContentItem }) {
  const Icon = contentTypeIcon(item.contentType);

  return (
    <Link href={`/content/${item.id}`} className="block">
      <div className="card p-0 overflow-hidden group hover:ring-1 hover:ring-border transition-all">
        {/* Thumbnail */}
        <div className={cn('aspect-video flex items-center justify-center relative', contentTypeBgColor(item.contentType))}>
          <Icon size={32} className="opacity-30" />
          {/* Type badge */}
          <span className={cn('absolute top-2 left-2 text-xs font-medium px-1.5 py-0.5 rounded', contentTypeColor(item.contentType))}>
            {contentTypeLabel(item.contentType)}
          </span>
          {/* Status badge */}
          <span className={cn('absolute top-2 right-2 text-xs font-medium px-1.5 py-0.5 rounded', statusColor(item.status))}>
            {item.status.replace('_', ' ')}
          </span>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <p className="text-sm font-medium text-text-primary truncate group-hover:text-white transition-colors">
            {item.title ?? 'Untitled'}
          </p>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              {item.qualityScore !== null && (
                <span className={cn('flex items-center gap-0.5', qualityColor(Number(item.qualityScore)))}>
                  <Star size={10} />
                  {Number(item.qualityScore).toFixed(1)}
                </span>
              )}
              {item.aiService && (
                <span className="truncate max-w-[80px]">{item.aiService.name}</span>
              )}
            </div>
            <span>{formatRelativeTime(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// List Row
// ---------------------------------------------------------------------------

function ContentRow({ item }: { item: ContentItem }) {
  const Icon = contentTypeIcon(item.contentType);

  return (
    <Link href={`/content/${item.id}`} className="block">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors cursor-pointer">
        {/* Thumbnail */}
        <div className={cn('w-14 h-10 rounded flex items-center justify-center flex-shrink-0', contentTypeBgColor(item.contentType))}>
          <Icon size={16} className="opacity-50" />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{item.title ?? 'Untitled'}</p>
        </div>

        {/* Type */}
        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0', contentTypeColor(item.contentType))}>
          {contentTypeLabel(item.contentType)}
        </span>

        {/* Channel */}
        <span className="text-xs text-text-secondary truncate max-w-[100px] flex-shrink-0">
          {item.channel?.name ?? '--'}
        </span>

        {/* AI Model */}
        <span className="text-xs text-text-secondary truncate max-w-[80px] flex-shrink-0">
          {item.aiService?.name ?? '--'}
        </span>

        {/* Quality */}
        <span className={cn('text-xs font-medium w-10 text-center flex-shrink-0', qualityColor(item.qualityScore !== null ? Number(item.qualityScore) : null))}>
          {item.qualityScore !== null ? Number(item.qualityScore).toFixed(1) : '--'}
        </span>

        {/* Status */}
        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0', statusColor(item.status))}>
          {item.status.replace('_', ' ')}
        </span>

        {/* Date */}
        <span className="text-xs text-text-secondary w-16 text-right flex-shrink-0">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LibraryPage() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortValue, setSortValue] = useState('createdAt:desc');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Fetch channels and AI services for filter dropdowns
  const { data: channelsData } = useChannels();
  const { data: servicesData } = useApi<AiService[]>('/ai-services');
  const channels = (channelsData?.data ?? []) as Channel[];
  const aiServices = (servicesData?.data ?? []) as AiService[];

  // Parse sort
  const [sortField, sortOrder] = useMemo(() => {
    const [field, order] = sortValue.split(':');
    return [field, order] as [string, string];
  }, [sortValue]);

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(perPage));
    p.set('sort', sortField);
    p.set('order', sortOrder);
    if (search) p.set('search', search);
    if (filterType) p.set('contentType', filterType);
    if (filterStatus) p.set('status', filterStatus);
    if (filterChannel) p.set('channelId', filterChannel);
    return p.toString();
  }, [page, perPage, sortField, sortOrder, search, filterType, filterStatus, filterChannel]);

  const { data, isLoading, error, mutate } = useContent(queryParams);

  const allItems = (data?.data ?? []) as ContentItem[];
  const meta = data?.meta ?? { total: 0, page: 1, limit: perPage, pages: 1 };

  // Client-side filter for AI model (not in API)
  const items = useMemo(() => {
    let filtered = allItems;
    if (filterModel) {
      filtered = filtered.filter((item) => item.aiService?.id === filterModel);
    }
    // Date range filtering client-side
    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter((item) => new Date(item.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => new Date(item.createdAt) <= to);
    }
    return filtered;
  }, [allItems, filterModel, dateFrom, dateTo]);

  const handleRefresh = useCallback(() => { mutate(); }, [mutate]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterType('');
    setFilterStatus('');
    setFilterChannel('');
    setFilterModel('');
    setDateFrom('');
    setDateTo('');
    setSortValue('createdAt:desc');
    setPage(1);
  }, []);

  const hasActiveFilters = search || filterType || filterStatus || filterChannel || filterModel || dateFrom || dateTo;

  // Pagination helpers
  const startItem = Math.min((meta.page - 1) * meta.limit + 1, meta.total);
  const endItem = Math.min(meta.page * meta.limit, meta.total);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Content Library</h1>
          <p className="text-text-secondary text-sm mt-1">Browse and manage all generated content</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('btn-secondary flex items-center gap-2', showFilters && 'ring-1 ring-accent-blue')}
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
          <div className="flex items-center bg-bg-secondary border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid' ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card mb-4 space-y-3">
        {/* Primary row: search + type + status + sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search titles and prompts..."
              className="input w-full pl-9"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="input"
          >
            <option value="">All Types</option>
            {CONTENT_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{contentTypeLabel(t)}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="input"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <select
            value={sortValue}
            onChange={(e) => { setSortValue(e.target.value); setPage(1); }}
            className="input"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Extended filters row (togglable) */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <select
              value={filterChannel}
              onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">All Channels</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
            <select
              value={filterModel}
              onChange={(e) => { setFilterModel(e.target.value); setPage(1); }}
              className="input"
            >
              <option value="">All Models</option>
              {aiServices.map((svc) => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-text-secondary text-xs">
              <Calendar size={12} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="input text-xs py-1 px-2"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="input text-xs py-1 px-2"
              />
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-text-secondary hover:text-text-primary underline">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      {isLoading ? (
        viewMode === 'grid' ? <GridSkeleton /> : <div className="card overflow-hidden"><ListSkeleton /></div>
      ) : error ? (
        <div className="card text-center py-12 text-red-400">
          <p>Failed to load content.</p>
          <button onClick={handleRefresh} className="btn-secondary btn-sm mt-3">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState />
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="card overflow-hidden p-0">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border text-xs text-text-secondary font-medium">
            <span className="w-14 flex-shrink-0">Thumb</span>
            <span className="flex-1">Title</span>
            <span className="w-20 flex-shrink-0">Type</span>
            <span className="w-[100px] flex-shrink-0">Channel</span>
            <span className="w-[80px] flex-shrink-0">Model</span>
            <span className="w-10 text-center flex-shrink-0">Score</span>
            <span className="w-20 flex-shrink-0">Status</span>
            <span className="w-16 text-right flex-shrink-0">Date</span>
          </div>
          {items.map((item) => (
            <ContentRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && items.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-text-secondary">
          <span>
            Showing {startItem}-{endItem} of {meta.total}
          </span>
          <div className="flex items-center gap-3">
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="input text-xs py-1 px-2"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm p-1 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => {
                let pageNum: number;
                if (meta.pages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= meta.pages - 2) {
                  pageNum = meta.pages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'btn-sm w-8 h-8 flex items-center justify-center rounded text-xs',
                      page === pageNum ? 'btn-primary' : 'btn-secondary',
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page >= meta.pages}
                className="btn-secondary btn-sm p-1 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
