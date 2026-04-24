/**
 * Empty state components for when there's no data to display
 */

import { ReactNode } from 'react';
import { 
  Search, 
  FileX, 
  FolderOpen, 
  Plus, 
  Bell, 
  Calendar,
  Video,
  Mic,
  Users,
  Settings,
  BarChart3,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Title of the empty state */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button - new API */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action link/text */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** @deprecated Use action instead */
  actionLabel?: string;
  /** @deprecated Use action.onClick instead */
  onAction?: () => void;
  /** @deprecated Use action and handle navigation in onClick */
  actionHref?: string;
  /** Compact mode for inline empty states */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  secondaryAction,
  // Legacy props
  actionLabel,
  onAction,
  actionHref,
  compact = false,
  className,
}: EmptyStateProps) {
  // Convert legacy props to new API
  const normalizedAction = action ?? (actionLabel ? {
    label: actionLabel,
    onClick: onAction ?? (() => {}),
  } : undefined);

  if (compact) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="mx-auto w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center mb-3">
          <Icon size={20} className="text-text-tertiary" />
        </div>
        <p className="text-text-primary font-medium text-sm">{title}</p>
        {description && (
          <p className="text-text-secondary text-xs mt-1">{description}</p>
        )}
        {normalizedAction && (
          <>
            {actionHref ? (
              <Link
                href={actionHref}
                className="btn-primary btn-sm mt-3 inline-flex items-center gap-1"
              >
                {normalizedAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={normalizedAction.onClick}
                className="btn-primary btn-sm mt-3 inline-flex items-center gap-1"
              >
                {normalizedAction.icon && <normalizedAction.icon size={14} />}
                {normalizedAction.label}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="mx-auto w-14 h-14 rounded-xl bg-bg-tertiary flex items-center justify-center mb-4">
        <Icon size={28} className="text-text-tertiary" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
          {description}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        {normalizedAction && (
          <>
            {actionHref ? (
              <Link
                href={actionHref}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                {normalizedAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={normalizedAction.onClick}
                className="btn-primary inline-flex items-center gap-2"
              >
                {normalizedAction.icon ? <normalizedAction.icon size={16} /> : <Plus size={16} />}
                {normalizedAction.label}
              </button>
            )}
          </>
        )}
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="btn-secondary"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */

export function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title={`No results for "${query}"`}
      description="Try adjusting your search terms or filters"
      action={{ label: 'Clear Search', onClick: onClear }}
    />
  );
}

export function EmptyContent({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Video}
      title="No content yet"
      description="Create your first piece of content to get started"
      action={{ label: 'Create Content', onClick: onCreate, icon: Plus }}
    />
  );
}

export function EmptyApprovals({ onViewAll }: { onViewAll?: () => void }) {
  return (
    <EmptyState
      icon={FileX}
      title="No pending approvals"
      description="Content awaiting review will appear here"
      compact
    />
  );
}

export function EmptyNotifications({ onMarkRead }: { onMarkRead?: () => void }) {
  return (
    <EmptyState
      icon={Bell}
      title="No notifications"
      description="You're all caught up!"
      compact
    />
  );
}

export function EmptyCalendar({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No scheduled content"
      description="Create and schedule content to see it on your calendar"
      action={{ label: 'Schedule Content', onClick: onCreate }}
    />
  );
}

export function EmptyVoices({ onClone }: { onClone: () => void }) {
  return (
    <EmptyState
      icon={Mic}
      title="No cloned voices yet"
      description="Clone your voice or create custom voice profiles for consistent narration"
      action={{ label: 'Clone Your First Voice', onClick: onClone }}
    />
  );
}

export function EmptyChannels({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No channels yet"
      description="Create a channel to start publishing content"
      action={{ label: 'Create Channel', onClick: onCreate, icon: Plus }}
    />
  );
}

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No data yet"
      description="Analytics will appear here once your content starts getting views"
      compact
    />
  );
}

export function EmptyWorkflows() {
  return (
    <EmptyState
      icon={Sparkles}
      title="No active workflows"
      description="Workflow jobs will appear here as content is generated"
      compact
    />
  );
}

export function EmptySettings({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      icon={Settings}
      title="Nothing to configure"
      description="All settings are at their default values"
      compact
    />
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="mx-auto w-14 h-14 rounded-xl bg-accent-red/10 flex items-center justify-center mb-4">
        <FileX size={28} className="text-accent-red" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary inline-flex items-center gap-2"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
