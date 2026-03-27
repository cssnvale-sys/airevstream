import { describe, it, expect } from 'vitest';
import { findApiRouteFiles } from './audit-helpers';

describe('force-dynamic coverage', () => {
  const routes = findApiRouteFiles();
  // Filter to non-parameterized routes (exclude paths with `[` which are dynamic segments)
  const nonParamRoutes = routes.filter(r => !r.relativePath.includes('['));

  it('should have found non-parameterized routes', () => {
    expect(nonParamRoutes.length).toBeGreaterThan(0);
  });

  it('all non-parameterized routes should export force-dynamic (D129)', () => {
    const violations: string[] = [];
    for (const route of nonParamRoutes) {
      if (!route.content.includes("export const dynamic = 'force-dynamic'")) {
        violations.push(route.relativePath);
      }
    }
    expect(violations).toEqual([]);
  });
});
