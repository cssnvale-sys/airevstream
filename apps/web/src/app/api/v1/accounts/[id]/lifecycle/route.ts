import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startAccountLifecyclePipeline } from '@airevstream/queue';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const StartLifecycleSchema = z.object({
  targetPlatforms: z.array(z.enum(['youtube', 'tiktok', 'instagram', 'facebook'])).min(1),
  avatarId: z.string().uuid().optional(),
  autoSeasoning: z.boolean().optional(),
  autoPosting: z.boolean().optional(),
});

/**
 * GET /api/v1/accounts/[id]/lifecycle
 * Get lifecycle status for an email account
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const { id } = await params;

  try {
    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!emailAccount) return error('NOT_FOUND', 'Email account not found', 404);

    const lifecycle = await ctx.db.accountLifecycle.findUnique({
      where: { emailAccountId: id },
    });

    if (!lifecycle) {
      return success({ lifecycle: null });
    }

    return success({
      lifecycle: {
        id: lifecycle.id,
        status: lifecycle.status,
        targetPlatforms: lifecycle.targetPlatforms,
        discoveryResults: lifecycle.discoveryResults,
        avatarId: lifecycle.avatarId,
        autoSeasoning: lifecycle.autoSeasoning,
        autoPosting: lifecycle.autoPosting,
        cohortId: lifecycle.cohortId,
        currentStep: lifecycle.currentStep,
        error: lifecycle.error,
        startedAt: lifecycle.startedAt?.toISOString() ?? null,
        completedAt: lifecycle.completedAt?.toISOString() ?? null,
        createdAt: lifecycle.createdAt.toISOString(),
        updatedAt: lifecycle.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('GET /api/v1/accounts/[id]/lifecycle failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch lifecycle status', 500);
  }
}

/**
 * POST /api/v1/accounts/[id]/lifecycle
 * Start a lifecycle pipeline for an email account
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
  if (ctx.role === 'viewer') return forbidden('Viewers cannot perform this action');

  const ip = getClientIp(req);
  const rl = checkRateLimit(`lifecycle:start:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  const { id } = await params;

  try {
    const emailAccount = await ctx.db.emailAccount.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!emailAccount) return error('NOT_FOUND', 'Email account not found', 404);

    // Check for existing active lifecycle
    const existing = await ctx.db.accountLifecycle.findUnique({
      where: { emailAccountId: id },
    });
    if (existing && !['failed', 'completed'].includes(existing.status)) {
      return error('CONFLICT', 'A lifecycle pipeline is already active for this account', 409);
    }

    const body = await req.json();
    const parsed = StartLifecycleSchema.safeParse(body);
    if (!parsed.success) {
      return error('VALIDATION_ERROR', parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 400);
    }

    const result = await startAccountLifecyclePipeline({
      emailAccountId: id,
      tenantId: ctx.tenantId,
      targetPlatforms: parsed.data.targetPlatforms,
      avatarId: parsed.data.avatarId,
      autoSeasoning: parsed.data.autoSeasoning,
      autoPosting: parsed.data.autoPosting,
    });

    return success({ jobId: result.jobId, status: 'started' });
  } catch (err) {
    console.error('POST /api/v1/accounts/[id]/lifecycle failed:', err);
    return error('INTERNAL_ERROR', 'Failed to start lifecycle pipeline', 500);
  }
}
