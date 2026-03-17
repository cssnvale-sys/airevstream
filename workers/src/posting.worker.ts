import { createWorker, type ContentPublishJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { decrypt } from '@airevstream/crypto';
import { getConfig, createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:posting');

async function processPostingJob(job: Job<ContentPublishJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing posting job');

  const { contentId, accountId } = job.data;
  const db = getDb();

  // Get the posting record
  const posting = await db.posting.findFirst({
    where: { contentId, accountId, status: 'pending' },
    include: { content: true, account: true },
  });

  if (!posting) {
    logger.warn({ contentId, accountId }, 'No pending posting found');
    return;
  }

  // Update status to publishing
  await db.posting.update({
    where: { id: posting.id },
    data: { status: 'publishing' },
  });

  await db.content.update({
    where: { id: contentId },
    data: { status: 'publishing' },
  });

  try {
    // Decrypt access token if available
    const config = getConfig();
    let _accessToken: string | null = null;
    if (posting.account.accessToken && config.ENCRYPTION_KEY) {
      _accessToken = decrypt(posting.account.accessToken, config.ENCRYPTION_KEY);
    }

    // Placeholder: In production, this would use platform-specific APIs
    // to publish the content (YouTube Data API, TikTok API, etc.)
    logger.info({
      contentId,
      accountId,
      platform: posting.account.platform,
    }, 'Publishing content (placeholder)');

    // Simulate publishing delay
    // In production, replace with actual API calls

    // Mark as published
    await db.posting.update({
      where: { id: posting.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        platformPostId: `placeholder_${Date.now()}`,
      },
    });

    await db.content.update({
      where: { id: contentId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    logger.info({ contentId, accountId, platform: posting.account.platform }, 'Content published (placeholder)');
    return { postingId: posting.id, status: 'published' };
  } catch (error: any) {
    await db.posting.update({
      where: { id: posting.id },
      data: { status: 'failed', errorMessage: error.message },
    });

    await db.content.update({
      where: { id: contentId },
      data: { status: 'failed' },
    });

    throw error;
  }
}

export function startPostingWorker() {
  const worker = createWorker('posting', processPostingJob, {
    concurrency: 1,
    limiter: { max: 5, duration: 60000 }, // Rate limit: 5 posts per minute
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Posting job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Posting job failed');
  });

  logger.info('Posting worker started');
  return worker;
}
