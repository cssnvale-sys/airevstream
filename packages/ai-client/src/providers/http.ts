import type { AiProvider, TextRequest, ChatRequest, TextResponse, HealthCheckResult } from '../types.js';

/**
 * Generic HTTP provider for non-text AI services (image, video, voice).
 * Sends requests to the service's REST endpoint and returns the response.
 * Each service has its own API format, so this handles common patterns.
 */
export class HttpProvider implements AiProvider {
  readonly name: string;
  readonly providerType: any;
  readonly supportedTypes: any[];

  constructor(
    name: string,
    providerType: string,
    supportedTypes: string[],
  ) {
    this.name = name;
    this.providerType = providerType;
    this.supportedTypes = supportedTypes as any[];
  }

  async generateText(request: TextRequest & { endpoint?: string; apiKey?: string }): Promise<TextResponse> {
    const endpoint = request.endpoint;
    if (!endpoint) throw new Error(`No endpoint configured for ${this.name}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (request.apiKey) {
      headers['Authorization'] = `Bearer ${request.apiKey}`;
    }

    const start = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model,
        ...((request as any).params ?? {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.name} API error ${res.status}: ${text}`);
    }

    const data = await res.json() as any;

    return {
      content: typeof data === 'string' ? data : JSON.stringify(data),
      model: request.model ?? this.name,
      durationMs: Date.now() - start,
    };
  }

  async generateChat(request: ChatRequest & { endpoint?: string; apiKey?: string }): Promise<TextResponse> {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }
    // For non-text services, convert chat to single prompt
    const lastMessage = request.messages[request.messages.length - 1];
    return this.generateText({
      ...request,
      prompt: lastMessage.content,
    });
  }

  async checkHealth(endpoint: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      return { healthy: res.ok || res.status === 405, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
