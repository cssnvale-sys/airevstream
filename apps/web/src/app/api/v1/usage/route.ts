import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

type UsageMetric = {
  metric: string;
  current: number;
  limit: number;
  percentUsed: number;
};

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;

  switch (period) {
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end: monthEnd };
    }
    case 'last_7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'current_month':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
  }
}

/**
 * GET /api/v1/usage
 * Return usage metrics for the current tenant
 * Query params: period (current_month, last_month, last_7d)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return error('UNAUTHORIZED', 'User not found', 401);
    }

    if (!user.tenantId || !user.tenant) {
      return error('BAD_REQUEST', 'User is not assigned to a tenant', 400);
    }

    const url = new URL(req.url);
    const period = url.searchParams.get('period') ?? 'current_month';
    const validPeriods = ['current_month', 'last_month', 'last_7d'];
    if (!validPeriods.includes(period)) {
      return error('VALIDATION_ERROR', `Invalid period. Must be one of: ${validPeriods.join(', ')}`, 400);
    }

    const { start, end } = getDateRange(period);
    const limits = (user.tenant.limits as Record<string, number>) ?? {};

    // Count content items created in the period, scoped to tenant
    const tenantFilter = user.tenantId
      ? { channel: { socialAccount: { emailAccount: { tenantId: user.tenantId } } } }
      : {};

    const contentCount = await ctx.db.contentItem.count({
      where: {
        createdAt: { gte: start, lte: end },
        ...tenantFilter,
      },
    });

    // Count email accounts belonging to this tenant
    const accountCount = await ctx.db.emailAccount.count({
      where: user.tenantId ? { tenantId: user.tenantId } : {},
    });

    // Count channels belonging to this tenant
    const channelCount = await ctx.db.channel.count({
      where: user.tenantId
        ? { socialAccount: { emailAccount: { tenantId: user.tenantId } } }
        : {},
    });

    // Count AI service usage (API calls) in the period
    const aiUsageCount = await ctx.db.aiServiceUsage.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    // Approximate storage: count content items with fileUrl, scoped to tenant
    const filesCount = await ctx.db.contentItem.count({
      where: {
        fileUrl: { not: null },
        ...tenantFilter,
      },
    });
    const estimatedStorageGb = parseFloat((filesCount * 0.05).toFixed(2));

    const maxAccounts = limits.maxAccounts ?? 5;
    const maxChannels = limits.maxChannels ?? 3;
    const maxContentPerMonth = limits.maxContentPerMonth ?? 100;
    const storageGb = limits.storageGb ?? 1;

    const metrics: UsageMetric[] = [
      {
        metric: 'accounts',
        current: accountCount,
        limit: maxAccounts,
        percentUsed: maxAccounts === -1 ? 0 : maxAccounts === 0 ? 100 : parseFloat(((accountCount / maxAccounts) * 100).toFixed(1)),
      },
      {
        metric: 'channels',
        current: channelCount,
        limit: maxChannels,
        percentUsed: maxChannels === -1 ? 0 : maxChannels === 0 ? 100 : parseFloat(((channelCount / maxChannels) * 100).toFixed(1)),
      },
      {
        metric: 'content_items',
        current: contentCount,
        limit: maxContentPerMonth,
        percentUsed: maxContentPerMonth === -1 ? 0 : maxContentPerMonth === 0 ? 100 : parseFloat(((contentCount / maxContentPerMonth) * 100).toFixed(1)),
      },
      {
        metric: 'ai_api_calls',
        current: aiUsageCount,
        limit: -1, // No hard limit on API calls by default
        percentUsed: 0,
      },
      {
        metric: 'storage_gb',
        current: estimatedStorageGb,
        limit: storageGb,
        percentUsed: storageGb === -1 ? 0 : storageGb === 0 ? 100 : parseFloat(((estimatedStorageGb / storageGb) * 100).toFixed(1)),
      },
    ];

    return success({
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      plan: user.tenant.plan,
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      metrics,
    });
  } catch {
    return error('INTERNAL_ERROR', 'Failed to fetch usage metrics', 500);
  }
}
