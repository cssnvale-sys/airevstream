import { createWorker, type ContentGenerateJob, type ContentPublishJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { generateText } from '@airevstream/ai-client';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:content');

async function processContentJob(job: Job<ContentGenerateJob | ContentPublishJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing content job');

  if (job.name === 'content:generate') {
    const data = job.data as ContentGenerateJob;
    return handleGenerate(data, job);
  }

  if (job.name === 'content:publish') {
    const data = job.data as ContentPublishJob;
    return handlePublishRequest(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleGenerate(data: ContentGenerateJob, job: Job) {
  const db = getDb();

  // Update content status to generating
  await db.content.update({
    where: { id: data.contentId },
    data: { status: 'generating' },
  });

  await job.updateProgress(10);

  try {
    const content = await db.content.findUnique({ where: { id: data.contentId } });
    if (!content) throw new Error(`Content ${data.contentId} not found`);

    const prompt = data.prompt ?? `Generate a ${content.type} script about: ${content.title}\n\n${content.description ?? ''}`;

    const result = await generateText(prompt, {
      systemPrompt: 'You are a professional content creator. Write engaging, well-structured content.',
    });

    await job.updateProgress(80);

    // Save generated script
    await db.content.update({
      where: { id: data.contentId },
      data: {
        script: result.content,
        status: 'review',
        metadata: {
          aiModel: result.model,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await job.updateProgress(100);
    logger.info({ contentId: data.contentId }, 'Content generated successfully');

    return { contentId: data.contentId, status: 'review' };
  } catch (error) {
    await db.content.update({
      where: { id: data.contentId },
      data: { status: 'failed' },
    });
    throw error;
  }
}

async function handlePublishRequest(data: ContentPublishJob) {
  const db = getDb();

  // Create a posting record
  await db.posting.create({
    data: {
      contentId: data.contentId,
      accountId: data.accountId,
      status: 'pending',
    },
  });

  logger.info({ contentId: data.contentId, accountId: data.accountId }, 'Publish request queued');
  return { contentId: data.contentId, status: 'queued' };
}

export function startContentWorker() {
  const worker = createWorker('content', processContentJob, { concurrency: 2 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Content job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Content job failed');
  });

  logger.info('Content worker started');
  return worker;
}
