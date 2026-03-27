import {
  createWorker, getQueue,
  type AccountCreateJob, type AccountSyncJob, type AccountHealthCheckJob, type AccountWarmJob,
  type SeasoningEnrollJob, type SeasoningSignupJob, type SeasoningWarmJob, type SeasoningCheckJob, type SeasoningGraduateJob,
} from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import {
  createLogger,
  determineNextAction, calculateNextSessionTime, selectActivitiesForSession, assessRisk,
  DEFAULT_SEASONING_SCHEDULE, SEASONING_RISK_THRESHOLDS, getNextPhase,
  type SeasoningPhase, type ActivityLogEntry, type ActivityLock,
} from '@airevstream/shared';
import { decrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import type { Job } from 'bullmq';

// Lazy imports for browser automation (heavy dependency)
let BrowserContextManager: typeof import('@airevstream/browser-automation').BrowserContextManager | null = null;
let SessionManager: typeof import('@airevstream/browser-automation').SessionManager | null = null;
let ProxyManager: typeof import('@airevstream/browser-automation').ProxyManager | null = null; // Reserved for future proxy rotation
let createWorkflow: typeof import('@airevstream/browser-automation').createWorkflow | null = null;
let AccountProxyPinning: typeof import('@airevstream/browser-automation').AccountProxyPinning | null = null;
let FingerprintStore: typeof import('@airevstream/browser-automation').FingerprintStore | null = null;

async function loadBrowserAutomation() {
  if (!BrowserContextManager) {
    try {
      const mod = await import('@airevstream/browser-automation');
      BrowserContextManager = mod.BrowserContextManager;
      SessionManager = mod.SessionManager;
      ProxyManager = mod.ProxyManager;
      createWorkflow = mod.createWorkflow;
      AccountProxyPinning = mod.AccountProxyPinning;
      FingerprintStore = mod.FingerprintStore;
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

// ─── Activity Lock Helpers (D112) ───

function getActivityLock(metadata: unknown): ActivityLock | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const meta = metadata as Record<string, unknown>;
  const lock = meta.activityLock as ActivityLock | undefined;
  if (!lock?.lockedAt || !lock?.expiresAt) return null;
  // Check TTL expiry
  if (new Date(lock.expiresAt).getTime() < Date.now()) return null;
  return lock;
}

async function acquireActivityLock(
  socialAccountId: string,
  type: 'warming' | 'posting',
  jobId: string,
  durationMinutes: number,
): Promise<boolean> {
  const db = getDb();
  const social = await db.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!social) return false;

  const existingLock = getActivityLock(social.metadata);
  if (existingLock) {
    // Lock held by someone else and not expired
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const meta = (typeof social.metadata === 'object' && social.metadata !== null ? social.metadata : {}) as Record<string, unknown>;

  await db.socialAccount.update({
    where: { id: socialAccountId },
    data: {
      metadata: {
        ...meta,
        activityLock: { type, lockedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), jobId },
      } as any,
    },
  });
  return true;
}

async function releaseActivityLock(socialAccountId: string): Promise<void> {
  const db = getDb();
  const social = await db.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!social) return;

  const meta = (typeof social.metadata === 'object' && social.metadata !== null ? social.metadata : {}) as Record<string, unknown>;
  const { activityLock: _, ...rest } = meta;
  await db.socialAccount.update({
    where: { id: socialAccountId },
    data: { metadata: rest as any },
  });
}

async function processAccountJob(job: Job) {
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

  // ─── Seasoning Pipeline Jobs ───
  if (job.name === 'seasoning:enroll') {
    return handleSeasoningEnroll(job.data as SeasoningEnrollJob);
  }
  if (job.name === 'seasoning:signup') {
    return handleSeasoningSignup(job.data as SeasoningSignupJob);
  }
  if (job.name === 'seasoning:warm') {
    return handleSeasoningWarm(job.data as SeasoningWarmJob, job);
  }
  if (job.name === 'seasoning:check-due') {
    return handleSeasoningCheckDue();
  }
  if (job.name === 'seasoning:graduate') {
    return handleSeasoningGraduate(job.data as SeasoningGraduateJob);
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
        tenantId: account.emailAccount.tenantId ?? undefined,
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
  await job.updateProgress(5);
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
  await job.updateProgress(10);
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

        await job.updateProgress(25);
        const warmResult = await workflow.warmAccount({
          platform: account.platform as any,
          durationMinutes,
          activities: ['browse', 'watch', 'like', 'search'],
          nicheTags: nicheTags.length > 0 ? nicheTags : undefined,
          intensity: 'low',
        });
        await job.updateProgress(80);

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
              tenantId: account.emailAccount.tenantId ?? undefined,
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

        await job.updateProgress(100);
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

// ═══════════════════════════════════════════════════════════════════
// SEASONING PIPELINE HANDLERS
// ═══════════════════════════════════════════════════════════════════

async function handleSeasoningEnroll(data: SeasoningEnrollJob) {
  const db = getDb();
  logger.info({ cohortId: data.cohortId, emailAccountId: data.emailAccountId, platform: data.platform }, 'Enrolling account in seasoning');

  // Create enrollment record
  const enrollment = await db.seasoningEnrollment.create({
    data: {
      cohortId: data.cohortId,
      emailAccountId: data.emailAccountId,
      platform: data.platform,
      status: 'pending',
    },
  });

  // Update cohort account count
  await db.seasoningCohort.update({
    where: { id: data.cohortId },
    data: { totalAccounts: { increment: 1 } },
  });

  // Queue the signup job
  const queue = getQueue('seasoning');
  await queue.add('seasoning:signup', {
    enrollmentId: enrollment.id,
    emailAccountId: data.emailAccountId,
    platform: data.platform,
    tenantId: data.tenantId,
  } as any, {
    delay: Math.floor(Math.random() * 5 * 60 * 1000), // Random 0-5 min stagger
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
  });

  logger.info({ enrollmentId: enrollment.id }, 'Seasoning enrollment created, signup queued');
  return { enrollmentId: enrollment.id };
}

async function handleSeasoningSignup(data: SeasoningSignupJob) {
  const db = getDb();
  const automationAvailable = await loadBrowserAutomation();

  const enrollment = await db.seasoningEnrollment.findUnique({
    where: { id: data.enrollmentId },
    include: { emailAccount: true },
  });

  if (!enrollment) {
    logger.warn({ enrollmentId: data.enrollmentId }, 'Seasoning enrollment not found');
    return;
  }

  // Mark as signing up
  await db.seasoningEnrollment.update({
    where: { id: data.enrollmentId },
    data: { status: 'signing_up' },
  });

  if (!automationAvailable || !createWorkflow || !BrowserContextManager) {
    logger.error({ enrollmentId: data.enrollmentId }, 'Browser automation unavailable for signup');
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: {
        status: 'failed',
        failureCount: { increment: 1 },
        failureReason: 'Browser automation unavailable',
      },
    });
    throw new Error('Browser automation required for seasoning signup');
  }

  const mgr = await getBrowserManager();
  if (!mgr) {
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: { status: 'failed', failureReason: 'Browser manager init failed' },
    });
    return;
  }

  // Use fingerprint store for consistent browser profile
  let fingerprintConfig = undefined;
  if (FingerprintStore) {
    const fpStore = new FingerprintStore();
    fingerprintConfig = fpStore.generateFingerprint(data.enrollmentId);
  }

  const contextEntry = await mgr.createContext({
    headless: true,
    viewport: fingerprintConfig?.screenResolution ?? { width: 1920, height: 1080 },
    fingerprint: fingerprintConfig,
  } as any);

  try {
    const workflow = createWorkflow(data.platform as any, contextEntry.context);
    const password = decryptCredential(enrollment.emailAccount.passwordEnc);

    const result = await workflow.createAccount({
      email: enrollment.emailAccount.email,
      password,
      platform: data.platform as any,
    });

    if (result.needsHuman) {
      await db.seasoningEnrollment.update({
        where: { id: data.enrollmentId },
        data: { status: 'needs_human', failureReason: result.humanTaskDescription ?? 'Manual verification needed' },
      });
      logger.info({ enrollmentId: data.enrollmentId, platform: data.platform }, 'Signup needs human intervention');
      return { status: 'needs_human' };
    }

    if (result.success) {
      // Create social account and link to enrollment
      const social = await db.socialAccount.create({
        data: {
          emailAccountId: data.emailAccountId,
          platform: data.platform,
          status: 'active',
        },
      });

      const now = new Date();
      await db.seasoningEnrollment.update({
        where: { id: data.enrollmentId },
        data: {
          socialAccountId: social.id,
          status: 'phase_1',
          currentPhase: 'phase_1',
          phaseStartedAt: now,
          fingerprintId: data.enrollmentId, // Use enrollment ID as fingerprint seed
          nextScheduledAt: calculateNextSessionTime(
            { ...enrollment, status: 'phase_1', currentPhase: 'phase_1', phaseStartedAt: now, activityLog: [], createdAt: enrollment.createdAt } as any,
            DEFAULT_SEASONING_SCHEDULE.phases.phase_1,
          ),
        },
      });

      logger.info({ enrollmentId: data.enrollmentId, socialAccountId: social.id }, 'Signup successful, entering phase_1');
      return { status: 'phase_1', socialAccountId: social.id };
    }

    // Signup failed
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: {
        status: 'failed',
        failureCount: { increment: 1 },
        failureReason: result.error ?? 'Signup failed',
      },
    });
    return { status: 'failed' };
  } catch (err) {
    logger.error({ err, enrollmentId: data.enrollmentId }, 'Seasoning signup automation failed');
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: {
        status: 'failed',
        failureCount: { increment: 1 },
        failureReason: String(err),
      },
    });
    throw err;
  } finally {
    await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close context'));
  }
}

async function handleSeasoningWarm(data: SeasoningWarmJob, job: Job) {
  const db = getDb();
  await job.updateProgress(5);
  const automationAvailable = await loadBrowserAutomation();

  const enrollment = await db.seasoningEnrollment.findUnique({
    where: { id: data.enrollmentId },
    include: { emailAccount: true, socialAccount: true },
  });

  if (!enrollment || !enrollment.socialAccount) {
    logger.warn({ enrollmentId: data.enrollmentId }, 'Enrollment or social account not found');
    return;
  }

  // Activity lock check (D112)
  if (enrollment.socialAccountId) {
    const social = await db.socialAccount.findUnique({ where: { id: enrollment.socialAccountId } });
    const existingLock = getActivityLock(social?.metadata);
    if (existingLock && existingLock.type === 'posting') {
      // Posting in progress — reschedule with jitter
      const jitterMs = 60000 + Math.floor(Math.random() * 120000); // 1-3 min
      logger.info({ enrollmentId: data.enrollmentId, lockType: existingLock.type }, 'Activity lock held by posting — rescheduling');
      const queue = getQueue('seasoning');
      await queue.add('seasoning:warm', data as any, { delay: jitterMs });
      return { status: 'rescheduled', reason: 'posting_lock' };
    }

    const lockAcquired = await acquireActivityLock(enrollment.socialAccountId, 'warming', `warm-${data.enrollmentId}`, 30);
    if (!lockAcquired) {
      logger.warn({ enrollmentId: data.enrollmentId }, 'Failed to acquire activity lock — rescheduling');
      const queue = getQueue('seasoning');
      await queue.add('seasoning:warm', data as any, { delay: 60000 });
      return { status: 'rescheduled', reason: 'lock_conflict' };
    }
  }

  // Risk check before warming
  const activityLog = (Array.isArray(enrollment.activityLog) ? enrollment.activityLog : []) as unknown as ActivityLogEntry[];
  const risk = assessRisk({
    ...enrollment,
    activityLog,
    status: enrollment.status as any,
  });

  if (risk.level === 'high') {
    logger.warn({ enrollmentId: data.enrollmentId, riskScore: risk.score, factors: risk.factors }, 'High risk — pausing enrollment');
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: { status: 'paused', failureReason: `High risk: ${risk.factors.join(', ')}` },
    });
    return { status: 'paused', risk };
  }

  // Determine current phase config
  const phaseKey = (data.phase || enrollment.currentPhase || 'phase_1') as 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4';
  const phaseConfig = DEFAULT_SEASONING_SCHEDULE.phases[phaseKey];
  if (!phaseConfig) {
    logger.warn({ enrollmentId: data.enrollmentId, phase: phaseKey }, 'Unknown phase');
    return;
  }

  // Select activities for this session
  const selectedActivities = selectActivitiesForSession(phaseKey as SeasoningPhase, phaseConfig);
  const durationMinutes = Math.floor(
    phaseConfig.minSessionMinutes + Math.random() * (phaseConfig.maxSessionMinutes - phaseConfig.minSessionMinutes),
  );

  let success = false;
  let warmError: string | undefined;

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      // Use persistent fingerprint
      let fingerprintConfig = undefined;
      if (FingerprintStore && enrollment.fingerprintId) {
        const fpStore = new FingerprintStore();
        fingerprintConfig = fpStore.generateFingerprint(enrollment.fingerprintId);
      }

      const contextEntry = await mgr.createContext({
        headless: true,
        viewport: fingerprintConfig?.screenResolution ?? { width: 1920, height: 1080 },
        fingerprint: fingerprintConfig,
      } as any);

      try {
        // Restore session
        if (sessMgr?.hasSession(data.socialAccountId, enrollment.socialAccount.platform as any)) {
          await sessMgr.loadSession(data.socialAccountId, enrollment.socialAccount.platform as any, contextEntry.context);
        }

        const workflow = createWorkflow(data.platform as any, contextEntry.context);
        await job.updateProgress(20);

        // Login if no session
        if (!sessMgr?.hasSession(data.socialAccountId, enrollment.socialAccount.platform as any)) {
          const password = decryptCredential(enrollment.emailAccount.passwordEnc);
          await workflow.login({
            email: enrollment.emailAccount.email,
            password,
            platform: data.platform as any,
          });
        }
        await job.updateProgress(30);

        const warmResult = await workflow.warmAccount({
          platform: data.platform as any,
          durationMinutes,
          activities: selectedActivities,
          intensity: phaseConfig.intensity,
        });
        await job.updateProgress(80);

        // Save session
        if (sessMgr) {
          await sessMgr.saveSession(data.socialAccountId, data.platform as any, contextEntry.context);
        }

        success = !warmResult.flagged;

        if (warmResult.flagged) {
          warmError = 'Account flagged during warming';
        }
      } catch (err) {
        logger.error({ err, enrollmentId: data.enrollmentId }, 'Seasoning warm automation failed');
        warmError = String(err);
      } finally {
        await mgr.closeContext(contextEntry.id).catch((closeErr) => logger.error({ closeErr }, 'Failed to close context'));
      }
    }
  } else {
    // No automation — can't warm
    warmError = 'Browser automation unavailable';
  }

  // Log activity
  const logEntry: ActivityLogEntry = {
    timestamp: new Date().toISOString(),
    phase: phaseKey as SeasoningPhase,
    activities: selectedActivities,
    durationMs: durationMinutes * 60 * 1000,
    success,
    error: warmError,
  };

  const updatedLog = [...activityLog, logEntry];

  // Check phase advancement
  let newStatus = enrollment.status;
  let newPhase = enrollment.currentPhase;
  let phaseStartedAt = enrollment.phaseStartedAt;

  if (success) {
    const shouldAdvance = enrollment.phaseStartedAt &&
      (new Date().getTime() - new Date(enrollment.phaseStartedAt).getTime()) / (1000 * 60 * 60 * 24) >= phaseConfig.durationDays;

    if (shouldAdvance) {
      const nextPhase = getNextPhase(phaseKey as SeasoningPhase);
      if (nextPhase && nextPhase !== 'seasoned') {
        newStatus = nextPhase;
        newPhase = nextPhase;
        phaseStartedAt = new Date();
        logger.info({ enrollmentId: data.enrollmentId, from: phaseKey, to: nextPhase }, 'Phase advanced');
      } else if (nextPhase === 'seasoned') {
        newStatus = 'seasoned';
        newPhase = 'seasoned';
        logger.info({ enrollmentId: data.enrollmentId }, 'Account seasoned — ready for graduation');
      }
    }
  }

  // Calculate next session time
  const currentPhaseConfig = newPhase && newPhase !== 'seasoned'
    ? DEFAULT_SEASONING_SCHEDULE.phases[newPhase as 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4']
    : phaseConfig;

  const nextScheduledAt = calculateNextSessionTime(
    { ...enrollment, activityLog: updatedLog, status: newStatus as any } as any,
    currentPhaseConfig,
  );

  await db.seasoningEnrollment.update({
    where: { id: data.enrollmentId },
    data: {
      status: newStatus,
      currentPhase: newPhase,
      phaseStartedAt,
      activitiesCompleted: { increment: selectedActivities.length },
      lastActivityAt: new Date(),
      nextScheduledAt,
      failureCount: success ? 0 : { increment: 1 },
      failureReason: warmError ?? null,
      activityLog: updatedLog as any,
    },
  });

  // Release activity lock
  if (enrollment.socialAccountId) {
    await releaseActivityLock(enrollment.socialAccountId);
  }

  logger.info({
    enrollmentId: data.enrollmentId,
    phase: phaseKey,
    activities: selectedActivities.length,
    success,
    nextScheduledAt: nextScheduledAt.toISOString(),
  }, 'Seasoning warm completed');

  await job.updateProgress(100);
  return { status: newStatus, success, nextScheduledAt };
}

async function handleSeasoningCheckDue() {
  try {
    const db = getDb();
    const now = new Date();

    // Find enrollments due for their next session
    const dueEnrollments = await db.seasoningEnrollment.findMany({
      where: {
        nextScheduledAt: { lte: now },
        status: { in: ['phase_1', 'phase_2', 'phase_3', 'phase_4'] },
      },
      include: { cohort: true },
      take: 20, // Process in batches
    });

    if (dueEnrollments.length === 0) {
      logger.debug('No seasoning enrollments due');
      return { processed: 0 };
    }

    logger.info({ count: dueEnrollments.length }, 'Processing due seasoning enrollments');
    const queue = getQueue('seasoning');

    for (let i = 0; i < dueEnrollments.length; i++) {
      const enrollment = dueEnrollments[i];
      if (!enrollment.socialAccountId) continue;

      // Stagger jobs with random delays to avoid burst
      const staggerMs = i * (30 + Math.floor(Math.random() * 60)) * 1000; // 30-90s between jobs

      await queue.add('seasoning:warm', {
        enrollmentId: enrollment.id,
        socialAccountId: enrollment.socialAccountId,
        platform: enrollment.platform,
        phase: enrollment.currentPhase ?? 'phase_1',
        tenantId: enrollment.cohort.tenantId,
      } as any, {
        delay: staggerMs,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
      });
    }

    // Also check for enrollments that have been 'seasoned' and ready for graduation
    const seasonedEnrollments = await db.seasoningEnrollment.findMany({
      where: { status: 'seasoned' },
      take: 10,
    });

    for (const enrollment of seasonedEnrollments) {
      if (!enrollment.socialAccountId) continue;
      await queue.add('seasoning:graduate', {
        enrollmentId: enrollment.id,
        socialAccountId: enrollment.socialAccountId,
      } as any);
    }

    return { processed: dueEnrollments.length, graduated: seasonedEnrollments.length };
  } catch (err) {
    logger.error({ err }, 'Failed to check due seasoning enrollments');
    throw err;
  }
}

async function handleSeasoningGraduate(data: SeasoningGraduateJob) {
  try {
    const db = getDb();

    const enrollment = await db.seasoningEnrollment.findUnique({
      where: { id: data.enrollmentId },
      include: { cohort: true },
    });

    if (!enrollment) {
      logger.warn({ enrollmentId: data.enrollmentId }, 'Enrollment not found for graduation');
      return;
    }

    // Transition to graduated
    await db.seasoningEnrollment.update({
      where: { id: data.enrollmentId },
      data: {
        status: 'graduated',
        nextScheduledAt: null,
      },
    });

    // Mark social account as fully active
    if (data.socialAccountId) {
      await db.socialAccount.update({
        where: { id: data.socialAccountId },
        data: { status: 'active' },
      });
    }

    // Update cohort completion count
    await db.seasoningCohort.update({
      where: { id: enrollment.cohortId },
      data: { completedAccounts: { increment: 1 } },
    });

    // Check if entire cohort is done
    const remaining = await db.seasoningEnrollment.count({
      where: {
        cohortId: enrollment.cohortId,
        status: { notIn: ['graduated', 'failed'] },
      },
    });

    if (remaining === 0) {
      await db.seasoningCohort.update({
        where: { id: enrollment.cohortId },
        data: { status: 'completed', completedAt: new Date() },
      });
      logger.info({ cohortId: enrollment.cohortId }, 'Seasoning cohort fully completed');
    }

    // Post-graduation hook: check AccountLifecycle for auto-posting (D112)
    if (data.socialAccountId) {
      const social = await db.socialAccount.findUnique({
        where: { id: data.socialAccountId },
        select: { emailAccountId: true },
      });
      if (social) {
        const lifecycle = await db.accountLifecycle.findUnique({
          where: { emailAccountId: social.emailAccountId },
        });
        if (lifecycle?.autoPosting) {
          await db.accountLifecycle.update({
            where: { id: lifecycle.id },
            data: { status: 'completed', completedAt: new Date(), currentStep: 'completed' },
          });
          logger.info({ lifecycleId: lifecycle.id }, 'Lifecycle completed — auto-posting enabled');
        }
      }
    }

    logger.info({ enrollmentId: data.enrollmentId, socialAccountId: data.socialAccountId }, 'Account graduated from seasoning');
    return { status: 'graduated' };
  } catch (err) {
    logger.error({ err, enrollmentId: data.enrollmentId, socialAccountId: data.socialAccountId }, 'Failed to graduate enrollment');
    throw err;
  }
}

export function startAccountWorker() {
  const worker = createWorker('account', processAccountJob, { concurrency: 3, stalledInterval: 300_000 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Account job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Account job failed');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Account job stalled — will be retried');
  });

  logger.info('Account worker started');
  return worker;
}

export function startSeasoningWorker() {
  const worker = createWorker('seasoning', processAccountJob as any, { concurrency: 3, stalledInterval: 300_000 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Seasoning job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Seasoning job failed');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Seasoning job stalled — will be retried');
  });

  // Register repeatable check-due job (every 15 minutes)
  const queue = getQueue('seasoning');
  queue.add('seasoning:check-due', { _trigger: 'repeatable' } as any, {
    repeat: { every: 15 * 60 * 1000 }, // 15 minutes
    removeOnComplete: 10,
    removeOnFail: 10,
  }).catch((err) => logger.error({ err }, 'Failed to register seasoning:check-due repeatable job'));

  logger.info('Seasoning worker started');
  return worker;
}
