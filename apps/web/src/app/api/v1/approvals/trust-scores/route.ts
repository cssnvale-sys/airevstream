import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, success , type ApiContext } from '@/lib/api-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    const rawScores = await ctx.db.approvalTrustScore.findMany({
      orderBy: { dimensionType: 'asc' },
    });

    // Convert Prisma Decimal fields to numbers
    const scores = rawScores.map((s) => ({
      ...s,
      trustScore: Number(s.trustScore),
      gateWindowHrs: Number(s.gateWindowHrs),
      avgOutcomeScore: Number(s.avgOutcomeScore),
    }));

    return success(scores);
  } catch (err) {
    logger.error('GET /api/v1/approvals/trust-scores error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch trust scores', 500);
  }
}
