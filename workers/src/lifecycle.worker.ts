import {
  createWorker, getQueue, addJob,
  type LifecycleInitJob, type LifecycleDiscoverJob, type LifecyclePlanJob,
  type LifecycleSignupJob, type LifecycleSetProfileJob, type LifecycleEnrollJob,
  startSeasoningPipeline,
} from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger, type Platform } from '@airevstream/shared';
import { decrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { getPresignedUrl } from '@airevstream/storage';
import type { Job } from 'bullmq';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const logger = createLogger('worker:lifecycle');

// Lazy imports for browser automation (heavy dependency)
let BrowserContextManager: typeof import('@airevstream/browser-automation').BrowserContextManager | null = null;
let SessionManager: typeof import('@airevstream/browser-automation').SessionManager | null = null;
let createWorkflow: typeof import('@airevstream/browser-automation').createWorkflow | null = null;
let FingerprintStore: typeof import('@airevstream/browser-automation').FingerprintStore | null = null;

async function loadBrowserAutomation() {
  if (!BrowserContextManager) {
    try {
      const mod = await import('@airevstream/browser-automation');
      BrowserContextManager = mod.BrowserContextManager;
      SessionManager = mod.SessionManager;
      createWorkflow = mod.createWorkflow;
      FingerprintStore = mod.FingerprintStore;
      return true;
    } catch (err) {
      logger.warn({ err }, 'Browser automation package not available');
      return false;
    }
  }
  return true;
}

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

async function processLifecycleJob(job: Job) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing lifecycle job');

  switch (job.name) {
    case 'lifecycle:init':
      return handleInit(job.data as LifecycleInitJob);
    case 'lifecycle:discover':
      return handleDiscover(job.data as LifecycleDiscoverJob);
    case 'lifecycle:plan':
      return handlePlan(job.data as LifecyclePlanJob);
    case 'lifecycle:signup':
      return handleSignup(job.data as LifecycleSignupJob);
    case 'lifecycle:set-profile':
      return handleSetProfile(job.data as LifecycleSetProfileJob);
    case 'lifecycle:enroll':
      return handleEnroll(job.data as LifecycleEnrollJob);
    default:
      logger.warn({ jobName: job.name }, 'Unknown lifecycle job name');
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: INIT
// ═══════════════════════════════════════════════════════════════════

async function handleInit(data: LifecycleInitJob) {
  try {
    const db = getDb();

    // Check if lifecycle already exists
    const existing = await db.accountLifecycle.findUnique({
      where: { emailAccountId: data.emailAccountId },
    });
    if (existing && existing.status !== 'failed') {
      logger.warn({ emailAccountId: data.emailAccountId, status: existing.status }, 'Lifecycle already exists');
      return { lifecycleId: existing.id, status: existing.status };
    }

    // Create or update lifecycle record
    const lifecycle = existing
      ? await db.accountLifecycle.update({
          where: { id: existing.id },
          data: {
            status: 'discovering',
            targetPlatforms: data.targetPlatforms,
            avatarId: data.avatarId ?? null,
            autoSeasoning: data.autoSeasoning ?? true,
            autoPosting: data.autoPosting ?? false,
            error: null,
            startedAt: new Date(),
            completedAt: null,
            discoveryResults: {},
          },
        })
      : await db.accountLifecycle.create({
          data: {
            emailAccountId: data.emailAccountId,
            tenantId: data.tenantId,
            targetPlatforms: data.targetPlatforms,
            avatarId: data.avatarId ?? null,
            autoSeasoning: data.autoSeasoning ?? true,
            autoPosting: data.autoPosting ?? false,
            status: 'discovering',
            startedAt: new Date(),
          },
        });

    // Update email account status
    await db.emailAccount.update({
      where: { id: data.emailAccountId },
      data: { status: 'provisioning' },
    });

    // Queue discovery jobs with stagger
    const queue = getQueue('lifecycle');
    for (let i = 0; i < data.targetPlatforms.length; i++) {
      const delay = i * (30000 + Math.floor(Math.random() * 60000)); // 30-90s stagger
      await queue.add('lifecycle:discover', {
        lifecycleId: lifecycle.id,
        emailAccountId: data.emailAccountId,
        platform: data.targetPlatforms[i],
        tenantId: data.tenantId,
      } as any, {
        delay,
        attempts: 2,
        backoff: { type: 'exponential', delay: 15000 },
      });
    }

    logger.info({ lifecycleId: lifecycle.id, platforms: data.targetPlatforms }, 'Lifecycle init — discovery jobs queued');
    return { lifecycleId: lifecycle.id, status: 'discovering' };
  } catch (err) {
    logger.error({ err, emailAccountId: data.emailAccountId }, 'Failed to initialize lifecycle');
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: DISCOVER
// ═══════════════════════════════════════════════════════════════════

async function handleDiscover(data: LifecycleDiscoverJob) {
  const db = getDb();

  const lifecycle = await db.accountLifecycle.findUnique({ where: { id: data.lifecycleId } });
  if (!lifecycle) {
    logger.warn({ lifecycleId: data.lifecycleId }, 'Lifecycle not found');
    return;
  }

  const emailAccount = await db.emailAccount.findUnique({ where: { id: data.emailAccountId } });
  if (!emailAccount) {
    logger.warn({ emailAccountId: data.emailAccountId }, 'Email account not found');
    return;
  }

  // Update current step
  await db.accountLifecycle.update({
    where: { id: data.lifecycleId },
    data: { currentStep: `discovering:${data.platform}` },
  });

  const automationAvailable = await loadBrowserAutomation();
  let discoveryResult: { exists: boolean | 'unknown'; accountInfo?: Record<string, unknown>; needsHuman?: boolean; humanTaskDescription?: string; error?: string } = {
    exists: 'unknown',
    error: 'Browser automation unavailable',
  };

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    if (mgr) {
      let fingerprintConfig = undefined;
      if (FingerprintStore) {
        const fpStore = new FingerprintStore();
        fingerprintConfig = fpStore.generateFingerprint(`${data.emailAccountId}-${data.platform}`);
      }

      const contextEntry = await mgr.createContext({
        headless: true,
        viewport: fingerprintConfig?.screenResolution ?? { width: 1920, height: 1080 },
        fingerprint: fingerprintConfig,
      } as any);

      try {
        const workflow = createWorkflow(data.platform as Platform, contextEntry.context);
        const password = decryptCredential(emailAccount.passwordEnc);

        discoveryResult = await workflow.discoverAccount({
          email: emailAccount.email,
          password,
          platform: data.platform as Platform,
        });
      } catch (err) {
        logger.error({ err, platform: data.platform }, 'Discovery automation failed');
        discoveryResult = { exists: 'unknown', error: String(err) };
      } finally {
        await mgr.closeContext(contextEntry.id).catch((e) => logger.error({ e }, 'Failed to close context'));
      }
    }
  }

  // Atomically update discovery results
  const currentResults = (lifecycle.discoveryResults ?? {}) as Record<string, unknown>;
  const updatedResults = {
    ...currentResults,
    [data.platform]: discoveryResult,
  };

  await db.accountLifecycle.update({
    where: { id: data.lifecycleId },
    data: { discoveryResults: updatedResults as any },
  });

  logger.info({ lifecycleId: data.lifecycleId, platform: data.platform, exists: discoveryResult.exists }, 'Discovery completed');

  // Check if all discoveries are done
  const completedCount = Object.keys(updatedResults).length;
  if (completedCount >= lifecycle.targetPlatforms.length) {
    // All done — queue plan
    await addJob('lifecycle', 'lifecycle:plan', {
      lifecycleId: data.lifecycleId,
      emailAccountId: data.emailAccountId,
      tenantId: data.tenantId,
    }, { attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }

  return { platform: data.platform, result: discoveryResult };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: PLAN
// ═══════════════════════════════════════════════════════════════════

async function handlePlan(data: LifecyclePlanJob) {
  try {
    const db = getDb();

    const lifecycle = await db.accountLifecycle.findUnique({ where: { id: data.lifecycleId } });
    if (!lifecycle) return;

    await db.accountLifecycle.update({
      where: { id: data.lifecycleId },
      data: { status: 'planning', currentStep: 'planning' },
    });

    const results = (lifecycle.discoveryResults ?? {}) as Record<string, { exists: boolean | 'unknown'; accountInfo?: Record<string, unknown>; needsHuman?: boolean }>;
    const signupsNeeded: string[] = [];
    const existingPlatforms: string[] = [];

    for (const platform of lifecycle.targetPlatforms) {
      const result = results[platform];
      if (!result) continue;

      if (result.exists === true) {
        existingPlatforms.push(platform);

        // Check if social account already exists
        const existingSocial = await db.socialAccount.findUnique({
          where: { emailAccountId_platform: { emailAccountId: data.emailAccountId, platform } },
        });

        if (!existingSocial) {
          // Create social account for discovered existing accounts
          await db.socialAccount.create({
            data: {
              emailAccountId: data.emailAccountId,
              platform,
              status: 'active',
              username: result.accountInfo?.username as string ?? undefined,
            },
          });
        }
      } else if (result.exists === false) {
        signupsNeeded.push(platform);
      } else if (result.needsHuman) {
        // Create a workflow job for manual investigation
        await db.workflowJob.create({
          data: {
            jobType: 'account_creation',
            priority: 5,
            status: 'running',
            needsHuman: true,
            humanTaskDesc: `Check if ${platform} account exists for this email (automated discovery inconclusive)`,
            params: { emailAccountId: data.emailAccountId, platform, lifecycleId: data.lifecycleId },
          },
        });
      }
    }

    // Queue signups
    if (signupsNeeded.length > 0) {
      await db.accountLifecycle.update({
        where: { id: data.lifecycleId },
        data: { status: 'signing_up', currentStep: `signup:${signupsNeeded[0]}` },
      });

      const queue = getQueue('lifecycle');
      for (let i = 0; i < signupsNeeded.length; i++) {
        const delay = i * (60000 + Math.floor(Math.random() * 120000)); // 1-3 min stagger
        await queue.add('lifecycle:signup', {
          lifecycleId: data.lifecycleId,
          emailAccountId: data.emailAccountId,
          platform: signupsNeeded[i],
          tenantId: data.tenantId,
          avatarId: lifecycle.avatarId ?? undefined,
        } as any, { delay, attempts: 2, backoff: { type: 'exponential', delay: 30000 } });
      }
    } else {
      // No signups needed — skip to enroll
      await queueEnrollIfReady(data.lifecycleId, data.emailAccountId, data.tenantId);
    }

    logger.info({
      lifecycleId: data.lifecycleId,
      existing: existingPlatforms,
      signupsNeeded,
    }, 'Plan completed');

    return { existing: existingPlatforms, signupsNeeded };
  } catch (err) {
    logger.error({ err, lifecycleId: data.lifecycleId }, 'Failed to plan lifecycle');
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: SIGNUP
// ═══════════════════════════════════════════════════════════════════

async function handleSignup(data: LifecycleSignupJob) {
  const db = getDb();

  const lifecycle = await db.accountLifecycle.findUnique({ where: { id: data.lifecycleId } });
  if (!lifecycle) return;

  const emailAccount = await db.emailAccount.findUnique({ where: { id: data.emailAccountId } });
  if (!emailAccount) return;

  await db.accountLifecycle.update({
    where: { id: data.lifecycleId },
    data: { currentStep: `signup:${data.platform}` },
  });

  const automationAvailable = await loadBrowserAutomation();

  if (!automationAvailable || !createWorkflow || !BrowserContextManager) {
    logger.error({ platform: data.platform }, 'Browser automation unavailable for signup');
    await db.accountLifecycle.update({
      where: { id: data.lifecycleId },
      data: { error: `Signup failed for ${data.platform}: browser automation unavailable` },
    });
    throw new Error('Browser automation required for signup');
  }

  const mgr = await getBrowserManager();
  if (!mgr) throw new Error('Browser manager init failed');

  let fingerprintConfig = undefined;
  if (FingerprintStore) {
    const fpStore = new FingerprintStore();
    fingerprintConfig = fpStore.generateFingerprint(`${data.emailAccountId}-${data.platform}`);
  }

  const contextEntry = await mgr.createContext({
    headless: true,
    viewport: fingerprintConfig?.screenResolution ?? { width: 1920, height: 1080 },
    fingerprint: fingerprintConfig,
  } as any);

  try {
    const workflow = createWorkflow(data.platform as Platform, contextEntry.context);
    const password = decryptCredential(emailAccount.passwordEnc);

    const result = await workflow.createAccount({
      email: emailAccount.email,
      password,
      platform: data.platform as Platform,
    });

    if (result.needsHuman) {
      await db.workflowJob.create({
        data: {
          jobType: 'account_creation',
          priority: 3,
          status: 'running',
          needsHuman: true,
          humanTaskDesc: result.humanTaskDescription ?? `Manual verification needed for ${data.platform} signup`,
          humanLinks: result.screenshots ? JSON.stringify(result.screenshots) : '[]',
          params: { emailAccountId: data.emailAccountId, platform: data.platform, lifecycleId: data.lifecycleId },
        },
      });
      logger.info({ platform: data.platform }, 'Signup needs human intervention');
      return { status: 'needs_human' };
    }

    if (result.success) {
      const social = await db.socialAccount.create({
        data: {
          emailAccountId: data.emailAccountId,
          platform: data.platform,
          status: 'active',
        },
      });

      // If avatar set, queue profile setup
      if (data.avatarId) {
        await addJob('lifecycle', 'lifecycle:set-profile', {
          lifecycleId: data.lifecycleId,
          socialAccountId: social.id,
          platform: data.platform,
          avatarId: data.avatarId,
          tenantId: data.tenantId,
        }, { delay: 5000, attempts: 2 });
      } else {
        await queueEnrollIfReady(data.lifecycleId, data.emailAccountId, data.tenantId);
      }

      logger.info({ socialAccountId: social.id, platform: data.platform }, 'Signup successful');
      return { socialAccountId: social.id, status: 'created' };
    }

    // Failed
    await db.accountLifecycle.update({
      where: { id: data.lifecycleId },
      data: { error: `Signup failed for ${data.platform}: ${result.error ?? 'unknown'}` },
    });
    return { status: 'failed', error: result.error };
  } catch (err) {
    logger.error({ err, platform: data.platform }, 'Lifecycle signup failed');
    throw err;
  } finally {
    await mgr.closeContext(contextEntry.id).catch((e) => logger.error({ e }, 'Failed to close context'));
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: SET PROFILE
// ═══════════════════════════════════════════════════════════════════

async function handleSetProfile(data: LifecycleSetProfileJob) {
  const db = getDb();

  const lifecycle = await db.accountLifecycle.findUnique({ where: { id: data.lifecycleId } });
  if (!lifecycle) return;

  await db.accountLifecycle.update({
    where: { id: data.lifecycleId },
    data: { status: 'setting_profile', currentStep: `profile:${data.platform}` },
  });

  // Download avatar images from MinIO to temp files
  let profileImagePath: string | undefined;
  let bannerImagePath: string | undefined;

  if (data.avatarId) {
    try {
      const avatar = await db.avatar.findUnique({ where: { id: data.avatarId } });
      if (avatar) {
        const images = avatar.images as Record<string, { bucket?: string; key?: string }>;
        const faceRef = images?.face;
        if (faceRef?.bucket && faceRef?.key) {
          const presignedUrl = await getPresignedUrl(faceRef.bucket, faceRef.key, 600);
          profileImagePath = await downloadToTemp(presignedUrl, 'profile.png');
        }
      }
    } catch (err) {
      logger.warn({ err, avatarId: data.avatarId }, 'Failed to download avatar images');
    }
  }

  const automationAvailable = await loadBrowserAutomation();

  if (automationAvailable && createWorkflow && BrowserContextManager) {
    const mgr = await getBrowserManager();
    const sessMgr = await getSessionManager();
    if (mgr) {
      const contextEntry = await mgr.createContext({ headless: true });

      try {
        // Restore session
        if (sessMgr?.hasSession(data.socialAccountId, data.platform as Platform)) {
          await sessMgr.loadSession(data.socialAccountId, data.platform as Platform, contextEntry.context);
        }

        const workflow = createWorkflow(data.platform as Platform, contextEntry.context);
        const result = await workflow.setProfileAssets({
          profileImagePath,
          bannerImagePath,
        });

        if (result.success) {
          // Mark profile setup complete
          const social = await db.socialAccount.findUnique({ where: { id: data.socialAccountId } });
          const metadata = (typeof social?.metadata === 'object' && social.metadata !== null ? social.metadata : {}) as Record<string, unknown>;
          await db.socialAccount.update({
            where: { id: data.socialAccountId },
            data: {
              metadata: { ...metadata, profileSetupComplete: true } as any,
            },
          });
        }

        logger.info({ socialAccountId: data.socialAccountId, platform: data.platform, success: result.success }, 'Profile setup completed');
      } catch (err) {
        logger.error({ err, platform: data.platform }, 'Profile setup automation failed');
      } finally {
        await mgr.closeContext(contextEntry.id).catch((e) => logger.error({ e }, 'Failed to close context'));
      }
    }
  } else {
    logger.warn({ platform: data.platform }, 'Browser automation unavailable for profile setup — skipping');
  }

  // Clean up temp files
  if (profileImagePath) fs.unlink(profileImagePath, () => {});
  if (bannerImagePath) fs.unlink(bannerImagePath, () => {});

  // Check if all profiles are done, then enroll
  await queueEnrollIfReady(data.lifecycleId, lifecycle.emailAccountId, data.tenantId);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: ENROLL
// ═══════════════════════════════════════════════════════════════════

async function handleEnroll(data: LifecycleEnrollJob) {
  try {
    const db = getDb();

    const lifecycle = await db.accountLifecycle.findUnique({ where: { id: data.lifecycleId } });
    if (!lifecycle) return;

    if (!lifecycle.autoSeasoning) {
      // Skip seasoning — mark as completed
      await db.accountLifecycle.update({
        where: { id: data.lifecycleId },
        data: { status: 'completed', completedAt: new Date(), currentStep: 'completed' },
      });
      await db.emailAccount.update({
        where: { id: data.emailAccountId },
        data: { status: 'active' },
      });
      logger.info({ lifecycleId: data.lifecycleId }, 'Lifecycle completed (auto-seasoning disabled)');
      return { status: 'completed' };
    }

    await db.accountLifecycle.update({
      where: { id: data.lifecycleId },
      data: { status: 'enrolling', currentStep: 'enrolling' },
    });

    // Auto-create cohort
    const emailAccount = await db.emailAccount.findUnique({ where: { id: data.emailAccountId } });
    const dateStr = new Date().toISOString().split('T')[0];
    const cohort = await db.seasoningCohort.create({
      data: {
        tenantId: data.tenantId,
        name: `Auto: ${emailAccount?.email ?? data.emailAccountId} (${dateStr})`,
        platforms: data.platforms,
        status: 'active',
        startedAt: new Date(),
      },
    });

    // Start seasoning pipeline for new social accounts
    await startSeasoningPipeline({
      cohortId: cohort.id,
      tenantId: data.tenantId,
      emailAccountIds: [data.emailAccountId],
      platforms: data.platforms,
      staggerMinutes: { min: 1, max: 5 },
    });

    // Update lifecycle
    await db.accountLifecycle.update({
      where: { id: data.lifecycleId },
      data: {
        status: 'active',
        cohortId: cohort.id,
        currentStep: 'seasoning',
      },
    });

    await db.emailAccount.update({
      where: { id: data.emailAccountId },
      data: { status: 'active' },
    });

    logger.info({ lifecycleId: data.lifecycleId, cohortId: cohort.id, platforms: data.platforms }, 'Seasoning enrollment started');
    return { status: 'active', cohortId: cohort.id };
  } catch (err) {
    logger.error({ err, lifecycleId: data.lifecycleId }, 'Failed to enroll lifecycle');
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if all pending signups and profile setups are done,
 * then queue the enroll step.
 */
async function queueEnrollIfReady(lifecycleId: string, emailAccountId: string, tenantId: string) {
  const db = getDb();
  const lifecycle = await db.accountLifecycle.findUnique({ where: { id: lifecycleId } });
  if (!lifecycle) return;

  const results = (lifecycle.discoveryResults ?? {}) as Record<string, { exists: boolean | 'unknown' }>;
  const platformsNeedingSignup = lifecycle.targetPlatforms.filter((p) => {
    const r = results[p];
    return r && r.exists === false;
  });

  // Check if all platforms that needed signup now have social accounts
  const socialAccounts = await db.socialAccount.findMany({
    where: { emailAccountId, platform: { in: lifecycle.targetPlatforms } },
  });
  const socialPlatforms = new Set(socialAccounts.map((sa) => sa.platform));

  // Check all signups are completed (every platform that needed signup has a social account)
  const signupsComplete = platformsNeedingSignup.every((p) => socialPlatforms.has(p));
  if (!signupsComplete) return;

  // Check if profile setups are done (if avatar was provided)
  if (lifecycle.avatarId) {
    const needProfileSetup = socialAccounts.filter((sa) => {
      const meta = (typeof sa.metadata === 'object' && sa.metadata !== null ? sa.metadata : {}) as Record<string, unknown>;
      return !meta.profileSetupComplete && platformsNeedingSignup.includes(sa.platform);
    });
    if (needProfileSetup.length > 0) return; // Still waiting
  }

  // All ready — queue enroll
  const allPlatforms = [...new Set([...socialPlatforms])];
  await addJob('lifecycle', 'lifecycle:enroll', {
    lifecycleId,
    emailAccountId,
    tenantId,
    socialAccountIds: socialAccounts.map((sa) => sa.id),
    platforms: allPlatforms,
  }, { attempts: 2 });
}

/**
 * Download a URL to a temp file. Returns the file path.
 */
async function downloadToTemp(url: string, filename: string): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), 'airevstream-lifecycle');
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${Date.now()}-${filename}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ═══════════════════════════════════════════════════════════════════
// WORKER START
// ═══════════════════════════════════════════════════════════════════

export function startLifecycleWorker() {
  const worker = createWorker('lifecycle', processLifecycleJob, { concurrency: 2 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Lifecycle job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Lifecycle job failed');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Lifecycle job stalled — will be retried');
  });

  logger.info('Lifecycle worker started');
  return worker;
}
