import { authenticate, success, paginated } from '@/lib/api-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/jobs
 * Stub: returns empty paginated response.
 * TODO: wire to Prisma model when schema is extended.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) {
    // Return empty paginated response instead of error for graceful UI
    return paginated([], 0, 1, 25);
  }
  return paginated([], 0, 1, 25);
}
