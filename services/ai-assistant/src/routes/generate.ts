import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateText, generateJSON } from '@airevstream/ai-client';

const generateScriptSchema = z.object({
  topic: z.string().min(1),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'twitter', 'facebook']),
  contentType: z.enum(['video', 'image', 'text', 'story', 'reel', 'short']),
  tone: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  model: z.string().optional(),
});

const generateIdeasSchema = z.object({
  niche: z.string().min(1),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'twitter', 'facebook']).optional(),
  count: z.number().min(1).max(20).optional(),
  model: z.string().optional(),
});

const generateCaptionSchema = z.object({
  description: z.string().min(1),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'twitter', 'facebook']),
  hashtags: z.boolean().optional(),
  model: z.string().optional(),
});

export async function generateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Generate a content script
  app.post('/script', async (request, reply) => {
    const parsed = generateScriptSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const { topic, platform, contentType, tone, length, model } = parsed.data;
    const prompt = `Write a ${contentType} script for ${platform} about "${topic}".
${tone ? `Tone: ${tone}` : ''}
${length ? `Length: ${length}` : ''}
Include an attention-grabbing hook, main content, and a call to action.
Format the script with clear sections.`;

    try {
      const result = await generateText(prompt, {
        model,
        systemPrompt: 'You are an expert content creator and scriptwriter.',
      });
      return reply.send({ success: true, data: { script: result.content, model: result.model } });
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: { code: 'EXTERNAL_SERVICE_ERROR', message: `AI service unavailable: ${error.message}` },
      });
    }
  });

  // Generate content ideas
  app.post('/ideas', async (request, reply) => {
    const parsed = generateIdeasSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const { niche, platform, count, model } = parsed.data;
    const prompt = `Generate ${count ?? 5} content ideas for the "${niche}" niche${platform ? ` on ${platform}` : ''}.
Return a JSON array of objects with: title, description, contentType, estimatedEngagement (low/medium/high).`;

    try {
      const result = await generateJSON<Array<{
        title: string;
        description: string;
        contentType: string;
        estimatedEngagement: string;
      }>>(prompt, {
        model,
        systemPrompt: 'You are a social media strategist. Return valid JSON only.',
      });
      return reply.send({ success: true, data: { ideas: result } });
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: { code: 'EXTERNAL_SERVICE_ERROR', message: `AI service unavailable: ${error.message}` },
      });
    }
  });

  // Generate a caption
  app.post('/caption', async (request, reply) => {
    const parsed = generateCaptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const { description, platform, hashtags, model } = parsed.data;
    const prompt = `Write a compelling ${platform} caption for: "${description}".
${hashtags ? 'Include relevant hashtags.' : 'Do not include hashtags.'}
Keep it within the platform's character limit.`;

    try {
      const result = await generateText(prompt, {
        model,
        systemPrompt: 'You are a social media copywriter. Write engaging captions.',
      });
      return reply.send({ success: true, data: { caption: result.content, model: result.model } });
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: { code: 'EXTERNAL_SERVICE_ERROR', message: `AI service unavailable: ${error.message}` },
      });
    }
  });
}
