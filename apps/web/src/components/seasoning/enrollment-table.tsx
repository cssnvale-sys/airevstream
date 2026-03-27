'use client';

import { cn } from '@/lib/utils';

interface Enrollment {
  id: string;
  platform: string;
  status: string;
  currentPhase: string | null;
  activitiesCompleted: number;
  lastActivityAt: string | null;
  nextScheduledAt: string | null;
  failureCount: number;
  failureReason: string | null;
  emailAccount: { id: string; email: string };
  socialAccount: { id: string; username: string | null; healthScore: number; status: string } | null;
}

interface EnrollmentTableProps {
  enrollments: Enrollment[];
  onAction?: (enrollmentId: string, action: 'pause' | 'resume' | 'retry') => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-text-secondary',
  signing_up: 'text-accent-amber',
  needs_human: 'text-accent-amber',
  phase_1: 'text-accent-blue',
  phase_2: 'text-accent-blue',
  phase_3: 'text-accent-purple',
  phase_4: 'text-accent-purple',
  seasoned: 'text-accent-green',
  graduated: 'text-accent-green',
  failed: 'text-accent-red',
  paused: 'text-accent-amber',
};

const PLATFORM_ICONS: Record<string, string> = {
  youtube: 'YT',
  tiktok: 'TT',
  instagram: 'IG',
  facebook: 'FB',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function EnrollmentTable({ enrollments, onAction }: EnrollmentTableProps) {
  if (enrollments.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-body">
        No enrollments yet. Enroll accounts to begin seasoning.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border text-text-secondary text-caption">
            <th className="text-left py-2 px-3">Email</th>
            <th className="text-left py-2 px-3">Platform</th>
            <th className="text-left py-2 px-3">Status</th>
            <th className="text-left py-2 px-3">Phase</th>
            <th className="text-right py-2 px-3">Activities</th>
            <th className="text-right py-2 px-3">Health</th>
            <th className="text-left py-2 px-3">Last Active</th>
            <th className="text-left py-2 px-3">Next Session</th>
            <th className="text-right py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
              <td className="py-2 px-3 text-text-primary truncate max-w-[200px]">{e.emailAccount.email}</td>
              <td className="py-2 px-3">
                <span className="px-1.5 py-0.5 rounded text-caption bg-bg-tertiary">
                  {PLATFORM_ICONS[e.platform] ?? e.platform}
                </span>
              </td>
              <td className="py-2 px-3">
                <span className={cn('text-caption font-medium', STATUS_COLORS[e.status] ?? 'text-text-secondary')}>
                  {e.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="py-2 px-3 text-text-secondary text-caption">{e.currentPhase?.replace(/_/g, ' ') ?? '—'}</td>
              <td className="py-2 px-3 text-right text-text-secondary">{e.activitiesCompleted}</td>
              <td className="py-2 px-3 text-right">
                {e.socialAccount ? (
                  <span className={cn(
                    'text-caption font-medium',
                    e.socialAccount.healthScore >= 70 ? 'text-accent-green' :
                    e.socialAccount.healthScore >= 40 ? 'text-accent-amber' : 'text-accent-red',
                  )}>
                    {e.socialAccount.healthScore}
                  </span>
                ) : '—'}
              </td>
              <td className="py-2 px-3 text-text-secondary text-caption">{timeAgo(e.lastActivityAt)}</td>
              <td className="py-2 px-3 text-text-secondary text-caption">{timeAgo(e.nextScheduledAt)}</td>
              <td className="py-2 px-3 text-right">
                {onAction && (
                  <div className="flex gap-1 justify-end">
                    {(e.status === 'phase_1' || e.status === 'phase_2' || e.status === 'phase_3' || e.status === 'phase_4') && (
                      <button
                        onClick={() => onAction(e.id, 'pause')}
                        className="text-caption text-accent-amber hover:text-accent-amber px-1"
                      >
                        Pause
                      </button>
                    )}
                    {e.status === 'paused' && (
                      <button
                        onClick={() => onAction(e.id, 'resume')}
                        className="text-caption text-accent-blue hover:text-accent-blue px-1"
                      >
                        Resume
                      </button>
                    )}
                    {e.status === 'failed' && (
                      <button
                        onClick={() => onAction(e.id, 'retry')}
                        className="text-caption text-accent-green hover:text-accent-green px-1"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
