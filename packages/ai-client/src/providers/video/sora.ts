import type { VideoProvider, VideoGenRequest, VideoGenResult, VideoJobStatus } from './types.js';

/**
 * OpenAI Sora Video Provider
 *
 * Generates video via OpenAI's Sora API.
 * Requires OPENAI_API_KEY environment variable.
 */
export class SoraProvider implements VideoProvider {
  readonly name = 'OpenAI Sora';
  readonly providerType = 'sora';

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = baseUrl ?? 'https://api.openai.com/v1';
  }

  async generateVideo(request: VideoGenRequest): Promise<VideoGenResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body: Record<string, unknown> = {
      model: request.model ?? 'sora',
      prompt: request.prompt,
      duration: request.duration ?? 10,
      resolution: request.resolution ?? '1080p',
      aspect_ratio: request.aspectRatio ?? '16:9',
    };

    if (request.negativePrompt) {
      body.negative_prompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const res = await fetch(`${this.baseUrl}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error');
      throw new Error(`Sora API request failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as SoraGenerateResponse;

    return {
      jobId: data.id,
      status: 'queued',
      estimatedWaitMs: (request.duration ?? 10) * 20_000,
    };
  }

  async checkStatus(jobId: string): Promise<VideoJobStatus> {
    if (!this.apiKey) {
      return { jobId, status: 'failed', error: 'API key not configured' };
    }

    const res = await fetch(`${this.baseUrl}/videos/generations/${jobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { jobId, status: 'processing' };
    }

    const data = (await res.json()) as SoraStatusResponse;

    if (data.error) {
      return { jobId, status: 'failed', error: data.error.message };
    }

    if (data.status === 'succeeded' && data.video?.url) {
      return {
        jobId,
        status: 'complete',
        videoUrl: data.video.url,
        durationMs: data.video.duration ? data.video.duration * 1000 : undefined,
        progress: 100,
      };
    }

    if (data.status === 'failed') {
      return { jobId, status: 'failed', error: 'Sora generation failed' };
    }

    return { jobId, status: 'processing' };
  }

  async downloadVideo(jobId: string): Promise<Buffer> {
    const status = await this.checkStatus(jobId);
    if (status.status !== 'complete' || !status.videoUrl) {
      throw new Error(`Video not ready for download: ${status.status}`);
    }

    const res = await fetch(status.videoUrl, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to download Sora video: ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      console.debug(`[Sora] Health check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}

// ─── Internal types for Sora API responses ───

interface SoraGenerateResponse {
  id: string;
  status?: string;
}

interface SoraStatusResponse {
  id: string;
  status: string;
  video?: { url?: string; duration?: number };
  error?: { message?: string };
}
