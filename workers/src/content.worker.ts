import { createWorker, type ContentGenerateJob, type ContentPublishJob, type ContentApproveJob, type ContentFinalReviewJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

let _registry: ReturnType<typeof createServiceRegistry> | null = null;
function getRegistry() {
  if (!_registry) {
    try { _registry = createServiceRegistry(getDb()); } catch (err) { logger.warn({ err }, 'Service registry init failed'); return null; }
  }
  return _registry;
}

const logger = createLogger('worker:content');

async function processContentJob(job: Job<ContentGenerateJob | ContentPublishJob | ContentApproveJob | ContentFinalReviewJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing content job');

  if (job.name === 'content:generate') {
    const data = job.data as ContentGenerateJob;
    return handleGenerate(data, job);
  }

  if (job.name === 'content:publish') {
    const data = job.data as ContentPublishJob;
    return handlePublishRequest(data);
  }

  if (job.name === 'content:final-review') {
    const data = job.data as ContentFinalReviewJob;
    return handleFinalReview(data);
  }

  if (job.name === 'content:approve') {
    const data = job.data as ContentApproveJob;
    return handleApprove(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleGenerate(data: ContentGenerateJob, job: Job) {
  const db = getDb();

  // Update content status to generating
  await db.contentItem.update({
    where: { id: data.contentId },
    data: { status: 'generating' },
  });

  await job.updateProgress(10);

  try {
    // Load content and channel identity for context
    const content = await db.contentItem.findUnique({
      where: { id: data.contentId },
      include: {
        channel: {
          include: {
            channelAvatars: { include: { avatar: true } },
            cinemaBibles: { take: 1, orderBy: { version: 'desc' } },
          },
        },
      },
    });
    if (!content) throw new Error(`Content ${data.contentId} not found`);

    // Build context-aware prompt with channel identity
    const channel = content.channel;
    const channelContext = [
      `Channel: ${channel.name}`,
      `Language: ${channel.primaryLanguage}`,
      channel.niches.length > 0 ? `Niches: ${channel.niches.join(', ')}` : '',
      channel.tone ? `Tone: ${channel.tone}` : '',
      channel.personality ? `Personality: ${channel.personality}` : '',
      channel.targetAudience ? `Target audience: ${channel.targetAudience}` : '',
    ].filter(Boolean).join('\n');

    const prompt = data.prompt
      ?? `Generate a ${content.contentType} script about: ${content.title ?? 'trending topic'}`;

    const fullPrompt = `${channelContext}\n\n${prompt}`;

    const systemPrompt = 'You are a professional cinematic content creator. Write engaging, well-structured content that follows the H.I.C.C. framework: Hook (0-5s), Intro (5-30s), Content with micro-hooks every 60-90s, CTA at peak tension. Tag each section with emotional beat presets: INTIMATE, TENSION, POWER, AWE, PSYCHOLOGICAL, EMOTIONAL, MOMENTUM, CALM.';

    let resultContent: string;
    let resultModel: string;
    let serviceId: string | undefined;

    const registry = getRegistry();
    if (registry) {
      const result = await registry.generate({
        type: 'text',
        task: 'script_generation',
        prompt: fullPrompt,
        systemPrompt,
        contentId: data.contentId,
        channelId: content.channelId,
      });
      resultContent = result.content;
      resultModel = result.model;
      serviceId = result.serviceId;
    } else {
      const result = await generateText(fullPrompt, { systemPrompt });
      resultContent = result.content;
      resultModel = result.model;
    }

    await job.updateProgress(80);

    // Save generated content and update status
    await db.contentItem.update({
      where: { id: data.contentId },
      data: {
        status: 'pending_approval',
        aiServiceId: serviceId ?? undefined,
        generationParams: {
          aiModel: resultModel,
          generatedAt: new Date().toISOString(),
          prompt: fullPrompt,
        },
        platformMetadata: {
          script: resultContent,
        },
      },
    });

    await job.updateProgress(100);
    logger.info({ contentId: data.contentId }, 'Content generated successfully');

    return { contentId: data.contentId, status: 'pending_approval' };
  } catch (error) {
    logger.error({ contentId: data.contentId, error: error instanceof Error ? error.message : String(error) }, 'Content generation failed');
    try {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'failed' },
      });
    } catch (dbErr) {
      logger.error({ contentId: data.contentId, error: dbErr instanceof Error ? dbErr.message : String(dbErr) }, 'Failed to update content status to failed');
    }
    throw error;
  }
}

async function handlePublishRequest(data: ContentPublishJob) {
  try {
    const db = getDb();

    // Create a scheduled post record
    const content = await db.contentItem.findUnique({
      where: { id: data.contentId },
      include: { channel: { include: { socialAccount: true } } },
    });

    if (!content) {
      logger.warn({ contentId: data.contentId }, 'Content not found');
      return;
    }

    await db.scheduledPost.create({
      data: {
        contentId: data.contentId,
        channelId: data.channelId,
        scheduledAt: new Date(),
        platform: content.channel.socialAccount.platform,
        socialAccountId: content.channel.socialAccount.id,
        status: 'scheduled',
      },
    });

    logger.info({ contentId: data.contentId, channelId: data.channelId }, 'Publish request queued');
    return { contentId: data.contentId, status: 'scheduled' };
  } catch (err) {
    logger.error({ err, contentId: data.contentId, channelId: data.channelId }, 'Publish request failed');
    throw err;
  }
}

async function handleApprove(data: ContentApproveJob) {
  try {
    const db = getDb();
    const content = await db.contentItem.findUnique({ where: { id: data.contentId } });
    if (!content) {
      logger.warn({ contentId: data.contentId }, 'Content not found for approval');
      return;
    }

    if (data.action === 'approve') {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'approved', approvedAt: new Date(), approvedBy: 'auto' },
      });
    } else if (data.action === 'reject') {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'draft' },
      });
    } else if (data.action === 'regenerate') {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'generating' },
      });
    } else {
      throw new Error(`Unknown approval action: ${data.action}`);
    }

    logger.info({ contentId: data.contentId, action: data.action }, 'Content approval processed');
    return { contentId: data.contentId, action: data.action };
  } catch (err) {
    logger.error({ err, contentId: data.contentId, action: data.action }, 'Content approval failed');
    throw err;
  }
}

// ─── Final Review Handler (Cinema Pipeline) ───

async function handleFinalReview(data: ContentFinalReviewJob) {
  const db = getDb();
  logger.info({ contentId: data.contentId, storyboardId: data.storyboardId }, 'Processing final review');

  try {
    const content = await db.contentItem.findUnique({
      where: { id: data.contentId },
      select: { id: true, status: true },
    });

    if (!content) {
      throw new Error(`Content item ${data.contentId} not found`);
    }

    if (data.autoApprove) {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'approved' },
      });
      logger.info({ contentId: data.contentId }, 'Content auto-approved');
    } else {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'pending_approval' },
      });
      logger.info({ contentId: data.contentId }, 'Content sent for manual review');
    }

    return { contentId: data.contentId, status: data.autoApprove ? 'approved' : 'pending_approval' };
  } catch (err) {
    logger.error({ err, contentId: data.contentId }, 'Final review failed');
    throw err;
  }
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
