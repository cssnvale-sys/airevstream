import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addJob } from '@airevstream/queue';

const renderVideoSchema = z.object({
  contentId: z.string(),
  compositionId: z.string().default('main'),
  props: z.record(z.unknown()).optional(),
});

const generateAudioSchema = z.object({
  contentId: z.string(),
  text: z.string().min(1),
  voice: z.string().optional(),
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

    const { contentId, compositionId, props } = parsed.data;

    const job = await addJob('production', 'production:render-video', {
      contentId,
      compositionId,
      props: props ?? {},
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

    const { contentId, text, voice } = parsed.data;

    const job = await addJob('production', 'production:generate-audio', {
      contentId,
      text,
      voice,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, status: 'queued' },
    });
  });
}
