// packages/shared/src/comfyui-client.ts

import type { ComfyUIWorkflow } from './comfyui-composer.js';
import { createLogger } from './logger.js';
import { COMFYUI_POLL_INTERVAL_MS } from './constants.js';

const logger = createLogger('comfyui-client');

export interface OutputImage {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ComfyUISystemStats {
  system: {
    os: string;
    python_version: string;
    embedded_python: boolean;
  };
  devices: Array<{
    name: string;
    type: string;
    vram_total: number;
    vram_free: number;
  }>;
}

/**
 * ComfyUI HTTP API Client
 *
 * Manages communication with a ComfyUI server for image/video generation.
 * Extracted from production.worker.ts inline functions.
 */
export class ComfyUIClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl ?? process.env.COMFYUI_URL ?? 'http://localhost:8188';
    this.timeoutMs = timeoutMs ?? 120_000;
  }

  /** Check if ComfyUI server is reachable */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'ComfyUI health check failed');
      return false;
    }
  }

  /** Get system stats (GPU info, memory) */
  async getSystemStats(): Promise<ComfyUISystemStats> {
    const res = await fetch(`${this.baseUrl}/system_stats`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Failed to get system stats: ${res.status}`);
    return (await res.json()) as ComfyUISystemStats;
  }

  /** Queue a workflow prompt for execution */
  async queuePrompt(workflow: ComfyUIWorkflow): Promise<string> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'unable to read response body');
      throw new Error(`ComfyUI prompt failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as { prompt_id: string };
    if (!data.prompt_id) {
      throw new Error('ComfyUI returned response without prompt_id');
    }
    return data.prompt_id;
  }

  /** Poll until a prompt completes or times out */
  async waitForCompletion(promptId: string): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < this.timeoutMs) {
      const res = await fetch(`${this.baseUrl}/history/${promptId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, { status?: { completed?: boolean; status_str?: string } }>;
        if (data[promptId]) {
          const entry = data[promptId];
          if (entry.status?.completed || entry.status?.status_str === 'success') {
            return;
          }
          if (entry.status?.status_str === 'error') {
            throw new Error(`ComfyUI workflow execution failed for prompt ${promptId}`);
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, COMFYUI_POLL_INTERVAL_MS));
    }
    throw new Error(`ComfyUI prompt ${promptId} timed out after ${this.timeoutMs}ms`);
  }

  /** Get output images from a completed prompt */
  async getOutputImages(promptId: string): Promise<OutputImage[]> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Failed to get history for prompt ${promptId}`);
    const data = (await res.json()) as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>;
    const entry = data[promptId];
    if (!entry?.outputs) throw new Error(`No outputs for prompt ${promptId}`);

    const images: OutputImage[] = [];
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
    return images;
  }

  /** Download a single image from ComfyUI */
  async downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type });
    const res = await fetch(`${this.baseUrl}/view?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Failed to download image ${filename}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Queue a workflow, wait for completion, and return output images */
  async queueAndWait(workflow: ComfyUIWorkflow): Promise<OutputImage[]> {
    const promptId = await this.queuePrompt(workflow);
    await this.waitForCompletion(promptId);
    return this.getOutputImages(promptId);
  }

  /** List available checkpoint models */
  async listCheckpoints(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/object_info/CheckpointLoaderSimple`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, { input?: { required?: { ckpt_name?: [string[]] } } }>;
    const info = data.CheckpointLoaderSimple;
    return info?.input?.required?.ckpt_name?.[0] ?? [];
  }

  /** List available LoRA models */
  async listLoras(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/object_info/LoraLoader`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, { input?: { required?: { lora_name?: [string[]] } } }>;
    const info = data.LoraLoader;
    return info?.input?.required?.lora_name?.[0] ?? [];
  }

  /** List available ControlNet models */
  async listControlNets(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/object_info/ControlNetLoader`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, { input?: { required?: { control_net_name?: [string[]] } } }>;
    const info = data.ControlNetLoader;
    return info?.input?.required?.control_net_name?.[0] ?? [];
  }
}
