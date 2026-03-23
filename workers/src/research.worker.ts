import { createWorker, getQueue, type ResearchTrendsJob, type ResearchTopicsJob, type ResearchKnowledgeUpdateJob, type ResearchPopulateKnowledgeJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { generateJSON, createServiceRegistry } from '@airevstream/ai-client';
import { createLogger } from '@airevstream/shared';
import type { Job } from 'bullmq';

let _registry: ReturnType<typeof createServiceRegistry> | null = null;
function getRegistry() {
  if (!_registry) {
    try { _registry = createServiceRegistry(getDb()); } catch (err) { logger.warn({ err }, 'Service registry init failed, using legacy AI client'); return null; }
  }
  return _registry;
}

const logger = createLogger('worker:research');

async function processResearchJob(job: Job<ResearchTrendsJob | ResearchTopicsJob | ResearchKnowledgeUpdateJob | ResearchPopulateKnowledgeJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing research job');

  if (job.name === 'research:trends') {
    const data = job.data as ResearchTrendsJob;
    return handleTrends(data, job);
  }

  if (job.name === 'research:topics') {
    const data = job.data as ResearchTopicsJob;
    return handleTopics(data, job);
  }

  if (job.name === 'research:knowledge-update') {
    const data = job.data as ResearchKnowledgeUpdateJob;
    return handleKnowledgeUpdate(data);
  }

  if (job.name === 'research:populate-knowledge') {
    const data = job.data as ResearchPopulateKnowledgeJob;
    return handlePopulateKnowledge(data, job);
  }

  logger.warn({ jobName: job.name }, 'Unknown job name');
}

async function handleTrends(data: ResearchTrendsJob, job: Job) {
  const db = getDb();

  try {
    const prompt = `Suggest 10 trending content topics${data.platform ? ` for ${data.platform}` : ''}${data.keywords?.length ? ` related to: ${data.keywords.join(', ')}` : ''}.
Return a JSON array of objects with: topic, relevanceScore (0-10), platform, reason, suggestedContentTypes (array).`;

    let trends: Array<{
      topic: string;
      relevanceScore: number;
      platform: string;
      reason: string;
      suggestedContentTypes: string[];
    }>;

    const registry = getRegistry();
    if (registry) {
      const result = await registry.generate({
        type: 'text',
        task: 'trend_research',
        prompt,
        format: 'json',
        systemPrompt: 'You are a social media trend analyst. Return valid JSON only.',
      });
      try {
        trends = JSON.parse(result.content);
      } catch (parseErr) {
        logger.error({ parseErr, content: result.content.slice(0, 200) }, 'Failed to parse AI trend response as JSON');
        throw new Error('AI service returned invalid JSON for trend research');
      }
    } else {
      trends = await generateJSON(prompt, {
        systemPrompt: 'You are a social media trend analyst. Return valid JSON only.',
      });
    }

    await job.updateProgress(50);

    // Save to knowledge base in bulk
    await db.knowledgeBaseEntry.createMany({
      data: trends.map((trend) => ({
        domain: 'platform_ops',
        category: 'trends',
        title: trend.topic,
        content: `${trend.reason}\n\nSuggested content types: ${trend.suggestedContentTypes.join(', ')}`,
        relevanceScore: trend.relevanceScore,
      })),
    });

    await job.updateProgress(100);
    logger.info({ count: trends.length }, 'Trends researched');
    return { count: trends.length };
  } catch (error) {
    logger.error({ err: error }, 'Failed to research trends');
    throw error;
  }
}

async function handleTopics(data: ResearchTopicsJob, job: Job) {
  const db = getDb();
  const count = data.count ?? 5;

  try {
    const prompt = `Generate ${count} unique content topic ideas for the "${data.niche}" niche.
Return a JSON array of objects with: topic, description, targetAudience, contentTypes (array of video_short/video_long/image/text).`;

    let topics: Array<{
      topic: string;
      description: string;
      targetAudience: string;
      contentTypes: string[];
    }>;

    const registry = getRegistry();
    if (registry) {
      const result = await registry.generate({
        type: 'text',
        task: 'topic_generation',
        prompt,
        format: 'json',
        systemPrompt: 'You are a content strategist. Return valid JSON only.',
      });
      try {
        topics = JSON.parse(result.content);
      } catch (parseErr) {
        logger.error({ parseErr, content: result.content.slice(0, 200) }, 'Failed to parse AI topic response as JSON');
        throw new Error('AI service returned invalid JSON for topic generation');
      }
    } else {
      topics = await generateJSON(prompt, {
        systemPrompt: 'You are a content strategist. Return valid JSON only.',
      });
    }

    await job.updateProgress(50);

    await db.knowledgeBaseEntry.createMany({
      data: topics.map((topic) => ({
        domain: 'platform_ops',
        category: `niche:${data.niche}`,
        title: topic.topic,
        content: `${topic.description}\n\nTarget audience: ${topic.targetAudience}\nContent types: ${topic.contentTypes.join(', ')}`,
      })),
    });

    await job.updateProgress(100);
    logger.info({ niche: data.niche, count: topics.length }, 'Topics generated');
    return { count: topics.length };
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate topics');
    throw error;
  }
}

async function handleKnowledgeUpdate(data: ResearchKnowledgeUpdateJob) {
  const db = getDb();

  // Placeholder: In production, this would crawl documentation, GitHub releases,
  // community forums for the specified domain
  logger.info({ domain: data.domain, sourceUrl: data.sourceUrl }, 'Knowledge update (placeholder)');

  if (data.sourceUrl) {
    await db.knowledgeBaseEntry.create({
      data: {
        domain: data.domain,
        category: 'external',
        title: `Update from ${data.sourceUrl}`,
        content: 'Placeholder: Content would be scraped from URL',
        sourceUrl: data.sourceUrl,
      },
    });
  }

  return { domain: data.domain, status: 'updated' };
}

async function handlePopulateKnowledge(data: ResearchPopulateKnowledgeJob, job: Job) {
  const db = getDb();
  const { domain, urls, topic } = data;
  let createdCount = 0;
  let skippedCount = 0;

  try {
    // Process explicit URLs if provided
    if (urls && urls.length > 0) {
      // Batch duplicate check — single query instead of N queries
      const existingEntries = await db.knowledgeBaseEntry.findMany({
        where: { sourceUrl: { in: urls } },
        select: { sourceUrl: true },
      });
      const existingUrls = new Set(existingEntries.map((e) => e.sourceUrl));

      const newEntries = [];
      for (const url of urls) {
        if (existingUrls.has(url)) {
          logger.info({ url }, 'Skipping duplicate URL');
          skippedCount++;
          continue;
        }

        const title = `Knowledge from ${new URL(url).hostname}: ${topic}`;
        const contentSummary = `Placeholder content for URL: ${url}. ` +
          `Topic: ${topic}. Domain: ${domain}. ` +
          `In production, this would contain the first 2000 characters of scraped content from the URL.`;

        const contentLength = contentSummary.length;
        const lengthBonus = Math.min(contentLength / 1000, 2.0);
        const freshnessBonus = 1.0;
        const relevanceScore = Math.min(Math.round((5.0 + lengthBonus + freshnessBonus) * 10) / 10, 10.0);

        newEntries.push({
          domain,
          category: `research:${topic}`,
          title,
          content: contentSummary.substring(0, 2000),
          sourceUrl: url,
          relevanceScore,
          isCurrent: true,
        });
      }

      if (newEntries.length > 0) {
        await db.knowledgeBaseEntry.createMany({ data: newEntries });
        createdCount += newEntries.length;
      }

      await job.updateProgress(urls.length > 0 ? 50 : 0);
    }

    // Generate topic-based knowledge entries using AI
    // This simulates finding search results for the topic
    const prompt = `Generate 5 knowledge base entries about "${topic}" in the "${domain}" domain.
Return a JSON array of objects with: title, content (informative summary, max 500 chars), sourceUrl (a plausible reference URL), relevanceScore (0-10).`;

    let entries: Array<{
      title: string;
      content: string;
      sourceUrl?: string;
      relevanceScore: number;
    }>;

    const registry = getRegistry();
    if (registry) {
      const result = await registry.generate({
        type: 'text',
        task: 'knowledge_population',
        prompt,
        format: 'json',
        systemPrompt: 'You are a research assistant. Return valid JSON only.',
      });
      try {
        entries = JSON.parse(result.content);
      } catch (parseErr) {
        logger.error({ parseErr, content: result.content.slice(0, 200) }, 'Failed to parse AI knowledge response as JSON');
        throw new Error('AI service returned invalid JSON for knowledge population');
      }
    } else {
      try {
        entries = await generateJSON(prompt, {
          systemPrompt: 'You are a research assistant. Return valid JSON only.',
        });
      } catch {
        // If AI is unavailable, create a single placeholder entry
        logger.warn('AI unavailable for knowledge population, creating placeholder entries');
        entries = [
          {
            title: `Research: ${topic}`,
            content: `Placeholder knowledge entry for topic "${topic}" in domain "${domain}". ` +
              `This entry was created as a stub when AI generation was unavailable. ` +
              `It should be enriched with actual content when AI services are restored.`,
            relevanceScore: 3.0,
          },
        ];
      }
    }

    // Ensure entries is an array
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    // Batch duplicate check for entries with sourceUrls
    const entryUrls = entries.filter((e) => e.sourceUrl).map((e) => e.sourceUrl!);
    const existingKbEntries = entryUrls.length > 0
      ? await db.knowledgeBaseEntry.findMany({
          where: { sourceUrl: { in: entryUrls } },
          select: { sourceUrl: true },
        })
      : [];
    const existingKbUrls = new Set(existingKbEntries.map((e) => e.sourceUrl));

    const newKbEntries = [];
    for (const entry of entries) {
      if (entry.sourceUrl && existingKbUrls.has(entry.sourceUrl)) {
        logger.info({ sourceUrl: entry.sourceUrl }, 'Skipping duplicate knowledge entry');
        skippedCount++;
        continue;
      }

      const baseScore = entry.relevanceScore ?? 5.0;
      const contentLength = (entry.content ?? '').length;
      const lengthBonus = Math.min(contentLength / 500, 1.5);
      const relevanceScore = Math.min(Math.round((baseScore + lengthBonus) * 10) / 10, 10.0);

      newKbEntries.push({
        domain,
        category: `research:${topic}`,
        title: entry.title,
        content: (entry.content ?? '').substring(0, 2000),
        sourceUrl: entry.sourceUrl ?? null,
        relevanceScore,
        isCurrent: true,
      });
    }

    if (newKbEntries.length > 0) {
      await db.knowledgeBaseEntry.createMany({ data: newKbEntries });
      createdCount += newKbEntries.length;
    }

    await job.updateProgress(100);

    logger.info(
      { domain, topic, created: createdCount, skipped: skippedCount },
      'Knowledge base populated',
    );

    return { domain, topic, created: createdCount, skipped: skippedCount };
  } catch (error) {
    logger.error({ err: error, domain, topic }, 'Failed to populate knowledge base');
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

  // Set up repeatable trends research (every 12 hours)
  const researchQueue = getQueue('research');
  researchQueue.add('research:trends', {} as any, {
    repeat: { every: 12 * 60 * 60 * 1000 }, // every 12 hours
    removeOnComplete: true,
    removeOnFail: 10,
  });

  logger.info('Research worker started');
  return worker;
}
