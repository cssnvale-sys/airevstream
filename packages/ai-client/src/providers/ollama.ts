import { Ollama } from 'ollama';
import { createLogger } from '@airevstream/shared';
import type { AiProvider, TextRequest, ChatRequest, TextResponse, StreamChunk, HealthCheckResult } from '../types.js';

const logger = createLogger('ai-client:ollama');

// The default model can be overridden at runtime via OLLAMA_DEFAULT_MODEL,
// e.g. if the operator has pulled qwen3.5:122b or any other tag instead of qwen3:8b.
// Read inside the call (not at module load) so per-process env overrides work
// even when this file is compiled into a shared bundle.
const FALLBACK_MODEL = 'qwen3:8b';
function getDefaultModel(): string {
  return process.env.OLLAMA_DEFAULT_MODEL?.trim() || FALLBACK_MODEL;
}

// Thinking models (qwen3, deepseek-r1, etc.) emit `<think>...</think>` blocks
// in message.content even when the top-level `think` flag suppresses structured
// thinking. Strip them defensively so downstream consumers see only the final
// answer. Non-thinking models pass through unchanged.
function stripThinkingTags(content: string): string {
  if (!content) return content;
  return content.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
}

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  readonly providerType = 'ollama' as const;
  readonly supportedTypes = ['text' as const];

  private clients = new Map<string, Ollama>();

  private getClient(endpoint: string): Ollama {
    let client = this.clients.get(endpoint);
    if (!client) {
      client = new Ollama({ host: endpoint });
      this.clients.set(endpoint, client);
    }
    return client;
  }

  async generateText(request: TextRequest & { endpoint?: string }): Promise<TextResponse> {
    const endpoint = request.endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? getDefaultModel();
    const think = request.think ?? false;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const start = Date.now();
    const response = await client.chat({
      model,
      messages,
      think,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
      format: request.format,
    });

    return {
      content: stripThinkingTags(response.message.content),
      model: response.model,
      durationMs: Date.now() - start,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      tokensUsed: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };
  }

  async generateChat(request: ChatRequest & { endpoint?: string }): Promise<TextResponse> {
    const endpoint = request.endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? getDefaultModel();
    const think = request.think ?? false;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const start = Date.now();
    const response = await client.chat({
      model,
      messages,
      think,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
      format: request.format,
    });

    return {
      content: stripThinkingTags(response.message.content),
      model: response.model,
      durationMs: Date.now() - start,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      tokensUsed: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };
  }

  async *streamChat(request: ChatRequest & { endpoint?: string }): AsyncGenerator<StreamChunk> {
    const endpoint = request.endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? getDefaultModel();
    const think = request.think ?? false;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const stream = await client.chat({
      model,
      messages,
      think,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
    });

    // Buffer across chunk boundaries so we don't leak partial <think> tags.
    let insideThink = false;
    for await (const chunk of stream) {
      let piece = chunk.message.content ?? '';
      // Fast path: no tags present
      if (!piece.includes('<think>') && !piece.includes('</think>') && !insideThink) {
        yield { content: piece, done: chunk.done };
        continue;
      }
      // Slow path: filter tags. Simple state machine per-chunk.
      let out = '';
      while (piece.length > 0) {
        if (insideThink) {
          const end = piece.indexOf('</think>');
          if (end === -1) { piece = ''; break; }
          piece = piece.slice(end + '</think>'.length);
          insideThink = false;
        } else {
          const start = piece.indexOf('<think>');
          if (start === -1) { out += piece; piece = ''; break; }
          out += piece.slice(0, start);
          piece = piece.slice(start + '<think>'.length);
          insideThink = true;
        }
      }
      yield { content: out, done: chunk.done };
    }
  }

  async checkHealth(endpoint: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = this.getClient(endpoint);
      await client.list();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Model Management (Ollama-specific) ───

  async listModels(endpoint?: string): Promise<Array<{ name: string; size: number }>> {
    const ep = endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(ep);
    const response = await client.list();
    return response.models.map((m) => ({ name: m.name, size: m.size }));
  }

  async pullModel(name: string, endpoint?: string): Promise<void> {
    const ep = endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(ep);
    await client.pull({ model: name });
  }

  async isModelAvailable(name: string, endpoint?: string): Promise<boolean> {
    try {
      const models = await this.listModels(endpoint);
      return models.some((m) => m.name === name || m.name.startsWith(name + ':'));
    } catch (err) {
      logger.debug({ model: name, error: err instanceof Error ? err.message : String(err) }, 'isModelAvailable check failed');
      return false;
    }
  }
}
