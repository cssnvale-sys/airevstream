import { createWorker, getQueue, type ContentGenerateJob, type ContentPublishJob, type ContentApproveJob, type ContentFinalReviewJob, type ContentViralScoreJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { generateText, createServiceRegistry } from '@airevstream/ai-client';
import { createLogger, scoreViralPotential, APPROVAL_DEFAULTS, evaluateApprovalGate } from '@airevstream/shared';
import type { ViralScoringInput } from '@airevstream/shared';
import type { Job } from 'bullmq';

let _registry: ReturnType<typeof createServiceRegistry> | null = null;
function getRegistry() {
  if (!_registry) {
    try { _registry = createServiceRegistry(getDb()); } catch (err) { logger.warn({ err }, 'Service registry init failed'); return null; }
  }
  return _registry;
}

const logger = createLogger('worker:content');

// ─── Constants ───
const TRENDS_PAGE_SIZE = 20;
const CONTENT_RESCORE_INTERVAL_MS = 5 * 60 * 1000;

async function processContentJob(job: Job<ContentGenerateJob | ContentPublishJob | ContentApproveJob | ContentFinalReviewJob | ContentViralScoreJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing content job');

  if (job.name === 'content:check-approval-timeouts') {
    return handleCheckApprovalTimeouts();
  }

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

  if (job.name === 'content:viral-score') {
    const data = job.data as ContentViralScoreJob;
    return handleViralScore(data);
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

    // Look up trust score to determine gate window
    let gateWindowHrs: number = APPROVAL_DEFAULTS.INITIAL_GATE_WINDOW_HRS;
    try {
      const trustScore = await db.approvalTrustScore.findFirst({
        where: { dimensionType: 'content_type', dimensionValue: content.contentType },
      });
      if (trustScore) {
        gateWindowHrs = Number(trustScore.gateWindowHrs);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to look up approval trust score — using default gate window');
    }

    // Save generated content and update status
    await db.contentItem.update({
      where: { id: data.contentId },
      data: {
        status: 'pending_approval',
        approvalGateWindowHrs: gateWindowHrs,
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

    // Create alert for pending approval
    try {
      const channelWithAccount = await db.channel.findUnique({
        where: { id: content.channelId },
        select: { socialAccount: { select: { emailAccount: { select: { tenantId: true } } } } },
      });
      const tenantId = channelWithAccount?.socialAccount?.emailAccount?.tenantId ?? null;
      await db.alert.create({
        data: {
          tenantId,
          severity: 'info',
          category: 'content',
          title: 'Content awaiting approval',
          message: `"${content.title ?? 'Untitled'}" needs review (auto-approves in ${gateWindowHrs}h)`,
          source: 'content-worker',
          metadata: { contentId: data.contentId, contentType: content.contentType, link: `/content/${data.contentId}` },
        },
      });
    } catch (alertErr) {
      logger.warn({ alertErr }, 'Failed to create approval alert');
    }

    await job.updateProgress(90);

    // ─── Multi-language translation step ───
    const metadata = (content.platformMetadata as Record<string, unknown>) ?? {};
    const languages = (metadata.languages as string[]) ?? [];
    if (languages.length > 0 && resultContent && registry) {
      const translations: Record<string, string> = {};
      for (const lang of languages) {
        try {
          const translationPrompt = `Translate the following script to ${lang}. Maintain the same tone, timing markers like [HOOK], [INTRO], [CONTENT], [CTA], and formatting. Only output the translated text, nothing else.\n\n${resultContent}`;
          const translationResult = await registry.generate({ type: 'text', task: 'translation', prompt: translationPrompt, maxTokens: 4096 });
          translations[lang] = translationResult.content;
          logger.info({ contentId: data.contentId, lang }, 'Script translated');
        } catch (translateErr) {
          logger.warn({ contentId: data.contentId, lang, err: translateErr }, 'Translation failed for language');
        }
      }
      if (Object.keys(translations).length > 0) {
        await db.contentItem.update({
          where: { id: data.contentId },
          data: {
            platformMetadata: {
              ...metadata,
              script: resultContent,
              translations,
              translatedAt: new Date().toISOString(),
            },
          },
        });
      }
    }

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

    // Update ContentItem status to reflect scheduling
    await db.contentItem.update({
      where: { id: data.contentId },
      data: { status: 'scheduled' },
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
      include: {
        channel: { select: { socialAccount: { select: { platform: true, emailAccount: { select: { tenantId: true } } } } } },
        storyboards: {
          where: { id: data.storyboardId },
          select: {
            totalDurationSec: true,
            shots: {
              select: { shotNumber: true, startSec: true, endSec: true, qualityScore: true, shotspec: true },
              orderBy: { shotNumber: 'asc' },
            },
          },
          take: 1,
        },
      },
    });

    if (!content) {
      throw new Error(`Content item ${data.contentId} not found`);
    }

    // Compute viral score during final review
    const storyboard = content.storyboards[0];
    const shots = storyboard?.shots ?? [];
    const script = (content.platformMetadata as Record<string, unknown>)?.script as string | undefined;

    const viralInput: ViralScoringInput = {
      title: content.title ?? undefined,
      script,
      contentType: content.contentType,
      platform: content.channel?.socialAccount?.platform ?? undefined,
      durationSec: storyboard?.totalDurationSec != null ? Number(storyboard.totalDurationSec) : undefined,
      shotCount: shots.length,
      shotDurations: shots.map(s => Number(s.endSec ?? 0) - Number(s.startSec ?? 0)),
      qualityScores: shots.filter(s => s.qualityScore != null).map(s => Number(s.qualityScore)),
      hasMusic: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        return spec?.audioPlan != null;
      }),
      hasFace: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        const prompt = ((spec?.promptBlocks as string[]) ?? []).join(' ').toLowerCase();
        return /\b(face|portrait|person|character|man|woman|girl|boy)\b/.test(prompt);
      }),
      hasCTA: script ? /\b(subscribe|follow|like|share|comment|link)\b/i.test(script) : false,
    };

    const viralScore = scoreViralPotential(viralInput);
    logger.info({ contentId: data.contentId, viralScore: viralScore.overall, tier: viralScore.tier }, 'Viral score computed');

    // Store viral score in content performance JSON
    const existingPerf = (content.performance as Record<string, unknown>) ?? {};
    const updatedPerf = {
      ...existingPerf,
      viralScore: viralScore.overall,
      viralTier: viralScore.tier,
      viralDimensions: viralScore.dimensions,
      viralIssues: viralScore.issues,
      shareCoefficient: viralScore.shareCoefficient,
      scoredAt: new Date().toISOString(),
    };

    if (data.autoApprove) {
      await db.contentItem.update({
        where: { id: data.contentId },
        data: { status: 'approved', performance: updatedPerf as any },
      });
      logger.info({ contentId: data.contentId }, 'Content auto-approved');
    } else {
      // Look up trust score to determine gate window
      let gateWindowHrs: number = APPROVAL_DEFAULTS.INITIAL_GATE_WINDOW_HRS;
      try {
        const trustScore = await db.approvalTrustScore.findFirst({
          where: { dimensionType: 'content_type', dimensionValue: content.contentType },
        });
        if (trustScore) {
          gateWindowHrs = Number(trustScore.gateWindowHrs);
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to look up approval trust score — using default gate window');
      }

      await db.contentItem.update({
        where: { id: data.contentId },
        data: {
          status: 'pending_approval',
          approvalGateWindowHrs: gateWindowHrs,
          performance: updatedPerf as any,
        },
      });

      // Create alert for pending approval
      try {
        const tenantId = content.channel?.socialAccount?.emailAccount?.tenantId ?? null;
        await db.alert.create({
          data: {
            tenantId,
            severity: 'info',
            category: 'content',
            title: 'Content awaiting approval',
            message: `"${content.title ?? 'Untitled'}" needs review (auto-approves in ${gateWindowHrs}h)`,
            source: 'content-worker',
            metadata: { contentId: data.contentId, contentType: content.contentType, qualityScore: viralScore.overall, link: `/content/${data.contentId}` },
          },
        });
      } catch (alertErr) {
        logger.warn({ alertErr }, 'Failed to create approval alert');
      }

      logger.info({ contentId: data.contentId, gateWindowHrs }, 'Content sent for manual review with gate window');
    }

    return { contentId: data.contentId, status: data.autoApprove ? 'approved' : 'pending_approval', viralScore };
  } catch (err) {
    logger.error({ err, contentId: data.contentId }, 'Final review failed');
    throw err;
  }
}

// ─── Viral Score Handler ───

async function handleViralScore(data: ContentViralScoreJob) {
  const db = getDb();
  logger.info({ contentId: data.contentId }, 'Computing viral score');

  try {
    const content = await db.contentItem.findUnique({
      where: { id: data.contentId },
      include: {
        channel: { select: { socialAccount: { select: { platform: true } } } },
        storyboards: {
          where: data.storyboardId ? { id: data.storyboardId } : undefined,
          select: {
            totalDurationSec: true,
            shots: {
              select: { shotNumber: true, startSec: true, endSec: true, qualityScore: true, shotspec: true },
              orderBy: { shotNumber: 'asc' },
            },
          },
          take: 1,
        },
      },
    });

    if (!content) {
      throw new Error(`Content item ${data.contentId} not found`);
    }

    // Fetch trending topics for alignment check
    const trendEntries = await db.knowledgeBaseEntry.findMany({
      where: { category: 'trends' },
      orderBy: { createdAt: 'desc' },
      take: TRENDS_PAGE_SIZE,
      select: { title: true, relevanceScore: true },
    });

    const storyboard = content.storyboards[0];
    const shots = storyboard?.shots ?? [];
    const script = (content.platformMetadata as Record<string, unknown>)?.script as string | undefined;

    const viralInput: ViralScoringInput = {
      title: content.title ?? undefined,
      script,
      contentType: content.contentType,
      platform: data.platform ?? content.channel?.socialAccount?.platform ?? undefined,
      durationSec: storyboard?.totalDurationSec != null ? Number(storyboard.totalDurationSec) : undefined,
      shotCount: shots.length,
      shotDurations: shots.map(s => Number(s.endSec ?? 0) - Number(s.startSec ?? 0)),
      qualityScores: shots.filter(s => s.qualityScore != null).map(s => Number(s.qualityScore)),
      trendingTopics: trendEntries.map(e => e.title),
      hasMusic: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        return spec?.audioPlan != null;
      }),
      hasFace: shots.some(s => {
        const spec = s.shotspec as Record<string, unknown> | null;
        const prompt = ((spec?.promptBlocks as string[]) ?? []).join(' ').toLowerCase();
        return /\b(face|portrait|person|character|man|woman|girl|boy)\b/.test(prompt);
      }),
      hasCTA: script ? /\b(subscribe|follow|like|share|comment|link)\b/i.test(script) : false,
    };

    const viralScore = scoreViralPotential(viralInput);

    // Store in performance JSON
    const existingPerf = (content.performance as Record<string, unknown>) ?? {};
    await db.contentItem.update({
      where: { id: data.contentId },
      data: {
        performance: {
          ...existingPerf,
          viralScore: viralScore.overall,
          viralTier: viralScore.tier,
          viralDimensions: viralScore.dimensions,
          viralIssues: viralScore.issues,
          shareCoefficient: viralScore.shareCoefficient,
          scoredAt: new Date().toISOString(),
        } as any,
      },
    });

    logger.info({ contentId: data.contentId, viralScore: viralScore.overall, tier: viralScore.tier }, 'Viral score computed and stored');
    return viralScore;
  } catch (err) {
    logger.error({ err, contentId: data.contentId }, 'Viral score computation failed');
    throw err;
  }
}

// ─── Approval Timeout Checker ───

async function handleCheckApprovalTimeouts() {
  const db = getDb();
  logger.info('Checking approval gate timeouts');

  try {
    const pendingItems = await db.contentItem.findMany({
      where: { status: 'pending_approval' },
      select: {
        id: true,
        contentType: true,
        approvalGateWindowHrs: true,
        createdAt: true,
        qualityScore: true,
      },
    });

    if (pendingItems.length === 0) {
      logger.debug('No pending approval items');
      return;
    }

    let autoApprovedCount = 0;
    const now = new Date();

    for (const item of pendingItems) {
      const gateWindowHrs = item.approvalGateWindowHrs != null
        ? Number(item.approvalGateWindowHrs)
        : APPROVAL_DEFAULTS.INITIAL_GATE_WINDOW_HRS;

      // Look up trust score for this content type
      let trustScore = 50; // default
      try {
        const ts = await db.approvalTrustScore.findFirst({
          where: { dimensionType: 'content_type', dimensionValue: item.contentType },
        });
        if (ts) trustScore = Number(ts.trustScore);
      } catch (err) {
        logger.debug({ err, contentType: item.contentType }, 'Trust score lookup failed — using default');
      }

      const result = evaluateApprovalGate({
        trustScore,
        gateWindowHrs,
        contentCreatedAt: item.createdAt,
        qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
        now,
      });

      if (result.shouldAutoApprove) {
        await db.contentItem.update({
          where: { id: item.id },
          data: {
            status: 'approved',
            approvedAt: now,
            approvedBy: 'auto:timeout',
          },
        });
        autoApprovedCount++;
        logger.info({ contentId: item.id, reason: result.reason }, 'Content auto-approved by timeout');
      } else if (result.shouldAutoReject) {
        await db.contentItem.update({
          where: { id: item.id },
          data: { status: 'draft' },
        });
        logger.info({ contentId: item.id, reason: result.reason }, 'Content auto-rejected by quality threshold');
      }
    }

    if (autoApprovedCount > 0) {
      logger.info({ autoApprovedCount, totalChecked: pendingItems.length }, 'Approval timeout check complete');
    }
  } catch (err) {
    logger.error({ err }, 'Approval timeout check failed');
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

  worker.on('error', (err) => {
    console.error('[Content] Worker error:', err);
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Content job stalled — will be retried');
  });

  // Register repeatable approval timeout check (every 5 minutes)
  const contentQueue = getQueue('content');
  contentQueue.add('content:check-approval-timeouts', { _trigger: 'repeatable' } as any, {
    repeat: { every: CONTENT_RESCORE_INTERVAL_MS }, // 5 minutes
    removeOnComplete: true,
    removeOnFail: 10,
  }).catch((err: unknown) => logger.error({ err }, 'Failed to register approval timeout repeatable job'));

  logger.info('Content worker started');
  return worker;
}
