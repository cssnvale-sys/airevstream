import { createWorker, type MaintenanceCleanupJob, type MaintenanceBackupJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:maintenance');

async function processMaintenanceJob(job: Job<MaintenanceCleanupJob | MaintenanceBackupJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing maintenance job');

  if (job.name === 'maintenance:cleanup') {
    const data = job.data as MaintenanceCleanupJob;
    return handleCleanup(data);
  }

  if (job.name === 'maintenance:backup') {
    const data = job.data as MaintenanceBackupJob;
    return handleBackup(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleCleanup(data: MaintenanceCleanupJob) {
  const db = getDb();
  const olderThanDays = data.olderThanDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  // Clean up old job logs
  const deletedLogs = await db.jobLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // Clean up expired refresh tokens
  const deletedTokens = await db.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  // Clean up old research topics
  const deletedTopics = await db.researchTopic.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  const result = {
    deletedJobLogs: deletedLogs.count,
    deletedRefreshTokens: deletedTokens.count,
    deletedResearchTopics: deletedTopics.count,
  };

  logger.info(result, 'Cleanup completed');
  return result;
}

async function handleBackup(data: MaintenanceBackupJob) {
  // Placeholder: In production, this would trigger pg_dump and/or MinIO backup
  logger.info({ target: data.target }, 'Backup triggered (placeholder)');
  return { target: data.target, status: 'placeholder' };
}

export function startMaintenanceWorker() {
  const worker = createWorker('maintenance', processMaintenanceJob, { concurrency: 1 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Maintenance job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Maintenance job failed');
  });

  logger.info('Maintenance worker started');
  return worker;
}
