import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import type { ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chat, createServiceRegistry } from '@airevstream/ai-client';
import type { ChatMessage } from '@airevstream/ai-client';

const ChatSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(10000),
  contextPage: z.string().max(100).optional().nullable(),
});

/**
 * POST /api/v1/assistant/chat
 * Send a message to the AI assistant with rich context injection.
 *
 * Body: { conversationId?, message, contextPage? }
 * Header: x-context-page (optional, current page the user is viewing)
 *
 * If no conversationId, creates a new conversation.
 * Creates ConversationMessage records, injects system context, and forwards to AI service.
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`chat:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many chat requests', 429);
  }

  try {
    const body = await req.json();
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { conversationId, message, contextPage: bodyContextPage } = parsed.data;

    // Resolve context page: header takes precedence, then body, then existing conversation
    const headerContextPage = req.headers.get('x-context-page');
    const contextPage = headerContextPage ?? bodyContextPage ?? null;

    let conversation;

    if (!ctx.tenantId) {
      return error('FORBIDDEN', 'No tenant context', 403);
    }

    if (conversationId) {
      // Use existing conversation — validate tenant ownership
      conversation = await ctx.db.conversation.findFirst({
        where: { id: conversationId, tenantId: ctx.tenantId },
      });
      if (!conversation) {
        return validationError('Conversation not found');
      }
    } else {
      // Create new conversation
      const title = message.slice(0, 100) + (message.length > 100 ? '...' : '');
      conversation = await ctx.db.conversation.create({
        data: {
          tenantId: ctx.tenantId,
          title,
          contextPage: contextPage ?? null,
        },
      });
    }

    // Create user message
    const userMessage = await ctx.db.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message.trim(),
      },
    });

    // Build context injection in parallel with history retrieval
    const [history, systemContext] = await Promise.all([
      // Get conversation history for context
      ctx.db.conversationMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        take: 50, // Limit context window
      }),
      // Build the system context block
      buildSystemContext(ctx, contextPage, message.trim()),
    ]);

    // Inject system context as the first message in the conversation if it doesn't already have one
    const hasSystemMessage = history.some((m) => m.role === 'system');
    if (!hasSystemMessage && systemContext) {
      await ctx.db.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'system',
          content: systemContext,
        },
      });
    } else if (systemContext) {
      // Update the existing system message with fresh context
      const existingSystemMsg = history.find((m) => m.role === 'system');
      if (existingSystemMsg) {
        await ctx.db.conversationMessage.update({
          where: { id: existingSystemMsg.id },
          data: { content: systemContext },
        });
      }
    }

    // Find an active text AI service to forward the request
    const aiService = await ctx.db.aiService.findFirst({
      where: { serviceType: 'text', status: 'active' },
      orderBy: [{ fallbackOrder: 'asc' }, { healthScore: 'desc' }],
    });

    // Build ChatMessage array from existing history (avoid redundant DB query)
    // Update or insert system message in the in-memory list
    const updatedHistory = [...history];
    if (systemContext) {
      const systemIdx = updatedHistory.findIndex((m) => m.role === 'system');
      if (systemIdx >= 0) {
        updatedHistory[systemIdx] = { ...updatedHistory[systemIdx], content: systemContext };
      } else {
        updatedHistory.unshift({ role: 'system', content: systemContext } as typeof history[0]);
      }
    }

    const chatMessages: ChatMessage[] = updatedHistory.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    // Generate assistant response via AI
    let assistantContent: string;
    let tokensUsed: number | null = null;
    let modelUsed: string | null = null;

    if (aiService) {
      try {
        // Try service registry first for multi-provider support
        const registry = createServiceRegistry(ctx.db);
        const result = await registry.generate({
          type: 'text',
          task: 'chat',
          prompt: message.trim(),
          messages: chatMessages,
          systemPrompt: systemContext || undefined,
        });
        assistantContent = result.content;
        tokensUsed = result.tokensUsed ?? null;
        modelUsed = result.model;
      } catch (registryErr) {
        console.error('Service registry chat failed, falling back to Ollama:', registryErr);
        // Fall back to direct Ollama chat
        try {
          const result = await chat(chatMessages);
          assistantContent = result.content;
          tokensUsed = (result.promptTokens ?? 0) + (result.completionTokens ?? 0) || null;
          modelUsed = result.model;
        } catch (aiErr) {
          console.error('AI chat call failed:', aiErr);
          assistantContent = 'I apologize, but I\'m unable to connect to the AI service right now. Please check that your AI service (e.g., Ollama) is running and try again.';
        }
      }
    } else {
      assistantContent = 'No active AI text service is configured. Please add an AI service in Settings > AI Services.';
    }

    const assistantMessage = await ctx.db.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantContent,
        tokensUsed,
      },
    });

    // Update conversation message count and model
    await ctx.db.conversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: { increment: 2 },
        modelUsed: modelUsed ?? aiService?.name ?? null,
        contextPage: contextPage ?? conversation.contextPage,
      },
    });

    // Log usage
    if (aiService) {
      await ctx.db.aiServiceUsage.create({
        data: {
          serviceId: aiService.id,
          requestType: 'chat',
          tokensUsed,
          cost: null,
          success: !!modelUsed,
        },
      });
    }

    return success({
      conversationId: conversation.id,
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
      context: {
        page: contextPage,
        injected: !!systemContext,
      },
      messageCount: history.length + 1, // +1 for the new assistant message
    });
  } catch (err) {
    console.error('POST /api/v1/assistant/chat error:', err);
    return error('INTERNAL_ERROR', 'Failed to process chat message', 500);
  }
}

// ---------------------------------------------------------------------------
// Context injection builder
// ---------------------------------------------------------------------------

/**
 * Build a system context block to inject into the conversation.
 * Gathers real-time data about the system state to give the AI assistant
 * situational awareness.
 */
async function buildSystemContext(
  ctx: ApiContext,
  contextPage: string | null,
  userMessage: string,
): Promise<string> {
  try {
    // Run all context queries in parallel for speed
    const [
      alertsData,
      activeWorkflowCount,
      contentQueueStats,
      knowledgeResults,
    ] = await Promise.all([
      // Recent alerts: count + top 3
      getAlertsContext(ctx),

      // Active workflow count
      ctx.db.workflowJob.count({
        where: { status: { in: ['queued', 'running'] } },
      }),

      // Content queue stats
      getContentQueueStats(ctx),

      // Knowledge base entries relevant to user's question
      getRelevantKnowledge(ctx, userMessage),
    ]);

    // Build the system context block
    const sections: string[] = [];

    sections.push('=== SYSTEM CONTEXT (auto-injected) ===');
    sections.push(`Timestamp: ${new Date().toISOString()}`);

    // Current page context
    if (contextPage) {
      sections.push(`\nUser is currently viewing: ${contextPage}`);
    }

    // Alerts
    sections.push(`\n--- Alerts ---`);
    sections.push(`Open alerts: ${alertsData.totalOpen}`);
    if (alertsData.topAlerts.length > 0) {
      sections.push('Recent alerts:');
      for (const alert of alertsData.topAlerts) {
        sections.push(`  - [${alert.severity.toUpperCase()}] ${alert.title}${alert.message ? ': ' + alert.message : ''}`);
      }
    }

    // Active workflows
    sections.push(`\n--- Workflows ---`);
    sections.push(`Active workflows: ${activeWorkflowCount}`);

    // Content queue
    sections.push(`\n--- Content Queue ---`);
    sections.push(`Pending: ${contentQueueStats.pending}`);
    sections.push(`Generating: ${contentQueueStats.generating}`);
    sections.push(`Approved: ${contentQueueStats.approved}`);
    sections.push(`Total draft/in-progress: ${contentQueueStats.pending + contentQueueStats.generating}`);

    // Knowledge base results
    if (knowledgeResults.length > 0) {
      sections.push(`\n--- Relevant Knowledge ---`);
      for (const entry of knowledgeResults) {
        const snippet = entry.content.length > 200
          ? entry.content.slice(0, 200) + '...'
          : entry.content;
        sections.push(`[${entry.domain}] ${entry.title}`);
        sections.push(`  ${snippet}`);
      }
    }

    sections.push('\n=== END SYSTEM CONTEXT ===');

    return sections.join('\n');
  } catch (err) {
    console.error('buildSystemContext error:', err);
    // Gracefully degrade -- return minimal context if something fails
    return `=== SYSTEM CONTEXT (auto-injected) ===\nTimestamp: ${new Date().toISOString()}\nContext build partially failed. Proceed with the user's question.\n=== END SYSTEM CONTEXT ===`;
  }
}

/**
 * Get alert context: total open count and top 3 recent alerts.
 * Alerts are system-level (no tenantId on Alert model) — intentional.
 * All tenants see system health alerts (e.g. service outages, resource issues).
 */
async function getAlertsContext(ctx: ApiContext) {
  const [totalOpen, topAlerts] = await Promise.all([
    ctx.db.alert.count({
      where: { status: { in: ['open', 'acknowledged'] } },
    }),
    ctx.db.alert.findMany({
      where: { status: { in: ['open', 'acknowledged'] } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        severity: true,
        title: true,
        message: true,
        category: true,
        createdAt: true,
      },
    }),
  ]);

  return { totalOpen, topAlerts };
}

/**
 * Get content queue statistics by status.
 */
async function getContentQueueStats(ctx: ApiContext) {
  // tenantId is guaranteed non-null by the route handler guard
  const tenantChannelFilter = ctx.tenantId
    ? { channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } } }
    : {};

  const statusCounts = await ctx.db.contentItem.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      status: { in: ['draft', 'generating', 'generated', 'pending_approval', 'approved'] },
      ...tenantChannelFilter,
    },
  });

  const countMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.id]),
  );

  return {
    pending: (countMap['draft'] ?? 0) + (countMap['pending_approval'] ?? 0),
    generating: countMap['generating'] ?? 0,
    approved: (countMap['approved'] ?? 0) + (countMap['generated'] ?? 0),
  };
}

/**
 * Find knowledge base entries relevant to the user's question.
 * Uses simple keyword matching on title and content fields.
 * Returns top 3 results sorted by relevance score.
 *
 * Note: KnowledgeBaseEntry does not have tenantId (KI-020). Entries are
 * shared across all tenants until the schema is migrated.
 */
async function getRelevantKnowledge(
  ctx: ApiContext,
  userMessage: string,
) {
  // Extract meaningful keywords (3+ chars, skip common stop words)
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
    'than', 'its', 'over', 'such', 'that', 'this', 'with', 'will', 'each',
    'from', 'they', 'what', 'how', 'who', 'which', 'their', 'about', 'would',
    'make', 'like', 'just', 'into', 'could', 'time', 'very', 'when', 'come',
    'there', 'also', 'more', 'should', 'does', 'please', 'help',
  ]);

  const keywords = userMessage
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (keywords.length === 0) {
    return [];
  }

  // Build OR conditions for each keyword
  const orConditions = keywords.slice(0, 5).flatMap((keyword) => [
    { title: { contains: keyword, mode: 'insensitive' as const } },
    { content: { contains: keyword, mode: 'insensitive' as const } },
  ]);

  const entries = await ctx.db.knowledgeBaseEntry.findMany({
    where: {
      isCurrent: true,
      OR: orConditions,
    },
    orderBy: { relevanceScore: 'desc' },
    take: 3,
    select: {
      domain: true,
      title: true,
      content: true,
      relevanceScore: true,
    },
  });

  return entries;
}
