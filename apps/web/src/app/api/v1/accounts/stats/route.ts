import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';

/**
 * GET /api/v1/accounts/stats
 * Returns account coverage statistics: platform distribution, status breakdown, tier distribution
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const db = ctx.db;

    const tenantScope = { tenantId: ctx.tenantId };
    const socialTenantScope = { emailAccount: { tenantId: ctx.tenantId } };
    const channelTenantScope = { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } };

    const [
      totalEmails,
      emailsByStatus,
      socialsByPlatform,
      socialsByStatus,
      emailsByTier,
      channelsByLanguage,
      recentlyActive,
    ] = await Promise.all([
      db.emailAccount.count({ where: tenantScope }),

      db.emailAccount.groupBy({
        by: ['status'],
        where: tenantScope,
        _count: { id: true },
      }),

      db.socialAccount.groupBy({
        by: ['platform'],
        where: socialTenantScope,
        _count: { id: true },
        _avg: { healthScore: true },
      }),

      db.socialAccount.groupBy({
        by: ['status'],
        where: socialTenantScope,
        _count: { id: true },
      }),

      db.emailAccount.groupBy({
        by: ['tier'],
        where: tenantScope,
        _count: { id: true },
      }),

      db.channel.groupBy({
        by: ['primaryLanguage'],
        where: channelTenantScope,
        _count: { id: true },
      }),

      db.socialAccount.count({
        where: {
          ...socialTenantScope,
          lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Calculate coverage: emails that have at least one social account per platform
    const emailsWithSocials = await db.emailAccount.findMany({
      where: tenantScope,
      select: {
        id: true,
        socialAccounts: {
          select: { platform: true },
        },
      },
    });

    const platforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
    const coverage: Record<string, { count: number; percentage: number }> = {};
    for (const platform of platforms) {
      const count = emailsWithSocials.filter((e) =>
        e.socialAccounts.some((s) => s.platform === platform),
      ).length;
      coverage[platform] = {
        count,
        percentage: totalEmails > 0 ? Math.round((count / totalEmails) * 100) : 0,
      };
    }

    return success({
      totalEmailAccounts: totalEmails,
      emailsByStatus: Object.fromEntries(
        emailsByStatus.map((s) => [s.status, s._count.id]),
      ),
      emailsByTier: Object.fromEntries(
        emailsByTier.map((t) => [t.tier, t._count.id]),
      ),
      platformDistribution: Object.fromEntries(
        socialsByPlatform.map((p) => [
          p.platform,
          { count: p._count.id, avgHealth: Math.round(Number(p._avg.healthScore ?? 0)) },
        ]),
      ),
      socialsByStatus: Object.fromEntries(
        socialsByStatus.map((s) => [s.status, s._count.id]),
      ),
      platformCoverage: coverage,
      channelsByLanguage: Object.fromEntries(
        channelsByLanguage.map((l) => [l.primaryLanguage, l._count.id]),
      ),
      recentlyActiveAccounts: recentlyActive,
    });
  } catch (err) {
    console.error('GET /api/v1/accounts/stats failed:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch account stats', 500);
  }
}
