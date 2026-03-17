import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addJob } from '@airevstream/queue';

const generateImageSchema = z.object({
  contentId: z.string(),
  workflow: z.enum(['character', 'upscale', 'style', 'environment']),
  params: z.record(z.unknown()).optional(),
});

export async function imageRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Queue image generation
  app.post('/generate', async (request, reply) => {
    const parsed = generateImageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const { contentId, workflow, params } = parsed.data;

    const job = await addJob('production', 'production:generate-image', {
      contentId,
      workflowId: workflow,
      params: params ?? {},
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, status: 'queued' },
    });
  });

  // Get ComfyUI status (placeholder — requires ComfyUI running)
  app.get('/comfyui/status', async (_request, reply) => {
    const comfyuiUrl = process.env.COMFYUI_BASE_URL ?? 'http://localhost:8188';
    try {
      const response = await fetch(`${comfyuiUrl}/system_stats`);
      if (response.ok) {
        const stats = await response.json();
        return reply.send({ success: true, data: { status: 'connected', stats } });
      }
      return reply.send({ success: true, data: { status: 'error', message: 'ComfyUI returned non-OK' } });
    } catch {
      return reply.send({ success: true, data: { status: 'disconnected', message: 'ComfyUI not reachable' } });
    }
  });
}
