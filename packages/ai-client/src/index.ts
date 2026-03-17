import { Ollama } from 'ollama';

// ─── Types ───

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

export interface StreamChunk {
  content: string;
  done: boolean;
}

// ─── Default Config ───

const DEFAULT_MODEL = 'qwen3:8b';

// ─── Client ───

let client: Ollama | null = null;

export function getAiClient(baseUrl?: string): Ollama {
  if (!client) {
    client = new Ollama({
      host: baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    });
  }
  return client;
}

export function resetAiClient(): void {
  client = null;
}

// ─── Generate Text ───

export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const ollama = getAiClient();
  const model = options.model ?? DEFAULT_MODEL;

  const messages: ChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await ollama.chat({
    model,
    messages,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens,
    },
    format: options.format,
  });

  return {
    content: response.message.content,
    model: response.model,
    totalDuration: response.total_duration,
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

// ─── Chat ───

export async function chat(
  messages: ChatMessage[],
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const ollama = getAiClient();
  const model = options.model ?? DEFAULT_MODEL;

  const allMessages = options.systemPrompt
    ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
    : messages;

  const response = await ollama.chat({
    model,
    messages: allMessages,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens,
    },
    format: options.format,
  });

  return {
    content: response.message.content,
    model: response.model,
    totalDuration: response.total_duration,
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

// ─── Streaming ───

export async function* streamText(
  prompt: string,
  options: GenerateOptions = {},
): AsyncGenerator<StreamChunk> {
  const ollama = getAiClient();
  const model = options.model ?? DEFAULT_MODEL;

  const messages: ChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const stream = await ollama.chat({
    model,
    messages,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens,
    },
  });

  for await (const chunk of stream) {
    yield {
      content: chunk.message.content,
      done: chunk.done,
    };
  }
}

// ─── Structured Output (JSON) ───

export async function generateJSON<T = unknown>(
  prompt: string,
  options: Omit<GenerateOptions, 'format'> = {},
): Promise<T> {
  const result = await generateText(prompt, { ...options, format: 'json' });
  return JSON.parse(result.content) as T;
}

// ─── Model Management ───

export async function listModels(): Promise<Array<{ name: string; size: number }>> {
  const ollama = getAiClient();
  const response = await ollama.list();
  return response.models.map((m) => ({
    name: m.name,
    size: m.size,
  }));
}

export async function pullModel(name: string): Promise<void> {
  const ollama = getAiClient();
  await ollama.pull({ model: name });
}

export async function isModelAvailable(name: string): Promise<boolean> {
  try {
    const models = await listModels();
    return models.some((m) => m.name === name || m.name.startsWith(name + ':'));
  } catch {
    return false;
  }
}
