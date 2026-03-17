import { createWorker, type ResearchTrendsJob, type ResearchTopicsJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { generateJSON } from '@airevstream/ai-client';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

const logger = createLogger('worker:research');

async function processResearchJob(job: Job<ResearchTrendsJob | ResearchTopicsJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing research job');

  if (job.name === 'research:trends') {
    const data = job.data as ResearchTrendsJob;
    return handleTrends(data);
  }

  if (job.name === 'research:topics') {
    const data = job.data as ResearchTopicsJob;
    return handleTopics(data);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleTrends(data: ResearchTrendsJob) {
  const db = getDb();

  // Use AI to generate trending topic suggestions
  // In production, this would also scrape/query platform APIs for real trend data
  try {
    const prompt = `Suggest 10 trending content topics${data.platform ? ` for ${data.platform}` : ''}${data.keywords?.length ? ` related to: ${data.keywords.join(', ')}` : ''}.
Return a JSON array of objects with: topic, trendScore (0-100), platform, reason.`;

    const trends = await generateJSON<Array<{
      topic: string;
      trendScore: number;
      platform: string;
      reason: string;
    }>>(prompt, {
      systemPrompt: 'You are a social media trend analyst. Return valid JSON only.',
    });

    // Save to database
    for (const trend of trends) {
      await db.researchTopic.create({
        data: {
          topic: trend.topic,
          platform: trend.platform || data.platform || null,
          trendScore: trend.trendScore,
          data: trend as any,
        },
      });
    }

    logger.info({ count: trends.length }, 'Trends researched');
    return { count: trends.length };
  } catch (error) {
    logger.error({ err: error }, 'Failed to research trends');
    throw error;
  }
}

async function handleTopics(data: ResearchTopicsJob) {
  const db = getDb();
  const count = data.count ?? 5;

  try {
    const prompt = `Generate ${count} unique content topic ideas for the "${data.niche}" niche.
Return a JSON array of objects with: topic, description, targetAudience, contentTypes (array of video/image/text).`;

    const topics = await generateJSON<Array<{
      topic: string;
      description: string;
      targetAudience: string;
      contentTypes: string[];
    }>>(prompt, {
      systemPrompt: 'You are a content strategist. Return valid JSON only.',
    });

    for (const topic of topics) {
      await db.researchTopic.create({
        data: {
          topic: topic.topic,
          data: topic as any,
        },
      });
    }

    logger.info({ niche: data.niche, count: topics.length }, 'Topics generated');
    return { count: topics.length };
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate topics');
    throw error;
  }
}

export function startResearchWorker() {
  const worker = createWorker('research', processResearchJob, { concurrency: 1 });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Research job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Research job failed');
  });

  logger.info('Research worker started');
  return worker;
}
