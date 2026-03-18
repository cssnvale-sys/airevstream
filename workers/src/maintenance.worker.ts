import { createWorker, type MaintenanceCleanupJob, type MaintenanceBackupJob, type MaintenanceMetricsJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';
import os from 'node:os';

const logger = createLogger('worker:maintenance');

async function processMaintenanceJob(job: Job<MaintenanceCleanupJob | MaintenanceBackupJob | MaintenanceMetricsJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing maintenance job');

  if (job.name === 'maintenance:cleanup') {
    const data = job.data as MaintenanceCleanupJob;
    return handleCleanup(data);
  }

  if (job.name === 'maintenance:backup') {
    const data = job.data as MaintenanceBackupJob;
    return handleBackup(data);
  }

  if (job.name === 'maintenance:metrics') {
    return handleMetrics();
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleCleanup(data: MaintenanceCleanupJob) {
  const db = getDb();
  const olderThanDays = data.olderThanDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  // Run all cleanup deletes in a transaction for atomicity
  const [deletedTokens, deletedAlerts, deletedMetrics, deletedKb, archivedJobs] = await db.$transaction([
    db.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }),
    db.alert.deleteMany({
      where: { status: 'resolved', resolvedAt: { lt: cutoff } },
    }),
    db.systemMetric.deleteMany({
      where: { createdAt: { lt: cutoff } },
    }),
    db.knowledgeBaseEntry.deleteMany({
      where: { isCurrent: false, updatedAt: { lt: cutoff } },
    }),
    db.workflowJob.deleteMany({
      where: { status: { in: ['completed', 'cancelled'] }, completedAt: { lt: cutoff } },
    }),
  ]);

  const result = {
    deletedRefreshTokens: deletedTokens.count,
    deletedAlerts: deletedAlerts.count,
    deletedMetrics: deletedMetrics.count,
    deletedKnowledgeEntries: deletedKb.count,
    archivedJobs: archivedJobs.count,
  };

  logger.info(result, 'Cleanup completed');
  return result;
}

async function handleBackup(_data: MaintenanceBackupJob) {
  // Placeholder: In production, trigger pg_dump and/or MinIO backup
  logger.info({ target: _data.target }, 'Backup triggered (placeholder)');
  return { target: _data.target, status: 'placeholder' };
}

async function handleMetrics() {
  const db = getDb();

  // Collect system metrics
  const cpuUsage = os.loadavg()[0] / os.cpus().length * 100; // 1-min load avg as percentage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

  // Count queue depth
  const queuedJobs = await db.workflowJob.count({ where: { status: 'queued' } });

  await db.$transaction([
    db.systemMetric.create({
      data: { metricType: 'cpu', value: Math.round(cpuUsage * 100) / 100, unit: 'percent' },
    }),
    db.systemMetric.create({
      data: { metricType: 'ram', value: Math.round(ramUsagePercent * 100) / 100, unit: 'percent' },
    }),
    db.systemMetric.create({
      data: { metricType: 'ram_used_gb', value: Math.round((totalMem - freeMem) / (1024 ** 3) * 100) / 100, unit: 'bytes' },
    }),
    db.systemMetric.create({
      data: { metricType: 'queue_depth', value: queuedJobs, unit: 'count' },
    }),
  ]);

  logger.info({ cpu: cpuUsage.toFixed(1), ram: ramUsagePercent.toFixed(1), queueDepth: queuedJobs }, 'Metrics collected');
  return { cpu: cpuUsage, ram: ramUsagePercent, queueDepth: queuedJobs };
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
