import { createLogger } from '@airevstream/shared';

const logger = createLogger('comfyui-client');

export interface ComfyUIConfig {
  baseUrl: string;
  timeout?: number;
}

export interface WorkflowResult {
  images: Array<{ filename: string; subfolder: string; type: string }>;
  promptId: string;
}

export class ComfyUIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: Partial<ComfyUIConfig>) {
    this.baseUrl = config?.baseUrl ?? process.env.COMFYUI_URL ?? 'http://localhost:8188';
    this.timeout = config?.timeout ?? 120_000;
  }

  /** Check if ComfyUI server is reachable */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Submit a workflow prompt to ComfyUI and return the prompt ID */
  async queuePrompt(workflow: Record<string, unknown>): Promise<string> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI prompt failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { prompt_id: string };
    logger.info({ promptId: data.prompt_id }, 'Workflow queued');
    return data.prompt_id;
  }

  /** Poll for prompt completion. Returns when done or throws on timeout. */
  async waitForCompletion(promptId: string): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < this.timeout) {
      const res = await fetch(`${this.baseUrl}/history/${promptId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        if (data[promptId]) {
          const entry = data[promptId] as {
            status?: { completed?: boolean; status_str?: string };
          };
          if (entry.status?.completed || entry.status?.status_str === 'success') {
            logger.info({ promptId }, 'Workflow completed');
            return;
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`ComfyUI prompt ${promptId} timed out after ${this.timeout}ms`);
  }

  /** Get the output images for a completed prompt */
  async getOutputImages(promptId: string): Promise<WorkflowResult> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Failed to get history for prompt ${promptId}`);

    const data = (await res.json()) as Record<string, any>;
    const entry = data[promptId];
    if (!entry?.outputs) throw new Error(`No outputs for prompt ${promptId}`);

    const images: Array<{ filename: string; subfolder: string; type: string }> = [];
    for (const nodeId of Object.keys(entry.outputs)) {
      const nodeOutput = entry.outputs[nodeId];
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          images.push({
            filename: img.filename,
            subfolder: img.subfolder ?? '',
            type: img.type ?? 'output',
          });
        }
      }
    }

    return { images, promptId };
  }

  /** Download an image from ComfyUI by filename */
  async downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type });
    const res = await fetch(`${this.baseUrl}/view?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Failed to download image ${filename}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Full pipeline: queue -> wait -> get images -> download all */
  async generateImages(
    workflow: Record<string, unknown>,
  ): Promise<Array<{ filename: string; data: Buffer }>> {
    const promptId = await this.queuePrompt(workflow);
    await this.waitForCompletion(promptId);
    const result = await this.getOutputImages(promptId);

    const downloads: Array<{ filename: string; data: Buffer }> = [];
    for (const img of result.images) {
      const data = await this.downloadImage(img.filename, img.subfolder, img.type);
      downloads.push({ filename: img.filename, data });
    }

    logger.info({ promptId, imageCount: downloads.length }, 'All images downloaded');
    return downloads;
  }
}
