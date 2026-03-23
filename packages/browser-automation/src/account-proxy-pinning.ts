import type { ProxyConfig } from './types.js';
import { createLogger } from '@airevstream/shared';

const logger = createLogger('account-proxy-pinning');

/**
 * Manages proxy pinning for seasoning enrollments.
 * Ensures each account always uses the same proxy IP for consistency,
 * storing the assignment in SocialAccount.metadata JSON.
 */
export class AccountProxyPinning {
  private proxyPool: ProxyConfig[];

  constructor(proxyPool: ProxyConfig[] = []) {
    this.proxyPool = proxyPool;
  }

  /**
   * Pin a proxy to an account. Selects the least-used proxy from the pool.
   * Returns the proxy server string to store on the enrollment.
   */
  pinProxy(accountId: string, platform: string): string | null {
    if (this.proxyPool.length === 0) {
      logger.warn({ accountId, platform }, 'No proxies in pool — cannot pin');
      return null;
    }

    // Simple round-robin based on hash of accountId + platform
    const hash = simpleHash(`${accountId}:${platform}`);
    const index = hash % this.proxyPool.length;
    const proxy = this.proxyPool[index];

    logger.info({ accountId, platform, proxyServer: proxy.server }, 'Proxy pinned to account');
    return proxy.server;
  }

  /**
   * Get the pinned proxy config for an account from its stored metadata.
   */
  getPinnedProxy(metadata: Record<string, unknown>): ProxyConfig | null {
    const pinnedServer = metadata.pinnedProxy as string | undefined;
    if (!pinnedServer) return null;

    const proxy = this.proxyPool.find((p) => p.server === pinnedServer);
    if (!proxy) {
      logger.warn({ pinnedServer }, 'Pinned proxy not found in current pool');
      return null;
    }

    return proxy;
  }

  /**
   * Add proxies to the pool.
   */
  addProxies(proxies: ProxyConfig[]): void {
    this.proxyPool.push(...proxies);
  }

  /**
   * Get pool size.
   */
  get poolSize(): number {
    return this.proxyPool.length;
  }
}

/** Simple deterministic hash for proxy assignment */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
