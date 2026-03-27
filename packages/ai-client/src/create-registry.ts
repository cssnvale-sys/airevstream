import { ServiceRegistry } from './registry.js';
import type { ServiceRecord } from './types.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('ai-client:registry');

/**
 * Creates a ServiceRegistry instance wired to Prisma and crypto.
 * This is the recommended way to create a registry in services and workers.
 *
 * Usage:
 * ```ts
 * import { getDb } from '@airevstream/db';
 * import { decrypt } from '@airevstream/crypto';
 * import { createServiceRegistry } from '@airevstream/ai-client';
 *
 * const registry = createServiceRegistry(getDb(), decrypt, process.env.ENCRYPTION_KEY!);
 * const result = await registry.generate({ type: 'text', task: 'script_generation', prompt: '...' });
 * ```
 */
export function createServiceRegistry(
  db: any,
  decryptFn?: (ciphertext: string, key: string) => string,
  encryptionKey?: string,
): ServiceRegistry {
  return new ServiceRegistry({
    fetchServices: async (serviceType: string, fallbackGroup?: string): Promise<ServiceRecord[]> => {
      const where: Record<string, unknown> = {
        serviceType,
        status: { in: ['active', 'degraded'] },
      };
      if (fallbackGroup) {
        where.OR = [
          { fallbackGroup },
          { fallbackGroup: null },
        ];
      }

      const services = await db.aiService.findMany({
        where,
        orderBy: [
          { fallbackOrder: 'asc' },
          { healthScore: 'desc' },
        ],
      });

      return services.map((s: any) => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        serviceType: s.serviceType,
        endpoint: s.endpoint,
        apiKeyEnc: s.apiKeyEnc,
        capabilities: s.capabilities ?? {},
        rateLimits: s.rateLimits ?? {},
        costPerUnit: s.costPerUnit ?? {},
        status: s.status,
        healthScore: s.healthScore,
        lastHealthCheck: s.lastHealthCheck,
        avgResponseMs: s.avgResponseMs,
        successRate: Number(s.successRate),
        avgQualityScore: s.avgQualityScore != null ? Number(s.avgQualityScore) : null,
        fallbackOrder: s.fallbackOrder,
        fallbackGroup: s.fallbackGroup,
        isLocal: s.isLocal,
        isFree: s.isFree,
      }));
    },

    logUsage: async (usage) => {
      try {
        await db.aiServiceUsage.create({
          data: {
            serviceId: usage.serviceId,
            contentId: usage.contentId ?? undefined,
            channelId: usage.channelId ?? undefined,
            requestType: usage.requestType,
            tokensUsed: usage.tokensUsed,
            durationSec: usage.durationSec,
            cost: usage.cost,
            success: usage.success,
            responseMs: usage.responseMs,
            errorMessage: usage.errorMessage,
          },
        });
      } catch (err) {
        logger.error({ err }, 'AI service usage logging failed');
      }
    },

    updateService: async (serviceId: string, updates: Record<string, unknown>) => {
      try {
        await db.aiService.update({
          where: { id: serviceId },
          data: updates,
        });
      } catch (err) {
        logger.error({ err }, 'AI service stats update failed');
      }
    },

    decryptKey: (decryptFn && encryptionKey)
      ? (encryptedKey: string) => decryptFn(encryptedKey, encryptionKey)
      : undefined,
  });
}
