import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getPresignedUrl } from '@airevstream/storage';
import { BUCKETS, PRESIGNED_URL_TTL_SECONDS } from '@airevstream/shared';

const ALLOWED_BUCKETS: Set<string> = new Set(Object.values(BUCKETS));

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const ip = getClientIp(req);
    const rl = checkRateLimit(`media-url:${ip}:${ctx.userId}`, { maxAttempts: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get('bucket');
    const key = searchParams.get('key');

    if (!bucket || !key) {
      return validationError('Missing required parameters: bucket, key');
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return validationError('Invalid bucket name');
    }

    const url = await getPresignedUrl(bucket, key, PRESIGNED_URL_TTL_SECONDS);
    return success({ url, expiresIn: PRESIGNED_URL_TTL_SECONDS });
  } catch (err) {
    console.error('GET /api/v1/media/[...path] error:', err);
    // MinIO throws if object doesn't exist
    if (err instanceof Error && err.message.includes('Not Found')) {
      return error('NOT_FOUND', 'Object not found', 404);
    }
    return error('INTERNAL_ERROR', 'Failed to generate presigned URL', 500);
  }
}
