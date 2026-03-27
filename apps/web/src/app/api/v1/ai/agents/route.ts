import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, validationError, forbidden } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  AGENT_CONFIGS,
  AGENT_ROLES,
  getExecutionOrder,
} from '@airevstream/shared';
import type { AgentRole } from '@airevstream/shared';

export const dynamic = 'force-dynamic';

// GET: List all agents and their configurations
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const agents = AGENT_ROLES.map(role => {
    const config = AGENT_CONFIGS[role];
    return {
      role: config.role,
      name: config.name,
      description: config.description,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
      dependsOn: config.dependsOn,
      qcGateAfter: config.qcGateAfter,
    };
  });

  const executionOrder = getExecutionOrder();

  return success({
    agents,
    executionOrder: executionOrder.map((phase, i) => ({
      phase: i + 1,
      agents: phase,
      parallel: phase.length > 1,
    })),
  });
}

// POST: Run a single agent or the full pipeline
const RunAgentSchema = z.object({
  mode: z.enum(['single', 'pipeline']),
  role: z.enum(['director', 'lookdev', 'shotspec', 'render', 'dialogue', 'sound', 'finishing'] as [AgentRole, ...AgentRole[]]).optional(),
  input: z.record(z.unknown()),
  contentId: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role === 'viewer') {
    return forbidden('Viewers cannot perform this action');
  }

  const rl = checkRateLimit(`ai:agents:${ctx.userId}`, RATE_LIMITS.contentGeneration);
  if (!rl.allowed) {
    return error('RATE_LIMITED', 'Too many agent requests. Please try again later.', 429);
  }

  try {
    const body = await req.json();
    const parsed = RunAgentSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const { mode, role, input } = parsed.data;

    if (mode === 'single') {
      if (!role) {
        return error('MISSING_ROLE', 'Role is required for single agent mode', 400);
      }

      const config = AGENT_CONFIGS[role];

      // Return the agent config and input for the client to process
      // (actual AI call happens through the ServiceRegistry on the AI assistant service)
      return success({
        role,
        systemPrompt: config.systemPrompt,
        input,
        outputSchema: config.outputSchema,
        message: `Agent ${config.name} ready — send to AI service for execution`,
      });
    }

    // Pipeline mode — return the full execution plan
    const executionOrder = getExecutionOrder();
    const plan = executionOrder.map((phase, i) => ({
      phase: i + 1,
      agents: phase.map(r => ({
        role: r,
        name: AGENT_CONFIGS[r].name,
        systemPrompt: AGENT_CONFIGS[r].systemPrompt,
        dependsOn: AGENT_CONFIGS[r].dependsOn,
        qcGateAfter: AGENT_CONFIGS[r].qcGateAfter,
      })),
      parallel: phase.length > 1,
    }));

    return success({
      mode: 'pipeline',
      phases: plan,
      input,
      message: 'Pipeline plan generated — execute phases sequentially',
    });
  } catch (err) {
    console.error('[POST /ai/agents]', err);
    return error('INTERNAL_ERROR', 'Failed to process agent request', 500);
  }
}
