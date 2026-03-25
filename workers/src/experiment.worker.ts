import { createWorker, type ExperimentEvaluateJob, type ExperimentRecordMetricJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { createLogger, shouldDeclareWinner } from '@airevstream/shared';
import type { VariantMetrics } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:experiment');

async function processExperimentJob(job: Job<ExperimentEvaluateJob | ExperimentRecordMetricJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing experiment job');

  if (job.name === 'experiment:evaluate') {
    const data = job.data as ExperimentEvaluateJob;
    return handleEvaluate(data);
  }

  if (job.name === 'experiment:record-metric') {
    const data = job.data as ExperimentRecordMetricJob;
    return handleRecordMetric(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown experiment job name');
}

async function handleEvaluate(data: ExperimentEvaluateJob) {
  const db = getDb();

  const experiment = await db.experiment.findUnique({
    where: { id: data.experimentId },
  });

  if (!experiment) {
    logger.warn({ experimentId: data.experimentId }, 'Experiment not found');
    return;
  }

  if (experiment.status !== 'running') {
    logger.info({ experimentId: data.experimentId, status: experiment.status }, 'Experiment not in running state, skipping evaluation');
    return;
  }

  // Optimistic concurrency: re-check status with a conditional update to prevent race conditions
  const lockResult = await db.experiment.updateMany({
    where: { id: data.experimentId, status: 'running' },
    data: { status: 'evaluating' },
  });
  if (lockResult.count === 0) {
    logger.info({ experimentId: data.experimentId }, 'Experiment already being evaluated by another worker');
    return;
  }

  try {
    // Re-read variants after acquiring lock to get the freshest metric data
    const variants = await db.experimentVariant.findMany({
      where: { experimentId: data.experimentId },
    });

    const variantResults: VariantMetrics[] = variants.map(v => ({
      id: v.id,
      label: v.label,
      impressions: v.impressions,
      clicks: v.clicks,
      engagementRate: Number(v.engagementRate),
      completionRate: Number(v.completionRate),
      shareRate: Number(v.shareRate),
    }));

    const decision = shouldDeclareWinner(
      variantResults,
      Number(experiment.confidenceLevel),
      experiment.minSampleSize,
      experiment.primaryMetric,
    );

    logger.info({ experimentId: data.experimentId, decision }, 'Evaluation result');

    if (decision.winnerId) {
      await db.experiment.update({
        where: { id: data.experimentId },
        data: {
          status: 'completed',
          winnerId: decision.winnerId,
          significance: decision.significance,
          endedAt: new Date(),
        },
      });
      logger.info({ experimentId: data.experimentId, winnerId: decision.winnerId }, 'Experiment completed with winner');

      // Feedback loop: update SuggestionLog entries with viralScoreAfter
      try {
        const winningVariant = variants.find(v => v.id === decision.winnerId);
        if (winningVariant?.viralScore != null) {
          const presetOverrides = (winningVariant.presetOverrides as Record<string, unknown>) ?? {};
          // Extract preset IDs from both keys and string values (handles both conventions)
          const potentialIds = new Set<string>();
          for (const [key, value] of Object.entries(presetOverrides)) {
            if (key.includes('.')) potentialIds.add(key);
            if (typeof value === 'string' && value.includes('.')) potentialIds.add(value);
          }
          const presetIds = Array.from(potentialIds);
          if (presetIds.length > 0) {
            const updated = await db.suggestionLog.updateMany({
              where: {
                tenantId: experiment.tenantId,
                presetId: { in: presetIds },
                outcome: 'accepted',
                viralScoreAfter: null,
              },
              data: { viralScoreAfter: winningVariant.viralScore },
            });
            if (updated.count > 0) {
              logger.info({ experimentId: data.experimentId, updatedLogs: updated.count }, 'Updated suggestion logs with viral score after');
            }
          }
        }
      } catch (feedbackErr) {
        // Non-blocking — log and continue
        logger.warn({ experimentId: data.experimentId, error: feedbackErr }, 'Failed to update suggestion feedback loop');
      }
    } else {
      // No winner yet — update significance and return to running
      await db.experiment.update({
        where: { id: data.experimentId },
        data: { status: 'running', significance: decision.significance },
      });
    }
  } catch (evalErr) {
    // Restore status to running on evaluation failure
    logger.error({ experimentId: data.experimentId, error: evalErr }, 'Evaluation failed, restoring running status');
    await db.experiment.update({
      where: { id: data.experimentId },
      data: { status: 'running' },
    }).catch((restoreErr) => { logger.error({ experimentId: data.experimentId, error: restoreErr }, 'Failed to restore experiment status after evaluation failure'); });
    throw evalErr;
  }
}

async function handleRecordMetric(data: ExperimentRecordMetricJob) {
  const db = getDb();

  const variant = await db.experimentVariant.findUnique({
    where: { id: data.variantId },
    include: { experiment: { select: { tenantId: true, status: true } } },
  });

  if (!variant) {
    logger.warn({ variantId: data.variantId }, 'Variant not found');
    return;
  }

  // Verify tenant ownership
  if (variant.experiment.tenantId !== data.tenantId) {
    logger.warn({ variantId: data.variantId, expectedTenant: data.tenantId, actualTenant: variant.experiment.tenantId }, 'Tenant mismatch on record-metric');
    return;
  }

  // Only accept metrics for running experiments
  if (variant.experiment.status !== 'running') {
    logger.info({ variantId: data.variantId, status: variant.experiment.status }, 'Experiment not running, skipping metric record');
    return;
  }

  // Increment the appropriate metric
  const updateData: Record<string, unknown> = {};
  switch (data.metric) {
    case 'impressions':
      updateData.impressions = { increment: Math.round(data.value) };
      break;
    case 'clicks':
      updateData.clicks = { increment: Math.round(data.value) };
      break;
    case 'engagementRate':
      updateData.engagementRate = data.value;
      break;
    case 'completionRate':
      updateData.completionRate = data.value;
      break;
    case 'shareRate':
      updateData.shareRate = data.value;
      break;
    case 'viralScore':
      updateData.viralScore = Math.round(data.value);
      break;
    default:
      logger.warn({ metric: data.metric }, 'Unknown metric type');
      return;
  }

  await db.experimentVariant.update({
    where: { id: data.variantId },
    data: updateData,
  });

  logger.info({ variantId: data.variantId, metric: data.metric, value: data.value }, 'Metric recorded');
}

export function startExperimentWorker() {
  return createWorker('experiment', processExperimentJob, { concurrency: 2 });
}
