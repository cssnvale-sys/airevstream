'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToken } from '@/lib/auth';
import useSWR from 'swr';
import { toast } from '@/lib/toast';
import { NotificationItem, type Notification } from './notification-item';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { useSystemEvents } from '@/lib/sse';

type AlertsResponse = {
  success: boolean;
  data: Notification[];
  meta?: { total: number; page: number; limit: number; pages: number };
};

const fetcher = async (url: string): Promise<AlertsResponse> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
};

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());

  const { data, mutate } = useSWR<AlertsResponse>(
    '/api/v1/system/alerts?status=open&limit=10',
    fetcher,
    { refreshInterval: 30000 },
  );

  // Wire SSE alert events for immediate refresh
  const { alert: sseAlert } = useSystemEvents();
  useEffect(() => {
    if (sseAlert) {
      mutate(); // Immediately refresh the notification list when an SSE alert arrives
    }
  }, [sseAlert, mutate]);

  const alerts = (data?.data as Notification[] | undefined) ?? [];
  const unreadCount = alerts.filter((a) => a.status === 'open').length;

  // Show toast for new notifications
  useEffect(() => {
    if (!alerts.length) return;

    const currentIds = new Set(alerts.map((a) => a.id));
    const prevIds = prevAlertIdsRef.current;

    // Only show toasts after the initial load
    if (prevIds.size > 0) {
      for (const alert of alerts) {
        if (!prevIds.has(alert.id)) {
          const variant =
            alert.severity === 'critical' || alert.severity === 'error'
              ? 'error'
              : alert.severity === 'warning'
                ? 'warning'
                : 'info';

          if (variant === 'error') {
            toast.error(alert.title, { description: alert.message });
          } else if (variant === 'warning') {
            toast.warning(alert.title, { description: alert.message });
          } else {
            toast.info(alert.title, { description: alert.message });
          }
        }
      }
    }

    prevAlertIdsRef.current = currentIds;
  }, [alerts]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close panel on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  const dismissNotification = useCallback(
    async (id: string) => {
      try {
        const token = getToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/v1/system/alerts/${id}/acknowledge`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) throw new Error('Failed to acknowledge');

        // Optimistic update: remove from list
        mutate(
          (current) => {
            if (!current) return current;
            return {
              ...current,
              data: (current.data as Notification[]).filter((a) => a.id !== id),
              meta: current.meta ? { ...current.meta, total: current.meta.total - 1 } : undefined,
            };
          },
          { revalidate: false },
        );
      } catch (err) {
        console.error('Failed to dismiss notification:', err);
        mutate();
      }
    },
    [mutate],
  );

  const markAllRead = useCallback(async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/system/alerts/acknowledge-all', {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error('Failed to acknowledge all');

      // Optimistic update: clear all
      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            data: [],
            meta: current.meta ? { ...current.meta, total: 0 } : undefined,
          };
        },
        { revalidate: false },
      );
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      mutate();
    }
  }, [mutate]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      const link = notification.link ?? (notification.metadata?.link as string | undefined);
      if (link) {
        router.push(link);
        setOpen(false);
      }
    },
    [router],
  );

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="btn-icon relative"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1" aria-live="polite" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            'absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[480px]',
            'bg-bg-secondary border border-border rounded-lg shadow-lg',
            'flex flex-col overflow-hidden',
            'backdrop-blur-sm',
            'animate-in fade-in slide-in-from-top-2 duration-150',
          )}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-card-title text-text-primary">Notifications</h3>
            <div className="flex items-center gap-1">
              {alerts.length > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-caption text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-md hover:bg-bg-tertiary"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {alerts.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No notifications"
                description="You're all caught up"
                className="py-12"
              />
            ) : (
              alerts.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDismiss={dismissNotification}
                  onClick={handleNotificationClick}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  router.push('/system');
                  setOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 w-full text-caption text-accent-blue hover:text-accent-blue/80 transition-colors py-1 rounded-md hover:bg-bg-tertiary"
              >
                <span>View all notifications</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
