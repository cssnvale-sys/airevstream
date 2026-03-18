import type {
  AiProvider,
  ServiceRecord,
  GenerateRequest,
  GenerateResponse,
  AttemptRecord,
  CircuitBreakerState,
  HealthCheckResult,
} from './types.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAICompatProvider } from './providers/openai-compat.js';
import { HttpProvider } from './providers/http.js';

// ─── Circuit Breaker Config ───

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 1 minute

// ─── Provider Factory ───

function createProvider(providerType: string): AiProvider {
  switch (providerType) {
    case 'ollama':
      return new OllamaProvider();
    case 'openai':
      return new OpenAICompatProvider('openai', 'openai');
    case 'anthropic':
      return new OpenAICompatProvider('anthropic', 'anthropic');
    case 'google':
      return new OpenAICompatProvider('google', 'google');
    case 'comfyui':
      return new HttpProvider('comfyui', 'comfyui', ['image']);
    case 'elevenlabs':
      return new HttpProvider('elevenlabs', 'elevenlabs', ['voice']);
    case 'runway':
      return new HttpProvider('runway', 'runway', ['video']);
    case 'kling':
      return new HttpProvider('kling', 'kling', ['video']);
    case 'pika':
      return new HttpProvider('pika', 'pika', ['video']);
    case 'luma':
      return new HttpProvider('luma', 'luma', ['video']);
    case 'heygen':
      return new HttpProvider('heygen', 'heygen', ['video']);
    case 'sora':
      return new HttpProvider('sora', 'sora', ['video']);
    default:
      return new HttpProvider(providerType, providerType as AiProvider['providerType'], ['text']);
  }
}

// ─── Service Registry ───

export type ServiceFetcher = (serviceType: string, fallbackGroup?: string) => Promise<ServiceRecord[]>;
export type UsageLogger = (usage: {
  serviceId: string;
  contentId?: string;
  channelId?: string;
  requestType: string;
  tokensUsed?: number;
  durationSec?: number;
  cost?: number;
  success: boolean;
  responseMs?: number;
  errorMessage?: string;
}) => Promise<void>;
export type ServiceUpdater = (serviceId: string, updates: Record<string, unknown>) => Promise<void>;
export type KeyDecryptor = (encryptedKey: string) => string;

export class ServiceRegistry {
  private providers = new Map<string, AiProvider>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private fetchServices: ServiceFetcher;
  private logUsage?: UsageLogger;
  private updateService?: ServiceUpdater;
  private decryptKey?: KeyDecryptor;

  constructor(opts: {
    fetchServices: ServiceFetcher;
    logUsage?: UsageLogger;
    updateService?: ServiceUpdater;
    decryptKey?: KeyDecryptor;
  }) {
    this.fetchServices = opts.fetchServices;
    this.logUsage = opts.logUsage;
    this.updateService = opts.updateService;
    this.decryptKey = opts.decryptKey;
  }

  // ─── Main Generate Method ───

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const maxRetries = request.maxRetries ?? 3;
    const services = await this.getAvailableServices(request);

    if (services.length === 0) {
      throw new Error(`No available AI services for type="${request.type}", task="${request.task}"`);
    }

    const attempts: AttemptRecord[] = [];
    let lastError: unknown = null;

    for (let i = 0; i < Math.min(maxRetries, services.length); i++) {
      const service = services[i];

      // Check circuit breaker
      if (this.isCircuitOpen(service.id)) {
        attempts.push({
          serviceId: service.id,
          serviceName: service.name,
          success: false,
          durationMs: 0,
          error: 'Circuit breaker open',
        });
        continue;
      }

      const start = Date.now();
      try {
        const provider = this.getProvider(service.provider);
        const apiKey = service.apiKeyEnc && this.decryptKey
          ? this.decryptKey(service.apiKeyEnc)
          : undefined;

        const providerRequest = {
          ...request,
          endpoint: service.endpoint ?? undefined,
          apiKey,
          model: request.model ?? this.getModelFromCapabilities(service),
        };

        let result;
        if (request.messages && request.messages.length > 0) {
          result = await provider.generateChat(providerRequest as any);
        } else {
          result = await provider.generateText(providerRequest as any);
        }

        const durationMs = Date.now() - start;
        const cost = this.estimateCost(service, result.tokensUsed);

        // Check budget
        if (request.budgetLimit && cost && cost > request.budgetLimit) {
          attempts.push({
            serviceId: service.id,
            serviceName: service.name,
            success: false,
            durationMs,
            error: `Cost ${cost} exceeds budget ${request.budgetLimit}`,
          });
          continue;
        }

        // Log success
        this.recordSuccess(service.id);
        await this.logUsage?.({
          serviceId: service.id,
          contentId: request.contentId,
          channelId: request.channelId,
          requestType: request.task,
          tokensUsed: result.tokensUsed,
          durationSec: durationMs / 1000,
          cost,
          success: true,
          responseMs: durationMs,
        });

        // Update service stats
        await this.updateService?.(service.id, {
          avgResponseMs: durationMs,
          lastHealthCheck: new Date(),
        });

        attempts.push({
          serviceId: service.id,
          serviceName: service.name,
          success: true,
          durationMs,
        });

        return {
          content: result.content,
          model: result.model,
          serviceId: service.id,
          serviceName: service.name,
          provider: service.provider,
          tokensUsed: result.tokensUsed,
          durationMs,
          cost,
          attempts,
        };
      } catch (err) {
        const durationMs = Date.now() - start;
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);

        this.recordFailure(service.id);
        await this.logUsage?.({
          serviceId: service.id,
          contentId: request.contentId,
          channelId: request.channelId,
          requestType: request.task,
          success: false,
          responseMs: durationMs,
          errorMessage: errMsg,
        });

        attempts.push({
          serviceId: service.id,
          serviceName: service.name,
          success: false,
          durationMs,
          error: errMsg,
        });
      }
    }

    throw new Error(
      `All ${attempts.length} AI service attempts failed for type="${request.type}". ` +
      `Last error: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown')}`
    );
  }

  // ─── Service Selection ───

  private async getAvailableServices(request: GenerateRequest): Promise<ServiceRecord[]> {
    const fallbackGroup = `${request.type}_gen`;
    const services = await this.fetchServices(request.type, fallbackGroup);

    return services
      .filter((s) => {
        // Exclude disabled and down services
        if (s.status === 'disabled' || s.status === 'down') return false;
        // Respect local/free preferences
        if (request.preferLocal && !s.isLocal) return false;
        if (request.preferFree && !s.isFree) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by: fallback order, then health score (desc), then success rate (desc)
        if (a.fallbackOrder !== b.fallbackOrder) return a.fallbackOrder - b.fallbackOrder;
        if (a.healthScore !== b.healthScore) return b.healthScore - a.healthScore;
        const aRate = Number(a.successRate);
        const bRate = Number(b.successRate);
        return bRate - aRate;
      });
  }

  // ─── Provider Management ───

  private getProvider(providerType: string): AiProvider {
    let provider = this.providers.get(providerType);
    if (!provider) {
      provider = createProvider(providerType);
      this.providers.set(providerType, provider);
    }
    return provider;
  }

  getOllamaProvider(): OllamaProvider {
    let provider = this.providers.get('ollama');
    if (!provider) {
      provider = new OllamaProvider();
      this.providers.set('ollama', provider);
    }
    return provider as OllamaProvider;
  }

  // ─── Health Checks ───

  async healthCheckAll(services: ServiceRecord[]): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    await Promise.allSettled(
      services.map(async (service) => {
        if (!service.endpoint) {
          results.set(service.id, { healthy: false, latencyMs: 0, error: 'No endpoint' });
          return;
        }

        const provider = this.getProvider(service.provider);
        const result = await provider.checkHealth(service.endpoint);
        results.set(service.id, result);

        // Update service status based on health
        const newStatus = result.healthy
          ? (result.latencyMs > 5000 ? 'degraded' : 'active')
          : 'down';

        const newScore = result.healthy
          ? Math.min(100, service.healthScore + 5)
          : Math.max(0, service.healthScore - 20);

        await this.updateService?.(service.id, {
          status: newStatus,
          healthScore: newScore,
          lastHealthCheck: new Date(),
          avgResponseMs: result.latencyMs,
        });
      }),
    );

    return results;
  }

  // ─── Circuit Breaker ───

  private isCircuitOpen(serviceId: string): boolean {
    const state = this.circuitBreakers.get(serviceId);
    if (!state) return false;

    if (state.state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
        state.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(serviceId: string): void {
    const state = this.circuitBreakers.get(serviceId);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
    }
  }

  private recordFailure(serviceId: string): void {
    let state = this.circuitBreakers.get(serviceId);
    if (!state) {
      state = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuitBreakers.set(serviceId, state);
    }

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open';
    }
  }

  // ─── Cost Estimation ───

  private estimateCost(service: ServiceRecord, tokensUsed?: number): number | undefined {
    if (service.isFree || service.isLocal) return 0;
    const costPerUnit = service.costPerUnit as Record<string, number> | null;
    if (!costPerUnit || !tokensUsed) return undefined;

    const inputCost = costPerUnit.inputPerToken ?? costPerUnit.perToken ?? 0;
    const outputCost = costPerUnit.outputPerToken ?? costPerUnit.perToken ?? 0;
    // Rough split: 60% input, 40% output
    return tokensUsed * 0.6 * inputCost + tokensUsed * 0.4 * outputCost;
  }

  // ─── Helpers ───

  private getModelFromCapabilities(service: ServiceRecord): string | undefined {
    const caps = service.capabilities as Record<string, any> | null;
    return caps?.defaultModel ?? caps?.model ?? undefined;
  }
}
