import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error } from '@/lib/api-server';
import { ComfyUIClient } from '@airevstream/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/comfyui/models
 * List available ComfyUI models (checkpoints, LoRAs, ControlNets).
 * Returns { available: false } if ComfyUI is not reachable.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const client = new ComfyUIClient();
    const healthy = await client.isHealthy();

    if (!healthy) {
      return success({ available: false, checkpoints: [], loras: [], controlNets: [] });
    }

    const [checkpoints, loras, controlNets] = await Promise.all([
      client.listCheckpoints(),
      client.listLoras(),
      client.listControlNets(),
    ]);

    return success({ available: true, checkpoints, loras, controlNets });
  } catch (err) {
    console.error('GET /api/v1/comfyui/models failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list ComfyUI models', 500);
  }
}
