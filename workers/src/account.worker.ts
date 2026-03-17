import { createWorker, type AccountSyncJob, type AccountHealthCheckJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:account');

async function processAccountJob(job: Job<AccountSyncJob | AccountHealthCheckJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing account job');

  if (job.name === 'account:sync') {
    const data = job.data as AccountSyncJob;
    return handleSync(data);
  }

  if (job.name === 'account:health-check') {
    const data = job.data as AccountHealthCheckJob;
    return handleHealthCheck(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleSync(data: AccountSyncJob) {
  const db = getDb();
  const account = await db.account.findUnique({ where: { id: data.accountId } });

  if (!account) {
    logger.warn({ accountId: data.accountId }, 'Account not found');
    return;
  }

  // Placeholder: In production, this would call platform APIs to sync account data
  // (followers, stats, profile info, etc.)
  logger.info({ accountId: data.accountId, platform: account.platform }, 'Account synced (placeholder)');

  await db.account.update({
    where: { id: data.accountId },
    data: { lastSyncedAt: new Date() },
  });

  return { accountId: data.accountId, status: 'synced' };
}

async function handleHealthCheck(data: AccountHealthCheckJob) {
  const db = getDb();
  const account = await db.account.findUnique({ where: { id: data.accountId } });

  if (!account) {
    logger.warn({ accountId: data.accountId }, 'Account not found');
    return;
  }

  // Placeholder: Check if tokens are still valid, account is not banned, etc.
  const isHealthy = account.status === 'active';

  logger.info({
    accountId: data.accountId,
    platform: account.platform,
    healthy: isHealthy,
  }, 'Account health checked');

  return { accountId: data.accountId, healthy: isHealthy };
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
