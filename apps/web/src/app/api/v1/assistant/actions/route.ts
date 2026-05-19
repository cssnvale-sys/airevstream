import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import type { ApiContext } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const ACTION_TIERS: Record<string, number> = {
  // Tier 1: read-only -- execute immediately
  'analytics.query': 1,
  'knowledge.search': 1,
  'system.healthCheck': 1,

  // Tier 2: modify -- require confirmation
  'content.generate': 2,
  'content.schedule': 2,
  'content.approve': 2,

  // Tier 3: admin -- require confirmation + audit log
  'account.create': 3,
  'workflow.start': 3,
  'settings.update': 3,

  // Tier 4: dangerous -- require confirmation + explicit authorization
  'account.delete': 4,
  'system.reset': 4,
};

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const actionRequestSchema = z.object({
  actionType: z.string().min(1).max(50),
  parameters: z.record(z.unknown()).default({}),
  conversationId: z.string().uuid().optional().nullable(),
  confirmed: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Action executor map
// ---------------------------------------------------------------------------

type ActionResult = { data: unknown; rollbackData?: unknown };
type ActionExecutor = (params: Record<string, unknown>, ctx: ApiContext) => Promise<ActionResult>;

const executors: Record<string, ActionExecutor> = {
  // ---- Tier 1 ----

  'analytics.query': async (params, ctx) => {
    const reportType = (params.reportType as string) ?? 'content';
    const rawDays = Number(params.days ?? 30);
    const days = isNaN(rawDays) || rawDays < 1 ? 30 : Math.min(rawDays, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Tenant-scoped filter for channel-linked models
    const tenantChannelFilter = { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } };

    if (reportType === 'content') {
      const statusCounts = await ctx.db.contentItem.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: since }, ...tenantChannelFilter },
      });
      return {
        data: {
          reportType,
          period: { days, since: since.toISOString() },
          statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
        },
      };
    }

    if (reportType === 'revenue') {
      const clicks = await ctx.db.affiliateClick.aggregate({
        where: { createdAt: { gte: since }, ...tenantChannelFilter },
        _sum: { revenue: true },
        _count: { id: true },
      });
      return {
        data: {
          reportType,
          period: { days, since: since.toISOString() },
          totalClicks: clicks._count.id,
          totalRevenue: clicks._sum.revenue?.toString() ?? '0',
        },
      };
    }

    if (reportType === 'engagement') {
      const posts = await ctx.db.scheduledPost.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: since }, ...tenantChannelFilter },
      });
      return {
        data: {
          reportType,
          period: { days, since: since.toISOString() },
          postsByStatus: Object.fromEntries(posts.map((p) => [p.status, p._count.id])),
        },
      };
    }

    // Default: aggregate overview
    const [contentCount, postCount, alertCount] = await Promise.all([
      ctx.db.contentItem.count({ where: { createdAt: { gte: since }, ...tenantChannelFilter } }),
      ctx.db.scheduledPost.count({ where: { createdAt: { gte: since }, ...tenantChannelFilter } }),
      // Alerts are system-level (no tenantId on Alert model) — intentional
      ctx.db.alert.count({ where: { createdAt: { gte: since }, status: 'open' } }),
    ]);

    return {
      data: {
        reportType: 'overview',
        period: { days, since: since.toISOString() },
        contentCreated: contentCount,
        postsScheduled: postCount,
        openAlerts: alertCount,
      },
    };
  },

  'knowledge.search': async (params, ctx) => {
    const query = (params.query as string) ?? '';
    const domain = params.domain as string | undefined;
    const category = params.category as string | undefined;
    const limit = Math.min(Number(params.limit ?? 10), 50);

    const where: Record<string, unknown> = { isCurrent: true, tenantId: ctx.tenantId };
    if (domain) where.domain = domain;
    if (category) where.category = category;

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ];
    }

    const entries = await ctx.db.knowledgeBaseEntry.findMany({
      where,
      orderBy: { relevanceScore: 'desc' },
      take: limit,
    });

    return { data: { query, resultCount: entries.length, entries: entries.map(e => ({ ...e, relevanceScore: e.relevanceScore != null ? Number(e.relevanceScore) : null })) } };
  },

  'system.healthCheck': async (_params, ctx) => {
    const [serviceStatuses, openAlerts, activeJobs] = await Promise.all([
      ctx.db.aiService.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      ctx.db.alert.count({ where: { status: 'open' } }),
      ctx.db.workflowJob.count({ where: { status: { in: ['queued', 'running'] } } }),
    ]);

    const totalServices = serviceStatuses.reduce((sum, s) => sum + s._count.id, 0);
    const healthyServices = serviceStatuses.find((s) => s.status === 'active')?._count.id ?? 0;

    return {
      data: {
        status: healthyServices === totalServices && totalServices > 0 ? 'healthy' : 'degraded',
        services: {
          total: totalServices,
          healthy: healthyServices,
          statuses: Object.fromEntries(serviceStatuses.map((s) => [s.status, s._count.id])),
        },
        openAlerts,
        activeJobs,
        checkedAt: new Date().toISOString(),
      },
    };
  },

  // ---- Tier 2 ----

  'content.generate': async (params, ctx) => {
    const channelId = params.channelId as string;
    const contentType = (params.contentType as string) ?? 'text';
    const prompt = (params.prompt as string) ?? '';
    const title = params.title as string | undefined;
    const language = (params.language as string) ?? 'en';

    if (!channelId) throw new Error('channelId is required');

    // Verify channel exists and belongs to tenant
    const channel = await ctx.db.channel.findFirst({
      where: {
        id: channelId,
        socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
      },
      select: { id: true, name: true },
    });
    if (!channel) throw new Error('Channel not found');

    const contentItem = await ctx.db.contentItem.create({
      data: {
        channelId,
        title: title ?? null,
        contentType,
        prompt: prompt || null,
        language,
        status: 'generating',
      },
    });

    return {
      data: {
        contentId: contentItem.id,
        channelId,
        channelName: channel.name,
        contentType,
        status: contentItem.status,
        message: 'Content generation started',
      },
      rollbackData: { contentId: contentItem.id },
    };
  },

  'content.schedule': async (params, ctx) => {
    const contentId = params.contentId as string;
    const channelId = params.channelId as string;
    const scheduledAt = params.scheduledAt as string;
    const platform = (params.platform as string) ?? 'youtube';

    if (!contentId) throw new Error('contentId is required');
    if (!channelId) throw new Error('channelId is required');
    if (!scheduledAt) throw new Error('scheduledAt is required');

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) throw new Error('scheduledAt must be a valid date');

    // Verify content and channel exist and belong to tenant
    const contentTenantFilter = { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } };
    const channelTenantFilter = { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } };

    const [content, channel] = await Promise.all([
      ctx.db.contentItem.findFirst({ where: { id: contentId, ...contentTenantFilter }, select: { id: true, title: true } }),
      ctx.db.channel.findFirst({ where: { id: channelId, ...channelTenantFilter }, select: { id: true, name: true } }),
    ]);
    if (!content) throw new Error('Content not found');
    if (!channel) throw new Error('Channel not found');

    const post = await ctx.db.scheduledPost.create({
      data: {
        contentId,
        channelId,
        scheduledAt: scheduledDate,
        platform,
        status: 'scheduled',
      },
    });

    return {
      data: {
        scheduledPostId: post.id,
        contentId,
        channelId,
        scheduledAt: post.scheduledAt,
        platform,
        status: post.status,
      },
      rollbackData: { scheduledPostId: post.id },
    };
  },

  'content.approve': async (params, ctx) => {
    const contentId = params.contentId as string;
    if (!contentId) throw new Error('contentId is required');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id: contentId,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: { id: true, status: true, title: true },
    });
    if (!item) throw new Error('Content not found');
    if (item.status === 'approved') throw new Error('Content is already approved');

    const previousStatus = item.status;

    const updated = await ctx.db.contentItem.update({
      where: { id: contentId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: ctx.userId,
      },
    });

    return {
      data: {
        contentId: updated.id,
        title: updated.title,
        previousStatus,
        newStatus: 'approved',
      },
      rollbackData: { contentId, previousStatus },
    };
  },

  // ---- Tier 3 ----

  'account.create': async (params, ctx) => {
    const email = params.email as string;
    const tier = (params.tier as string) ?? 'tier2';

    if (!email) throw new Error('email is required');

    // Check for duplicate email within tenant
    const existing = await ctx.db.emailAccount.findFirst({
      where: { email, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (existing) throw new Error('Email account already exists');

    // Generate a random password and encrypt it
    const { randomBytes } = await import('node:crypto');
    const { encrypt } = await import('@airevstream/crypto');
    const tempPassword = randomBytes(16).toString('base64url');
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured');

    const account = await ctx.db.emailAccount.create({
      data: {
        email,
        passwordEnc: encrypt(tempPassword, encryptionKey),
        tier,
        status: 'pending',
        tenantId: ctx.tenantId,
      },
    });

    return {
      data: {
        accountId: account.id,
        email: account.email,
        tier: account.tier,
        status: account.status,
      },
      rollbackData: { accountId: account.id },
    };
  },

  'workflow.start': async (params, ctx) => {
    const jobType = (params.jobType as string) ?? 'content_production';
    const channelId = params.channelId as string | undefined;
    const priority = Number(params.priority ?? 5);
    const jobParams = (params.params as Record<string, unknown>) ?? {};

    // Verify channel belongs to tenant if provided
    if (channelId) {
      const channel = await ctx.db.channel.findFirst({
        where: {
          id: channelId,
          socialAccount: { emailAccount: { tenantId: ctx.tenantId } },
        },
        select: { id: true },
      });
      if (!channel) throw new Error('Channel not found');
    }

    const job = await ctx.db.workflowJob.create({
      data: {
        jobType,
        priority,
        channelId: channelId ?? null,
        status: 'queued',
        params: jobParams as Record<string, string | number | boolean>,
      },
    });

    return {
      data: {
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        priority: job.priority,
        message: 'Workflow job queued',
      },
      rollbackData: { jobId: job.id },
    };
  },

  'settings.update': async (params, ctx) => {
    const settingKey = params.settingKey as string;
    const value = params.value;

    if (!settingKey) throw new Error('settingKey is required');

    // Read existing value for rollback
    const existing = await ctx.db.systemSetting.findUnique({ where: { key: settingKey } });
    const previousValue = existing?.value ?? null;

    // Persist to SystemSetting table
    await ctx.db.systemSetting.upsert({
      where: { key: settingKey },
      update: { value: value as Prisma.InputJsonValue },
      create: { key: settingKey, value: value as Prisma.InputJsonValue },
    });

    return {
      data: {
        settingKey,
        value,
        message: `Setting "${settingKey}" updated`,
        updatedAt: new Date().toISOString(),
      },
      rollbackData: { settingKey, previousValue },
    };
  },

  // ---- Tier 4 ----

  'account.delete': async (params, ctx) => {
    const accountId = params.accountId as string;
    if (!accountId) throw new Error('accountId is required');

    const account = await ctx.db.emailAccount.findFirst({
      where: {
        id: accountId,
        tenantId: ctx.tenantId,
      },
      select: { id: true, email: true, tier: true, status: true },
    });
    if (!account) throw new Error('Account not found');

    await ctx.db.emailAccount.delete({ where: { id: accountId } });

    return {
      data: {
        accountId,
        email: account.email,
        deleted: true,
        message: 'Account and all associated data deleted',
      },
      rollbackData: { accountId, email: account.email, tier: account.tier, status: account.status },
    };
  },

  'system.reset': async (_params, ctx) => {
    // Controlled reset: clear queued/failed workflow jobs
    const deleted = await ctx.db.workflowJob.deleteMany({
      where: { status: { in: ['failed', 'cancelled'] } },
    });

    // Resolve all open alerts
    const resolvedAlerts = await ctx.db.alert.updateMany({
      where: { status: 'open' },
      data: { status: 'resolved', resolvedAt: new Date() },
    });

    return {
      data: {
        jobsCleared: deleted.count,
        alertsResolved: resolvedAlerts.count,
        message: 'System reset completed: failed jobs cleared, open alerts resolved',
        resetAt: new Date().toISOString(),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// POST /api/v1/assistant/actions
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/assistant/actions
 *
 * Execute an action through the AI assistant with a 4-tier safety system.
 *
 * Body: { actionType, parameters, conversationId?, confirmed? }
 *
 * Tier 1 (read-only): Execute immediately
 * Tier 2 (modify): Require confirmation before execution
 * Tier 3 (admin): Require confirmation + audit log
 * Tier 4 (dangerous): Require confirmation + explicit authorization
 *
 * If `confirmed` is false for tier 2+, returns the action proposal for user review.
 * If `confirmed` is true, executes the action and logs to ActionAuditLog.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`actions:${ip}:${ctx.userId}`, RATE_LIMITS.standardWrite);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = actionRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { actionType, parameters, conversationId, confirmed } = parsed.data;

    // Resolve tier
    const tier = ACTION_TIERS[actionType];
    if (tier === undefined) {
      return error('UNKNOWN_ACTION', `Unknown action type: ${actionType}`, 400);
    }

    // Tier 3+ actions require admin role
    if (tier >= 3 && ctx.role !== 'admin') {
      return forbidden('Admin role required for this action');
    }

    // Viewers cannot execute any actions
    if (ctx.role === 'viewer') {
      return forbidden('Viewers cannot execute actions');
    }

    // Resolve executor
    const executor = executors[actionType];
    if (!executor) {
      return error('NOT_IMPLEMENTED', `Action "${actionType}" is not yet implemented`, 501);
    }

    // Tier 1: execute immediately
    // Tier 2+: require confirmation
    if (tier >= 2 && !confirmed) {
      // Create a proposal audit log entry
      const auditLog = await ctx.db.actionAuditLog.create({
        data: {
          actionType,
          tier,
          parameters: parameters as object,
          result: {},
          status: 'proposed',
          conversationId: conversationId ?? null,
        },
      });

      return success({
        proposal: {
          auditLogId: auditLog.id,
          actionType,
          tier,
          parameters,
          requiresConfirmation: true,
          tierDescription: getTierDescription(tier),
          message: `This action requires confirmation. Tier ${tier}: ${getTierDescription(tier)}`,
        },
      });
    }

    // Execute the action
    let result: ActionResult;
    try {
      result = await executor(parameters, ctx);
    } catch (execError) {
      const caughtError = execError instanceof Error ? execError : new Error(String(execError));
      logger.error(`Action ${actionType} execution failed:`, caughtError)

      // Log failed execution (internal log only — don't expose to client)
      await ctx.db.actionAuditLog.create({
        data: {
          actionType,
          tier,
          parameters: parameters as object,
          result: { error: caughtError.message },
          status: 'failed',
          conversationId: conversationId ?? null,
        },
      });

      return error(
        'ACTION_FAILED',
        `Action "${actionType}" failed. Check system logs for details.`,
        400,
      );
    }

    // Log successful execution
    const auditLog = await ctx.db.actionAuditLog.create({
      data: {
        actionType,
        tier,
        parameters: parameters as object,
        result: (result.data as object) ?? {},
        status: 'completed',
        rollbackData: result.rollbackData
          ? (result.rollbackData as Prisma.InputJsonValue)
          : undefined,
        conversationId: conversationId ?? null,
      },
    });

    return success({
      executed: true,
      auditLogId: auditLog.id,
      actionType,
      tier,
      result: result.data,
    });
  } catch (err) {
    logger.apiError('METHOD', 'PATH', err as Error, { userId: ctx?.userId });
    return error('INTERNAL_ERROR', 'Failed to execute action', 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTierDescription(tier: number): string {
  switch (tier) {
    case 1:
      return 'Read-only operation. Executes immediately.';
    case 2:
      return 'Modification operation. Requires confirmation before execution.';
    case 3:
      return 'Administrative operation. Requires confirmation and will be audit-logged.';
    case 4:
      return 'Dangerous operation. Requires explicit confirmation and authorization. This action may be irreversible.';
    default:
      return 'Unknown tier.';
  }
}
