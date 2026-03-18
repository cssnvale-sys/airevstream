'use client';

import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export type Notification = {
  id: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  createdAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
  link?: string;
};

const severityConfig: Record<
  NotificationSeverity,
  { icon: typeof AlertTriangle; colorClass: string; bgClass: string }
> = {
  critical: {
    icon: AlertTriangle,
    colorClass: 'text-accent-red',
    bgClass: 'bg-accent-red/10',
  },
  warning: {
    icon: AlertCircle,
    colorClass: 'text-accent-amber',
    bgClass: 'bg-accent-amber/10',
  },
  info: {
    icon: Info,
    colorClass: 'text-accent-blue',
    bgClass: 'bg-accent-blue/10',
  },
};

type NotificationItemProps = {
  notification: Notification;
  onDismiss: (id: string) => void;
  onClick?: (notification: Notification) => void;
};

export function NotificationItem({ notification, onDismiss, onClick }: NotificationItemProps) {
  const config = severityConfig[notification.severity] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer',
        'hover:bg-bg-tertiary/50',
        notification.status === 'acknowledged' && 'opacity-60',
      )}
      onClick={() => onClick?.(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(notification);
        }
      }}
    >
      <div className={cn('mt-0.5 p-1 rounded-md shrink-0', config.bgClass)}>
        <Icon size={14} className={config.colorClass} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-body text-text-primary font-medium truncate">
            {notification.title}
          </p>
          <span className="text-caption text-text-secondary whitespace-nowrap shrink-0">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>
        <p className="text-caption text-text-secondary mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className={cn(
          'p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
          'opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5',
        )}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
