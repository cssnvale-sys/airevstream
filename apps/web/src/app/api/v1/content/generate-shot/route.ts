import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { addJob } from '@airevstream/queue';

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { shotId, description, channelId, workflowType } = body;

    if (!shotId || !description) {
      return validationError('shotId and description are required');
    }

    // Queue a ComfyUI image generation job via BullMQ
    const job = await addJob('production', 'production:generate-image', {
      shotId,
      channelId: channelId ?? null,
      workflowType: workflowType ?? 'storyboard-frame',
      params: {
        prompt: description,
        shotId,
      },
    });

    return success({
      shotId,
      jobId: job.id,
      status: 'generating',
      message: 'Shot generation queued',
    });
  } catch (err: any) {
    console.error('[POST /content/generate-shot]', err);
    return error('INTERNAL_ERROR', 'Failed to queue shot generation', 500);
  }
}
