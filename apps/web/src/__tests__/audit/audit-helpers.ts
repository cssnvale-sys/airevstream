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

export const WEB_ROOT = path.resolve(__dirname, '../../..');
const API_ROOT = path.join(WEB_ROOT, 'src/app/api/v1');
const AUTH_PAGES_ROOT = path.join(WEB_ROOT, 'src/app/auth');
const SCHEMA_PATH = path.resolve(WEB_ROOT, '../../packages/db/prisma/schema.prisma');
const MONOREPO_ROOT = path.resolve(WEB_ROOT, '../..');

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
 * All 72 entries fixed in Session 17 security hardening.
 */
export const KNOWN_MISSING_VIEWER_CHECKS = new Set<string>([
]);

/**
 * Known routes missing rate limiting on write handlers.
 * Format: "routeDir:METHOD"
 * All 33 entries fixed in Session 17 security hardening.
 */
export const KNOWN_MISSING_RATE_LIMIT = new Set<string>([
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
  // Fixed in Session 17: affiliate analytics tenant scoping
  'ai-services/usage/route.ts',             // admin-only, acceptable
]);

/**
 * Known silent catch blocks.
 * Format: "relativePath:lineNumber"
 */
export const KNOWN_SILENT_CATCHES = new Set([
  'ai-services/health-check/route.ts:39',   // intentional: URL validation returns true on parse error
  'ai-services/health-check/route.ts:104',  // intentional: ping service returns status
  'events/stream/route.ts:204',             // intentional: stream closed by client, clean up heartbeat
  'content/[id]/reject/route.ts:35',        // intentional: empty body acceptable, feedback is optional
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

export type SourceFile = {
  /** Absolute path */
  path: string;
  /** Relative path from WEB_ROOT/src or monorepo root */
  relativePath: string;
  /** File content as string */
  content: string;
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

/** Find frontend source files that use API mutation helpers (pages, components, hooks) */
export function findFrontendSourceFiles(): SourceFile[] {
  const dirs = [
    path.join(WEB_ROOT, 'src/app'),
    path.join(WEB_ROOT, 'src/components'),
    path.join(WEB_ROOT, 'src/hooks'),
  ];
  const files: SourceFile[] = [];
  for (const dir of dirs) {
    for (const f of walkDir(dir, /\.(ts|tsx)$/)) {
      // Skip test files and API routes (they don't use apiPost)
      if (f.includes('__tests__') || f.includes('/api/')) continue;
      files.push({
        path: f,
        relativePath: path.relative(WEB_ROOT, f),
        content: fs.readFileSync(f, 'utf-8'),
      });
    }
  }
  return files;
}

/** Find all production source files across the monorepo */
export function findProductionSourceFiles(): SourceFile[] {
  const dirs = [
    path.join(MONOREPO_ROOT, 'apps/web/src'),
    path.join(MONOREPO_ROOT, 'packages'),
    path.join(MONOREPO_ROOT, 'services'),
    path.join(MONOREPO_ROOT, 'workers'),
    path.join(MONOREPO_ROOT, 'remotion/src'),
  ];
  const files: SourceFile[] = [];
  for (const dir of dirs) {
    for (const f of walkDir(dir, /\.(ts|tsx)$/)) {
      if (f.includes('__tests__') || f.includes('.test.') || f.includes('seed.ts') || f.includes('node_modules')) continue;
      files.push({
        path: f,
        relativePath: path.relative(MONOREPO_ROOT, f),
        content: fs.readFileSync(f, 'utf-8'),
      });
    }
  }
  return files;
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

    // Skip past the parameter list — find the matching ')' for the opening '('
    // This handles destructured params like { params }: RouteParams
    const afterOpenParen = startIndex + match[0].length; // position after '('
    let parenDepth = 1;
    let closingParenIdx = -1;
    for (let i = afterOpenParen; i < content.length; i++) {
      if (content[i] === '(') parenDepth++;
      if (content[i] === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          closingParenIdx = i;
          break;
        }
      }
    }
    if (closingParenIdx === -1) continue;

    // Find the opening brace of the function body (after closing paren)
    const braceStart = content.indexOf('{', closingParenIdx + 1);
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
  // Match both `catch (err) {` and modern `catch {` (no parens)
  const catchRe = /\bcatch\s*(?:\([^)]*\)\s*)?\{/g;
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

// ──────────────────────────────────────────────────────────
// Status Enum Extraction
// ──────────────────────────────────────────────────────────

export type StatusEnum = {
  model: string;
  field: string;
  values: string[];
};

/**
 * Extract status enum definitions from Prisma schema comments.
 * Looks for fields with inline comments like: `status String @default("draft") // draft|running|completed`
 * or `status String @default("active") // active, suspended, cancelled`
 */
export function extractStatusEnums(schemaContent: string): StatusEnum[] {
  const enums: StatusEnum[] = [];
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRe.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelStart = schemaContent.indexOf('{', modelMatch.index);
    const modelBody = extractBraceBlock(schemaContent, modelStart);
    if (!modelBody) continue;

    // Match fields with status-like comments: fieldName String ... // value1|value2 or value1, value2
    const fieldRe = /^\s+(\w+)\s+String\b[^/\n]*\/\/\s*(.+)$/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRe.exec(modelBody)) !== null) {
      const fieldName = fieldMatch[1];
      const comment = fieldMatch[2].trim();

      // Parse pipe-separated or comma-separated values
      let values: string[];
      if (comment.includes('|')) {
        values = comment.split('|').map((v) => v.trim()).filter(Boolean);
      } else if (comment.includes(',')) {
        values = comment.split(',').map((v) => v.trim()).filter(Boolean);
      } else {
        continue; // Not a multi-value enum comment
      }

      // Filter out values that contain spaces (not valid status identifiers)
      values = values.filter((v) => /^[\w.-]+$/.test(v));

      // Only include if we got 3+ values (real enum, not a description)
      if (values.length < 3) continue;

      // Expand range notation like phase_1..4
      const expanded: string[] = [];
      for (const v of values) {
        const rangeMatch = v.match(/^(\w+?)(\d+)\.\.(\d+)$/);
        if (rangeMatch) {
          const prefix = rangeMatch[1];
          const start = Number(rangeMatch[2]);
          const end = Number(rangeMatch[3]);
          for (let i = start; i <= end; i++) {
            expanded.push(`${prefix}${i}`);
          }
        } else {
          expanded.push(v);
        }
      }

      enums.push({ model: modelName, field: fieldName, values: expanded });
    }
  }

  return enums;
}
