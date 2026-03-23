import { createWorker, getQueue, type MaintenanceCleanupJob, type MaintenanceBackupJob, type MaintenanceMetricsJob } from '@airevstream/queue';
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

  try {
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
  } catch (err) {
    logger.error({ err, olderThanDays }, 'Cleanup operation failed');
    throw err;
  }
}

async function handleBackup(data: MaintenanceBackupJob) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { readFile, unlink, mkdir } = await import('node:fs/promises');
  const execFileAsync = promisify(execFile);

  if (data.target === 'database' || data.target === 'all') {
    const backupDir = '/tmp/airevstream/backups';
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-backup-${timestamp}.sql.gz`;
    const filePath = `${backupDir}/${filename}`;

    try {
      // Run pg_dump and gzip
      const dbUrl = process.env.DATABASE_URL ?? 'postgresql://airevstream:airevstream_dev@localhost:5432/airevstream';
      await execFileAsync('sh', ['-c', `pg_dump "${dbUrl}" | gzip > "${filePath}"`], {
        timeout: 300_000, // 5 min max
      });

      // Upload to MinIO
      const { uploadBuffer, ensureBucket, listObjects, deleteObject } = await import('@airevstream/storage');
      const { BUCKETS } = await import('@airevstream/shared');
      await ensureBucket(BUCKETS.BACKUPS);

      const backupBuffer = await readFile(filePath);
      const key = `database/${filename}`;
      await uploadBuffer(BUCKETS.BACKUPS, key, backupBuffer, 'application/gzip');

      // Clean up local file
      await unlink(filePath).catch((e) => logger.debug({ err: e, path: filePath }, 'Temp file cleanup failed'));

      // Retain last 7 backups — delete older ones
      const objects = await listObjects(BUCKETS.BACKUPS, 'database/');
      if (objects.length > 7) {
        const sorted = objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        const toDelete = sorted.slice(7);
        for (const obj of toDelete) {
          await deleteObject(BUCKETS.BACKUPS, obj.name);
          logger.info({ key: obj.name }, 'Deleted old backup');
        }
      }

      logger.info({ key, size: backupBuffer.length }, 'Database backup completed');
      return { target: data.target, status: 'completed', key, size: backupBuffer.length };
    } catch (err) {
      // Clean up on failure
      await unlink(filePath).catch((e) => logger.debug({ err: e, path: filePath }, 'Temp file cleanup failed'));
      logger.error({ err }, 'Database backup failed');
      throw err;
    }
  }

  // Storage backup is a future enhancement
  if (data.target === 'storage') {
    logger.info('Storage backup not yet implemented');
    return { target: data.target, status: 'not_implemented' };
  }

  return { target: data.target, status: 'completed' };
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

  // Set up repeatable jobs
  const maintenanceQueue = getQueue('maintenance');
  maintenanceQueue.add('maintenance:backup', { target: 'database' } as any, {
    repeat: { every: 24 * 60 * 60 * 1000 }, // every 24 hours
    removeOnComplete: true,
    removeOnFail: 10,
  });
  maintenanceQueue.add('maintenance:cleanup', { olderThanDays: 30 } as any, {
    repeat: { every: 7 * 24 * 60 * 60 * 1000 }, // every 7 days
    removeOnComplete: true,
    removeOnFail: 10,
  });
  maintenanceQueue.add('maintenance:metrics', {} as any, {
    repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
    removeOnComplete: true,
    removeOnFail: 10,
  });

  logger.info('Maintenance worker started');
  return worker;
}
