'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  useSystemHealth,
  useSystemMetrics,
  useAlerts,
  useWorkflows,
  apiPost,
} from '@/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Database,
  Globe,
  Cog,
  Brain,
  Layers,
  Box,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  BellOff,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthData {
  status: string;
  services: { total: number; healthy: number; statuses?: Record<string, number> };
  metrics?: Record<string, { value: number; unit: string; timestamp: string } | null>;
  alerts?: { open: Record<string, number> };
  queues?: { activeJobs: number; pendingPosts: number };
}

interface MetricsData {
  cpu: number;
  ram: number;
  disk: number;
  queueDepth: number;
}

interface WorkflowRun {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
  content?: { id: string; title: string; contentType: string } | null;
}

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string | null;
  createdAt: string;
  status: string;
  acknowledgedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonBar() {
  return (
    <div className="animate-pulse space-y-1">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-bg-tertiary rounded" />
        <div className="h-3 w-10 bg-bg-tertiary rounded" />
      </div>
      <div className="h-2.5 w-full bg-bg-tertiary rounded-full" />
    </div>
  );
}

function SkeletonServiceCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-3 w-3 rounded-full bg-bg-tertiary" />
        <div className="h-4 w-28 bg-bg-tertiary rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 bg-bg-tertiary rounded" />
        <div className="h-3 w-32 bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}

interface ServiceDisplay {
  name: string;
  status: string;
  connectionInfo: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function overallStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-accent-green';
    case 'degraded':
      return 'bg-accent-amber';
    case 'unhealthy':
    case 'critical':
      return 'bg-accent-red';
    default:
      return 'bg-text-secondary';
  }
}

function serviceStatusDot(status: string): string {
  switch (status) {
    case 'healthy':
    case 'running':
    case 'connected':
      return 'bg-accent-green';
    case 'degraded':
    case 'slow':
      return 'bg-accent-amber';
    case 'unhealthy':
    case 'down':
    case 'error':
      return 'bg-accent-red';
    default:
      return 'bg-text-secondary';
  }
}

function serviceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('postgres') || lower.includes('db')) return <Database size={16} className="text-accent-blue" />;
  if (lower.includes('next') || lower.includes('web')) return <Globe size={16} className="text-text-secondary" />;
  if (lower.includes('workflow') || lower.includes('engine')) return <Cog size={16} className="text-accent-purple" />;
  if (lower.includes('ollama') || lower.includes('ai')) return <Brain size={16} className="text-accent-amber" />;
  if (lower.includes('bull') || lower.includes('worker') || lower.includes('redis')) return <Layers size={16} className="text-accent-green" />;
  if (lower.includes('minio') || lower.includes('storage')) return <Box size={16} className="text-accent-blue" />;
  return <Activity size={16} className="text-text-secondary" />;
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertCircle size={14} className="text-accent-red" />;
    case 'error':
      return <AlertTriangle size={14} className="text-accent-red" />;
    case 'warning':
      return <AlertTriangle size={14} className="text-accent-amber" />;
    case 'info':
      return <Info size={14} className="text-accent-blue" />;
    default:
      return <Info size={14} className="text-text-secondary" />;
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-accent-red/10 text-accent-red';
    case 'error':
      return 'bg-accent-red/10 text-accent-red';
    case 'warning':
      return 'bg-accent-amber/10 text-accent-amber';
    case 'info':
      return 'bg-accent-blue/10 text-accent-blue';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

function progressBarColor(pct: number): string {
  if (pct > 80) return 'bg-accent-red';
  if (pct > 50) return 'bg-accent-amber';
  return 'bg-accent-green';
}

// ---------------------------------------------------------------------------
// Known services (fallback when API doesn't return them)
// ---------------------------------------------------------------------------

const DEFAULT_SERVICES: ServiceDisplay[] = [
  { name: 'PostgreSQL', status: 'unknown', connectionInfo: 'localhost:5432' },
  { name: 'Next.js Web', status: 'unknown', connectionInfo: 'localhost:3000' },
  { name: 'Workflow Engine', status: 'unknown', connectionInfo: 'localhost:3001' },
  { name: 'Ollama', status: 'unknown', connectionInfo: 'localhost:11434' },
  { name: 'BullMQ Workers', status: 'unknown', connectionInfo: 'Redis 6379' },
  { name: 'MinIO', status: 'unknown', connectionInfo: 'localhost:9000' },
];

// ---------------------------------------------------------------------------
// System Health page
// ---------------------------------------------------------------------------

export default function SystemPage() {
  const { data: healthRes, isLoading: healthLoading, error: healthError, mutate: mutateHealth } = useSystemHealth<HealthData>();
  const { data: metricsRes, isLoading: metricsLoading, error: metricsError, mutate: mutateMetrics } = useSystemMetrics<MetricsData>();
  const { data: alertsRes, isLoading: alertsLoading, error: alertsError, mutate: mutateAlerts } = useAlerts<AlertItem[]>();
  const { data: workflowsRes, isLoading: workflowsLoading, error: workflowsError, mutate: mutateWorkflows } = useWorkflows<WorkflowRun[]>();

  const fetchError = healthError || metricsError || alertsError || workflowsError;

  const refreshAll = () => {
    mutateHealth();
    mutateMetrics();
    mutateAlerts();
    mutateWorkflows();
    toast.success('Refreshing health data...');
  };

  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [alertActionInFlight, setAlertActionInFlight] = useState<string | null>(null);

  // Derived data
  const health = healthRes?.data;
  const metrics = metricsRes?.data;
  const alerts = alertsRes?.data ?? [];
  const allWorkflows = workflowsRes?.data ?? [];
  const workflows = allWorkflows.filter((w) => w.status === 'running' || w.status === 'queued');
  // Failed jobs serve as recent errors
  const errors = allWorkflows.filter((w) => w.status === 'failed' && w.error);

  // Build service display from health counts + defaults
  const services: ServiceDisplay[] = DEFAULT_SERVICES.map((svc) => ({
    ...svc,
    status: health ? (health.services.healthy === health.services.total ? 'healthy' : 'degraded') : 'unknown',
  }));

  const overallStatus = health?.status ?? 'unknown';

  // Resource bars
  const resources = [
    { label: 'CPU', value: metrics?.cpu ?? 0, icon: Cpu },
    { label: 'RAM', value: metrics?.ram ?? 0, icon: MemoryStick },
    { label: 'Disk', value: metrics?.disk ?? 0, icon: HardDrive },
  ];

  // Actions
  const handleAcknowledgeAlert = async (id: string) => {
    setAlertActionInFlight(id);
    try {
      await apiPost(`/system/alerts/${id}/acknowledge`);
      mutateAlerts();
      toast.success('Alert acknowledged');
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      toast.error('Failed to acknowledge alert');
    } finally {
      setAlertActionInFlight(null);
    }
  };

  const handleSnoozeAlert = async (id: string) => {
    setAlertActionInFlight(id);
    try {
      await apiPost(`/system/alerts/${id}/snooze`, { duration: 3600 });
      mutateAlerts();
      toast.success('Alert snoozed for 1 hour');
    } catch (err) {
      console.error('Failed to snooze alert:', err);
      toast.error('Failed to snooze alert');
    } finally {
      setAlertActionInFlight(null);
    }
  };

  const handleRetryError = async (id: string) => {
    try {
      await apiPost(`/system/errors/${id}/retry`);
      toast.success('Retry queued');
      mutateWorkflows();
    } catch (err) {
      console.error('Failed to retry job:', err);
      toast.error('Failed to retry job');
    }
  };

  // ---------- Render ----------

  return (
    <AppLayout>
      {fetchError && (
        <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          Some system data failed to load. Please try refreshing the page.
        </div>
      )}
      {/* 1. Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">System Health</h1>
        <div className="flex items-center gap-2">
          <span
            className={cn('h-3 w-3 rounded-full', overallStatusColor(overallStatus))}
            title={overallStatus}
          />
          <span className="text-sm text-text-secondary capitalize">{overallStatus}</span>
        </div>
        {health?.queues && (
          <span className="text-xs text-text-secondary ml-auto">
            {health.queues.activeJobs} active jobs | {health.queues.pendingPosts} pending posts
          </span>
        )}
        <button
          onClick={refreshAll}
          className="btn-secondary flex items-center gap-1.5 text-sm ml-2"
          aria-label="Refresh health data"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* 2. Resource Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {metricsLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="card">
                <SkeletonBar />
              </div>
            ))
          : resources.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.label} className="card">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Icon size={14} /> {r.label}
                    </span>
                    <span className="text-text-primary font-medium">{r.value}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-bg-tertiary overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', progressBarColor(r.value))}
                      style={{ width: `${r.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
      </div>

      {/* 3. Services Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => <SkeletonServiceCard key={i} />)
            : services.map((svc) => (
                <div key={svc.name} className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', serviceStatusDot(svc.status))} />
                    <div className="flex items-center gap-1.5">
                      {serviceIcon(svc.name)}
                      <span className="font-medium text-text-primary text-sm">{svc.name}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-text-secondary">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="capitalize text-text-primary">{svc.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connection</span>
                      <span className="text-text-primary font-mono">{svc.connectionInfo}</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* 4. Active Workflows */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Active Workflows</h2>
        {workflowsLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-bg-tertiary rounded-lg" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">No running workflows</p>
        ) : (
          <div className="space-y-2">
            {workflows.map((wf) => {
              const isExpanded = expandedWorkflow === wf.id;
              return (
                <div key={wf.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-bg-tertiary/50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-text-secondary shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-text-secondary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{wf.jobType}</span>
                        {wf.content?.title && (
                          <span className="text-xs text-text-secondary truncate">{wf.content.title}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-text-secondary">{wf.progress}%</span>
                      <div className="w-24 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-blue transition-all"
                          style={{ width: `${wf.progress}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-border bg-bg-secondary/50">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-text-secondary">Started:</span>{' '}
                          <span className="text-text-primary">{formatRelativeTime(wf.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-text-secondary">Status:</span>{' '}
                          <span className="text-text-primary capitalize">{wf.status}</span>
                        </div>
                        {wf.error && (
                          <div className="col-span-2">
                            <span className="text-text-secondary">Error:</span>{' '}
                            <span className="text-accent-red">{wf.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Recent Errors */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Errors</h2>
        {workflowsLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-bg-tertiary rounded" />
            ))}
          </div>
        ) : errors.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-accent-green">
            <CheckCircle2 size={16} />
            <span className="text-sm">No recent errors</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-left">
                  <th className="pb-2 pr-3 font-medium">Severity</th>
                  <th className="pb-2 pr-3 font-medium">Job Type</th>
                  <th className="pb-2 pr-3 font-medium">Error</th>
                  <th className="pb-2 pr-3 font-medium">Time</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {errors.map((err) => (
                  <tr key={err.id} className="text-text-primary">
                    <td className="py-2 pr-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', severityBadgeClass('error'))}>
                        {severityIcon('error')}
                        error
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{err.jobType}</td>
                    <td className="py-2 pr-3 max-w-xs truncate">{err.error}</td>
                    <td className="py-2 pr-3 text-text-secondary whitespace-nowrap text-xs">
                      {formatRelativeTime(err.updatedAt)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRetryError(err.id)}
                        className="btn-ghost btn-sm inline-flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Alerts */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Alerts</h2>
        {alertsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 w-40 bg-bg-tertiary rounded mb-2" />
                <div className="h-3 w-full bg-bg-tertiary rounded" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="card flex items-center justify-center gap-2 py-6 text-accent-green">
            <CheckCircle2 size={16} />
            <span className="text-sm">No active alerts</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'card border-l-4',
                  alert.severity === 'critical'
                    ? 'border-l-accent-red'
                    : alert.severity === 'warning'
                      ? 'border-l-accent-amber'
                      : 'border-l-accent-blue',
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  {severityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary">{alert.title}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">{alert.message}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-text-secondary">{formatRelativeTime(alert.createdAt)}</span>
                  {alert.status === 'open' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={alertActionInFlight === alert.id}
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="btn-ghost btn-sm inline-flex items-center gap-1 text-xs"
                      >
                        <CheckCircle2 size={12} /> Acknowledge
                      </button>
                      <button
                        disabled={alertActionInFlight === alert.id}
                        onClick={() => handleSnoozeAlert(alert.id)}
                        className="btn-ghost btn-sm inline-flex items-center gap-1 text-xs"
                      >
                        <BellOff size={12} /> Snooze
                      </button>
                    </div>
                  )}
                  {alert.status === 'acknowledged' && (
                    <span className="badge badge-active text-xs">Acknowledged</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
