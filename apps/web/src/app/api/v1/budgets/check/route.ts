import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

/**
 * GET /api/v1/budgets/check
 * Check all active budgets and return any that have exceeded their alert threshold.
 * Queries AiServiceUsage to compute current spend for each budget's period.
 *
 * Returns a list of budget status objects:
 *   { id, name, limitAmount, currentSpend, percentUsed, isOverThreshold, isExceeded }
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    // Get all active budgets (tenant-scoped)
    const budgets = await ctx.db.costBudget.findMany({
      where: {
        tenantId: ctx.tenantId!,
        status: 'active',
      },
    });

    // Tenant scoping: get this tenant's channel IDs for cost aggregation
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    // Run all aggregate queries in parallel instead of serial N+1
    const aggregates = await Promise.all(
      budgets.map((budget) =>
        ctx.db.aiServiceUsage.aggregate({
          _sum: { cost: true },
          where: {
            channelId: { in: tenantChannelIds },
            createdAt: { gte: budget.periodStart, lte: budget.periodEnd },
            cost: { not: null },
          },
        })
      )
    );

    const results = [];
    const updates = [];

    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i];
      const computedSpend = Number(aggregates[i]._sum.cost ?? 0);
      const limitAmount = Number(budget.limitAmount);
      const alertThreshold = Number(budget.alertThreshold);

      // Batch updates instead of individual writes
      if (computedSpend !== Number(budget.currentSpend)) {
        updates.push(
          ctx.db.costBudget.update({
            where: { id: budget.id },
            data: {
              currentSpend: computedSpend,
              ...(computedSpend >= limitAmount ? { status: 'exceeded' } : {}),
            },
          })
        );
      }

      const percentUsed = limitAmount > 0 ? computedSpend / limitAmount : 0;
      const isOverThreshold = percentUsed >= alertThreshold;
      const isExceeded = percentUsed >= 1;

      if (isOverThreshold) {
        results.push({
          id: budget.id,
          name: budget.name,
          budgetType: budget.budgetType,
          category: budget.category,
          limitAmount,
          currentSpend: computedSpend,
          percentUsed: Math.round(percentUsed * 10000) / 100,
          isOverThreshold,
          isExceeded,
          periodStart: budget.periodStart,
          periodEnd: budget.periodEnd,
        });
      }
    }

    // Batch all updates in a single transaction
    if (updates.length > 0) {
      await ctx.db.$transaction(updates);
    }

    return success(results, {
      totalActive: budgets.length,
      totalOverThreshold: results.length,
    });
  } catch (err) {
    console.error('GET /api/v1/budgets/check error:', err);
    return error('INTERNAL_ERROR', 'Failed to check budgets', 500);
  }
}
