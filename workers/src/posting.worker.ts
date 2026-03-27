import { createWorker, getQueue, addJob, type PostingScheduleJob, type PostingPublishJob, type SeriesPlaylistSyncJob } from '@airevstream/queue';
import { getDb } from '@airevstream/db';
import { decrypt } from '@airevstream/crypto';
import { getConfig, createLogger, type ActivityLock } from '@airevstream/shared';
import { getPresignedUrl } from '@airevstream/storage';
import type { Job } from 'bullmq';
import { getAdapter, type PostContent, type PlatformCredentials } from './platform-adapters.js';

const logger = createLogger('worker:posting');

async function processPostingJob(job: Job<PostingScheduleJob | PostingPublishJob | SeriesPlaylistSyncJob>) {
  logger.info({ jobId: job.id, jobName: job.name }, 'Processing posting job');

  if (job.name === 'posting:check-scheduled') {
    return checkScheduledPosts();
  }

  if (job.name === 'posting:schedule') {
    const data = job.data as PostingScheduleJob;
    return handleSchedule(data);
  }

  if (job.name === 'posting:playlist-sync') {
    const data = job.data as SeriesPlaylistSyncJob;
    return handlePlaylistSync(data);
  }

  const { scheduledPostId, contentId, channelId, platform } = job.data as PostingPublishJob;
  const db = getDb();

  // Activity lock check (D112) — posting has time-sensitive priority
  const scheduledPostForLock = await db.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    select: { channel: { select: { socialAccount: { select: { id: true, metadata: true } } } } },
  });
  if (scheduledPostForLock?.channel?.socialAccount) {
    const socialId = scheduledPostForLock.channel.socialAccount.id;
    const meta = scheduledPostForLock.channel.socialAccount.metadata as Record<string, unknown> | null;
    const lock = meta?.activityLock as ActivityLock | undefined;
    if (lock?.lockedAt && lock?.expiresAt && new Date(lock.expiresAt).getTime() > Date.now()) {
      if (lock.type === 'warming') {
        const timeLeft = new Date(lock.expiresAt).getTime() - Date.now();
        if (timeLeft < 5 * 60 * 1000) {
          // Warming lock expiring soon (<5 min) — short retry
          logger.info({ socialAccountId: socialId, timeLeftMs: timeLeft }, 'Warming lock expiring soon — short retry');
          throw new Error('Activity lock held by warming — retry shortly');
        }
        // Warming lock long — posting breaks it (time-sensitive priority)
        logger.info({ socialAccountId: socialId }, 'Breaking warming lock for time-sensitive posting');
      }
    }
    // Acquire posting lock (30 min TTL)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await db.socialAccount.update({
      where: { id: socialId },
      data: {
        metadata: {
          ...(meta ?? {}),
          activityLock: { type: 'posting', lockedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), jobId: String(job.id) },
        } as any,
      },
    });
  }

  // Get the scheduled post record with related data
  const scheduledPost = await db.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: {
      content: true,
      channel: { include: { socialAccount: { include: { emailAccount: { select: { tenantId: true } } } } } },
    },
  });

  if (!scheduledPost) {
    logger.warn({ scheduledPostId }, 'No scheduled post found');
    return;
  }

  // Update status to posting
  await db.scheduledPost.update({
    where: { id: scheduledPost.id },
    data: { status: 'posting' },
  });

  try {
    // Decrypt credentials
    const config = getConfig();
    const socialAccount = scheduledPost.channel.socialAccount;
    if (!socialAccount.credentialsEnc || !config.ENCRYPTION_KEY) {
      throw new Error(`No credentials available for social account ${socialAccount.id}`);
    }

    const decryptedJson = decrypt(socialAccount.credentialsEnc, config.ENCRYPTION_KEY);
    let credentials: PlatformCredentials;
    try {
      credentials = JSON.parse(decryptedJson);
    } catch (parseErr) {
      throw new Error(`Failed to parse decrypted credentials for social account ${socialAccount.id}: invalid JSON`);
    }

    // Use channelId from the platform if not in credentials
    if (!credentials.channelId && scheduledPost.channel.platformChannelId) {
      credentials.channelId = scheduledPost.channel.platformChannelId;
    }

    // Build PostContent from content item and publish config
    const content = scheduledPost.content;
    const publishConfig = (scheduledPost.publishConfig ?? {}) as Record<string, unknown>;
    const platformMeta = (content.platformMetadata ?? {}) as Record<string, unknown>;

    // Resolve file URLs — convert MinIO storage paths to presigned URLs
    let videoUrl: string | undefined;
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (content.fileUrl) {
      const isVideo = content.contentType.startsWith('video');
      const isImage = content.contentType === 'image' || content.contentType === 'thumbnail';
      const presignedUrl = content.fileUrl.startsWith('http')
        ? content.fileUrl
        : await getPresignedUrl('content', content.fileUrl, 3600);

      if (isVideo) videoUrl = presignedUrl;
      if (isImage) imageUrl = presignedUrl;
    }

    if (content.thumbnailUrl) {
      thumbnailUrl = content.thumbnailUrl.startsWith('http')
        ? content.thumbnailUrl
        : await getPresignedUrl('content', content.thumbnailUrl, 3600);
    }

    const postContent: PostContent = {
      title: content.title ?? 'Untitled',
      description: (publishConfig.description as string)
        ?? (platformMeta.description as string)
        ?? content.prompt
        ?? '',
      videoUrl,
      imageUrl,
      thumbnailUrl,
      tags: (publishConfig.tags as string[])
        ?? (platformMeta.tags as string[])
        ?? undefined,
      scheduledAt: scheduledPost.scheduledAt.toISOString(),
    };

    // Publish via platform adapter
    const adapter = getAdapter(platform);
    logger.info({ contentId, channelId, platform }, 'Publishing content via platform adapter');
    const result = await adapter.publish(postContent, credentials);

    if (!result.success) {
      throw new Error(result.error ?? `Platform adapter returned failure for ${platform}`);
    }

    // Mark as posted — wrap in transaction for consistency
    const postedAt = new Date();
    await db.$transaction([
      db.scheduledPost.update({
        where: { id: scheduledPost.id },
        data: {
          status: 'posted',
          postedAt,
          platformPostId: result.platformPostId ?? null,
        },
      }),
      db.contentItem.update({
        where: { id: contentId },
        data: { status: 'posted' },
      }),
      db.socialAccount.update({
        where: { id: socialAccount.id },
        data: { lastPostAt: postedAt },
      }),
    ]);

    // Release activity lock
    if (scheduledPostForLock?.channel?.socialAccount) {
      const socialId = scheduledPostForLock.channel.socialAccount.id;
      const currentSocial = await db.socialAccount.findUnique({ where: { id: socialId } });
      if (currentSocial) {
        const curMeta = (typeof currentSocial.metadata === 'object' && currentSocial.metadata !== null ? currentSocial.metadata : {}) as Record<string, unknown>;
        const { activityLock: _, ...restMeta } = curMeta;
        await db.socialAccount.update({ where: { id: socialId }, data: { metadata: restMeta as any } });
      }
    }

    logger.info({
      contentId,
      channelId,
      platform,
      platformPostId: result.platformPostId,
      platformUrl: result.platformUrl,
    }, 'Content posted successfully');

    return {
      scheduledPostId: scheduledPost.id,
      status: 'posted',
      platformPostId: result.platformPostId,
      platformUrl: result.platformUrl,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const maxAttempts = job.opts.attempts ?? 3;

    await db.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: 'failed',
        errorMessage: errMsg,
        retryCount: job.attemptsMade,
      },
    });

    // Only create failure alert on the final attempt
    if (job.attemptsMade >= maxAttempts) {
      await db.contentItem.update({
        where: { id: contentId },
        data: { status: 'failed' },
      });

      await db.alert.create({
        data: {
          severity: 'warning',
          category: 'content',
          title: `Posting failed after ${job.attemptsMade} attempts`,
          message: `Content "${scheduledPost.content.title}" failed to post to ${platform}: ${errMsg}`,
          source: 'posting-worker',
          tenantId: scheduledPost.channel.socialAccount.emailAccount.tenantId ?? undefined,
          metadata: { contentId, channelId, platform, error: errMsg },
        },
      });
    }

    throw error;
  }
}

async function checkScheduledPosts() {
  try {
    const db = getDb();

    const duePosts = await db.scheduledPost.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        status: 'scheduled',
      },
      include: {
        content: true,
        channel: { include: { socialAccount: true } },
      },
      take: 100,
    });

    if (duePosts.length === 0) {
      return;
    }

    for (const post of duePosts) {
      await addJob('posting', 'posting:publish', {
        scheduledPostId: post.id,
        contentId: post.contentId,
        channelId: post.channelId,
        platform: post.platform,
      } as PostingPublishJob, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      });

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'queued' },
      });
    }

    logger.info({ count: duePosts.length }, 'Enqueued scheduled posts for publishing');
  } catch (err) {
    logger.error({ err }, 'Failed to check scheduled posts');
  }
}

async function handleSchedule(data: PostingScheduleJob) {
  const db = getDb();

  const content = await db.contentItem.findUnique({
    where: { id: data.contentId },
    include: { channel: { include: { socialAccount: true } } },
  });

  if (!content) {
    logger.warn({ contentId: data.contentId }, 'Content not found for scheduling');
    return;
  }

  const post = await db.scheduledPost.create({
    data: {
      contentId: data.contentId,
      channelId: data.channelId,
      scheduledAt: new Date(data.scheduledAt),
      platform: data.platform,
      socialAccountId: content.channel.socialAccount.id,
      status: 'scheduled',
    },
  });

  logger.info({ scheduledPostId: post.id, scheduledAt: data.scheduledAt }, 'Post scheduled');
  return { scheduledPostId: post.id, status: 'scheduled' };
}

async function handlePlaylistSync(data: SeriesPlaylistSyncJob) {
  // Stub: YouTube playlist sync will be implemented when YouTube Data API integration is ready
  logger.info({ seriesId: data.seriesId, playlistId: data.youtubePlaylistId }, 'Playlist sync requested (stub)');
  return { status: 'stub', seriesId: data.seriesId };
}

export function startPostingWorker() {
  const worker = createWorker('posting', processPostingJob, {
    concurrency: 1,
    limiter: { max: 5, duration: 60000 },
  });

  // Set up scheduled post checker — runs every 60 seconds
  const postingQueue = getQueue('posting');
  postingQueue.add('posting:check-scheduled', {} as any, {
    repeat: { every: 60000 },
    removeOnComplete: true,
    removeOnFail: 100,
  }).catch((err: unknown) => logger.error({ err }, 'Failed to register posting:check-scheduled repeatable job'));

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Posting job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Posting job failed');
  });

  logger.info('Posting worker started');
  return worker;
}
