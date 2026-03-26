'use client';

import { useLifecycle, retryLifecycle } from '@/hooks/use-lifecycle';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  CheckCircle, XCircle, Loader2, AlertTriangle, Clock, RefreshCw,
} from 'lucide-react';
import type { PlatformDiscoveryResult } from '@airevstream/shared';

interface LifecycleStatusPanelProps {
  emailAccountId: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock className="h-4 w-4" />, label: 'Pending', color: 'text-text-secondary' },
  discovering: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Discovering...', color: 'text-accent-blue' },
  planning: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Planning...', color: 'text-accent-blue' },
  signing_up: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Signing up...', color: 'text-accent-amber' },
  setting_profile: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Setting profile...', color: 'text-accent-amber' },
  enrolling: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Enrolling...', color: 'text-accent-purple' },
  active: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Seasoning active', color: 'text-accent-green' },
  completed: { icon: <CheckCircle className="h-4 w-4" />, label: 'Completed', color: 'text-accent-green' },
  failed: { icon: <XCircle className="h-4 w-4" />, label: 'Failed', color: 'text-accent-red' },
};

function PlatformStatusRow({ platform, result }: { platform: string; result?: PlatformDiscoveryResult }) {
  if (!result) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <Clock className="h-3.5 w-3.5" /> Queued
        </span>
      </div>
    );
  }

  if (result.needsHuman) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-accent-amber">
          <AlertTriangle className="h-3.5 w-3.5" /> Needs human
        </span>
      </div>
    );
  }

  if (result.exists === true) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-accent-green">
          <CheckCircle className="h-3.5 w-3.5" /> Account exists
          {result.accountInfo?.username && <span className="text-text-secondary">({result.accountInfo.username})</span>}
        </span>
      </div>
    );
  }

  if (result.exists === false) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-accent-blue">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing up...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="capitalize">{platform}</span>
      <span className="flex items-center gap-1.5 text-text-secondary">
        <AlertTriangle className="h-3.5 w-3.5" /> Unknown
      </span>
    </div>
  );
}

export function LifecycleStatusPanel({ emailAccountId }: LifecycleStatusPanelProps) {
  const { lifecycle, isLoading, mutate } = useLifecycle(emailAccountId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading lifecycle status...</span>
        </div>
      </div>
    );
  }

  if (!lifecycle) return null;

  const statusConfig = STATUS_CONFIG[lifecycle.status] ?? STATUS_CONFIG.pending;
  const results = lifecycle.discoveryResults ?? {};

  const handleRetry = async () => {
    try {
      await retryLifecycle(emailAccountId);
      toast.success('Lifecycle retry started');
      mutate();
    } catch (err) {
      console.error('Failed to retry lifecycle:', err);
      toast.error('Failed to retry lifecycle');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={statusConfig.color}>{statusConfig.icon}</span>
          <span className="text-sm font-medium text-text-primary">{statusConfig.label}</span>
        </div>
        {lifecycle.startedAt && (
          <span className="text-xs text-text-secondary">
            Started {formatRelativeTime(lifecycle.startedAt)}
          </span>
        )}
      </div>

      {lifecycle.error && (
        <div className="rounded bg-accent-red/10 border border-accent-red/30 px-3 py-2 text-xs text-accent-red">
          {lifecycle.error}
        </div>
      )}

      {lifecycle.targetPlatforms.length > 0 && (
        <div className="divide-y divide-border">
          {lifecycle.targetPlatforms.map((platform: string) => (
            <PlatformStatusRow
              key={platform}
              platform={platform}
              result={results[platform]}
            />
          ))}
        </div>
      )}

      {lifecycle.autoSeasoning && (
        <p className="text-xs text-text-secondary">
          Seasoning: {lifecycle.cohortId ? 'Enrolled' : 'Will auto-enroll after signup'}
        </p>
      )}

      {lifecycle.status === 'failed' && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 rounded bg-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
