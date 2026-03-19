import type { VideoProvider, VideoGenRequest, VideoGenResult, VideoJobStatus } from './types.js';

/**
 * ComfyUI Video Provider
 *
 * Generates video via AnimateDiff or Stable Video Diffusion through ComfyUI.
 * Requires ComfyUI with AnimateDiff or SVD nodes installed.
 */
export class ComfyUIVideoProvider implements VideoProvider {
  readonly name = 'ComfyUI Video';
  readonly providerType = 'comfyui';

  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl ?? process.env.COMFYUI_URL ?? 'http://localhost:8188';
    this.timeoutMs = timeoutMs ?? 300_000; // 5 min default for video
  }

  async generateVideo(request: VideoGenRequest): Promise<VideoGenResult> {
    const workflow = this.buildAnimateDiffWorkflow(request);

    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error');
      throw new Error(`ComfyUI video prompt failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as { prompt_id: string };
    return {
      jobId: data.prompt_id,
      status: 'queued',
    };
  }

  async checkStatus(jobId: string): Promise<VideoJobStatus> {
    const res = await fetch(`${this.baseUrl}/history/${jobId}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { jobId, status: 'processing' };
    }

    const data = (await res.json()) as Record<string, HistoryEntry>;
    const entry = data[jobId];

    if (!entry) {
      return { jobId, status: 'processing' };
    }

    if (entry.status?.completed || entry.status?.status_str === 'success') {
      // Find video output in the node outputs
      const videoUrl = this.extractVideoOutput(entry.outputs);
      return {
        jobId,
        status: 'complete',
        videoUrl,
        progress: 100,
      };
    }

    if (entry.status?.status_str === 'error') {
      return {
        jobId,
        status: 'failed',
        error: 'ComfyUI workflow execution failed',
      };
    }

    return { jobId, status: 'processing' };
  }

  async downloadVideo(jobId: string): Promise<Buffer> {
    const status = await this.checkStatus(jobId);
    if (status.status !== 'complete' || !status.videoUrl) {
      throw new Error(`Video not ready for download: ${status.status}`);
    }

    const res = await fetch(status.videoUrl, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to download video: ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private buildAnimateDiffWorkflow(request: VideoGenRequest): Record<string, unknown> {
    const frames = Math.round((request.duration ?? 4) * (request.fps ?? 24));

    return {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: request.model ?? 'sd_xl_base_1.0.safetensors' },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: { text: request.prompt, clip: ['1', 1] },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: request.negativePrompt ?? 'worst quality, blurry', clip: ['1', 1] },
      },
      '4': {
        class_type: 'ADE_AnimateDiffLoaderWithContext',
        inputs: {
          model: ['1', 0],
          model_name: 'AnimateDiff_v2.safetensors',
          context_options: null,
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: request.aspectRatio === '9:16' ? 576 : 1024,
          height: request.aspectRatio === '9:16' ? 1024 : 576,
          batch_size: frames,
        },
      },
      '6': {
        class_type: 'KSampler',
        inputs: {
          model: ['4', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['5', 0],
          seed: request.seed ?? Math.floor(Math.random() * 2147483647),
          steps: 25,
          cfg: 7.5,
          sampler_name: 'dpmpp_2m',
          scheduler: 'karras',
          denoise: 1.0,
        },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: { samples: ['6', 0], vae: ['1', 2] },
      },
      '8': {
        class_type: 'ADE_AnimateDiffCombine',
        inputs: {
          images: ['7', 0],
          frame_rate: request.fps ?? 24,
          format_type: 'video/h264-mp4',
          filename_prefix: 'airevstream_video',
        },
      },
    };
  }

  private extractVideoOutput(outputs: Record<string, NodeOutput>): string | undefined {
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.gifs) {
        for (const gif of nodeOutput.gifs) {
          const params = new URLSearchParams({
            filename: gif.filename,
            subfolder: gif.subfolder ?? '',
            type: gif.type ?? 'output',
          });
          return `${this.baseUrl}/view?${params}`;
        }
      }
      if (nodeOutput.videos) {
        for (const video of nodeOutput.videos) {
          const params = new URLSearchParams({
            filename: video.filename,
            subfolder: video.subfolder ?? '',
            type: video.type ?? 'output',
          });
          return `${this.baseUrl}/view?${params}`;
        }
      }
    }
    return undefined;
  }
}

// ─── Internal types for ComfyUI API responses ───

interface ComfyUIMediaFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

interface NodeOutput {
  gifs?: ComfyUIMediaFile[];
  videos?: ComfyUIMediaFile[];
}

interface HistoryEntry {
  status?: {
    completed?: boolean;
    status_str?: string;
  };
  outputs: Record<string, NodeOutput>;
}
