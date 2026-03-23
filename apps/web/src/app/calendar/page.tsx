'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useCalendar, useChannels } from '@/hooks/use-api';
import { cn, platformIcon } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  eachHourOfInterval,
  isSameDay,
  startOfDay,
  setHours,
} from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'day' | 'week' | 'month';

interface CalendarItem {
  id: string;
  scheduledAt: string;
  platform: string;
  status: string;
  channel?: { id: string; name: string };
  content?: { id: string; title: string; contentType: string; status: string };
}

interface Channel {
  id: string;
  name: string;
  platform: string;
}

interface Filters {
  channelId: string;
  platform: string;
  language: string;
  status: string;
  colorBy: 'status' | 'platform' | 'channel';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['all', 'posted', 'scheduled', 'pending_approval', 'failed'] as const;
const PLATFORM_OPTIONS = ['all', 'youtube', 'tiktok', 'instagram', 'facebook'] as const;
const LANGUAGE_OPTIONS = ['all', 'en', 'es', 'fr', 'de', 'pt'] as const;

const STATUS_DOT_COLOR: Record<string, string> = {
  posted: 'bg-accent-green',
  completed: 'bg-accent-green',
  scheduled: 'bg-accent-amber',
  pending_approval: 'bg-accent-purple',
  needs_human: 'bg-accent-purple',
  failed: 'bg-accent-red',
  error: 'bg-accent-red',
  generating: 'bg-accent-blue',
  draft: 'bg-gray-500',
};

const LEGEND_ITEMS = [
  { label: 'Posted', color: 'bg-accent-green' },
  { label: 'Scheduled', color: 'bg-accent-amber' },
  { label: 'Needs Approval', color: 'bg-accent-purple' },
  { label: 'Failed', color: 'bg-accent-red' },
];

const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_STEP = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abbreviate(name: string, maxLen = 12): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
}

function getTimeSlotRow(dateStr: string): number | null {
  const d = new Date(dateStr);
  const hour = d.getHours();
  if (hour < HOUR_START || hour >= HOUR_END) return null;
  return Math.floor((hour - HOUR_START) / HOUR_STEP);
}

function buildTimeLabels(): string[] {
  const labels: string[] = [];
  for (let h = HOUR_START; h < HOUR_END; h += HOUR_STEP) {
    const suffix = h >= 12 ? 'pm' : 'am';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    labels.push(`${display}${suffix}`);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const router = useRouter();

  // State
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filters, setFilters] = useState<Filters>({
    channelId: 'all',
    platform: 'all',
    language: 'all',
    status: 'all',
    colorBy: 'status',
  });

  // Derived date range
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Build query params — pass filters server-side instead of client-side
  const rangeParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('start', format(weekStart, 'yyyy-MM-dd'));
    p.set('end', format(weekEnd, 'yyyy-MM-dd'));
    if (filters.channelId !== 'all') p.set('channelId', filters.channelId);
    if (filters.platform !== 'all') p.set('platform', filters.platform);
    if (filters.status !== 'all') p.set('status', filters.status);
    if (filters.language !== 'all') p.set('language', filters.language);
    return p.toString();
  }, [weekStart, weekEnd, filters.channelId, filters.platform, filters.status, filters.language]);

  // API hooks
  const { data: calendarData, isLoading, error: calendarError } = useCalendar<CalendarItem[]>(rangeParams);
  const { data: channelsData, error: channelsError } = useChannels<Channel[]>();

  const fetchError = calendarError || channelsError;

  const items = calendarData?.data ?? [];
  const channels = channelsData?.data ?? [];

  // Items are already filtered server-side
  const filtered = items;

  // Build week days array (Mon-Sun)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const timeLabels = useMemo(() => buildTimeLabels(), []);
  const totalRows = timeLabels.length;

  // Navigation
  const goToPrevWeek = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setWeekStart((prev) => addWeeks(prev, 1));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Get items for a specific day + time slot
  function getSlotItems(day: Date, slotIndex: number): CalendarItem[] {
    return filtered.filter((item) => {
      const d = new Date(item.scheduledAt);
      return isSameDay(d, day) && getTimeSlotRow(item.scheduledAt) === slotIndex;
    });
  }

  return (
    <AppLayout>
      {fetchError && (
        <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          Failed to load calendar data. Please try refreshing the page.
        </div>
      )}
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Content Calendar</h1>
          <p className="text-text-secondary mt-1">
            {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={goToPrevWeek} className="btn-icon" aria-label="Previous week">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goToToday} className="btn-secondary btn-sm">
              Today
            </button>
            <button onClick={goToNextWeek} className="btn-icon" aria-label="Next week">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* View mode toggle — only week view is implemented */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => {
              const implemented = mode === 'week';
              return (
                <button
                  key={mode}
                  onClick={() => implemented && setViewMode(mode)}
                  disabled={!implemented}
                  title={!implemented ? 'Coming soon' : undefined}
                  className={cn(
                    'px-3 py-1.5 text-caption font-medium transition-colors capitalize',
                    viewMode === mode
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary',
                    !implemented && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Filter Bar ---- */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filters.channelId}
          onChange={(e) => updateFilter('channelId', e.target.value)}
          className="input text-caption"
        >
          <option value="all">All Channels</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>

        <select
          value={filters.platform}
          onChange={(e) => updateFilter('platform', e.target.value)}
          className="input text-caption"
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.language}
          onChange={(e) => updateFilter('language', e.target.value)}
          className="input text-caption"
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l === 'all' ? 'All Languages' : l.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="input text-caption"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>

        <select
          value={filters.colorBy}
          onChange={(e) => updateFilter('colorBy', e.target.value as Filters['colorBy'])}
          className="input text-caption"
        >
          <option value="status">Color by Status</option>
          <option value="platform">Color by Platform</option>
          <option value="channel">Color by Channel</option>
        </select>
      </div>

      {/* ---- Week Grid ---- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto" role="grid" aria-label="Weekly calendar">
          {/* Day headers */}
          <div
            className="grid border-b border-border min-w-[700px]"
            style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
            role="row"
          >
            {/* Empty top-left cell */}
            <div className="p-2 border-r border-border" />
            {weekDays.map((day) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'p-3 text-center border-r border-border last:border-r-0',
                    isToday && 'bg-accent-blue/5',
                  )}
                >
                  <p className="text-caption text-text-secondary uppercase">
                    {format(day, 'EEE')}
                  </p>
                  <p
                    className={cn(
                      'text-body font-semibold mt-0.5',
                      isToday ? 'text-accent-blue' : 'text-text-primary',
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid rows */}
          {timeLabels.map((label, rowIndex) => (
            <div
              key={label}
              className="grid border-b border-border last:border-b-0 min-w-[700px]"
              style={{
                gridTemplateColumns: '64px repeat(7, 1fr)',
                minHeight: '72px',
              }}
            >
              {/* Time label */}
              <div className="p-2 text-caption text-text-secondary text-right pr-3 border-r border-border flex items-start justify-end pt-3">
                {label}
              </div>

              {/* Day cells */}
              {weekDays.map((day) => {
                const slotItems = getSlotItems(day, rowIndex);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-1 border-r border-border last:border-r-0 min-h-[72px]',
                      isToday && 'bg-accent-blue/5',
                    )}
                  >
                    <div className="space-y-1">
                      {slotItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => item.content?.id && router.push(`/content/${item.content.id}`)}
                          aria-label={`${item.channel?.name ?? 'Unknown'} on ${item.platform} — ${item.content?.status ?? item.status}`}
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded-md text-caption transition-colors',
                            'bg-bg-tertiary hover:bg-bg-primary border border-border',
                            'flex items-center gap-1.5 group',
                          )}
                        >
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              STATUS_DOT_COLOR[item.content?.status ?? item.status] ?? 'bg-gray-500',
                            )}
                          />
                          <span className="shrink-0">{platformIcon(item.platform)}</span>
                          <span className="truncate text-text-primary group-hover:text-accent-blue">
                            {abbreviate(item.channel?.name ?? 'Unknown')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ---- Legend ---- */}
      <div className="flex items-center gap-6 mt-4">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
            <span className="text-caption text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
