import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, validationError, requireAdmin } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/v1/settings/data/export
 * Export data as CSV. Query: type (content|analytics|accounts)
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const adminCheck = requireAdmin(ctx);
  if (adminCheck) return adminCheck;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`settings-data-export:GET:${ip}:${ctx.userId}`, RATE_LIMITS.analyticsExport);
  if (!rl.allowed) return error('RATE_LIMITED', 'Too many export requests. Please try again later.', 429);

  try {
    const url = new URL(req.url);
    const exportType = url.searchParams.get('type');

    if (!exportType) {
      return validationError('type query parameter is required (content|analytics|accounts)');
    }

    const validTypes = ['content', 'analytics', 'accounts'];
    if (!validTypes.includes(exportType)) {
      return validationError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Get tenant channel IDs for scoping
    const tenantChannels = await ctx.db.channel.findMany({
      where: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      select: { id: true },
    });
    const tenantChannelIds = tenantChannels.map((c) => c.id);

    let csv = '';
    let filename = '';

    switch (exportType) {
      case 'content': {
        const items = await ctx.db.contentItem.findMany({
          where: { channelId: { in: tenantChannelIds } },
          include: {
            channel: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        csv = buildCsv(
          ['ID', 'Title', 'Type', 'Purpose', 'Status', 'Channel', 'Quality Score', 'Language', 'Created At'],
          items.map((item) => [
            item.id,
            item.title ?? '',
            item.contentType,
            item.contentPurpose ?? '',
            item.status,
            item.channel.name,
            item.qualityScore != null ? String(Number(item.qualityScore)) : '',
            item.language,
            item.createdAt.toISOString(),
          ]),
        );
        filename = `content-export-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'analytics': {
        const posts = await ctx.db.scheduledPost.findMany({
          where: { channelId: { in: tenantChannelIds }, status: 'posted' },
          include: {
            content: { select: { title: true, contentType: true, qualityScore: true, performance: true } },
            channel: { select: { id: true, name: true } },
          },
          orderBy: { postedAt: 'desc' },
        });

        csv = buildCsv(
          ['Post ID', 'Content Title', 'Content Type', 'Channel', 'Platform', 'Quality Score', 'Posted At'],
          posts.map((post) => [
            post.id,
            post.content.title ?? '',
            post.content.contentType,
            post.channel.name,
            post.platform,
            post.content.qualityScore != null ? String(Number(post.content.qualityScore)) : '',
            post.postedAt?.toISOString() ?? '',
          ]),
        );
        filename = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case 'accounts': {
        const accounts = await ctx.db.emailAccount.findMany({
          where: { tenantId: ctx.tenantId },
          include: {
            socialAccounts: {
              select: { platform: true, username: true, status: true, healthScore: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Flatten: one row per social account
        const rows: string[][] = [];
        for (const acct of accounts) {
          if (acct.socialAccounts.length === 0) {
            rows.push([
              acct.id,
              acct.email,
              acct.status,
              acct.tier,
              '',
              '',
              '',
              '',
              acct.createdAt.toISOString(),
            ]);
          } else {
            for (const sa of acct.socialAccounts) {
              rows.push([
                acct.id,
                acct.email,
                acct.status,
                acct.tier,
                sa.platform,
                sa.username ?? '',
                sa.status,
                String(sa.healthScore),
                acct.createdAt.toISOString(),
              ]);
            }
          }
        }

        csv = buildCsv(
          ['Email Account ID', 'Email', 'Account Status', 'Tier', 'Platform', 'Username', 'Social Status', 'Health Score', 'Created At'],
          rows,
        );
        filename = `accounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/v1/settings/data/export failed:', err);
    return error('INTERNAL_ERROR', 'Failed to export data', 500);
  }
}

function escapeCsvCell(value: string): string {
  if (value.length === 0) return '';
  // Prevent CSV injection
  const needsFormulaGuard = ['=', '+', '-', '@'].includes(value[0]!);
  if (needsFormulaGuard || value.includes(',') || value.includes('"') || value.includes('\n')) {
    const escaped = value.replace(/"/g, '""');
    return `"${needsFormulaGuard ? `'${escaped}` : escaped}"`;
  }
  return value;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const headerRow = headers.map(escapeCsvCell).join(',');
  const dataRows = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerRow, ...dataRows].join('\n');
}
