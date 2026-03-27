/**
 * Bug Class 13: Status enum completeness
 *
 * Rule: When an API route handler checks for specific status values from a
 * known Prisma status enum, it should handle ALL valid values for that enum.
 * Missing values cause 400 errors for valid states (e.g., experiment route
 * accepting "running" and "completed" but not "evaluating").
 *
 * Detection: Parse Prisma schema for status enum comments, then scan route
 * handlers for status string literals. If a handler references 3+ values
 * from an enum but is missing some, flag it.
 *
 * @see .claude/rules/08-audit-process.md — Bug Pattern catalog
 */

import { describe, it, expect } from 'vitest';
import {
  findApiRouteFiles,
  readPrismaSchema,
  extractStatusEnums,
} from './audit-helpers';

/**
 * Known incomplete status checks — routes where partial checking is intentional.
 * Format: "routeRelativePath:ModelName.fieldName"
 * Example: A create route only sets "draft" — it doesn't need all statuses.
 */
export const KNOWN_INCOMPLETE_STATUS_CHECKS = new Set<string>([
  // Intentional partial handling — verified in Session 39 Wave 3 audit.
  // Mis-attributed flags (audit tool matched wrong model's status values):
  'accounts/[id]/route.ts:SocialAccount.status',          // validates EmailAccount, not SocialAccount
  'approvals/route.ts:AiService.serviceType',              // route doesn't reference AiService
  'approvals/route.ts:StoryboardShot.status',              // route doesn't reference StoryboardShot
  'approvals/route.ts:ScheduledPost.status',               // route doesn't reference ScheduledPost
  'assistant/actions/route.ts:StoryboardShot.status',      // route doesn't reference StoryboardShot
  'assistant/actions/route.ts:SeasoningCohort.status',     // route doesn't reference SeasoningCohort
  'assistant/chat/route.ts:StoryboardShot.status',         // route references ContentItem, not StoryboardShot
  'content/[id]/route.ts:StoryboardShot.status',           // includes shots via Prisma, no filtering
  'content/[id]/route.ts:ScheduledPost.status',            // includes posts via Prisma, no filtering
  'content/route.ts:AiService.serviceType',                // includes aiService via Prisma, no filtering
  'content/route.ts:StoryboardShot.status',                // route doesn't reference StoryboardShot
  'content/route.ts:ScheduledPost.status',                 // route doesn't reference ScheduledPost
  'prompts/route.ts:AiService.serviceType',                // route doesn't reference AiService
  // Intentional partial handling — only subset of statuses is semantically correct:
  'ai-services/health-check/route.ts:AiService.status',   // binary health check: active/down only
  'ai-services/route.ts:ContentItem.contentType',          // mis-attributed: route has AiService.serviceType filter
  'assistant/actions/route.ts:ScheduledPost.status',       // create uses 'scheduled'; groupBy captures all
  'assistant/actions/route.ts:ActionAuditLog.status',      // confirm/rollback lifecycle not yet implemented
  'assistant/actions/route.ts:WorkflowJob.status',         // 'paused' excluded from active job count intentionally
  'content/[id]/pipeline-status/route.ts:ContentItem.status', // pipeline steps don't map to scheduled/posted/archived
  'content/[id]/pipeline-status/route.ts:ScheduledPost.status', // pipeline-status references ContentItem statuses, not ScheduledPost
  'experiments/[id]/stop/route.ts:Experiment.status',      // stop only applies to running/evaluating
  'suggestions/[id]/route.ts:SuggestionLog.outcome',       // 'shown' is initial DB default, not a user action
  'storyboard-shots/[shotId]/approve/route.ts:StoryboardShot.status', // approve route only handles pending/approved/rejected, not generating/generated
  'system/health/route.ts:AiService.status',                         // groupBy captures all statuses; 'disabled' not explicitly referenced
]);

/** Minimum number of enum values a handler must reference to trigger the check */
const MIN_REFERENCES_TO_CHECK = 3;

/**
 * Find which values from a status enum appear as string literals in the handler body.
 * Returns the set of matched values.
 */
function findReferencedStatusValues(handlerBody: string, enumValues: string[]): Set<string> {
  const found = new Set<string>();
  for (const value of enumValues) {
    // Match 'value' or "value" as standalone string literals
    const re = new RegExp(`['"\`]${escapeRegex(value)}['"\`]`);
    if (re.test(handlerBody)) {
      found.add(value);
    }
  }
  return found;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Bug Class 13: Status enum completeness', () => {
  const routes = findApiRouteFiles();
  const schema = readPrismaSchema();
  const statusEnums = extractStatusEnums(schema);

  it('should have found API route files', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have extracted status enums from Prisma schema', () => {
    expect(statusEnums.length).toBeGreaterThan(0);
  });

  it('should handle all valid status values when checking status', () => {
    const violations: string[] = [];

    for (const route of routes) {
      for (const enumDef of statusEnums) {
        const key = `${route.relativePath}:${enumDef.model}.${enumDef.field}`;
        if (KNOWN_INCOMPLETE_STATUS_CHECKS.has(key)) continue;

        const referenced = findReferencedStatusValues(route.content, enumDef.values);

        // Only flag if the handler references enough values to suggest it's
        // trying to enumerate the enum, but is missing some
        if (referenced.size >= MIN_REFERENCES_TO_CHECK) {
          const missing = enumDef.values.filter((v) => !referenced.has(v));
          if (missing.length > 0 && missing.length <= 3) {
            // Only flag if 1-3 values are missing (likely an omission, not a different use case)
            violations.push(
              `${route.relativePath} — ${enumDef.model}.${enumDef.field}: ` +
              `references ${referenced.size}/${enumDef.values.length} values, ` +
              `missing: [${missing.join(', ')}]`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Incomplete status enum handling found:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
