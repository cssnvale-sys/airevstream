// ─── Re-export types ───
export type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  TextRequest,
  TextResponse,
  ChatRequest,
  HealthCheckResult,
  ServiceRecord,
  GenerateRequest,
  GenerateResponse,
  AttemptRecord,
  CircuitBreakerState,
  AiProvider,
} from './types.js';

// ─── Re-export registry ───
export { ServiceRegistry } from './registry.js';
export type { ServiceFetcher, UsageLogger, ServiceUpdater, KeyDecryptor } from './registry.js';
export { createServiceRegistry } from './create-registry.js';

// ─── Re-export providers ───
export { OllamaProvider } from './providers/ollama.js';
export { OpenAICompatProvider } from './providers/openai-compat.js';
export { HttpProvider } from './providers/http.js';

// ─── Re-export video providers ───
export type {
  VideoProvider,
  VideoGenRequest,
  VideoGenResult,
  VideoJobStatus,
  VideoJobStatusType,
} from './providers/video/index.js';

export { ComfyUIVideoProvider } from './providers/video/index.js';
export { VeoProvider } from './providers/video/index.js';
export { SoraProvider } from './providers/video/index.js';

// ─── Legacy API (backward-compatible) ───
// These functions maintain the original Ollama-only interface for
// existing consumers (ai-assistant, workers, etc.)

import { OllamaProvider } from './providers/ollama.js';
import type { GenerateOptions, GenerateResult, ChatMessage, StreamChunk } from './types.js';

const DEFAULT_MODEL = 'qwen3:8b';
let ollamaProvider: OllamaProvider | null = null;

function getOllamaProvider(): OllamaProvider {
  if (!ollamaProvider) {
    ollamaProvider = new OllamaProvider();
  }
  return ollamaProvider;
}

/** @deprecated Use ServiceRegistry.generate() instead */
export function getAiClient(baseUrl?: string) {
  const { Ollama } = require('ollama');
  return new Ollama({
    host: baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  });
}

/** @deprecated Use ServiceRegistry instead */
export function resetAiClient(): void {
  ollamaProvider = null;
}

/** @deprecated Use ServiceRegistry.generate() with type='text' */
export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const provider = getOllamaProvider();
  const result = await provider.generateText({
    prompt,
    model: options.model ?? DEFAULT_MODEL,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    format: options.format,
  });

  return {
    content: result.content,
    model: result.model,
    totalDuration: result.durationMs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  };
}

/** @deprecated Use ServiceRegistry.generate() with messages */
export async function chat(
  messages: ChatMessage[],
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const provider = getOllamaProvider();
  const result = await provider.generateChat({
    messages,
    model: options.model ?? DEFAULT_MODEL,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    format: options.format,
  });

  return {
    content: result.content,
    model: result.model,
    totalDuration: result.durationMs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  };
}

/** @deprecated Use ServiceRegistry with streaming support */
export async function* streamText(
  prompt: string,
  options: GenerateOptions = {},
): AsyncGenerator<StreamChunk> {
  const provider = getOllamaProvider();
  const stream = provider.streamChat({
    messages: [{ role: 'user', content: prompt }],
    model: options.model ?? DEFAULT_MODEL,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  for await (const chunk of stream) {
    yield chunk;
  }
}

/** @deprecated Use ServiceRegistry.generate() with format='json' */
export async function generateJSON<T = unknown>(
  prompt: string,
  options: Omit<GenerateOptions, 'format'> = {},
): Promise<T> {
  const result = await generateText(prompt, { ...options, format: 'json' });
  try {
    return JSON.parse(result.content) as T;
  } catch {
    throw new Error(`AI returned invalid JSON: ${result.content.substring(0, 100)}`);
  }
}

/** @deprecated Use OllamaProvider.listModels() */
export async function listModels(): Promise<Array<{ name: string; size: number }>> {
  return getOllamaProvider().listModels();
}

/** @deprecated Use OllamaProvider.pullModel() */
export async function pullModel(name: string): Promise<void> {
  return getOllamaProvider().pullModel(name);
}

/** @deprecated Use OllamaProvider.isModelAvailable() */
export async function isModelAvailable(name: string): Promise<boolean> {
  return getOllamaProvider().isModelAvailable(name);
}
