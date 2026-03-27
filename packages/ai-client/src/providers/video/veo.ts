import type { VideoProvider, VideoGenRequest, VideoGenResult, VideoJobStatus } from './types.js';

/**
 * Google Veo Video Provider
 *
 * Generates video via Google's Veo API.
 * Requires GOOGLE_VEO_API_KEY environment variable.
 */
export class VeoProvider implements VideoProvider {
  readonly name = 'Google Veo';
  readonly providerType = 'google';

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.GOOGLE_VEO_API_KEY ?? '';
    this.baseUrl = baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async generateVideo(request: VideoGenRequest): Promise<VideoGenResult> {
    if (!this.apiKey) {
      throw new Error('Google Veo API key not configured');
    }

    const modelName = request.model ?? 'veo-2.0-generate-001';

    const body: Record<string, unknown> = {
      model: modelName,
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseModalities: ['VIDEO'],
        videoDuration: `${request.duration ?? 8}s`,
      },
    };

    const generationConfig = body.generationConfig as Record<string, unknown>;

    if (request.aspectRatio) {
      generationConfig.aspectRatio = request.aspectRatio;
    }

    if (request.negativePrompt) {
      generationConfig.negativePrompt = request.negativePrompt;
    }

    const res = await fetch(
      `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error');
      throw new Error(`Veo API request failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as VeoGenerateResponse;
    const jobId = data.name ?? data.operationId ?? `veo-${Date.now()}`;

    return {
      jobId,
      status: 'queued',
      estimatedWaitMs: (request.duration ?? 8) * 15_000, // Rough estimate
    };
  }

  async checkStatus(jobId: string): Promise<VideoJobStatus> {
    if (!this.apiKey) {
      return { jobId, status: 'failed', error: 'API key not configured' };
    }

    const res = await fetch(
      `${this.baseUrl}/operations/${jobId}?key=${this.apiKey}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) {
      return { jobId, status: 'processing' };
    }

    const data = (await res.json()) as VeoOperationResponse;

    if (data.error) {
      return { jobId, status: 'failed', error: data.error.message };
    }

    if (data.done && data.response?.candidates?.[0]?.content?.parts?.[0]) {
      const part = data.response.candidates[0].content.parts[0];
      return {
        jobId,
        status: 'complete',
        videoUrl: part.fileData?.fileUri,
        progress: 100,
      };
    }

    return { jobId, status: 'processing' };
  }

  async downloadVideo(jobId: string): Promise<Buffer> {
    const status = await this.checkStatus(jobId);
    if (status.status !== 'complete' || !status.videoUrl) {
      throw new Error(`Video not ready for download: ${status.status}`);
    }

    const res = await fetch(`${status.videoUrl}?key=${this.apiKey}`, {
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to download Veo video: ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) },
      );
      return res.ok;
    } catch (err) {
      console.debug(`[Veo] Health check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}

// ─── Internal types for Veo API responses ───

interface VeoGenerateResponse {
  name?: string;
  operationId?: string;
}

interface VeoPart {
  videoMetadata?: { videoDuration?: string };
  fileData?: { fileUri?: string };
}

interface VeoOperationResponse {
  done?: boolean;
  response?: {
    candidates?: Array<{
      content?: {
        parts?: VeoPart[];
      };
    }>;
  };
  error?: { message?: string };
}
