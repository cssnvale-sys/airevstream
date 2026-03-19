/**
 * Bug Class 6: Decimal fields not wrapped with Number()
 *
 * Rule: Prisma Decimal fields serialize as strings in JSON. API routes
 * that return Decimal fields MUST wrap them with Number() before responding.
 *
 * @see .claude/rules/05-frontend.md — "Prisma Decimal → Number Casting"
 * @see DECISIONS.md D013
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  readPrismaSchema,
  extractDecimalFields,
  modelToAccessor,
} from './audit-helpers';

/** Well-known Decimal field names across all models */
const KNOWN_DECIMAL_FIELDS = [
  'qualityScore',
  'successRate',
  'avgQualityScore',
  'durationSec',
  'cost',
  'revenue',
  'totalRevenue',
  'commissionRate',
  'trustScore',
  'gateWindowHrs',
  'avgOutcomeScore',
  'limitAmount',
  'currentSpend',
  'alertThreshold',
  'performanceScore',
  'startSec',
  'endSec',
  'totalDurationSec',
  'generationCost',
  'approvalGateWindowHrs',
  'avgScore',
  'relevanceScore',
  'value', // SystemMetric.value
];

describe('Bug Class 6: Decimal fields not wrapped with Number()', () => {
  const routes = findApiRouteFiles();
  const schema = readPrismaSchema();
  const decimalFieldsByModel = extractDecimalFields(schema);

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have Decimal fields in the schema', () => {
    expect(decimalFieldsByModel.size).toBeGreaterThan(0);
  });

  it('should wrap Decimal fields with Number() when returning data', () => {
    const violations: string[] = [];

    for (const route of routes) {
      // Check if the route queries any model with Decimal fields
      for (const [model, fields] of decimalFieldsByModel) {
        const accessor = modelToAccessor(model);
        const usesModel = new RegExp(`\\.${accessor}\\.`).test(route.content);
        if (!usesModel) continue;

        // Check if the route returns data (has success() or paginated() calls)
        const returnsData = /\b(success|paginated)\s*\(/.test(route.content);
        if (!returnsData) continue;

        // For each Decimal field, check if the route references it
        // and if so, whether Number() wrapping is present
        for (const field of fields) {
          // Check if this field appears in the response
          const fieldPattern = new RegExp(`\\b${field}\\b`);
          if (!fieldPattern.test(route.content)) continue;

          // Check for Number() wrapping pattern
          const numberWrapped = new RegExp(
            `Number\\(\\s*\\w+\\.${field}\\s*\\)` +
            `|${field}\\s*!=\\s*null\\s*\\?\\s*Number\\(` +
            `|${field}\\s*!==\\s*null\\s*\\?\\s*Number\\(`,
          ).test(route.content);

          // Also accept .map() transformations that do Number() wrapping
          const mapTransform = new RegExp(
            `${field}[^;]*Number\\(`,
          ).test(route.content);

          // Skip if field is only in schema import comments or variable names
          const isOnlyInComment = route.content.split('\n').every((line) => {
            if (!fieldPattern.test(line)) return true;
            return line.trimStart().startsWith('//') || line.trimStart().startsWith('*');
          });

          if (isOnlyInComment) continue;

          if (!numberWrapped && !mapTransform) {
            // Check if the route does a raw spread without wrapping
            // This is the most common violation pattern: return success(item) without mapping
            const rawReturn = new RegExp(`return\\s+(success|paginated)\\([^)]*\\b${accessor}\\b`).test(route.content);
            if (rawReturn) {
              violations.push(
                `${route.relativePath} — ${model}.${field} (Decimal) returned without Number() wrapping`,
              );
            }
          }
        }
      }
    }

    expect(violations, `Decimal fields returned without Number() wrapping:\n${violations.join('\n')}`).toEqual([]);
  });
});
