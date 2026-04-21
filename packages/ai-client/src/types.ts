import type { AiServiceType, AiServiceProvider } from '@airevstream/shared';

// ─── Provider Interface ───

export interface AiProvider {
  readonly name: string;
  readonly providerType: AiServiceProvider;
  readonly supportedTypes: AiServiceType[];

  generateText(request: TextRequest): Promise<TextResponse>;
  generateChat(request: ChatRequest): Promise<TextResponse>;
  streamChat?(request: ChatRequest): AsyncGenerator<StreamChunk>;
  checkHealth(endpoint: string): Promise<HealthCheckResult>;
}

// ─── Request/Response Types ───

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextRequest {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  format?: 'json' | undefined;
  /**
   * Whether to allow the model's internal thinking/reasoning phase (qwen3, deepseek-r1, etc.).
   * Defaults to `false` for latency. Callers that need deep reasoning for complex tasks
   * (planning, multi-step analysis) can set `think: true` explicitly.
   */
  think?: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  format?: 'json' | undefined;
  /**
   * Whether to allow the model's internal thinking/reasoning phase.
   * Defaults to `false`. See TextRequest.think for rationale.
   */
  think?: boolean;
}

export interface TextResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// ─── Service Record (mirrors DB model) ───

export interface ServiceRecord {
  id: string;
  name: string;
  provider: string;
  serviceType: string;
  endpoint: string | null;
  apiKeyEnc: string | null;
  capabilities: Record<string, unknown>;
  rateLimits: Record<string, unknown>;
  costPerUnit: Record<string, unknown>;
  status: string;
  healthScore: number;
  lastHealthCheck: Date | null;
  avgResponseMs: number | null;
  successRate: number | string; // Decimal comes as string from Prisma
  avgQualityScore: number | string | null;
  fallbackOrder: number;
  fallbackGroup: string | null;
  isLocal: boolean;
  isFree: boolean;
}

// ─── Registry Request ───

export interface GenerateRequest {
  type: AiServiceType;
  task: string;
  prompt: string;
  messages?: ChatMessage[];
  systemPrompt?: string;
  channelId?: string;
  contentId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  format?: 'json' | undefined;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
  preferLocal?: boolean;
  preferFree?: boolean;
}

export interface GenerateResponse {
  content: string;
  model: string;
  serviceId: string;
  serviceName: string;
  provider: string;
  tokensUsed?: number;
  durationMs?: number;
  cost?: number;
  attempts: AttemptRecord[];
}

export interface AttemptRecord {
  serviceId: string;
  serviceName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// ─── Circuit Breaker ───

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// ─── Legacy Compat ───

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: 'json' | undefined;
}

export interface GenerateResult {
  content: string;
  model: string;
  totalDuration?: number;
  promptTokens?: number;
  completionTokens?: number;
}
