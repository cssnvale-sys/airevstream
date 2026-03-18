import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { chat as aiChat, createServiceRegistry, type ChatMessage } from '@airevstream/ai-client';
import { createLogger } from '@airevstream/shared';

const chatLogger = createLogger('ai-assistant:chat');

let _registry: ReturnType<typeof createServiceRegistry> | null = null;
function getRegistry() {
  if (!_registry) {
    try { _registry = createServiceRegistry(getDb()); } catch (err) { chatLogger.warn({ err }, 'Service registry init failed, using legacy AI client'); return null; }
  }
  return _registry;
}

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  model: z.string().optional(),
  contextPage: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an AI assistant for AiRevStream, a multi-platform content automation system. You help the operator:
- Manage 1,200+ email accounts and social media channels
- Plan and generate cinematic content across YouTube, TikTok, Instagram, Facebook
- Monitor system health, account health, and workflow status
- Manage affiliate products and revenue tracking
- Provide strategic content and business advice
You have full awareness of the system state. Be concise, actionable, and proactive in suggestions.`;

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List conversations
  app.get('/conversations', async (request, reply) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;
    const db = getDb();

    const [items, total] = await Promise.all([
      db.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          title: true,
          contextPage: true,
          modelUsed: true,
          messageCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.conversation.count(),
    ]);

    return reply.send({
      success: true,
      data: items,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  });

  // Get conversation with messages
  app.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const conversation = await db.conversation.findUnique({
      where: { id },
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
    const body = request.body as { contextPage?: string } | undefined;
    const db = getDb();

    const conversation = await db.conversation.create({
      data: {
        title: 'New conversation',
        contextPage: body?.contextPage,
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
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    // Save user message
    const userMessage = await db.conversationMessage.create({
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
      let aiContent: string;
      let aiModel: string;
      let tokensUsed: number | null = null;

      const registry = getRegistry();
      if (registry) {
        const result = await registry.generate({
          type: 'text',
          task: 'chat',
          prompt: parsed.data.content,
          messages: history,
          model: parsed.data.model,
          systemPrompt: SYSTEM_PROMPT,
        });
        aiContent = result.content;
        aiModel = result.model;
        tokensUsed = result.tokensUsed ?? null;
      } else {
        const result = await aiChat(history, {
          model: parsed.data.model,
          systemPrompt: SYSTEM_PROMPT,
        });
        aiContent = result.content;
        aiModel = result.model;
        tokensUsed = result.totalDuration ? Math.round(result.totalDuration / 1000) : null;
      }

      // Save assistant message
      const assistantMessage = await db.conversationMessage.create({
        data: {
          conversationId: id,
          role: 'assistant',
          content: aiContent,
          tokensUsed,
        },
      });

      // Update conversation metadata
      await db.conversation.update({
        where: { id },
        data: {
          messageCount: { increment: 2 },
          modelUsed: aiModel,
          ...(conversation.title === 'New conversation' && conversation.messageCount === 0
            ? { title: parsed.data.content.slice(0, 100) }
            : {}),
        },
      });

      return reply.send({
        success: true,
        data: { userMessage, assistantMessage },
      });
    } catch (error) {
      chatLogger.error({ err: error }, 'AI chat service call failed');
      return reply.status(502).send({
        success: false,
        error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'AI service unavailable' },
      });
    }
  });

  // Delete conversation
  app.delete('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const existing = await db.conversation.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    await db.conversation.delete({ where: { id } });
    return reply.status(204).send();
  });

  // List discovered capabilities
  app.get('/capabilities', async (_request, reply) => {
    // Self-discovering architecture: list available system capabilities
    return reply.send({
      success: true,
      data: {
        actions: [
          { type: 'content.generate', tier: 2, description: 'Generate content for a channel' },
          { type: 'content.approve', tier: 2, description: 'Approve pending content' },
          { type: 'content.reject', tier: 2, description: 'Reject content with feedback' },
          { type: 'content.schedule', tier: 2, description: 'Schedule content for posting' },
          { type: 'account.create', tier: 3, description: 'Create new email account' },
          { type: 'account.update', tier: 2, description: 'Update account settings' },
          { type: 'channel.create', tier: 3, description: 'Create new channel identity' },
          { type: 'workflow.start', tier: 2, description: 'Start a workflow job' },
          { type: 'workflow.cancel', tier: 3, description: 'Cancel a running workflow' },
          { type: 'system.health', tier: 1, description: 'Check system health' },
          { type: 'analytics.query', tier: 1, description: 'Query analytics data' },
          { type: 'affiliate.add', tier: 2, description: 'Add affiliate product' },
        ],
      },
    });
  });
}
