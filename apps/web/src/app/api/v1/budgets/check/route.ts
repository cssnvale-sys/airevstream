import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  try {
    // Get all active budgets (tenant-scoped)
    const budgets = await ctx.db.costBudget.findMany({
      where: {
        tenantId: ctx.tenantId,
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
    const alertsToCreate: Array<{
      severity: string;
      category: string;
      title: string;
      message: string;
      source: string;
      metadata: Record<string, unknown>;
    }> = [];

    // Look up recent open cost-category alerts once so we can de-duplicate.
    // Previously the check endpoint computed thresholds but never persisted
    // anything (A4 Wave-1 blocker) — the budget page's "alerts" tab stayed
    // empty no matter how bad the overrun was.
    const existingAlerts = await ctx.db.alert.findMany({
      where: {
        tenantId: ctx.tenantId,
        category: 'cost',
        status: { in: ['open', 'acknowledged'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, source: true, metadata: true, severity: true },
    });
    const alertKey = (budgetId: string, kind: 'threshold' | 'exceeded') =>
      `budget:${budgetId}:${kind}`;
    const seenAlerts = new Set(
      existingAlerts
        .map((a) => (typeof a.metadata === 'object' && a.metadata && 'alertKey' in a.metadata
          ? String((a.metadata as Record<string, unknown>).alertKey)
          : null))
        .filter(Boolean) as string[],
    );

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

        const kind = isExceeded ? 'exceeded' : 'threshold';
        const key = alertKey(budget.id, kind);
        // Dedupe: only open one alert row per (budget, kind) per 24h window.
        if (!seenAlerts.has(key)) {
          seenAlerts.add(key);
          const percentText = (percentUsed * 100).toFixed(1);
          alertsToCreate.push({
            severity: isExceeded ? 'critical' : 'warning',
            category: 'cost',
            title: isExceeded
              ? `Budget exceeded: ${budget.name}`
              : `Budget threshold reached: ${budget.name}`,
            message: isExceeded
              ? `Budget "${budget.name}" has been exceeded: $${computedSpend.toFixed(2)} of $${limitAmount.toFixed(2)} (${percentText}%).`
              : `Budget "${budget.name}" is at ${percentText}% of its limit ($${computedSpend.toFixed(2)} / $${limitAmount.toFixed(2)}).`,
            source: 'budgets/check',
            metadata: {
              alertKey: key,
              budgetId: budget.id,
              budgetName: budget.name,
              budgetType: budget.budgetType,
              category: budget.category,
              limitAmount,
              currentSpend: computedSpend,
              percentUsed: Math.round(percentUsed * 10000) / 100,
              kind,
              periodStart: budget.periodStart.toISOString(),
              periodEnd: budget.periodEnd.toISOString(),
            },
          });
        }
      }
    }

    // Batch all updates in a single transaction
    if (updates.length > 0) {
      await ctx.db.$transaction(updates);
    }

    // Persist alert rows so the cost/alerts UI has something to display.
    // `createMany` is fine here — no relations need to be returned.
    if (alertsToCreate.length > 0) {
      await ctx.db.alert.createMany({
        data: alertsToCreate.map((a) => ({
          tenantId: ctx.tenantId!,
          severity: a.severity,
          category: a.category,
          title: a.title,
          message: a.message,
          source: a.source,
          metadata: a.metadata as any,
        })),
      });
    }

    return success(results, {
      totalActive: budgets.length,
      totalOverThreshold: results.length,
    });
  } catch (err) {
    logger.error('GET /api/v1/budgets/check error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to check budgets', 500);
  }
}
