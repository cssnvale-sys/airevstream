/**
 * OllamaAgentRunner — implements the AgentRunner interface.
 *
 * Takes a role, system prompt, and input data, calls Ollama to generate
 * structured JSON output, parses it, and returns the result.
 *
 * Uses the ServiceRegistry if available (preferred), otherwise falls back
 * to the legacy generateText function from @airevstream/ai-client.
 */

import type { AgentRunner } from './agent-orchestrator.js';
import type { AgentRole } from './agent-types.js';
import { createLogger } from '../logger.js';

const logger = createLogger('ollama-agent-runner');

// ─── Default outputs for graceful degradation ───

const DEFAULT_OUTPUTS: Record<AgentRole, unknown> = {
  director: {
    concept: 'Auto-generated cinematic content',
    narrative: 'A visually engaging narrative following the H.I.C.C. framework.',
    emotionalArc: ['curiosity', 'tension', 'revelation', 'satisfaction'],
    sections: [
      { type: 'hook', beat: 'curiosity', description: 'Opening hook', durationSec: 5 },
      { type: 'intro', beat: 'tension', description: 'Introduction', durationSec: 10 },
      { type: 'content', beat: 'revelation', description: 'Main content', durationSec: 30 },
      { type: 'cta', beat: 'satisfaction', description: 'Call to action', durationSec: 5 },
    ],
    visualDirection: 'Cinematic, warm tones, natural lighting',
    audioDirection: 'Ambient background with clear narration',
    totalDurationSec: 50,
  },
  lookdev: {
    globalStyle: 'Cinematic documentary',
    colorPalette: ['#2C3E50', '#E74C3C', '#ECF0F1', '#34495E', '#F39C12'],
    lightingScheme: 'Natural golden hour',
    lensKit: ['35mm', '85mm'],
    loraRecommendations: [],
    moodBoard: ['cinematic', 'warm', 'natural', 'documentary'],
    aspectRatio: '16:9',
  },
  shotspec: {
    shots: [
      {
        shotNumber: 1,
        promptBlocks: ['establishing shot', 'cinematic wide angle', 'golden hour lighting'],
        camera: { lens: '35mm', framing: 'wide', movement: 'static', dof: 'deep' },
        lighting: 'natural golden hour',
        duration: 5,
        transition: 'fade',
        beat: 'curiosity',
        generation: { steps: 30, cfg: 7, sampler: 'dpmpp_2m', width: 1920, height: 1080 },
      },
    ],
  },
  render: {
    renderedShots: [],
    qualityReport: { avgScore: 75, failedShots: [] },
  },
  dialogue: {
    tracks: [],
    narrationStyle: 'Documentary narration',
  },
  sound: {
    audioLayers: [],
    masterVolume: 0.8,
    mixNotes: 'Balanced mix with clear narration',
  },
  psychology: {
    hookOptimizations: [],
    ctaRewrites: [],
    emotionalTriggers: [],
    retentionTechniques: [],
    persuasionScore: 60,
  },
  'qc-decision': {
    shotVerdicts: [],
    summary: { approved: 0, softFix: 0, regenerate: 0, escalate: 0 },
    overallVerdict: 'proceed',
    message: 'Auto-approved (no QC data)',
  },
  finishing: {
    colorGrade: { temperature: 0, contrast: 10, saturation: 5 },
    postProcess: { sharpen: 20, filmGrain: 15, vignette: 10 },
    subtitles: [],
    deliveryFormat: { codec: 'h264', width: 1920, height: 1080, fps: 24 },
  },
};

/**
 * Extract JSON from a model response that may contain markdown fences,
 * prose around the JSON, or other wrapping.
 */
function extractJson(content: string): string {
  // Try direct parse first
  const trimmed = content.trim();

  // Strip thinking/reasoning blocks (qwen3 models sometimes emit <think>...</think>)
  const thinkMatch = trimmed.match(/<\/think>\s*([\s\S]*)/);
  const afterThink = thinkMatch ? thinkMatch[1].trim() : trimmed;

  // Check for ```json ... ``` fences
  const fenceMatch = afterThink.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find the first { or [ and last matching } or ]
  const firstBrace = afterThink.indexOf('{');
  const firstBracket = afterThink.indexOf('[');
  let start = -1;
  let endChar = '';

  if (firstBrace === -1 && firstBracket === -1) {
    return afterThink;
  }
  if (firstBrace === -1) {
    start = firstBracket;
    endChar = ']';
  } else if (firstBracket === -1) {
    start = firstBrace;
    endChar = '}';
  } else {
    if (firstBrace < firstBracket) {
      start = firstBrace;
      endChar = '}';
    } else {
      start = firstBracket;
      endChar = ']';
    }
  }

  const lastEnd = afterThink.lastIndexOf(endChar);
  if (lastEnd > start) {
    return afterThink.slice(start, lastEnd + 1);
  }

  return afterThink;
}

/**
 * OllamaAgentRunner — calls Ollama to generate agent output.
 *
 * @param generateFn - A function that calls Ollama (or compatible) with
 *   (prompt, options) and returns { content: string }.
 */
export interface OllamaAgentRunnerOptions {
  /** Function to call the AI model. Defaults to the legacy generateText. */
  generateFn?: (prompt: string, options: {
    systemPrompt?: string;
    format?: 'json';
    temperature?: number;
    maxTokens?: number;
  }) => Promise<{ content: string }>;
  /** Override the model (default: process.env.OLLAMA_DEFAULT_MODEL or 'qwen3:8b') */
  model?: string;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
  /** Max tokens (default: 8192) */
  maxTokens?: number;
}

export class OllamaAgentRunner implements AgentRunner {
  private generateFn: OllamaAgentRunnerOptions['generateFn'];
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: OllamaAgentRunnerOptions = {}) {
    this.generateFn = options.generateFn;
    this.model = options.model ?? process.env.OLLAMA_DEFAULT_MODEL?.trim() ?? 'qwen3:8b';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 8192;
  }

  async run(role: AgentRole, systemPrompt: string, input: unknown): Promise<unknown> {
    const userPrompt = this.buildUserPrompt(role, input);

    logger.info({ role, inputLength: userPrompt.length }, 'Running agent via Ollama');

    try {
      let content: string;

      if (this.generateFn) {
        const result = await this.generateFn(userPrompt, {
          systemPrompt,
          format: 'json',
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        });
        content = result.content;
      } else {
        // Fallback to dynamic import to avoid circular dependency
        const { generateText } = await import('@airevstream/ai-client');
        const result = await generateText(userPrompt, {
          systemPrompt,
          format: 'json',
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        });
        content = result.content;
      }

      // Parse the JSON output
      const jsonStr = extractJson(content);
      const parsed = JSON.parse(jsonStr);

      logger.info({ role, outputKeys: Object.keys(parsed) }, 'Agent completed successfully');
      return parsed;
    } catch (err) {
      logger.warn({ role, err: err instanceof Error ? err.message : String(err) }, 'Agent failed — using default output');
      return DEFAULT_OUTPUTS[role] ?? {};
    }
  }

  /**
   * Build the user prompt from the agent input.
   * The input is the structured payload for this agent's role.
   */
  private buildUserPrompt(role: AgentRole, input: unknown): string {
    const inputStr = JSON.stringify(input, null, 2);
    return `You are the ${role} agent. Process the following input and produce the required JSON output.\n\nINPUT:\n${inputStr}\n\nOutput ONLY valid JSON matching your role's schema. Do not include any text outside the JSON.`;
  }
}