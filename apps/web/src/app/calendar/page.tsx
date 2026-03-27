'use client';

import { useState, useMemo, useCallback, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { useCalendar, useChannels, apiPut } from '@/hooks/use-api';
import { cn, platformIcon } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useSWRConfig } from 'swr';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday as dateIsToday,
  eachDayOfInterval,
  setHours,
  setMinutes,
  setSeconds,
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
  status: string;
  colorBy: 'status' | 'platform' | 'channel';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['all', 'scheduled', 'posting', 'posted', 'failed', 'cancelled'] as const;
const PLATFORM_OPTIONS = ['all', 'youtube', 'tiktok', 'instagram', 'facebook'] as const;

const STATUS_DOT_COLOR: Record<string, string> = {
  posted: 'bg-accent-green',
  completed: 'bg-accent-green',
  scheduled: 'bg-accent-amber',
  pending_approval: 'bg-accent-purple',
  needs_human: 'bg-accent-purple',
  failed: 'bg-accent-red',
  error: 'bg-accent-red',
  generating: 'bg-accent-blue',
  draft: 'bg-text-tertiary',
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

// Day view: 1-hour slots across the full day
const DAY_HOUR_START = 0;
const DAY_HOUR_END = 24;

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

function buildDayTimeLabels(): string[] {
  const labels: string[] = [];
  for (let h = DAY_HOUR_START; h < DAY_HOUR_END; h++) {
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
  const { mutate: globalMutate } = useSWRConfig();

  // State — currentDate is the anchor date for all view modes
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filters, setFilters] = useState<Filters>({
    channelId: 'all',
    platform: 'all',
    status: 'all',
    colorBy: 'status',
  });

  // Drag-and-drop state
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // Derived date ranges for each view mode
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const dayStart = useMemo(() => startOfDay(currentDate), [currentDate]);
  const dayEnd = useMemo(() => endOfDay(currentDate), [currentDate]);

  // Compute the actual range for the API based on viewMode
  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { rangeStart: dayStart, rangeEnd: dayEnd };
      case 'month': {
        // Extend to cover partial weeks at start/end of month
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return { rangeStart: gridStart, rangeEnd: gridEnd };
      }
      case 'week':
      default:
        return { rangeStart: weekStart, rangeEnd: weekEnd };
    }
  }, [viewMode, dayStart, dayEnd, monthStart, monthEnd, weekStart, weekEnd]);

  // Build query params
  const rangeParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('start', format(rangeStart, 'yyyy-MM-dd'));
    p.set('end', format(rangeEnd, 'yyyy-MM-dd'));
    if (filters.channelId !== 'all') p.set('channelId', filters.channelId);
    if (filters.platform !== 'all') p.set('platform', filters.platform);
    if (filters.status !== 'all') p.set('status', filters.status);
    return p.toString();
  }, [rangeStart, rangeEnd, filters.channelId, filters.platform, filters.status]);

  // API hooks
  const { data: calendarData, isLoading, error: calendarError } = useCalendar<CalendarItem[]>(rangeParams);
  const { data: channelsData, error: channelsError } = useChannels<Channel[]>();

  const fetchError = calendarError || channelsError;

  const items = calendarData?.data ?? [];
  const channels = channelsData?.data ?? [];

  // Items are already filtered server-side
  const filtered = items;

  // Week view helpers
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const timeLabels = useMemo(() => buildTimeLabels(), []);
  const dayTimeLabels = useMemo(() => buildDayTimeLabels(), []);

  // Month view: build the grid of days (includes prev/next month padding)
  const monthGridDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthStart, monthEnd]);

  // Navigation handlers — adapt to view mode
  const goToPrev = useCallback(() => {
    switch (viewMode) {
      case 'day':
        setCurrentDate((prev) => subDays(prev, 1));
        break;
      case 'week':
        setCurrentDate((prev) => subWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate((prev) => subMonths(prev, 1));
        break;
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    switch (viewMode) {
      case 'day':
        setCurrentDate((prev) => addDays(prev, 1));
        break;
      case 'week':
        setCurrentDate((prev) => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate((prev) => addMonths(prev, 1));
        break;
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const switchToDay = useCallback((day: Date) => {
    setCurrentDate(day);
    setViewMode('day');
  }, []);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Get items for a specific day + time slot (week view, 2-hour slots)
  function getSlotItems(day: Date, slotIndex: number): CalendarItem[] {
    return filtered.filter((item) => {
      const d = new Date(item.scheduledAt);
      return isSameDay(d, day) && getTimeSlotRow(item.scheduledAt) === slotIndex;
    });
  }

  // Get items for a specific hour (day view, 1-hour slots)
  function getDaySlotItems(hour: number): CalendarItem[] {
    return filtered.filter((item) => {
      const d = new Date(item.scheduledAt);
      return isSameDay(d, currentDate) && d.getHours() === hour;
    });
  }

  // Get items for a specific date (month view)
  function getDayItems(day: Date): CalendarItem[] {
    return filtered.filter((item) => {
      const d = new Date(item.scheduledAt);
      return isSameDay(d, day);
    });
  }

  // ---------------------------------------------------------------------------
  // Drag-and-Drop handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback((e: DragEvent<HTMLButtonElement>, item: CalendarItem) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    setDragItemId(item.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragItemId(null);
    setDropTargetKey(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetKey(targetKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetKey(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, newDate: Date) => {
    e.preventDefault();
    setDropTargetKey(null);
    const itemId = e.dataTransfer.getData('text/plain');
    setDragItemId(null);

    if (!itemId) return;

    const item = filtered.find((i) => i.id === itemId);
    if (!item) return;

    // Preserve the original time when dropping to a new date in month view,
    // or use the target time for day/week views
    const newScheduledAt = newDate.toISOString();

    try {
      await apiPut(`/schedule/${itemId}`, { scheduledAt: newScheduledAt });
      toast.success('Post rescheduled successfully');
      // Revalidate calendar data
      globalMutate((key: unknown) => typeof key === 'string' && key.includes('/calendar'));
    } catch (err) {
      console.error('Failed to reschedule post:', err);
      toast.error('Failed to reschedule post');
    }
  }, [filtered, globalMutate]);

  // Build a drop handler that constructs a date from day + hour
  const handleDropOnSlot = useCallback((e: DragEvent<HTMLDivElement>, day: Date, hour: number) => {
    const targetDate = setSeconds(setMinutes(setHours(day, hour), 0), 0);
    handleDrop(e, targetDate);
  }, [handleDrop]);

  // Build a drop handler for month view (preserves original time, changes date)
  const handleDropOnDate = useCallback((e: DragEvent<HTMLDivElement>, day: Date) => {
    e.preventDefault();
    setDropTargetKey(null);
    const itemId = e.dataTransfer.getData('text/plain');
    setDragItemId(null);

    if (!itemId) return;

    const item = filtered.find((i) => i.id === itemId);
    if (!item) return;

    // Preserve original time, just change the date
    const original = new Date(item.scheduledAt);
    const newDate = setSeconds(
      setMinutes(
        setHours(day, original.getHours()),
        original.getMinutes(),
      ),
      original.getSeconds(),
    );

    const newScheduledAt = newDate.toISOString();

    (async () => {
      try {
        await apiPut(`/schedule/${itemId}`, { scheduledAt: newScheduledAt });
        toast.success('Post rescheduled successfully');
        globalMutate((key: unknown) => typeof key === 'string' && key.includes('/calendar'));
      } catch (err) {
        console.error('Failed to reschedule post:', err);
        toast.error('Failed to reschedule post');
      }
    })();
  }, [filtered, globalMutate]);

  // ---------------------------------------------------------------------------
  // Header subtitle
  // ---------------------------------------------------------------------------

  const headerSubtitle = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        return `${format(weekStart, 'MMM d')} \u2013 ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
    }
  }, [viewMode, currentDate, weekStart, weekEnd]);

  const navAriaLabel = useMemo(() => {
    switch (viewMode) {
      case 'day': return { prev: 'Previous day', next: 'Next day' };
      case 'week': return { prev: 'Previous week', next: 'Next week' };
      case 'month': return { prev: 'Previous month', next: 'Next month' };
    }
  }, [viewMode]);

  // ---------------------------------------------------------------------------
  // Shared item button renderer
  // ---------------------------------------------------------------------------

  function renderItemButton(item: CalendarItem, compact = false) {
    const isDragging = dragItemId === item.id;
    if (compact) {
      // Month view: colored dot
      return (
        <button
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            e.stopPropagation();
            if (item.content?.id) router.push(`/content/${item.content.id}`);
          }}
          title={`${item.content?.title ?? 'Untitled'} (${item.channel?.name ?? 'Unknown'}) - ${format(new Date(item.scheduledAt), 'h:mm a')}`}
          className={cn(
            'w-2.5 h-2.5 rounded-full shrink-0 cursor-grab active:cursor-grabbing transition-opacity',
            STATUS_DOT_COLOR[item.content?.status ?? item.status] ?? 'bg-text-tertiary',
            isDragging && 'opacity-40',
          )}
        />
      );
    }

    return (
      <button
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        onClick={() => item.content?.id && router.push(`/content/${item.content.id}`)}
        aria-label={`${item.channel?.name ?? 'Unknown'} on ${item.platform} \u2014 ${item.content?.status ?? item.status}`}
        className={cn(
          'w-full text-left px-2 py-1.5 rounded-md text-caption transition-colors cursor-grab active:cursor-grabbing',
          'bg-bg-tertiary hover:bg-bg-primary border border-border',
          'flex items-center gap-1.5 group',
          isDragging && 'opacity-40 border-accent-blue',
        )}
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            STATUS_DOT_COLOR[item.content?.status ?? item.status] ?? 'bg-text-tertiary',
          )}
        />
        <span className="shrink-0">{platformIcon(item.platform)}</span>
        <span className="truncate text-text-primary group-hover:text-accent-blue">
          {abbreviate(item.channel?.name ?? 'Unknown')}
        </span>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Drop target cell wrapper
  // ---------------------------------------------------------------------------

  function isDropTarget(key: string): boolean {
    return dropTargetKey === key && dragItemId !== null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
          <p className="text-text-secondary mt-1">{headerSubtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={goToPrev} className="btn-icon" aria-label={navAriaLabel.prev}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={goToToday} className="btn-secondary btn-sm">
              Today
            </button>
            <button onClick={goToNext} className="btn-icon" aria-label={navAriaLabel.next}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-caption font-medium transition-colors capitalize',
                  viewMode === mode
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Filter Bar ---- */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filters.channelId}
          onChange={(e) => updateFilter('channelId', e.target.value)}
          className="input text-caption"
          aria-label="Filter by channel"
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
          aria-label="Filter by platform"
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="input text-caption"
          aria-label="Filter by status"
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
          aria-label="Color by"
        >
          <option value="status">Color by Status</option>
          <option value="platform">Color by Platform</option>
          <option value="channel">Color by Channel</option>
        </select>
      </div>

      {/* ---- Calendar Content ---- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No scheduled content"
          description="No posts are scheduled for this period. Create content and schedule it to see it here."
          actionLabel="Create Content"
          actionHref="/create"
        />
      ) : viewMode === 'day' ? (
        /* ================================================================ */
        /* DAY VIEW                                                         */
        /* ================================================================ */
        <div className="card p-0 overflow-x-auto" role="grid" aria-label="Daily calendar">
          {/* Day header */}
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: '72px 1fr' }}
            role="row"
          >
            <div className="p-2 border-r border-border" />
            <div
              className={cn(
                'p-3 text-center',
                dateIsToday(currentDate) && 'bg-accent-blue/5',
              )}
            >
              <p className="text-caption text-text-secondary uppercase">
                {format(currentDate, 'EEEE')}
              </p>
              <p
                className={cn(
                  'text-body font-semibold mt-0.5',
                  dateIsToday(currentDate) ? 'text-accent-blue' : 'text-text-primary',
                )}
              >
                {format(currentDate, 'MMMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Hourly rows */}
          {dayTimeLabels.map((label, hour) => {
            const slotItems = getDaySlotItems(hour);
            const targetKey = `day-${hour}`;
            return (
              <div
                key={label}
                className="grid border-b border-border last:border-b-0"
                style={{
                  gridTemplateColumns: '72px 1fr',
                  minHeight: '56px',
                }}
                role="row"
              >
                {/* Time label */}
                <div className="p-2 text-caption text-text-secondary text-right pr-3 border-r border-border flex items-start justify-end pt-3">
                  {label}
                </div>

                {/* Slot cell */}
                <div
                  className={cn(
                    'p-1 min-h-[56px] transition-colors',
                    dateIsToday(currentDate) && 'bg-accent-blue/5',
                    isDropTarget(targetKey) && 'bg-accent-blue/15 ring-1 ring-inset ring-accent-blue/40',
                  )}
                  onDragOver={(e) => handleDragOver(e, targetKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnSlot(e, currentDate, hour)}
                >
                  <div className="space-y-1">
                    {slotItems.map((item) => renderItemButton(item))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'month' ? (
        /* ================================================================ */
        /* MONTH VIEW                                                       */
        /* ================================================================ */
        <div className="card p-0 overflow-x-auto" role="grid" aria-label="Monthly calendar">
          {/* Weekday headers */}
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
            role="row"
          >
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-caption text-text-secondary uppercase font-medium border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells — render in rows of 7 */}
          {Array.from({ length: Math.ceil(monthGridDays.length / 7) }, (_, weekIdx) => (
            <div
              key={weekIdx}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
              role="row"
            >
              {monthGridDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                const inCurrentMonth = isSameMonth(day, currentDate);
                const today = dateIsToday(day);
                const dayItems = getDayItems(day);
                const targetKey = `month-${format(day, 'yyyy-MM-dd')}`;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-2 border-r border-border last:border-r-0 min-h-[90px] transition-colors',
                      !inCurrentMonth && 'opacity-40',
                      today && 'bg-accent-blue/5',
                      isDropTarget(targetKey) && 'bg-accent-blue/15 ring-1 ring-inset ring-accent-blue/40',
                    )}
                    onDragOver={(e) => handleDragOver(e, targetKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnDate(e, day)}
                  >
                    {/* Date number — click to switch to day view */}
                    <button
                      onClick={() => switchToDay(day)}
                      className={cn(
                        'text-sm font-medium mb-1 hover:text-accent-blue transition-colors',
                        today
                          ? 'text-accent-blue font-bold bg-accent-blue/10 rounded-full w-7 h-7 flex items-center justify-center'
                          : inCurrentMonth
                            ? 'text-text-primary'
                            : 'text-text-secondary',
                      )}
                    >
                      {format(day, 'd')}
                    </button>

                    {/* Post indicators — show up to 4 dots, then +N */}
                    {dayItems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dayItems.slice(0, 4).map((item) => renderItemButton(item, true))}
                        {dayItems.length > 4 && (
                          <span className="text-[10px] text-text-secondary font-medium leading-none flex items-center">
                            +{dayItems.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* ================================================================ */
        /* WEEK VIEW (existing)                                             */
        /* ================================================================ */
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
              const today = dateIsToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'p-3 text-center border-r border-border last:border-r-0',
                    today && 'bg-accent-blue/5',
                  )}
                >
                  <p className="text-caption text-text-secondary uppercase">
                    {format(day, 'EEE')}
                  </p>
                  <p
                    className={cn(
                      'text-body font-semibold mt-0.5',
                      today ? 'text-accent-blue' : 'text-text-primary',
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
                const today = dateIsToday(day);
                const slotHour = HOUR_START + rowIndex * HOUR_STEP;
                const targetKey = `week-${format(day, 'yyyy-MM-dd')}-${slotHour}`;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-1 border-r border-border last:border-r-0 min-h-[72px] transition-colors',
                      today && 'bg-accent-blue/5',
                      isDropTarget(targetKey) && 'bg-accent-blue/15 ring-1 ring-inset ring-accent-blue/40',
                    )}
                    onDragOver={(e) => handleDragOver(e, targetKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnSlot(e, day, slotHour)}
                  >
                    <div className="space-y-1">
                      {slotItems.map((item) => renderItemButton(item))}
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
