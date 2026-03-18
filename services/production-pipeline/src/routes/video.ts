import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addJob } from '@airevstream/queue';

const renderVideoSchema = z.object({
  contentId: z.string().uuid(),
  storyboardId: z.string().uuid(),
  channelId: z.string().uuid(),
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

    const job = await addJob('production', 'production:render-video', {
      contentId: parsed.data.contentId,
      storyboardId: parsed.data.storyboardId,
      channelId: parsed.data.channelId,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, status: 'queued' },
    });
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

    const job = await addJob('production', 'production:storyboard', {
      contentId: parsed.data.contentId,
      channelId: parsed.data.channelId,
      scriptJson: parsed.data.scriptJson,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, status: 'queued' },
    });
  });
}
