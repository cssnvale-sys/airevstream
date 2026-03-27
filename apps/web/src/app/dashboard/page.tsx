'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  useApprovals,
  useContent,
  useWorkflows,
  useSystemHealth,
  useSystemMetrics,
  useApi,
  apiPost,
} from '@/hooks/use-api';
import {
  Youtube, Instagram, Facebook, Music2,
  ClipboardCheck, Send, HeartPulse, DollarSign,
  CheckCircle2, XCircle, ArrowRight, Clock,
  Cpu, MemoryStick, Layers, ChevronRight,
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatRelativeTime, statusColor } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { QualityBadge } from '@/components/ui/quality-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Link from 'next/link';

function formatCountdown(createdAt: string, gateWindowHrs: number | null): { text: string; urgency: 'normal' | 'amber' | 'red' } | null {
  if (gateWindowHrs == null) return null;
  const deadline = new Date(new Date(createdAt).getTime() + gateWindowHrs * 60 * 60 * 1000);
  const remainingMs = deadline.getTime() - Date.now();
  if (remainingMs <= 0) return { text: 'Auto-approving...', urgency: 'red' };
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const text = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const urgency = remainingMs < 30 * 60 * 1000 ? 'red' : remainingMs < 2 * 60 * 60 * 1000 ? 'amber' : 'normal';
  return { text, urgency };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalItem {
  id: string;
  title: string | null;
  channel?: { id: string; name: string };
  contentType: string;
  qualityScore: number | null;
  approvalGateWindowHrs: number | null;
  status: string;
  createdAt: string;
}

interface ContentItem {
  id: string;
  status: string;
  createdAt: string;
}

interface WorkflowItem {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  content?: { id: string; title: string; contentType: string } | null;
}

interface HealthData {
  status: string;
  services: { total: number; healthy: number };
  alerts?: { open: Record<string, number> };
  queues?: { activeJobs: number; pendingPosts: number };
}

interface MetricsData {
  cpu: number;
  ram: number;
  queueDepth: number;
}

interface ActivityItem {
  id: string;
  type: 'content' | 'posting' | 'alert';
  message: string;
  timestamp: string;
}

interface RevenueData {
  totals: { totalRevenue: number; totalConversions: number };
  period?: { start: string | null; end: string | null };
}

interface AccountStats {
  totalEmailAccounts: number;
  platformDistribution: Record<string, { count: number; avgHealth: number }>;
  platformCoverage: Record<string, { count: number; percentage: number }>;
  emailsByStatus: Record<string, number>;
  emailsByTier: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-bg-tertiary rounded" />
          <div className="h-7 w-16 bg-bg-tertiary rounded" />
        </div>
        <div className="h-10 w-10 bg-bg-tertiary rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="h-4 w-4 bg-bg-tertiary rounded-full" />
      <div className="flex-1 space-y-1">
        <div className="h-3 w-48 bg-bg-tertiary rounded" />
        <div className="h-2 w-32 bg-bg-tertiary rounded" />
      </div>
      <div className="h-6 w-16 bg-bg-tertiary rounded" />
    </div>
  );
}

function SkeletonProgress() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1">
          <div className="h-3 w-20 bg-bg-tertiary rounded" />
          <div className="h-2 w-full bg-bg-tertiary rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

function activityIcon(type: string) {
  switch (type) {
    case 'content':
      return <ClipboardCheck size={14} className="text-accent-purple" aria-hidden="true" />;
    case 'posting':
      return <Send size={14} className="text-accent-green" aria-hidden="true" />;
    case 'alert':
      return <XCircle size={14} className="text-accent-red" aria-hidden="true" />;
    default:
      return <Clock size={14} className="text-text-secondary" aria-hidden="true" />;
  }
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: approvalsRes, isLoading: approvalsLoading, error: approvalsError, mutate: mutateApprovals } = useApprovals<ApprovalItem[]>('status=pending_approval&limit=5');
  const { data: contentRes, isLoading: contentLoading, error: contentError } = useContent<ContentItem[]>('limit=100');
  const { data: workflowsRes, isLoading: workflowsLoading, error: workflowsError } = useWorkflows<WorkflowItem[]>();
  const { data: healthRes, isLoading: healthLoading, error: healthError } = useSystemHealth<HealthData>();
  const { data: metricsRes, isLoading: metricsLoading, error: metricsError } = useSystemMetrics<MetricsData>();
  const { data: activityRes, isLoading: activityLoading, error: activityError } = useApi<ActivityItem[]>('/activity?limit=10');
  const { data: revenueRes, isLoading: revenueLoading, error: revenueError } = useApi<RevenueData>('/analytics/revenue');
  const { data: accountStatsRes, isLoading: accountStatsLoading, error: accountStatsError } = useApi<AccountStats>('/accounts/stats');

  const fetchError = approvalsError || contentError || workflowsError || healthError || metricsError || activityError || revenueError || accountStatsError;

  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  // Derived data
  const approvals = approvalsRes?.data ?? [];
  const contentItems = contentRes?.data ?? [];
  const workflows = workflowsRes?.data ?? [];
  const health = healthRes?.data;
  const metrics = metricsRes?.data;
  const activityFeed = activityRes?.data ?? [];
  const revenue = revenueRes?.data;
  const accountStats = accountStatsRes?.data;

  const postedTodayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return contentItems.filter(
      (c) => c.status === 'posted' && c.createdAt?.slice(0, 10) === today,
    ).length;
  }, [contentItems]);

  const accountsHealthy = health?.services
    ? Math.round((health.services.healthy / Math.max(health.services.total, 1)) * 100)
    : null;

  // Workflow type counts
  const workflowCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    workflows.forEach((w) => {
      const cat = w.jobType || 'Other';
      cats[cat] = (cats[cat] ?? 0) + 1;
    });
    return Object.entries(cats);
  }, [workflows]);

  // Actions
  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    setActionInFlight(id);
    try {
      await apiPost(`/approvals/${id}/${action}`);
      mutateApprovals();
    } catch (err) {
      console.error(`Failed to ${action} content:`, err);
      toast.error(`Failed to ${action} content`);
    } finally {
      setActionInFlight(null);
    }
  };

  // ---------- Render ----------

  return (
    <AppLayout>
      {fetchError && (
        <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          Some dashboard data failed to load. Please try refreshing the page.
        </div>
      )}
      {/* 1. Greeting Row */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{getGreeting()}</h1>
        <p className="text-text-secondary mt-1">{formatDate()}</p>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {approvalsLoading ? (
          <SkeletonCard />
        ) : (
          <Link href="/approvals" className="card block hover:border-accent-purple/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Pending Approvals</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {formatNumber(approvalsRes?.meta?.total ?? approvals.length)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <ClipboardCheck size={20} className="text-accent-purple" />
              </div>
            </div>
          </Link>
        )}

        {contentLoading ? (
          <SkeletonCard />
        ) : (
          <Link href="/content?status=posted" className="card block hover:border-accent-green/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Posted Today</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{formatNumber(postedTodayCount)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent-green/10 flex items-center justify-center">
                <Send size={20} className="text-accent-green" />
              </div>
            </div>
          </Link>
        )}

        {healthLoading ? (
          <SkeletonCard />
        ) : (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Accounts Healthy</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {accountsHealthy !== null ? `${accountsHealthy}%` : '--'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent-green/10 flex items-center justify-center">
                <HeartPulse size={20} className="text-accent-green" />
              </div>
            </div>
          </div>
        )}

        {revenueLoading ? (
          <SkeletonCard />
        ) : (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Revenue</p>
                <p className="text-2xl font-bold text-text-primary mt-1">
                  {revenue ? formatCurrency(Number(revenue.totals.totalRevenue)) : '--'}
                </p>
                {revenue && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
                    {revenue.totals.totalConversions} conversions
                  </div>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-accent-amber/10 flex items-center justify-center">
                <DollarSign size={20} className="text-accent-amber" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Approval Queue Preview */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Approval Queue</h2>
          <Link href="/approvals" className="text-sm text-accent-blue hover:underline flex items-center gap-1">
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {approvalsLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No pending approvals</p>
        ) : (
          <div className="divide-y divide-border">
            {approvals.slice(0, 5).map((item) => {
              const countdown = formatCountdown(item.createdAt, item.approvalGateWindowHrs);
              return (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/content/${item.id}`} className="text-sm font-medium text-text-primary truncate hover:text-accent-blue hover:underline block">{item.title ?? item.channel?.name ?? 'No channel'}</Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('badge text-xs', statusColor(item.status))}>{item.contentType}</span>
                      {item.qualityScore != null && (
                        <QualityBadge score={Number(item.qualityScore)} size="sm" />
                      )}
                      {countdown && (
                        <span className={cn('text-xs', {
                          'text-text-secondary': countdown.urgency === 'normal',
                          'text-accent-amber': countdown.urgency === 'amber',
                          'text-accent-red font-medium': countdown.urgency === 'red',
                        })}>
                          <Clock size={10} className="inline mr-0.5" />
                          {countdown.text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      disabled={actionInFlight === item.id}
                      onClick={() => handleApproval(item.id, 'approve')}
                      className="btn-success btn-sm flex items-center gap-1"
                      aria-label="Approve"
                    >
                      <CheckCircle2 size={14} />
                      <span className="hidden sm:inline">Approve</span>
                    </button>
                    <button
                      disabled={actionInFlight === item.id}
                      onClick={() => setRejectId(item.id)}
                      className="btn-danger btn-sm flex items-center gap-1"
                      aria-label="Reject"
                    >
                      <XCircle size={14} />
                      <span className="hidden sm:inline">Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Active Workflows + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Workflows */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Active Workflows</h2>
            <Link href="/workflows" className="text-sm text-accent-blue hover:underline flex items-center gap-1">
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          {workflowsLoading ? (
            <SkeletonProgress />
          ) : workflowCategories.length === 0 ? (
            <p className="text-text-secondary text-sm py-4 text-center">No active workflows</p>
          ) : (
            <div className="space-y-3">
              {workflowCategories.map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-accent-blue" />
                    <span className="text-sm text-text-primary">{category}</span>
                  </div>
                  <span className="text-sm font-medium text-text-primary">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">System Health</h2>
          {metricsLoading || healthLoading ? (
            <SkeletonProgress />
          ) : (
            <div className="space-y-4">
              {/* CPU */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Cpu size={14} /> CPU
                  </span>
                  <span className="text-text-primary font-medium">{metrics?.cpu ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (metrics?.cpu ?? 0) > 80 ? 'bg-accent-red' : (metrics?.cpu ?? 0) > 50 ? 'bg-accent-amber' : 'bg-accent-green',
                    )}
                    style={{ width: `${metrics?.cpu ?? 0}%` }}
                  />
                </div>
              </div>

              {/* RAM */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <MemoryStick size={14} /> RAM
                  </span>
                  <span className="text-text-primary font-medium">{metrics?.ram ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (metrics?.ram ?? 0) > 80 ? 'bg-accent-red' : (metrics?.ram ?? 0) > 50 ? 'bg-accent-amber' : 'bg-accent-green',
                    )}
                    style={{ width: `${metrics?.ram ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Queue Depth */}
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Layers size={14} /> Queue Depth
                </span>
                <span className="text-sm font-medium text-text-primary">{metrics?.queueDepth ?? 0} jobs</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Account Coverage */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Platform Coverage</h2>
          <Link href="/accounts" className="text-sm text-accent-blue hover:underline flex items-center gap-1">
            Manage accounts <ChevronRight size={14} />
          </Link>
        </div>
        {accountStatsLoading ? (
          <SkeletonProgress />
        ) : !accountStats ? (
          <p className="text-text-secondary text-sm py-4 text-center">No account data available</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { platform: 'youtube', label: 'YouTube', icon: <Youtube size={16} />, color: 'text-red-500' },
                { platform: 'tiktok', label: 'TikTok', icon: <Music2 size={16} />, color: 'text-cyan-400' },
                { platform: 'instagram', label: 'Instagram', icon: <Instagram size={16} />, color: 'text-pink-500' },
                { platform: 'facebook', label: 'Facebook', icon: <Facebook size={16} />, color: 'text-blue-500' },
              ].map(({ platform, label, icon, color }) => {
                const dist = accountStats.platformDistribution[platform];
                const cov = accountStats.platformCoverage[platform];
                return (
                  <div key={platform} className="rounded-lg border border-border bg-bg-secondary p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={color}>{icon}</span>
                      <span className="text-sm font-medium text-text-primary">{label}</span>
                    </div>
                    <p className="text-xl font-bold text-text-primary">{dist?.count ?? 0}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-text-secondary">
                        {cov?.percentage ?? 0}% coverage
                      </span>
                      {dist && (
                        <span className={cn(
                          'text-xs',
                          dist.avgHealth >= 80 ? 'text-accent-green' : dist.avgHealth >= 50 ? 'text-accent-amber' : 'text-accent-red',
                        )}>
                          {dist.avgHealth}% health
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-tertiary mt-2 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
                        style={{ width: `${cov?.percentage ?? 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="text-text-secondary">
                Total email accounts: <span className="font-medium text-text-primary">{accountStats.totalEmailAccounts}</span>
              </span>
              <span className="text-text-secondary">
                Active: <span className="font-medium text-accent-green">{accountStats.emailsByStatus?.active ?? 0}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 7. Recent Activity Feed */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h2>
        {activityLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : activityFeed.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No recent activity</p>
        ) : (
          <div className="divide-y divide-border">
            {activityFeed.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="h-7 w-7 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
                  {activityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{item.message}</p>
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={rejectId !== null}
        title="Reject Content"
        message="Are you sure you want to reject this content? Visit the content detail page to provide a rejection reason."
        confirmLabel="Reject"
        variant="danger"
        onConfirm={() => { if (rejectId) { handleApproval(rejectId, 'reject'); } setRejectId(null); }}
        onCancel={() => setRejectId(null)}
        loading={actionInFlight !== null}
      />
    </AppLayout>
  );
}
