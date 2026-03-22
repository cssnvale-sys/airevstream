import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, forbidden, isUUID, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import type { QueueName } from '@airevstream/queue';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/system/errors/[id]/retry
 * Re-queue a failed workflow job via BullMQ.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot retry jobs');
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`system-errors-retry:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;
  if (!isUUID(id)) return validationError('Invalid ID format');

  try {
    // Verify tenant ownership through content or account chain
    const job = await ctx.db.workflowJob.findFirst({
      where: {
        id,
        OR: [
          { content: { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } } },
          { emailAccountId: { not: null } },
        ],
      },
    });
    if (!job) return notFound('Workflow job not found');

    // Extra check for emailAccountId-based jobs
    if (!job.contentId && job.emailAccountId) {
      const ownsAccount = await ctx.db.emailAccount.findFirst({
        where: { id: job.emailAccountId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!ownsAccount) return notFound('Workflow job not found');
    }

    if (job.status !== 'failed') {
      return error('BAD_REQUEST', `Job is in "${job.status}" state, only failed jobs can be retried`, 400);
    }

    if (job.retryCount >= job.maxRetries) {
      return error('BAD_REQUEST', `Job has exceeded max retries (${job.maxRetries})`, 400);
    }

    // Map jobType to queue name
    const queueMap: Record<string, QueueName> = {
      content_production: 'content',
      account_creation: 'account',
      warming: 'account',
      research: 'research',
      posting: 'posting',
      maintenance: 'maintenance',
      image_generation: 'production',
      video_render: 'production',
      audio_generation: 'production',
    };

    const queueName = queueMap[job.jobType] ?? 'content';

    // Re-queue the job
    const newJob = await addJob(queueName, job.jobType, job.params as Record<string, unknown>, {
      attempts: job.maxRetries - job.retryCount,
    });

    // Update the workflow job record
    await ctx.db.workflowJob.update({
      where: { id },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
        error: null,
      },
    });

    return success({
      id,
      status: 'queued',
      queueJobId: newJob.id,
      retryCount: job.retryCount + 1,
    });
  } catch (err) {
    console.error('POST /api/v1/system/errors/[id]/retry error:', err);
    return error('INTERNAL_ERROR', 'Failed to retry job', 500);
  }
}
