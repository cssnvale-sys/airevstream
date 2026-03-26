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
  pending: { icon: <Clock className="h-4 w-4" />, label: 'Pending', color: 'text-zinc-400' },
  discovering: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Discovering...', color: 'text-blue-400' },
  planning: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Planning...', color: 'text-blue-400' },
  signing_up: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Signing up...', color: 'text-amber-400' },
  setting_profile: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Setting profile...', color: 'text-amber-400' },
  enrolling: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Enrolling...', color: 'text-purple-400' },
  active: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Seasoning active', color: 'text-green-400' },
  completed: { icon: <CheckCircle className="h-4 w-4" />, label: 'Completed', color: 'text-green-400' },
  failed: { icon: <XCircle className="h-4 w-4" />, label: 'Failed', color: 'text-red-400' },
};

function PlatformStatusRow({ platform, result }: { platform: string; result?: PlatformDiscoveryResult }) {
  if (!result) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <Clock className="h-3.5 w-3.5" /> Queued
        </span>
      </div>
    );
  }

  if (result.needsHuman) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Needs human
        </span>
      </div>
    );
  }

  if (result.exists === true) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-green-400">
          <CheckCircle className="h-3.5 w-3.5" /> Account exists
          {result.accountInfo?.username && <span className="text-zinc-500">({result.accountInfo.username})</span>}
        </span>
      </div>
    );
  }

  if (result.exists === false) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="capitalize">{platform}</span>
        <span className="flex items-center gap-1.5 text-blue-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing up...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="capitalize">{platform}</span>
      <span className="flex items-center gap-1.5 text-zinc-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Unknown
      </span>
    </div>
  );
}

export function LifecycleStatusPanel({ emailAccountId }: LifecycleStatusPanelProps) {
  const { lifecycle, isLoading, mutate } = useLifecycle(emailAccountId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
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
    } catch {
      toast.error('Failed to retry lifecycle');
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={statusConfig.color}>{statusConfig.icon}</span>
          <span className="text-sm font-medium text-zinc-200">{statusConfig.label}</span>
        </div>
        {lifecycle.startedAt && (
          <span className="text-xs text-zinc-500">
            Started {formatRelativeTime(lifecycle.startedAt)}
          </span>
        )}
      </div>

      {lifecycle.error && (
        <div className="rounded bg-red-900/20 border border-red-800/30 px-3 py-2 text-xs text-red-300">
          {lifecycle.error}
        </div>
      )}

      {lifecycle.targetPlatforms.length > 0 && (
        <div className="divide-y divide-zinc-800">
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
        <p className="text-xs text-zinc-500">
          Seasoning: {lifecycle.cohortId ? 'Enrolled' : 'Will auto-enroll after signup'}
        </p>
      )}

      {lifecycle.status === 'failed' && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
