/**
 * Shared utilities for codebase audit tests.
 *
 * These helpers read source files as strings and provide pattern-matching
 * utilities for detecting recurring bug classes. They do NOT import or
 * execute any application code.
 */

import fs from 'fs';
import path from 'path';

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const WEB_ROOT = path.resolve(__dirname, '../../..');
const API_ROOT = path.join(WEB_ROOT, 'src/app/api/v1');
const AUTH_PAGES_ROOT = path.join(WEB_ROOT, 'src/app/auth');
const SCHEMA_PATH = path.resolve(WEB_ROOT, '../../packages/db/prisma/schema.prisma');

// ──────────────────────────────────────────────────────────
// Allowlists — routes that legitimately deviate from the rule
// ──────────────────────────────────────────────────────────

/** Auth routes that legitimately use getDb() because they run before authentication */
export const GETDB_ALLOWLIST = [
  'auth/login',
  'auth/register',
  'auth/forgot-password',
  'auth/reset-password',
];

/** Routes exempt from rate limiting checks */
export const RATE_LIMIT_EXEMPT = [
  // Read-only GET handlers don't need rate limiting
  // (only write handlers POST/PUT/PATCH/DELETE are checked)
  'auth/me',           // GET-only profile endpoint
  'system/health',     // Health check
];

/** Routes exempt from viewer role checks (unauthenticated or GET-only) */
export const VIEWER_WRITE_EXEMPT: string[] = [
  // Auth routes are unauthenticated — no viewer check needed
  'auth/login',
  'auth/register',
  'auth/forgot-password',
  'auth/reset-password',
  'auth/change-password',  // Uses authenticate but is self-service
];

// ──────────────────────────────────────────────────────────
// Known Violations — pre-existing gaps, tracked for future fix
//
// These prevent false failures while still catching NEW regressions.
// When a violation is fixed, remove it from the list — the test will
// verify it stays fixed. Adding entries here requires justification.
// ──────────────────────────────────────────────────────────

/**
 * Known routes missing viewer role checks on write handlers.
 * Format: "routeDir:METHOD" (e.g. "accounts/[id]:PUT")
 * TODO: Fix these and remove from list.
 */
export const KNOWN_MISSING_VIEWER_CHECKS = new Set([
  'accounts/[id]:PUT',
  'accounts/[id]:DELETE',
  'accounts/[id]/socials:POST',
  'affiliate/links:POST',
  'ai/guidance:POST',
  'cinema-bible/[id]:PUT',
  'affiliate/products/[id]:PUT',
  'affiliate/storefronts/[id]/products/[productId]:PATCH',
  'affiliate/storefronts/[id]/products/[productId]:DELETE',
  'affiliate/storefronts/[id]/products:POST',
  'affiliate/storefronts/[id]:PATCH',
  'affiliate/storefronts/[id]:DELETE',
  'ai-services/[id]:PUT',
  'ai-services/[id]:DELETE',
  'api-keys/[id]:PATCH',
  'api-keys/[id]:DELETE',
  'api-keys:POST',
  'approvals/[id]/[action]:POST',
  'assistant/chat:POST',
  'assistant/conversations/[id]:DELETE',
  'budgets/[id]:PATCH',
  'budgets/[id]:DELETE',
  'channels/[id]/affiliate-pool:DELETE',
  'channels/[id]/affiliate-pool:POST',
  'channels/[id]/avatars:POST',
  'channels/[id]/cinema-bible:PUT',
  'channels/[id]:PUT',
  'channels/[id]:DELETE',
  'channels/families:POST',
  'content/[id]/approve:POST',
  'content/[id]/quality-score:POST',
  'content/[id]/regenerate:POST',
  'content/[id]/reject:POST',
  'pipeline/cinema:POST',
  'content/[id]:PUT',
  'content/[id]:DELETE',
  'content/[id]/storyboard:PUT',
  'content/[id]/variants:POST',
  'content/[id]/versions:POST',
  'content/generate:POST',
  'content/generate-script:POST',
  'content/generate-shot:POST',
  'content/generate-storyboard:POST',
  'knowledge-base/[id]:PUT',
  'knowledge-base/[id]:PATCH',
  'knowledge-base/[id]:DELETE',
  'knowledge-base:POST',
  'prompts/[id]:PUT',
  'prompts/[id]:PATCH',
  'prompts/[id]:DELETE',
  'prompts/[id]/score:POST',
  'prompts:POST',
  'schedule/[id]:PUT',
  'schedule/[id]:PATCH',
  'schedule/[id]:DELETE',
  'schedule:POST',
  'settings/api-keys/[id]/revoke:POST',
  'settings/appearance:PUT',
  'settings/general:PUT',
  'settings/notifications:PUT',
  'settings/security:PUT',
  'subscriptions/[id]:PATCH',
  'subscriptions:POST',
  'system/alerts/[id]/acknowledge:POST',
  'system/alerts/[id]/snooze:POST',
  'system/alerts/acknowledge-all:POST',
  'system/errors/[id]/retry:POST',
  'tenants/[id]:PATCH',
  'tenants:POST',
  'users/[id]:PATCH',
  'users/invite:POST',
  'workflows/hitl/[id]/complete:POST',
]);

/**
 * Known routes missing rate limiting on write handlers.
 * Format: "routeDir:METHOD"
 * TODO: Fix these and remove from list.
 */
export const KNOWN_MISSING_RATE_LIMIT = new Set([
  'affiliate/storefronts/[id]/products/[productId]:PATCH',
  'affiliate/storefronts/[id]/products/[productId]:DELETE',
  'affiliate/storefronts/[id]/products:POST',
  'ai/guidance:POST',
  'ai-services:POST',
  'api-keys/[id]:PATCH',
  'api-keys/[id]:DELETE',
  'api-keys:POST',
  'approvals/bulk:POST',
  'assistant/conversations/[id]:DELETE',
  'channels/[id]/avatars:POST',
  'channels/[id]/cinema-bible:PUT',
  'channels/families:POST',
  'content/[id]/approve:POST',
  'content/[id]/quality-score:POST',
  'content/[id]/reject:POST',
  'pipeline/cinema:POST',
  'prompts/[id]/score:POST',
  'schedule:POST',
  'settings/api-keys/[id]/revoke:POST',
  'settings/appearance:PUT',
  'settings/general:PUT',
  'settings/notifications:PUT',
  'settings/security:PUT',
  'subscriptions:POST',
  'system/alerts/[id]/acknowledge:POST',
  'system/alerts/[id]/snooze:POST',
  'system/alerts/acknowledge-all:POST',
  'system/errors/[id]/retry:POST',
  'tenants/[id]:PATCH',
  'tenants:POST',
  'users/[id]:PATCH',
  'workflows/hitl/[id]/complete:POST',
]);

/**
 * Known routes missing tenant scoping.
 * Format: "routeDir — description"
 * Some are legitimate (admin-only, self-service), some are real gaps.
 */
export const KNOWN_MISSING_TENANT_SCOPE = new Set([
  // Legitimate: admin-only routes that intentionally see all data
  'users/route.ts',           // admin-only — lists all users
  'users/invite/route.ts',    // admin-only — creates users across tenants
  'users/[id]/route.ts',      // admin-only — manages any user
  'tenants/route.ts',         // admin-only
  'tenants/[id]/route.ts',    // admin-only
  // Legitimate: self-service by userId from JWT
  'auth/change-password/route.ts',  // scopes by userId, not tenantId
  // Legitimate: API key routes scope via key's tenant
  'api-keys/route.ts',
  'api-keys/[id]/route.ts',
  // Legitimate: subscription routes check tenantId via comparison
  'subscriptions/[id]/route.ts',
  // Real gaps (to be fixed):
  'affiliate/analytics/route.ts',           // TODO: add tenant filtering
  'affiliate/products/[id]/analytics/route.ts',  // TODO: add tenant filtering
  'ai-services/usage/route.ts',             // admin-only, acceptable
]);

/**
 * Known silent catch blocks.
 * Format: "relativePath:lineNumber"
 */
export const KNOWN_SILENT_CATCHES = new Set([
  'ai-services/health-check/route.ts:104',  // intentional: ping service returns status
]);

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type RouteFile = {
  /** Absolute path */
  path: string;
  /** Relative path from api/v1/ (e.g. "content/[id]/route.ts") */
  relativePath: string;
  /** File content as string */
  content: string;
};

export type HandlerInfo = {
  method: string;           // GET, POST, PUT, PATCH, DELETE
  body: string;             // Full function body text
  startLine: number;        // Line number where the handler starts
};

// ──────────────────────────────────────────────────────────
// File Discovery
// ──────────────────────────────────────────────────────────

function walkDir(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Find all route.ts files under apps/web/src/app/api/v1/ */
export function findApiRouteFiles(): RouteFile[] {
  const files = walkDir(API_ROOT, /^route\.ts$/);
  return files.map((filePath) => ({
    path: filePath,
    relativePath: path.relative(API_ROOT, filePath),
    content: fs.readFileSync(filePath, 'utf-8'),
  }));
}

/** Check if a route file's relative path matches an allowlist entry */
export function matchesAllowlist(relativePath: string, allowlist: string[]): boolean {
  // relativePath is like "auth/login/route.ts"
  const routeDir = relativePath.replace(/\/route\.ts$/, '');
  return allowlist.some((entry) => routeDir === entry || routeDir.startsWith(entry + '/'));
}

/** Read an auth page file (login, register, etc.) */
export function readAuthPage(pageName: string): string | null {
  const pagePath = path.join(AUTH_PAGES_ROOT, pageName, 'page.tsx');
  if (!fs.existsSync(pagePath)) return null;
  return fs.readFileSync(pagePath, 'utf-8');
}

/** Read the Prisma schema file */
export function readPrismaSchema(): string {
  return fs.readFileSync(SCHEMA_PATH, 'utf-8');
}

// ──────────────────────────────────────────────────────────
// Handler Extraction
// ──────────────────────────────────────────────────────────

const HANDLER_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

/** Extract all HTTP handler functions from a route file */
export function extractHandlers(content: string): HandlerInfo[] {
  const handlers: HandlerInfo[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(HANDLER_RE.source, 'g');

  while ((match = re.exec(content)) !== null) {
    const method = match[1];
    const startIndex = match.index;
    const startLine = content.substring(0, startIndex).split('\n').length;

    // Find the opening brace of the function
    const braceStart = content.indexOf('{', startIndex + match[0].length);
    if (braceStart === -1) continue;

    const body = extractBraceBlock(content, braceStart);
    if (body) {
      handlers.push({ method, body, startLine });
    }
  }

  return handlers;
}

/** Check if a handler method is a write operation */
export function isWriteHandler(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

// ──────────────────────────────────────────────────────────
// Brace Matching
// ──────────────────────────────────────────────────────────

/**
 * Extract a brace-delimited block from content starting at the given index.
 * The index should point to the opening '{'.
 * Returns the content between (and including) the braces.
 */
export function extractBraceBlock(content: string, startIndex: number): string | null {
  if (content[startIndex] !== '{') return null;

  let depth = 0;
  let inString: string | false = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inTemplate = false;
  let templateDepth = 0;

  for (let i = startIndex; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    // Handle comments
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    // Handle template literals
    if (inTemplate) {
      if (ch === '`' && templateDepth === 0) {
        inTemplate = false;
        continue;
      }
      if (ch === '$' && next === '{') {
        templateDepth++;
        i++;
        continue;
      }
      if (ch === '}' && templateDepth > 0) {
        templateDepth--;
        continue;
      }
      continue;
    }

    // Handle strings
    if (inString) {
      if (ch === inString) inString = false;
      continue;
    }

    // Detect start of strings/comments
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      inString = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      templateDepth = 0;
      continue;
    }

    // Track braces
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return content.substring(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Extract all catch block bodies from a piece of code.
 * Returns array of { body, lineNumber }.
 */
export function extractCatchBlocks(content: string): Array<{ body: string; lineNumber: number }> {
  const blocks: Array<{ body: string; lineNumber: number }> = [];
  const catchRe = /\bcatch\s*\([^)]*\)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = catchRe.exec(content)) !== null) {
    const braceStart = content.indexOf('{', match.index + match[0].length - 1);
    if (braceStart === -1) continue;

    const body = extractBraceBlock(content, braceStart);
    if (body) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      blocks.push({ body, lineNumber });
    }
  }

  return blocks;
}

// ──────────────────────────────────────────────────────────
// Prisma Schema Parsing
// ──────────────────────────────────────────────────────────

/**
 * Extract all Decimal field names from the Prisma schema, grouped by model.
 * Returns a Map of modelName → Set of field names.
 */
export function extractDecimalFields(schemaContent: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRe.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelStart = schemaContent.indexOf('{', modelMatch.index);
    const modelBody = extractBraceBlock(schemaContent, modelStart);
    if (!modelBody) continue;

    const decimalFields = new Set<string>();
    const fieldRe = /^\s+(\w+)\s+.*Decimal/gm;
    let fieldMatch: RegExpExecArray | null;
    const fieldRegex = new RegExp(fieldRe.source, 'gm');

    while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
      decimalFields.add(fieldMatch[1]);
    }

    if (decimalFields.size > 0) {
      result.set(modelName, decimalFields);
    }
  }

  return result;
}

/**
 * Extract models that have a direct tenantId field.
 */
export function extractTenantScopedModels(schemaContent: string): Set<string> {
  const result = new Set<string>();
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRe.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelStart = schemaContent.indexOf('{', modelMatch.index);
    const modelBody = extractBraceBlock(schemaContent, modelStart);
    if (!modelBody) continue;

    if (/\btenantId\b/.test(modelBody)) {
      result.add(modelName);
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────
// String Extraction
// ──────────────────────────────────────────────────────────

/**
 * Extract error message strings from API route error() calls.
 * Looks for patterns like: error('CODE', 'message', status)
 * Returns array of message strings.
 */
export function extractErrorMessages(content: string): string[] {
  const messages: string[] = [];
  // Match error('CODE', 'message' ...
  const re = /\berror\(\s*['"][\w_]+['"]\s*,\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    messages.push(match[1]);
  }

  return messages;
}

/**
 * Extract safeMessages array strings from a frontend page.
 * Looks for: const safeMessages = ['msg1', 'msg2', ...]
 */
export function extractSafeMessages(content: string): string[] {
  const messages: string[] = [];
  const arrayMatch = content.match(/safeMessages\s*=\s*\[([^\]]+)\]/s);
  if (!arrayMatch) return messages;

  const arrayContent = arrayMatch[1];
  const stringRe = /['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = stringRe.exec(arrayContent)) !== null) {
    messages.push(match[1]);
  }

  return messages;
}

// ──────────────────────────────────────────────────────────
// Detection Patterns
// ──────────────────────────────────────────────────────────

/** Check if a route file uses authenticate() (is an authenticated route) */
export function usesAuthentication(content: string): boolean {
  return /\bauthenticate\b/.test(content) &&
    !/^\s*\/\/.*authenticate/m.test(content);
}

/** Check if a route file uses getDb() directly (not via authenticate) */
export function usesGetDb(content: string): boolean {
  return /\bgetDb\s*\(/.test(content) || /import\s*\{[^}]*\bgetDb\b/.test(content);
}

/** Convert a Prisma model name to its likely ctx.db accessor name */
export function modelToAccessor(modelName: string): string {
  // Prisma client uses camelCase: ContentItem → contentItem
  return modelName[0].toLowerCase() + modelName.slice(1);
}
