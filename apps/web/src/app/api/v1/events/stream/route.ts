import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSE, error } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { ApiContext } from '@/lib/api-server';
import type { SystemEvent, AlertSeverity, WorkflowStatus, ContentStatus } from '@/lib/event-types';
import { logger } from '@/lib/logger';

const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function sseMessage(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return encoder.encode(payload);
}

function sseComment(text: string): Uint8Array {
  return encoder.encode(`:${text}\n\n`);
}

function eventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Poll real alerts from the database.
 */
async function pollAlerts(ctx: ApiContext, lastCheck: Date): Promise<SystemEvent | null> {
  const alert = await ctx.db.alert.findFirst({
    where: {
      createdAt: { gt: lastCheck },
      status: { in: ['open', 'acknowledged'] },
      OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!alert) return null;

  const metadata = (alert.metadata as Record<string, unknown>) ?? {};

  return {
    type: 'alert',
    id: eventId(),
    timestamp: new Date().toISOString(),
    data: {
      severity: alert.severity as AlertSeverity,
      title: alert.title,
      message: alert.message ?? '',
      category: alert.category,
      source: alert.source ?? 'system',
      link: (metadata.link as string) ?? undefined,
      metadata,
    },
  };
}

/**
 * Poll real workflow job updates (tenant-scoped).
 */
async function pollWorkflows(ctx: ApiContext, _lastCheck: Date, tenantChannelIds?: string[]): Promise<SystemEvent | null> {
  const where: Record<string, unknown> = { status: { in: ['queued', 'running'] } };
  if (tenantChannelIds) {
    where.OR = [
      { channelId: { in: tenantChannelIds } },
      { channelId: null },
    ];
  }
  const job = await ctx.db.workflowJob.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  if (!job) return null;

  return {
    type: 'workflow-update',
    id: eventId(),
    timestamp: new Date().toISOString(),
    data: {
      workflowId: job.id,
      jobId: job.id,
      status: job.status as WorkflowStatus,
      progress: job.progress,
      stepName: job.jobType,
      message: `${job.jobType} ${job.status}`,
    },
  };
}

/**
 * Poll real content status changes (tenant-scoped).
 */
async function pollContent(ctx: ApiContext, lastCheck: Date, tenantChannelIds?: string[]): Promise<SystemEvent | null> {
  const where: Record<string, unknown> = {
    updatedAt: { gt: lastCheck },
    status: { in: ['generating', 'generated', 'pending_approval'] },
  };
  if (tenantChannelIds) {
    where.channelId = { in: tenantChannelIds };
  }
  const content = await ctx.db.contentItem.findFirst({
    where,
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      channelId: true,
      status: true,
      title: true,
      contentType: true,
    },
  });

  if (!content) return null;

  return {
    type: 'content-status',
    id: eventId(),
    timestamp: new Date().toISOString(),
    data: {
      contentId: content.id,
      channelId: content.channelId,
      status: content.status as ContentStatus,
      title: content.title ?? 'Untitled',
      contentType: content.contentType,
    },
  };
}

/**
 * Poll real system metrics.
 */
async function pollMetrics(ctx: ApiContext): Promise<SystemEvent | null> {
  const metric = await ctx.db.systemMetric.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!metric) return null;

  return {
    type: 'system-metric',
    id: eventId(),
    timestamp: new Date().toISOString(),
    data: {
      metricType: metric.metricType,
      value: Number(metric.value),
      unit: metric.unit ?? '',
      threshold: null,
      status: Number(metric.value) > 85 ? 'critical' as const : Number(metric.value) > 70 ? 'warning' as const : 'normal' as const,
    },
  };
}

type PollFn = (ctx: ApiContext, lastCheck: Date, tenantChannelIds?: string[]) => Promise<SystemEvent | null>;
const pollers: Array<{ type: string; fn: PollFn }> = [
  { type: 'alert', fn: pollAlerts },
  { type: 'workflow-update', fn: pollWorkflows },
  { type: 'content-status', fn: pollContent },
  { type: 'system-metric', fn: (ctx) => pollMetrics(ctx) },
];

/**
 * GET /api/v1/events/stream
 *
 * Server-Sent Events endpoint for real-time dashboard updates.
 * Polls the database for new alerts, workflow updates, content changes,
 * and system metrics every 10 seconds.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateSSE(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  // Rate limit SSE connections: max 10 connections per minute per user
  const ip = getClientIp(req);
  const rl = checkRateLimit(`events:SSE:${ip}:${ctx.userId}`, { maxAttempts: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many SSE connections. Please try again later.', 429);

  // Pre-fetch tenant channel IDs for scoping pollers
  const tenantChannels = await ctx.db.channel.findMany({
    where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
    select: { id: true },
  });
  const tenantChannelIds = tenantChannels.map((c) => c.id);

  const signal = req.signal;
  let lastCheck = new Date(Date.now() - 60_000); // Start checking from 1 minute ago

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseMessage('connected', {
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: {
          serverId: `srv_${Math.random().toString(36).slice(2, 8)}`,
          version: '0.1.0',
        },
      }));

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(sseComment('ping'));
        } catch (streamErr) {
          // Stream closed by client — clean up heartbeat
          logger.debug('SSE stream closed by client, cleaning up heartbeat', { streamErr });
          clearInterval(heartbeatInterval);
        }
      }, SSE_HEARTBEAT_INTERVAL_MS);

      // Poll all event types in parallel every 10 seconds
      const eventInterval = setInterval(async () => {
        const cycleStart = new Date();
        try {
          const results = await Promise.allSettled(
            pollers.map(p => p.fn(ctx, lastCheck, tenantChannelIds))
          );
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              controller.enqueue(sseMessage(result.value.type, result.value));
            }
          }
          lastCheck = cycleStart;
        } catch (err) {
          logger.error('SSE poll error (cycle skipped)', err as Error);
        }
      }, 10_000);

      signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearInterval(eventInterval);
        try {
          controller.close();
        } catch (err) {
          // Stream may already be closed — log only unexpected errors
          if (err instanceof Error && err.message !== 'Controller is already closed') {
            console.error('SSE stream close error:', err.message);
          }
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
