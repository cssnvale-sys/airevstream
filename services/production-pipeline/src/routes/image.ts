import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addJob } from '@airevstream/queue';
import { createLogger } from '@airevstream/shared';
import { ComfyUIClient } from '../comfyui-client.js';
import { getTemplatePlaceholders, type WorkflowTemplate } from '../template-renderer.js';

const imageLogger = createLogger('production-pipeline:image');
const comfyClient = new ComfyUIClient();

const generateImageSchema = z.object({
  contentId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  shotId: z.string().uuid().optional(),
  workflowType: z.enum(['character', 'upscale', 'style', 'environment', 'thumbnail', 'scenery', 'storyboard']),
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

    try {
      const job = await addJob('production', 'production:generate-image', {
        contentId: parsed.data.contentId,
        channelId: parsed.data.channelId,
        shotId: parsed.data.shotId,
        workflowType: parsed.data.workflowType,
        params: parsed.data.params ?? {},
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, status: 'queued' },
      });
    } catch (err) {
      imageLogger.error({ err, workflowType: parsed.data.workflowType }, 'Failed to queue image generation job');
      return reply.status(500).send({
        success: false,
        error: { code: 'QUEUE_ERROR', message: 'Failed to queue image generation' },
      });
    }
  });

  // Get ComfyUI status
  app.get('/comfyui/status', async (_request, reply) => {
    const healthy = await comfyClient.isHealthy();
    return reply.send({
      success: true,
      data: {
        status: healthy ? 'connected' : 'disconnected',
      },
    });
  });

  // Get template placeholders for a workflow type
  app.get<{ Params: { template: string } }>('/templates/:template/placeholders', async (request, reply) => {
    const { template } = request.params;
    const validTemplates = ['thumbnail-generation', 'scenery-generation', 'avatar-generation', 'storyboard-frame'];
    if (!validTemplates.includes(template)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TEMPLATE', message: `Valid templates: ${validTemplates.join(', ')}` },
      });
    }
    try {
      const placeholders = await getTemplatePlaceholders(template as WorkflowTemplate);
      return reply.send({ success: true, data: { template, placeholders } });
    } catch (error) {
      imageLogger.error({ err: error }, 'Failed to read template placeholders');
      return reply.status(500).send({
        success: false,
        error: { code: 'TEMPLATE_ERROR', message: 'Failed to read template placeholders' },
      });
    }
  });
}
