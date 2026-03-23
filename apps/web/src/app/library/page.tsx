'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useContent, useChannels, useApi, apiDelete } from '@/hooks/use-api';
import { cn, formatRelativeTime, statusColor } from '@/lib/utils';
import {
  Search, LayoutGrid, List,
  FileText, Image, Film, Video, Mic, ImageIcon,
  Star, Calendar, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/lib/toast';
import { useDebounce } from '@/hooks/use-debounce';

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

function LibraryEmptyState() {
  return (
    <EmptyState
      icon={FileText}
      title="No content found"
      description="Create your first content piece or adjust the filters."
      actionLabel="Create Content"
      actionHref="/create"
    />
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

function ContentRow({ item, onDelete }: { item: ContentItem; onDelete?: (id: string) => void }) {
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

        {/* Delete */}
        {onDelete && ['draft', 'archived', 'failed'].includes(item.status) && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.id); }}
            className="text-text-secondary hover:text-accent-red transition-colors p-1 flex-shrink-0"
            aria-label={`Delete ${item.title ?? 'content'}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
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

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 300);

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
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filterType) p.set('contentType', filterType);
    if (filterStatus) p.set('status', filterStatus);
    if (filterChannel) p.set('channelId', filterChannel);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p.toString();
  }, [page, perPage, sortField, sortOrder, debouncedSearch, filterType, filterStatus, filterChannel, dateFrom, dateTo]);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data, isLoading, error, mutate } = useContent(queryParams);

  const allItems = (data?.data ?? []) as ContentItem[];
  const meta = data?.meta ?? { total: 0, page: 1, limit: perPage, pages: 1 };

  // Client-side filter for AI model (not yet a server-side query param)
  const items = useMemo(() => {
    if (!filterModel) return allItems;
    return allItems.filter((item) => item.aiService?.id === filterModel);
  }, [allItems, filterModel]);

  const handleRefresh = useCallback(() => { mutate(); }, [mutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/content/${deleteTarget}`);
      mutate();
      toast.success('Content deleted');
    } catch (err) {
      console.error('Failed to delete content:', err);
      toast.error('Failed to delete content');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, mutate]);

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
          <LibraryEmptyState />
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
        <div className="card overflow-x-auto p-0">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border text-xs text-text-secondary font-medium min-w-[700px]">
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
            <ContentRow key={item.id} item={item} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && items.length > 0 && (
        <Pagination
          page={page}
          totalPages={meta.pages}
          total={meta.total}
          limit={perPage}
          onPageChange={setPage}
          onLimitChange={(n) => { setPerPage(n); setPage(1); }}
          limitOptions={PER_PAGE_OPTIONS}
          className="mt-4"
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Content"
        message="This content item will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </AppLayout>
  );
}
