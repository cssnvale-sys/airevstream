import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, success } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);
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
    console.error('GET /api/v1/approvals/trust-scores error:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
