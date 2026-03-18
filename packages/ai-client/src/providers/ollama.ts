import { Ollama } from 'ollama';
import type { AiProvider, TextRequest, ChatRequest, TextResponse, StreamChunk, HealthCheckResult } from '../types.js';

const DEFAULT_MODEL = 'qwen3:8b';

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
    const endpoint = (request as any).endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? DEFAULT_MODEL;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const start = Date.now();
    const response = await client.chat({
      model,
      messages,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
      format: request.format,
    });

    return {
      content: response.message.content,
      model: response.model,
      durationMs: Date.now() - start,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      tokensUsed: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };
  }

  async generateChat(request: ChatRequest & { endpoint?: string }): Promise<TextResponse> {
    const endpoint = (request as any).endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? DEFAULT_MODEL;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const start = Date.now();
    const response = await client.chat({
      model,
      messages,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
      format: request.format,
    });

    return {
      content: response.message.content,
      model: response.model,
      durationMs: Date.now() - start,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      tokensUsed: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };
  }

  async *streamChat(request: ChatRequest & { endpoint?: string }): AsyncGenerator<StreamChunk> {
    const endpoint = (request as any).endpoint ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const client = this.getClient(endpoint);
    const model = request.model ?? DEFAULT_MODEL;

    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages;

    const stream = await client.chat({
      model,
      messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
      },
    });

    for await (const chunk of stream) {
      yield {
        content: chunk.message.content,
        done: chunk.done,
      };
    }
  }

  async checkHealth(endpoint: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = this.getClient(endpoint);
      await client.list();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
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
    } catch {
      return false;
    }
  }
}
