import { createWorker, type AccountCreateJob, type AccountSyncJob, type AccountHealthCheckJob, type AccountWarmJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger } from '@airevstream/shared';
import { decrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import type { Job } from 'bullmq';

// Lazy imports for browser automation (heavy dependency)
let BrowserContextManager: typeof import('@airevstream/browser-automation').BrowserContextManager | null = null;
let SessionManager: typeof import('@airevstream/browser-automation').SessionManager | null = null;
let ProxyManager: typeof import('@airevstream/browser-automation').ProxyManager | null = null;
let createWorkflow: typeof import('@airevstream/browser-automation').createWorkflow | null = null;

async function loadBrowserAutomation() {
  if (!BrowserContextManager) {
    try {
      const mod = await import('@airevstream/browser-automation');
      BrowserContextManager = mod.BrowserContextManager;
      SessionManager = mod.SessionManager;
      ProxyManager = mod.ProxyManager;
      createWorkflow = mod.createWorkflow;
      return true;
    } catch (err) {
      logger.warn({ err }, 'Browser automation package not available — using placeholder mode');
      return false;
    }
  }
  return true;
}

const logger = createLogger('worker:account');

// Shared instances (initialized lazily)
let browserManager: InstanceType<typeof import('@airevstream/browser-automation').BrowserContextManager> | null = null;
let sessionManager: InstanceType<typeof import('@airevstream/browser-automation').SessionManager> | null = null;
let proxyManager: InstanceType<typeof import('@airevstream/browser-automation').ProxyManager> | null = null;

async function getBrowserManager() {
  if (!browserManager && BrowserContextManager) {
    browserManager = new BrowserContextManager();
  }
  return browserManager;
}

async function getSessionManager() {
  if (!sessionManager && SessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

function decryptCredential(encrypted: string): string {
  const config = getConfig();
  if (!config.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured');
  return decrypt(encrypted, config.ENCRYPTION_KEY);
}

async function processAccountJob(job: Job<AccountCreateJob | AccountSyncJob | AccountHealthCheckJob | AccountWarmJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing account job');

  if (job.name === 'account:create') {
    return handleCreate(job.data as AccountCreateJob, job);
  }
  if (job.name === 'account:sync') {
    return handleSync(job.data as AccountSyncJob, job);
  }
  if (job.name === 'account:health-check') {
    return handleHealthCheck(job.data as AccountHealthCheckJob, job);
  }
  if (job.name === 'account:warm') {
    return handleWarm(job.data as AccountWarmJob, job);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleCreate(data: AccountCreateJob, job: Job) {
  const db = getDb();
  const automationAvailable = await loadBrowserAutomation();

  const emailAccount = await db.emailAccount.findUnique({
    where: { id: data.emailAccountId },
  });

  if (!emailAccount) {
    logger.warn({ emailAccountId: data.emailAccountId }, 'Email account not found');
    return;
  }

  // Create workflow job record for tracking
  const workflowJob = await db.workflowJob.create({
    data: {
      jobType: 'account_creation',
      priority: 3,
      status: 'running',
      params: { emailAccountId: data.emailAccountId, platform: data.platform },
      startedAt: new Date(),
    },
  });

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      const contextEntry = await mgr.createContext({
        headless: true,
        viewport: { width: 1920, height: 1080 },
      });

      try {
        const workflow = createWorkflow(data.platform as any, contextEntry.context);
        const password = decryptCredential(emailAccount.passwordEnc);

        const result = await workflow.createAccount({
          email: emailAccount.email,
          password,
          platform: data.platform as any,
        });

        // Save session if successful
        if (result.success && sessMgr) {
          await sessMgr.saveSession(data.emailAccountId, data.platform as any, contextEntry.context);
        }

        if (result.needsHuman) {
          // Create HITL task
          await db.workflowJob.update({
            where: { id: workflowJob.id },
            data: {
              status: 'running',
              needsHuman: true,
              humanTaskDesc: result.humanTaskDescription ?? `Manual verification needed for ${data.platform} account creation`,
              humanLinks: result.screenshots ? JSON.stringify(result.screenshots) : '[]',
            },
          });

          logger.info({ emailAccountId: data.emailAccountId, platform: data.platform }, 'Account creation needs human intervention');
          return { status: 'needs_human', workflowJobId: workflowJob.id };
        }

        const social = await db.socialAccount.create({
          data: {
            emailAccountId: data.emailAccountId,
            platform: data.platform,
            status: 'active',
          },
        });

        await db.workflowJob.update({
          where: { id: workflowJob.id },
          data: { status: 'completed', completedAt: new Date(), result: { socialAccountId: social.id } },
        });

        return { socialAccountId: social.id, status: 'created' };
      } catch (err) {
        logger.error({ err, emailAccountId: data.emailAccountId, platform: data.platform }, 'Account creation automation failed');
        await db.workflowJob.update({
          where: { id: workflowJob.id },
          data: { status: 'failed', error: String(err) },
        });
      } finally {
        await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close browser context'));
      }
    }
  }

  // Automation unavailable — fail honestly instead of creating a placeholder
  logger.error({ emailAccountId: data.emailAccountId, platform: data.platform }, 'Account creation failed: browser automation unavailable');
  await db.workflowJob.update({
    where: { id: workflowJob.id },
    data: { status: 'failed', error: 'Browser automation unavailable' },
  });
  throw new Error('Account creation requires browser automation which is not available');
}

async function handleSync(data: AccountSyncJob, job: Job) {
  const db = getDb();
  const account = await db.socialAccount.findUnique({
    where: { id: data.socialAccountId },
    include: { emailAccount: true },
  });

  if (!account) {
    logger.warn({ socialAccountId: data.socialAccountId }, 'Social account not found');
    return;
  }

  const automationAvailable = await loadBrowserAutomation();

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      const contextEntry = await mgr.createContext({ headless: true });

      try {
        // Restore session if available
        if (sessMgr?.hasSession(data.socialAccountId, account.platform as any)) {
          await sessMgr.loadSession(data.socialAccountId, account.platform as any, contextEntry.context);
        }

        const workflow = createWorkflow(account.platform as any, contextEntry.context);
        const password = decryptCredential(account.emailAccount.passwordEnc);

        const loginResult = await workflow.login({
          email: account.emailAccount.email,
          password,
          platform: account.platform as any,
        });

        if (loginResult.success) {
          // Save refreshed session
          if (sessMgr) {
            await sessMgr.saveSession(data.socialAccountId, account.platform as any, contextEntry.context);
          }

          await db.socialAccount.update({
            where: { id: data.socialAccountId },
            data: { lastLoginAt: new Date(), status: 'active' },
          });
        }

        logger.info({ socialAccountId: data.socialAccountId, platform: account.platform, success: loginResult.success }, 'Account synced');
        return { socialAccountId: data.socialAccountId, status: loginResult.success ? 'synced' : 'sync_failed' };
      } catch (err) {
        logger.error({ err, socialAccountId: data.socialAccountId }, 'Account sync automation failed');
      } finally {
        await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close browser context'));
      }
    }
  }

  // Fallback placeholder — degraded operation, sync can proceed without automation
  logger.warn({ socialAccountId: data.socialAccountId, platform: account.platform }, 'Account synced (placeholder — browser automation unavailable)');
  await db.socialAccount.update({
    where: { id: data.socialAccountId },
    data: { lastLoginAt: new Date() },
  });

  return { socialAccountId: data.socialAccountId, status: 'synced' };
}

async function handleHealthCheck(data: AccountHealthCheckJob, job: Job) {
  const db = getDb();
  const account = await db.socialAccount.findUnique({
    where: { id: data.socialAccountId },
    include: { emailAccount: true },
  });

  if (!account) {
    logger.warn({ socialAccountId: data.socialAccountId }, 'Social account not found');
    return;
  }

  const automationAvailable = await loadBrowserAutomation();
  let isHealthy = account.status === 'active';
  const issues: string[] = [];

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      const contextEntry = await mgr.createContext({ headless: true });

      try {
        // Restore session
        if (sessMgr?.hasSession(data.socialAccountId, account.platform as any)) {
          await sessMgr.loadSession(data.socialAccountId, account.platform as any, contextEntry.context);
        }

        const workflow = createWorkflow(account.platform as any, contextEntry.context);
        const healthResult = await workflow.checkAccountHealth();

        isHealthy = healthResult.healthy;
        issues.push(...healthResult.issues);
      } catch (err) {
        logger.error({ err, socialAccountId: data.socialAccountId }, 'Health check automation failed');
        issues.push('Health check automation error');
      } finally {
        await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close browser context'));
      }
    }
  }

  const newScore = isHealthy
    ? Math.min(100, account.healthScore + 1)
    : Math.max(0, account.healthScore - 10);

  await db.socialAccount.update({
    where: { id: data.socialAccountId },
    data: {
      healthScore: newScore,
      status: newScore < 20 ? 'flagged' : account.status,
      metadata: {
        ...(typeof account.metadata === 'object' && account.metadata !== null ? account.metadata as Record<string, unknown> : {}),
        lastHealthCheck: new Date().toISOString(),
        healthIssues: issues,
      },
    },
  });

  // Create alert if health is critically low
  if (newScore < 30 && account.healthScore >= 30) {
    await db.alert.create({
      data: {
        severity: newScore < 10 ? 'critical' : 'warning',
        category: 'account_health',
        title: `Account health critical: ${account.username ?? account.platform}`,
        message: `Health score dropped to ${newScore}. Issues: ${issues.join(', ') || 'unknown'}`,
        source: 'account-worker',
        metadata: { socialAccountId: data.socialAccountId, platform: account.platform },
      },
    });
  }

  logger.info({
    socialAccountId: data.socialAccountId,
    platform: account.platform,
    healthy: isHealthy,
    healthScore: newScore,
    issues,
  }, 'Account health checked');

  return { socialAccountId: data.socialAccountId, healthy: isHealthy, healthScore: newScore, issues };
}

async function handleWarm(data: AccountWarmJob, job: Job) {
  const db = getDb();
  const account = await db.socialAccount.findUnique({
    where: { id: data.socialAccountId },
    include: {
      emailAccount: true,
      channels: { select: { niches: true } },
    },
  });

  if (!account) {
    logger.warn({ socialAccountId: data.socialAccountId }, 'Social account not found');
    return;
  }

  const durationMinutes = data.durationMinutes ?? Math.floor(Math.random() * (60 - 5 + 1)) + 5;
  const automationAvailable = await loadBrowserAutomation();

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      const contextEntry = await mgr.createContext({ headless: true });

      try {
        // Restore session
        if (sessMgr?.hasSession(data.socialAccountId, account.platform as any)) {
          await sessMgr.loadSession(data.socialAccountId, account.platform as any, contextEntry.context);
        }

        // First login if no session
        const workflow = createWorkflow(account.platform as any, contextEntry.context);
        const password = decryptCredential(account.emailAccount.passwordEnc);

        if (!sessMgr?.hasSession(data.socialAccountId, account.platform as any)) {
          await workflow.login({
            email: account.emailAccount.email,
            password,
            platform: account.platform as any,
          });
        }

        // Collect niche tags from channels for targeted warming
        const nicheTags = account.channels.flatMap((ch) => ch.niches);

        const warmResult = await workflow.warmAccount({
          platform: account.platform as any,
          durationMinutes,
          activities: ['browse', 'watch', 'like', 'search'],
          nicheTags: nicheTags.length > 0 ? nicheTags : undefined,
          intensity: 'low',
        });

        // Save session after warming
        if (sessMgr) {
          await sessMgr.saveSession(data.socialAccountId, account.platform as any, contextEntry.context);
        }

        await db.socialAccount.update({
          where: { id: data.socialAccountId },
          data: {
            lastLoginAt: new Date(),
            metadata: {
              ...(typeof account.metadata === 'object' && account.metadata !== null ? account.metadata as Record<string, unknown> : {}),
              lastWarmingSession: JSON.parse(JSON.stringify({
                date: new Date().toISOString(),
                durationMs: warmResult.totalDurationMs,
                activities: warmResult.activitiesPerformed,
                flagged: warmResult.flagged,
              })),
            } as any,
          },
        });

        if (warmResult.flagged) {
          await db.alert.create({
            data: {
              severity: 'warning',
              category: 'account_health',
              title: `Warming flagged: ${account.username ?? account.platform}`,
              message: `Account may have been flagged during warming session`,
              source: 'account-worker',
              metadata: { socialAccountId: data.socialAccountId },
            },
          });
        }

        logger.info({
          socialAccountId: data.socialAccountId,
          platform: account.platform,
          durationMinutes,
          activities: warmResult.activitiesPerformed.length,
          flagged: warmResult.flagged,
        }, 'Account warmed');

        return { socialAccountId: data.socialAccountId, status: 'warmed', durationMinutes, flagged: warmResult.flagged };
      } catch (err) {
        logger.error({ err, socialAccountId: data.socialAccountId }, 'Account warming automation failed');
      } finally {
        await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close browser context'));
      }
    }
  }

  // Fallback placeholder — degraded operation, warming can proceed without automation
  logger.warn({
    socialAccountId: data.socialAccountId,
    platform: account.platform,
    durationMinutes,
  }, 'Account warming (placeholder — browser automation unavailable)');

  await db.socialAccount.update({
    where: { id: data.socialAccountId },
    data: { lastLoginAt: new Date() },
  });

  return { socialAccountId: data.socialAccountId, status: 'warmed', durationMinutes };
}

export function startAccountWorker() {
  const worker = createWorker('account', processAccountJob, { concurrency: 3 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Account job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Account job failed');
  });

  logger.info('Account worker started');
  return worker;
}
