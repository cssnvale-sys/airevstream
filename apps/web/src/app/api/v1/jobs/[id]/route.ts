import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/jobs/[id]
 * Get job status by ID. Used for polling job progress.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const job = await ctx.db.workflowJob.findUnique({
      where: { id },
      select: {
        id: true,
        jobType: true,
        status: true,
        progress: true,
        result: true,
        error: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) return notFound('Job not found');

    return success({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      progress: job.progress,
      result: job.result,
      failedReason: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.completedAt,
    });
  } catch (err) {
    console.error('GET /api/v1/jobs/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch job status', 500);
  }
}
