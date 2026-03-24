import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { addJob } from '@airevstream/queue';
import { z } from 'zod';

const ResearchBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('trends'),
    platform: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('topics'),
    niche: z.string().min(1),
    count: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('knowledge-update'),
    domain: z.string().min(1),
    sourceUrl: z.string().url().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);
    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot trigger research');
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`research:POST:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    let body: z.infer<typeof ResearchBodySchema>;
    try {
      const raw = await req.json();
      body = ResearchBodySchema.parse(raw);
    } catch {
      return error('VALIDATION_ERROR', 'Invalid request body. Expected type: trends, topics, or knowledge-update', 400);
    }

    let job;
    if (body.type === 'trends') {
      job = await addJob('research', 'research:trends', {
        tenantId: ctx.tenantId!,
        platform: body.platform,
        keywords: body.keywords,
      });
    } else if (body.type === 'topics') {
      job = await addJob('research', 'research:topics', {
        tenantId: ctx.tenantId!,
        niche: body.niche,
        count: body.count,
      });
    } else {
      job = await addJob('research', 'research:knowledge-update', {
        tenantId: ctx.tenantId!,
        domain: body.domain,
        sourceUrl: body.sourceUrl,
      });
    }

    return success({ jobId: job.id, type: body.type, message: 'Research job queued' });
  } catch (err) {
    console.error('POST /api/v1/research error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
