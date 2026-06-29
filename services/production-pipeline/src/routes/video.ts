import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addJob } from '@airevstream/queue';
import { createLogger } from '@airevstream/shared';

const videoLogger = createLogger('production-pipeline:video');

const exportVariantSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  aspect: z.string().optional(),
  codec: z.string().optional(),
});

const renderVideoSchema = z.object({
  contentId: z.string().uuid(),
  storyboardId: z.string().uuid(),
  channelId: z.string().uuid(),
  exportVariant: exportVariantSchema.optional(),
  autoVariants: z.boolean().optional(),
  variantConfigs: z.array(exportVariantSchema).optional(),
});

const generateAudioSchema = z.object({
  contentId: z.string().uuid(),
  text: z.string().min(1),
  voice: z.string().optional(),
  language: z.string().optional(),
});

const createStoryboardSchema = z.object({
  contentId: z.string().uuid(),
  channelId: z.string().uuid(),
  scriptJson: z.record(z.unknown()),
});

export async function videoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Queue video render
  app.post('/render', async (request, reply) => {
    const parsed = renderVideoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    try {
      const job = await addJob('production', 'production:render-video', {
        contentId: parsed.data.contentId,
        storyboardId: parsed.data.storyboardId,
        channelId: parsed.data.channelId,
        ...(parsed.data.exportVariant ? { exportVariant: parsed.data.exportVariant } : {}),
        ...(parsed.data.autoVariants !== undefined ? { autoVariants: parsed.data.autoVariants } : {}),
        ...(parsed.data.variantConfigs ? { variantConfigs: parsed.data.variantConfigs } : {}),
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, status: 'queued' },
      });
    } catch (err) {
      videoLogger.error({ err, contentId: parsed.data.contentId }, 'Failed to queue video render job');
      return reply.status(500).send({
        success: false,
        error: { code: 'QUEUE_ERROR', message: 'Failed to queue video render' },
      });
    }
  });

  // Queue audio generation (TTS)
  app.post('/audio', async (request, reply) => {
    const parsed = generateAudioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    try {
      const job = await addJob('production', 'production:generate-audio', {
        contentId: parsed.data.contentId,
        text: parsed.data.text,
        voice: parsed.data.voice,
        language: parsed.data.language,
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, status: 'queued' },
      });
    } catch (err) {
      videoLogger.error({ err, contentId: parsed.data.contentId }, 'Failed to queue audio generation job');
      return reply.status(500).send({
        success: false,
        error: { code: 'QUEUE_ERROR', message: 'Failed to queue audio generation' },
      });
    }
  });

  // Queue storyboard generation
  app.post('/storyboard', async (request, reply) => {
    const parsed = createStoryboardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    try {
      const job = await addJob('production', 'production:generate-storyboard', {
        contentId: parsed.data.contentId,
        channelId: parsed.data.channelId,
        scriptJson: parsed.data.scriptJson,
      });

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, status: 'queued' },
      });
    } catch (err) {
      videoLogger.error({ err, contentId: parsed.data.contentId }, 'Failed to queue storyboard generation job');
      return reply.status(500).send({
        success: false,
        error: { code: 'QUEUE_ERROR', message: 'Failed to queue storyboard generation' },
      });
    }
  });
}
