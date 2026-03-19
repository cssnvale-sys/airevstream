/**
 * Bug Class 4: Missing tenant scoping in API routes
 *
 * Rule: Every authenticated route that queries tenant-scoped models must
 * filter by ctx.tenantId (for models with direct tenantId) or through
 * the chain filter (Channel → SocialAccount → EmailAccount → tenantId).
 *
 * @see .claude/rules/06-backend.md — "Critical: Tenant-Scoped Database Access"
 * @see .claude/rules/07-security.md — "Tenant Scoping"
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  matchesAllowlist,
  GETDB_ALLOWLIST,
  KNOWN_MISSING_TENANT_SCOPE,
  usesAuthentication,
  readPrismaSchema,
  extractTenantScopedModels,
  modelToAccessor,
} from './audit-helpers';

/** Models that are global and don't need tenant scoping */
const GLOBAL_MODELS = new Set([
  'AiService',
  'SystemSetting',
  'SystemMetric',
  'Alert',
  'Avatar',        // Global asset, linked to channels via ChannelAvatar
  'SceneryAsset',  // Global asset, linked to channels via ChannelScenery
]);

/** Models scoped through chain (Channel → SocialAccount → EmailAccount → tenantId) */
const CHAIN_SCOPED_MODELS = new Set([
  'ContentItem',
  'Channel',
  'SocialAccount',
  'ScheduledPost',
  'Storyboard',
  'StoryboardShot',
  'ChannelAvatar',
  'ChannelScenery',
  'BrandingPackage',
  'CinemaBible',
  'ChannelAffiliatePool',
  'AffiliateClick',
  'AiServiceUsage',
  'Storefront',
  'StorefrontProduct',
]);

/** Patterns indicating tenant scoping is applied */
const TENANT_SCOPE_PATTERNS = [
  /tenantId:\s*ctx\.tenantId/,
  /tenantId:\s*ctx\.tenantId/,
  /emailAccount:\s*\{\s*tenantId/,
  /emailAccount\s*:\s*\{[^}]*tenantId/,
  /socialAccount\s*:\s*\{[^}]*emailAccount/,
  /ctx\.tenantId/,
];

describe('Bug Class 4: Missing tenant scoping', () => {
  const routes = findApiRouteFiles();
  const schema = readPrismaSchema();
  const directTenantModels = extractTenantScopedModels(schema);

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have tenant scoping on routes that query tenant-scoped models', () => {
    const violations: string[] = [];

    for (const route of routes) {
      // Skip auth routes (unauthenticated)
      if (matchesAllowlist(route.relativePath, GETDB_ALLOWLIST)) continue;

      // Only check authenticated routes
      if (!usesAuthentication(route.content)) continue;

      // Check for direct-tenantId models
      for (const model of directTenantModels) {
        if (GLOBAL_MODELS.has(model)) continue;

        const accessor = modelToAccessor(model);
        // Check if this route queries this model
        const queryPattern = new RegExp(`\\bctx\\.db\\.${accessor}\\.(findMany|findFirst|findUnique|count|create|update|delete|upsert)\\b`);
        if (!queryPattern.test(route.content)) continue;

        // Verify tenant scoping
        const hasTenantScope = TENANT_SCOPE_PATTERNS.some((p) => p.test(route.content));
        if (!hasTenantScope) {
          // Skip known pre-existing violations
          if (KNOWN_MISSING_TENANT_SCOPE.has(route.relativePath)) continue;

          violations.push(
            `${route.relativePath} — queries ${model} (direct tenantId) without tenant scoping`,
          );
        }
      }

      // Check for chain-scoped models
      for (const model of CHAIN_SCOPED_MODELS) {
        const accessor = modelToAccessor(model);
        const queryPattern = new RegExp(`\\bctx\\.db\\.${accessor}\\.(findMany|findFirst|count)\\b`);
        if (!queryPattern.test(route.content)) continue;

        // For chain-scoped models, check for either direct tenantId or chain filter
        const hasTenantScope = TENANT_SCOPE_PATTERNS.some((p) => p.test(route.content));
        if (!hasTenantScope) {
          // Skip known pre-existing violations
          if (KNOWN_MISSING_TENANT_SCOPE.has(route.relativePath)) continue;

          violations.push(
            `${route.relativePath} — queries ${model} (chain-scoped) without tenant scoping`,
          );
        }
      }
    }

    expect(violations, `Routes missing tenant scoping:\n${violations.join('\n')}`).toEqual([]);
  });
});
