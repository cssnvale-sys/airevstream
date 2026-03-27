/**
 * Shared SSE event type definitions for real-time dashboard updates.
 *
 * SSE is used instead of WebSocket because Next.js App Router doesn't
 * natively support WebSocket in API routes. SSE works with standard HTTP
 * and is simpler for one-way server-to-client updates.
 */

// ─── Event Type Discriminators ───

export type EventType = 'alert' | 'workflow-update' | 'content-status' | 'system-metric';

// ─── Base Event ───

export type SystemEventBase = {
  type: EventType;
  timestamp: string; // ISO 8601
  id: string; // unique event ID
};

// ─── Specific Event Types ───

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export type AlertEvent = SystemEventBase & {
  type: 'alert';
  data: {
    severity: AlertSeverity;
    title: string;
    message: string;
    category: string;
    source: string;
    link?: string;
    metadata?: Record<string, unknown>;
  };
};

export type WorkflowStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type WorkflowUpdateEvent = SystemEventBase & {
  type: 'workflow-update';
  data: {
    workflowId: string;
    jobId: string;
    status: WorkflowStatus;
    progress: number; // 0-100
    stepName: string;
    message: string;
  };
};

export type ContentStatus = 'generating' | 'generated' | 'rendering' | 'rendered' | 'failed' | 'pending_approval';

export type ContentStatusEvent = SystemEventBase & {
  type: 'content-status';
  data: {
    contentId: string;
    channelId: string;
    status: ContentStatus;
    title: string;
    contentType: string;
  };
};

export type SystemMetricEvent = SystemEventBase & {
  type: 'system-metric';
  data: {
    metricType: string;
    value: number;
    unit: string;
    threshold: number | null;
    status: 'normal' | 'warning' | 'critical';
  };
};

// ─── Union Type ───

export type SystemEvent = AlertEvent | WorkflowUpdateEvent | ContentStatusEvent | SystemMetricEvent;

// ─── Connection Event (sent on initial connect) ───

export type ConnectionEvent = {
  type: 'connected';
  timestamp: string;
  data: {
    serverId: string;
    version: string;
  };
};

