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
    // Get all active budgets
    const budgets = await ctx.db.costBudget.findMany({
      where: {
        status: 'active',
      },
    });

    const results = [];

    for (const budget of budgets) {
      // Query AiServiceUsage to compute actual spend for this budget's period
      const usageAggregate = await ctx.db.aiServiceUsage.aggregate({
        _sum: {
          cost: true,
        },
        where: {
          createdAt: {
            gte: budget.periodStart,
            lte: budget.periodEnd,
          },
          cost: {
            not: null,
          },
          // If the budget has a category, we could filter by it.
          // For 'ai_services' category, include all AI service usage.
          // For 'all' or null category, include everything.
        },
      });

      const computedSpend = Number(usageAggregate._sum.cost ?? 0);
      const limitAmount = Number(budget.limitAmount);
      const alertThreshold = Number(budget.alertThreshold);

      // Update currentSpend in the database to reflect actual usage
      if (computedSpend !== Number(budget.currentSpend)) {
        await ctx.db.costBudget.update({
          where: { id: budget.id },
          data: {
            currentSpend: computedSpend,
            // Auto-update status if exceeded
            ...(computedSpend >= limitAmount ? { status: 'exceeded' } : {}),
          },
        });
      }

      const percentUsed = limitAmount > 0 ? computedSpend / limitAmount : 0;
      const isOverThreshold = percentUsed >= alertThreshold;
      const isExceeded = percentUsed >= 1;

      // Only include budgets that are over their alert threshold
      if (isOverThreshold) {
        results.push({
          id: budget.id,
          name: budget.name,
          budgetType: budget.budgetType,
          category: budget.category,
          limitAmount,
          currentSpend: computedSpend,
          percentUsed: Math.round(percentUsed * 10000) / 100, // e.g. 85.50%
          isOverThreshold,
          isExceeded,
          periodStart: budget.periodStart,
          periodEnd: budget.periodEnd,
        });
      }
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
