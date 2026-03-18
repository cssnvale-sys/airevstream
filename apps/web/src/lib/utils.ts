import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active': case 'healthy': case 'posted': case 'approved': case 'completed':
      return 'badge-active';
    case 'warming': case 'pending': case 'pending_approval': case 'queued': case 'scheduled':
      return 'badge-pending';
    case 'generating': case 'rendering': case 'running': case 'in_progress': case 'posting':
      return 'badge-working';
    case 'failed': case 'error': case 'flagged': case 'disabled': case 'banned':
      return 'badge-error';
    case 'needs_human': case 'human':
      return 'badge-human';
    default:
      return 'badge-idle';
  }
}

export function platformIcon(platform: string): string {
  switch (platform) {
    case 'youtube': return '🎬';
    case 'tiktok': return '📱';
    case 'instagram': return '📷';
    case 'facebook': return '📘';
    default: return '🌐';
  }
}
