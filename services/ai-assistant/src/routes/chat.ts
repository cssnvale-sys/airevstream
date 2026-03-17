import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { chat as aiChat, type ChatMessage } from '@airevstream/ai-client';
import { parsePagination, paginate } from '@airevstream/shared';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  model: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an AI content creation assistant for AiRevStream. You help users:
- Plan content strategies across multiple platforms
- Write scripts, captions, and descriptions
- Suggest topics based on trends
- Optimize content for different platforms (YouTube, TikTok, Instagram, Twitter, Facebook)
- Provide creative direction for video and image content
Be concise, creative, and actionable in your responses.`;

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List conversations
  app.get('/conversations', async (request, reply) => {
    const { page, limit } = parsePagination(request.query as any);
    const db = getDb();
    const userId = request.user.sub;

    const [items, total] = await Promise.all([
      db.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      db.conversation.count({ where: { userId } }),
    ]);

    return reply.send({ success: true, data: paginate(items, total, { page, limit }) });
  });

  // Get conversation with messages
  app.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const conversation = await db.conversation.findFirst({
      where: { id, userId: request.user.sub },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    return reply.send({ success: true, data: conversation });
  });

  // Create new conversation
  app.post('/conversations', async (request, reply) => {
    const db = getDb();
    const conversation = await db.conversation.create({
      data: {
        userId: request.user.sub,
        title: 'New conversation',
      },
    });

    return reply.status(201).send({ success: true, data: conversation });
  });

  // Send message to conversation
  app.post('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
    }

    const db = getDb();
    const conversation = await db.conversation.findFirst({
      where: { id, userId: request.user.sub },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    // Save user message
    const userMessage = await db.message.create({
      data: {
        conversationId: id,
        role: 'user',
        content: parsed.data.content,
      },
    });

    // Build message history for AI
    const history: ChatMessage[] = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    history.push({ role: 'user', content: parsed.data.content });

    try {
      const aiResponse = await aiChat(history, {
        model: parsed.data.model,
        systemPrompt: SYSTEM_PROMPT,
      });

      // Save assistant message
      const assistantMessage = await db.message.create({
        data: {
          conversationId: id,
          role: 'assistant',
          content: aiResponse.content,
          metadata: {
            model: aiResponse.model,
            totalDuration: aiResponse.totalDuration,
          },
        },
      });

      // Update conversation title from first message if it's the default
      if (conversation.title === 'New conversation' && conversation.messages.length === 0) {
        const title = parsed.data.content.slice(0, 100);
        await db.conversation.update({ where: { id }, data: { title } });
      }

      return reply.send({
        success: true,
        data: {
          userMessage,
          assistantMessage,
        },
      });
    } catch (error: any) {
      // If Ollama is not available, return a helpful error
      return reply.status(502).send({
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: `AI service unavailable: ${error.message}`,
        },
      });
    }
  });

  // Delete conversation
  app.delete('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.conversation.findFirst({ where: { id, userId: request.user.sub } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    await db.conversation.delete({ where: { id } });
    return reply.status(204).send();
  });
}
