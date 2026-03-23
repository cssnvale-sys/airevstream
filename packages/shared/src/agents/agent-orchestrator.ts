/**
 * Agent Orchestrator
 *
 * Manages the execution of specialized cinema agents through a task graph.
 * Runs agents in phases (respecting dependencies), handles QC gates,
 * and manages pipeline state.
 */

import type {
  AgentRole,
  AgentTask,
  AgentPipelineState,
  AgentTaskStatus,
  ComplexityMode,
  DirectorInput,
  DirectorOutput,
  LookDevInput,
  LookDevOutput,
  ShotSpecInput,
  ShotSpecOutput,
  DialogueInput,
  DialogueOutput,
  SoundInput,
  SoundOutput,
  RenderInput,
  RenderOutput,
  FinishingInput,
  FinishingOutput,
} from './agent-types.js';
import { AGENT_CONFIGS, getExecutionOrder, getAgentPromptForMode } from './agent-prompts.js';

// ─── Agent Runner Interface ───

/**
 * Interface for running an agent. Implementations provide the actual AI call
 * (e.g., via ServiceRegistry, direct Ollama call, or mock for testing).
 */
export interface AgentRunner {
  run(
    role: AgentRole,
    systemPrompt: string,
    input: unknown,
  ): Promise<unknown>;
}

// ─── QC Gate Interface ───

export interface QCGateResult {
  passed: boolean;
  score: number;
  issues: string[];
}

export interface QCGate {
  evaluate(role: AgentRole, output: unknown): Promise<QCGateResult>;
}

// ─── Default QC Gate ───

/** Basic QC gate that validates output structure */
export class DefaultQCGate implements QCGate {
  async evaluate(role: AgentRole, output: unknown): Promise<QCGateResult> {
    const config = AGENT_CONFIGS[role];
    if (!config || !output || typeof output !== 'object') {
      return { passed: false, score: 0, issues: ['Invalid output structure'] };
    }

    const outputObj = output as Record<string, unknown>;
    const missing = config.outputSchema.filter(field => !(field in outputObj));

    if (missing.length > 0) {
      return {
        passed: false,
        score: Math.round(((config.outputSchema.length - missing.length) / config.outputSchema.length) * 100),
        issues: missing.map(f => `Missing required field: ${f}`),
      };
    }

    return { passed: true, score: 100, issues: [] };
  }
}

// ─── Orchestrator ───

export interface OrchestratorOptions {
  runner: AgentRunner;
  qcGate?: QCGate;
  maxRetries?: number;
  complexityMode?: ComplexityMode;
  onTaskUpdate?: (role: AgentRole, task: AgentTask) => void;
}

/**
 * Orchestrate the cinema agent pipeline.
 *
 * Execution flow:
 *   Phase 1: Director (creative direction)
 *   Phase 2: LookDev + Dialogue (parallel — both depend only on Director)
 *   Phase 3: ShotSpec (depends on Director + LookDev)
 *   Phase 4: Render + Sound (parallel — Render needs ShotSpec, Sound needs Dialogue + ShotSpec)
 *   Phase 5: Finishing (depends on Render + Dialogue + Sound + LookDev)
 */
export class AgentOrchestrator {
  private runner: AgentRunner;
  private qcGate: QCGate;
  private maxRetries: number;
  private complexityMode: ComplexityMode;
  private onTaskUpdate?: (role: AgentRole, task: AgentTask) => void;

  constructor(options: OrchestratorOptions) {
    this.runner = options.runner;
    this.qcGate = options.qcGate ?? new DefaultQCGate();
    this.maxRetries = options.maxRetries ?? 2;
    this.complexityMode = options.complexityMode ?? 'advanced';
    this.onTaskUpdate = options.onTaskUpdate;
  }

  /**
   * Run the full agent pipeline.
   */
  async execute(input: DirectorInput, contentId: string): Promise<AgentPipelineState> {
    const state: AgentPipelineState = {
      id: `pipeline-${Date.now()}`,
      contentId,
      status: 'running',
      startedAt: new Date().toISOString(),
      tasks: {
        director: createTask('director'),
        lookdev: createTask('lookdev'),
        shotspec: createTask('shotspec'),
        render: createTask('render'),
        dialogue: createTask('dialogue'),
        sound: createTask('sound'),
        finishing: createTask('finishing'),
      },
    };

    const outputs: Partial<Record<AgentRole, unknown>> = {};
    const phases = getExecutionOrder();

    try {
      for (const phase of phases) {
        // Run all agents in this phase concurrently
        const results = await Promise.allSettled(
          phase.map(role => this.runAgent(role, input, outputs, state)),
        );

        // Collect results
        for (let i = 0; i < phase.length; i++) {
          const role = phase[i]!;
          const result = results[i]!;

          if (result.status === 'fulfilled') {
            outputs[role] = result.value;
          } else {
            state.tasks[role].status = 'failed';
            state.tasks[role].error = result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
            this.notifyUpdate(role, state.tasks[role]);

            // If a critical agent fails, abort pipeline
            if (['director', 'shotspec', 'render'].includes(role)) {
              state.status = 'failed';
              state.completedAt = new Date().toISOString();
              return state;
            }

            // In simple mode, skip non-critical agent failures gracefully
            if (this.complexityMode === 'simple' && !['director', 'shotspec', 'render'].includes(role)) {
              state.tasks[role].status = 'skipped';
            }
          }
        }
      }

      state.status = 'completed';
    } catch (err) {
      state.status = 'failed';
    }

    state.completedAt = new Date().toISOString();
    return state;
  }

  /**
   * Run a single agent with QC gate and retries.
   */
  private async runAgent(
    role: AgentRole,
    directorInput: DirectorInput,
    outputs: Partial<Record<AgentRole, unknown>>,
    state: AgentPipelineState,
  ): Promise<unknown> {
    const config = AGENT_CONFIGS[role];
    const task = state.tasks[role];

    // Build input for this agent
    const agentInput = this.buildAgentInput(role, directorInput, outputs);

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    task.input = agentInput;
    state.currentAgent = role;
    this.notifyUpdate(role, task);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const prompt = getAgentPromptForMode(role, this.complexityMode);
        const output = await this.runner.run(role, prompt, agentInput);

        // QC gate check if configured
        if (config.qcGateAfter) {
          const qcResult = await this.qcGate.evaluate(role, output);
          task.qcScore = qcResult.score;
          task.qcPassed = qcResult.passed;

          if (!qcResult.passed && attempt < this.maxRetries) {
            lastError = new Error(`QC gate failed: ${qcResult.issues.join(', ')}`);
            continue;
          }
        }

        task.status = 'completed';
        task.output = output;
        task.completedAt = new Date().toISOString();
        task.durationMs = Date.now() - new Date(task.startedAt!).getTime();
        this.notifyUpdate(role, task);
        return output;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) continue;
      }
    }

    throw lastError ?? new Error(`Agent ${role} failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Build the input payload for an agent based on its dependencies.
   */
  private buildAgentInput(
    role: AgentRole,
    directorInput: DirectorInput,
    outputs: Partial<Record<AgentRole, unknown>>,
  ): unknown {
    switch (role) {
      case 'director':
        return directorInput;

      case 'lookdev':
        return {
          directorOutput: outputs.director as DirectorOutput,
        } satisfies LookDevInput;

      case 'shotspec':
        return {
          directorOutput: outputs.director as DirectorOutput,
          lookDevOutput: outputs.lookdev as LookDevOutput,
        } satisfies ShotSpecInput;

      case 'render':
        return {
          shotSpecOutput: outputs.shotspec as ShotSpecOutput,
          lookDevOutput: outputs.lookdev as LookDevOutput,
          qualityPreset: 'cinema',
        } satisfies RenderInput;

      case 'dialogue':
        return {
          directorOutput: outputs.director as DirectorOutput,
        } satisfies DialogueInput;

      case 'sound':
        return {
          directorOutput: outputs.director as DirectorOutput,
          dialogueOutput: outputs.dialogue as DialogueOutput,
          shotSpecOutput: outputs.shotspec as ShotSpecOutput,
        } satisfies SoundInput;

      case 'finishing':
        return {
          renderOutput: outputs.render as RenderOutput,
          dialogueOutput: outputs.dialogue as DialogueOutput,
          soundOutput: outputs.sound as SoundOutput,
          lookDevOutput: outputs.lookdev as LookDevOutput,
        } satisfies FinishingInput;

      default:
        return {};
    }
  }

  private notifyUpdate(role: AgentRole, task: AgentTask): void {
    this.onTaskUpdate?.(role, { ...task });
  }
}

// ─── Helpers ───

function createTask(role: AgentRole): AgentTask {
  return { role, status: 'pending' };
}
