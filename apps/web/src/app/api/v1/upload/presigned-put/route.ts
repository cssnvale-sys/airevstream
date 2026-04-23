import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { getPresignedPutUrl, ensureBucket } from '@airevstream/storage';
import { BUCKETS, PRESIGNED_URL_TTL_SECONDS } from '@airevstream/shared';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_BUCKETS = [BUCKETS.AVATARS, BUCKETS.SCENERY, BUCKETS.BRANDING];

/**
 * POST /api/v1/upload/presigned-put
 * Generate a presigned PUT URL for direct-to-MinIO upload.
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const ctx = authResult;

  if (ctx.role === 'viewer') return forbidden('Viewers cannot upload files');
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`upload-presigned:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

  try {
    const body = await req.json();
    const { bucket, fileName, contentType } = body as {
      bucket?: string;
      fileName?: string;
      contentType?: string;
    };

    if (!bucket || !fileName || !contentType) {
      return validationError('bucket, fileName, and contentType are required');
    }

    if (!(ALLOWED_BUCKETS as readonly string[]).includes(bucket)) {
      return validationError(
        `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}`,
      );
    }

    // Derive asset type from bucket name (strip 'airevstream-' prefix)
    const assetType = bucket.replace('airevstream-', '');
    const key = `${ctx.tenantId}/${assetType}/${crypto.randomUUID()}/${fileName}`;

    await ensureBucket(bucket);
    const url = await getPresignedPutUrl(bucket, key, PRESIGNED_URL_TTL_SECONDS);

    return success({ url, bucket, key, expiresIn: PRESIGNED_URL_TTL_SECONDS });
  } catch (err) {
    logger.error('POST /api/v1/upload/presigned-put failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to generate presigned URL', 500);
  }
}
