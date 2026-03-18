import { createLogger } from '@airevstream/shared';

const logger = createLogger('platform-adapters');

export interface PostContent {
  title: string;
  description: string;
  videoUrl?: string;
  imageUrl?: string;
  tags?: string[];
  thumbnailUrl?: string;
  scheduledAt?: string;
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  channelId?: string;
  pageId?: string;
}

/**
 * Abstract base for platform posting adapters.
 * Each platform implements its own publish() method.
 */
abstract class BasePlatformAdapter {
  protected logger = logger;
  abstract readonly platform: string;
  abstract publish(content: PostContent, credentials: PlatformCredentials): Promise<PostResult>;
}

/**
 * YouTube adapter using Data API v3.
 * Handles video upload via resumable upload protocol.
 */
export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = 'youtube';
  private readonly API_BASE = 'https://www.googleapis.com/youtube/v3';
  private readonly UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

  async publish(content: PostContent, credentials: PlatformCredentials): Promise<PostResult> {
    this.logger.info({ title: content.title }, 'Publishing to YouTube');

    if (!content.videoUrl) {
      return { success: false, error: 'Video URL required for YouTube upload' };
    }

    try {
      // Step 1: Initialize resumable upload
      const metadata = {
        snippet: {
          title: content.title,
          description: content.description,
          tags: content.tags ?? [],
          categoryId: '22', // People & Blogs default
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      };

      const initRes = await fetch(
        `${this.UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        return { success: false, error: `YouTube init failed (${initRes.status}): ${errText}` };
      }

      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) {
        return { success: false, error: 'No upload URL returned from YouTube' };
      }

      // Step 2: Download video and upload to YouTube
      const videoRes = await fetch(content.videoUrl, { signal: AbortSignal.timeout(120_000) });
      if (!videoRes.ok) {
        return { success: false, error: `Failed to download video from ${content.videoUrl}` };
      }

      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBuffer.length),
        },
        body: videoBuffer,
        signal: AbortSignal.timeout(600_000), // 10 min for large uploads
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        return { success: false, error: `YouTube upload failed (${uploadRes.status}): ${errText}` };
      }

      const result = await uploadRes.json() as { id: string };
      const videoUrl = `https://www.youtube.com/watch?v=${result.id}`;

      this.logger.info({ videoId: result.id, url: videoUrl }, 'YouTube upload successful');

      // Step 3: Set thumbnail if provided
      if (content.thumbnailUrl) {
        await this.setThumbnail(credentials.accessToken, result.id, content.thumbnailUrl);
      }

      return { success: true, platformPostId: result.id, platformUrl: videoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'YouTube publish failed');
      return { success: false, error: msg };
    }
  }

  private async setThumbnail(accessToken: string, videoId: string, thumbnailUrl: string): Promise<void> {
    try {
      const thumbRes = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(30_000) });
      if (!thumbRes.ok) return;
      const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());

      await fetch(
        `${this.UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'image/png',
          },
          body: thumbBuffer,
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (error) {
      this.logger.warn({ error, videoId }, 'Failed to set YouTube thumbnail');
    }
  }
}

/**
 * TikTok adapter using Content Posting API.
 */
export class TikTokAdapter extends BasePlatformAdapter {
  readonly platform = 'tiktok';
  private readonly API_BASE = 'https://open.tiktokapis.com/v2';

  async publish(content: PostContent, credentials: PlatformCredentials): Promise<PostResult> {
    this.logger.info({ title: content.title }, 'Publishing to TikTok');

    if (!content.videoUrl) {
      return { success: false, error: 'Video URL required for TikTok upload' };
    }

    try {
      // Step 1: Init video upload
      const initRes = await fetch(`${this.API_BASE}/post/publish/video/init/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: content.title.slice(0, 150),
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: content.videoUrl,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!initRes.ok) {
        const errText = await initRes.text();
        return { success: false, error: `TikTok init failed (${initRes.status}): ${errText}` };
      }

      const initData = await initRes.json() as { data: { publish_id: string } };
      const publishId = initData.data?.publish_id;

      if (!publishId) {
        return { success: false, error: 'No publish_id returned from TikTok' };
      }

      // Step 2: Poll for completion (TikTok processes async)
      let status = 'PROCESSING_UPLOAD';
      let attempts = 0;
      while (status === 'PROCESSING_UPLOAD' && attempts < 30) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`${this.API_BASE}/post/publish/status/fetch/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publish_id: publishId }),
          signal: AbortSignal.timeout(10_000),
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json() as { data: { status: string } };
          status = statusData.data?.status ?? 'UNKNOWN';
        }
        attempts++;
      }

      if (status === 'PUBLISH_COMPLETE') {
        this.logger.info({ publishId }, 'TikTok upload successful');
        return { success: true, platformPostId: publishId };
      }

      return { success: false, error: `TikTok upload status: ${status}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'TikTok publish failed');
      return { success: false, error: msg };
    }
  }
}

/**
 * Instagram adapter using Instagram Graph API.
 * Handles Reels (video) and Feed posts (images).
 */
export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = 'instagram';
  private readonly API_BASE = 'https://graph.instagram.com/v18.0';

  async publish(content: PostContent, credentials: PlatformCredentials): Promise<PostResult> {
    this.logger.info({ title: content.title }, 'Publishing to Instagram');

    try {
      const igUserId = credentials.channelId ?? 'me';

      if (content.videoUrl) {
        return await this.publishReel(igUserId, content, credentials);
      }
      if (content.imageUrl) {
        return await this.publishImage(igUserId, content, credentials);
      }

      return { success: false, error: 'Either videoUrl or imageUrl required for Instagram' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Instagram publish failed');
      return { success: false, error: msg };
    }
  }

  private async publishReel(
    userId: string,
    content: PostContent,
    credentials: PlatformCredentials,
  ): Promise<PostResult> {
    // Step 1: Create media container
    const createRes = await fetch(`${this.API_BASE}/${userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: content.videoUrl,
        caption: `${content.title}\n\n${content.description}${content.tags ? '\n\n' + content.tags.map(t => `#${t}`).join(' ') : ''}`,
        access_token: credentials.accessToken,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, error: `Instagram container creation failed: ${errText}` };
    }

    const containerData = await createRes.json() as { id: string };
    const containerId = containerData.id;

    // Step 2: Wait for container to be ready
    await new Promise(r => setTimeout(r, 10_000));

    // Step 3: Publish the container
    const publishRes = await fetch(`${this.API_BASE}/${userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: credentials.accessToken,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      return { success: false, error: `Instagram publish failed: ${errText}` };
    }

    const publishData = await publishRes.json() as { id: string };
    return {
      success: true,
      platformPostId: publishData.id,
      platformUrl: `https://www.instagram.com/reel/${publishData.id}/`,
    };
  }

  private async publishImage(
    userId: string,
    content: PostContent,
    credentials: PlatformCredentials,
  ): Promise<PostResult> {
    const createRes = await fetch(`${this.API_BASE}/${userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: content.imageUrl,
        caption: `${content.title}\n\n${content.description}`,
        access_token: credentials.accessToken,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, error: `Instagram image creation failed: ${errText}` };
    }

    const containerData = await createRes.json() as { id: string };
    await new Promise(r => setTimeout(r, 5_000));

    const publishRes = await fetch(`${this.API_BASE}/${userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: credentials.accessToken,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      return { success: false, error: `Instagram publish failed: ${errText}` };
    }

    const publishData = await publishRes.json() as { id: string };
    return { success: true, platformPostId: publishData.id };
  }
}

/**
 * Facebook adapter using Graph API.
 * Handles Page posts (text, image, video).
 */
export class FacebookAdapter extends BasePlatformAdapter {
  readonly platform = 'facebook';
  private readonly API_BASE = 'https://graph.facebook.com/v18.0';

  async publish(content: PostContent, credentials: PlatformCredentials): Promise<PostResult> {
    this.logger.info({ title: content.title }, 'Publishing to Facebook');

    const pageId = credentials.pageId ?? credentials.channelId;
    if (!pageId) {
      return { success: false, error: 'Facebook Page ID required' };
    }

    try {
      if (content.videoUrl) {
        return await this.publishVideo(pageId, content, credentials);
      }
      return await this.publishPost(pageId, content, credentials);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: msg }, 'Facebook publish failed');
      return { success: false, error: msg };
    }
  }

  private async publishVideo(
    pageId: string,
    content: PostContent,
    credentials: PlatformCredentials,
  ): Promise<PostResult> {
    const res = await fetch(`${this.API_BASE}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: content.videoUrl,
        title: content.title,
        description: content.description,
        access_token: credentials.accessToken,
      }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Facebook video upload failed: ${errText}` };
    }

    const data = await res.json() as { id: string };
    return {
      success: true,
      platformPostId: data.id,
      platformUrl: `https://www.facebook.com/${pageId}/videos/${data.id}`,
    };
  }

  private async publishPost(
    pageId: string,
    content: PostContent,
    credentials: PlatformCredentials,
  ): Promise<PostResult> {
    const body: Record<string, unknown> = {
      message: `${content.title}\n\n${content.description}`,
      access_token: credentials.accessToken,
    };
    if (content.imageUrl) body.link = content.imageUrl;

    const res = await fetch(`${this.API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Facebook post failed: ${errText}` };
    }

    const data = await res.json() as { id: string };
    return {
      success: true,
      platformPostId: data.id,
      platformUrl: `https://www.facebook.com/${data.id}`,
    };
  }
}

/** Factory: get the right adapter for a platform. */
export function getAdapter(platform: string): BasePlatformAdapter {
  switch (platform.toLowerCase()) {
    case 'youtube': return new YouTubeAdapter();
    case 'tiktok': return new TikTokAdapter();
    case 'instagram': return new InstagramAdapter();
    case 'facebook': return new FacebookAdapter();
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}
