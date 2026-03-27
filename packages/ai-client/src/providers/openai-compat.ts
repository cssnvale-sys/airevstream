import { createLogger } from '@airevstream/shared';
import type { AiProvider, TextRequest, ChatRequest, TextResponse, StreamChunk, HealthCheckResult, ChatMessage } from '../types.js';

const logger = createLogger('ai-client:openai-compat');

/**
 * OpenAI-compatible provider. Works with OpenAI, Anthropic (via proxy),
 * Google (via proxy), DeepSeek, and any OpenAI-compatible API.
 */
export class OpenAICompatProvider implements AiProvider {
  readonly name: string;
  readonly providerType: AiProvider['providerType'];
  readonly supportedTypes: AiProvider['supportedTypes'] = ['text'];

  constructor(
    name: string,
    providerType: AiProvider['providerType'],
  ) {
    this.name = name;
    this.providerType = providerType;
  }

  async generateText(request: TextRequest & { endpoint?: string; apiKey?: string }): Promise<TextResponse> {
    const messages: ChatMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    // Omit systemPrompt to prevent generateChat from prepending it again
    const { systemPrompt: _omit, ...rest } = request;
    return this.generateChat({ ...rest, messages });
  }

  async generateChat(request: ChatRequest & { endpoint?: string; apiKey?: string }): Promise<TextResponse> {
    const endpoint = request.endpoint ?? 'https://api.openai.com/v1';
    const apiKey = request.apiKey;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const start = Date.now();
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: request.model ?? 'gpt-4o-mini',
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        ...(request.format === 'json' ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI-compat API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const choice = data.choices?.[0];
    const usage = data.usage;

    return {
      content: choice?.message?.content ?? '',
      model: data.model ?? request.model ?? 'unknown',
      durationMs: Date.now() - start,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      tokensUsed: usage?.total_tokens,
    };
  }

  async *streamChat(request: ChatRequest & { endpoint?: string; apiKey?: string }): AsyncGenerator<StreamChunk> {
    const endpoint = request.endpoint ?? 'https://api.openai.com/v1';
    const apiKey = request.apiKey;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({
        model: request.model ?? 'gpt-4o-mini',
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI-compat API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          const finished = parsed.choices?.[0]?.finish_reason != null;
          if (delta || finished) {
            yield { content: delta, done: finished };
          }
        } catch (parseErr) {
          // Malformed SSE chunk — skip but log for debugging
          logger.debug({ chunk: data.substring(0, 80) }, 'Skipping malformed SSE chunk');
        }
      }
    }
  }

  async checkHealth(endpoint: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${endpoint}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      return { healthy: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
