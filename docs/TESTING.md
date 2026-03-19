# Testing Infrastructure

## Overview

AiRevStream uses a 3-tier test pyramid:

| Tier | Tool | Tests | Speed | What it catches |
|------|------|-------|-------|-----------------|
| 1. Unit | Vitest | 135 | ~1s | Package functions, API helpers, auth, rate limiting, utils |
| 2. Audit | Vitest | 24 | <1s | Source code patterns (9 bug classes from 150+ manual findings) |
| 3. E2E | Playwright | 173 | ~2-5min | Full UI flows across all 17 pages |

Total: ~332 tests.

## Quick Reference

| Command | What it runs | Scope |
|---------|-------------|-------|
| `npm test` | Unit tests via Turbo (all packages) | All packages |
| `npm run audit` | Audit tests via Turbo | apps/web |
| `npm run test:e2e` | E2E tests (needs dev server on :3000) | Full stack |
| `npm run test:e2e:ui` | E2E with Playwright UI | Full stack |
| `npx turbo build` | TypeScript compilation (14 packages) | All packages |

---

## Tier 1: Unit Tests (Vitest)

**Location**: `packages/*/__tests__/`, `apps/web/src/__tests__/`, `services/*/__tests__/`

**Run**: `npm test` or `npx turbo test`

**Coverage by package**:

| Package | Tests | What's tested |
|---------|-------|---------------|
| `@airevstream/web` | 135 | API server helpers, auth, rate limiting, password hashing, export utils |
| `@airevstream/shared` | ~20 | Config, constants, utility functions |
| `@airevstream/crypto` | ~10 | AES-256-GCM encrypt/decrypt |
| `@airevstream/queue` | ~10 | Job type definitions, queue helpers |
| `@airevstream/ai-client` | ~15 | Provider registry, Ollama client |
| `@airevstream/storage` | ~5 | MinIO/S3 client operations |
| `@airevstream/audio-engine` | ~10 | TTS providers, audio processing |
| `@airevstream/browser-automation` | ~15 | Stealth browser, human behavior simulation |
| Services (3) | ~15 | Fastify auth plugins, route handlers |

---

## Tier 2: Code Quality Audit (Vitest)

**Location**: `apps/web/src/__tests__/audit/`

**Run**: `npm run audit` or `npx turbo audit`

**Purpose**: Reads source files as strings and scans for violation patterns. Prevents regression of 9 recurring bug classes discovered across 10 manual audit sessions (150+ bugs fixed). Runs in <1 second. Zero new dependencies.

### Bug Classes

| # | File | Bug Class | Method | Known Gaps |
|---|------|-----------|--------|------------|
| 1 | `silent-catch.audit.test.ts` | Silent catch blocks | Brace-matching + logging regex | 1 |
| 2 | `getdb-in-routes.audit.test.ts` | `getDb()` in authenticated routes | String match | 0 |
| 3 | `error-leak.audit.test.ts` | `err.message` leaked in responses | Regex (error() helper calls) | 0 |
| 4 | `tenant-scoping.audit.test.ts` | Missing tenant scoping | Schema model classification + regex | 12 |
| 5 | `data-shape.audit.test.ts` | API/frontend data shape mismatch | Targeted sub-patterns | 0 |
| 6 | `decimal-wrapping.audit.test.ts` | Decimal fields not wrapped | Schema field parsing + regex | 0 |
| 7 | `error-allowlist.audit.test.ts` | Error message allowlist drift | Cross-file string comparison | 0 |
| 8 | `role-checks.audit.test.ts` | Missing viewer role checks | Handler extraction + regex | 70 |
| 9 | `rate-limiting.audit.test.ts` | Missing rate limiting | Handler extraction + regex | 31 |

"Known Gaps" = pre-existing violations tracked in `audit-helpers.ts` known lists. New regressions fail the test.

### Shared Utilities

`audit-helpers.ts` provides:
- `findApiRouteFiles()` — discovers all `route.ts` under `app/api/v1/`
- `extractHandlers(content)` — extracts HTTP handler functions
- `extractBraceBlock(content, index)` — brace-matching for code blocks
- `extractCatchBlocks(content)` — finds catch blocks with line numbers
- `extractDecimalFields(schema)` — parses Prisma schema for Decimal fields
- `extractTenantScopedModels(schema)` — classifies models by tenant scope
- `extractErrorMessages(content)` — extracts error() message strings
- `extractSafeMessages(content)` — extracts frontend safeMessages arrays
- Allowlists: `GETDB_ALLOWLIST`, `RATE_LIMIT_EXEMPT`, `VIEWER_WRITE_EXEMPT`
- Known violations: `KNOWN_MISSING_VIEWER_CHECKS`, `KNOWN_MISSING_RATE_LIMIT`, `KNOWN_MISSING_TENANT_SCOPE`, `KNOWN_SILENT_CATCHES`

### Adding New Rules

1. Create `apps/web/src/__tests__/audit/new-pattern.audit.test.ts`
2. Add shared helpers to `audit-helpers.ts` if needed
3. Run `npm run audit` to verify it catches the pattern
4. Fix existing violations or add to known list with justification
5. Document the rule in `.claude/rules/`

### Reducing Known Violations

When fixing a known violation:
1. Apply the fix to the route file
2. Remove the entry from the known list in `audit-helpers.ts`
3. Run `npm run audit` to verify the test still passes (without the allowlist entry)

---

## Tier 3: E2E Tests (Playwright)

**Location**: `e2e/`

**Run**: `npm run test:e2e` (requires dev server running on :3000)

**Run with UI**: `npm run test:e2e:ui`

**Config**: `e2e/playwright.config.ts`
- Sequential execution (workers: 1)
- StorageState auth (logs in once, reuses `.auth/admin.json`)
- Chromium only

### Auth

- `e2e/fixtures/auth.fixture.ts` — logs in as admin, saves session
- Admin credentials: `admin@airevstream.local` / `changeme123`

### Test Data

- `e2e/fixtures/test-data.ts` — seed IDs matching `packages/db/prisma/seed.ts`
- Test-created data convention: `e2e-*@e2e-test.local` emails, `[E2E]` prefixed names

### Helpers

- `e2e/helpers/api.helper.ts` — `apiGet`, `apiPost`, `apiPut`, `apiDelete`
- `e2e/helpers/wait.helper.ts` — `waitForToast`, `waitForDataLoad`

### Pages Covered

30 spec files, 173 tests across all pages:

| Area | Spec File | Tests |
|------|-----------|-------|
| Auth | `auth/login.spec.ts` | 5 |
| Auth | `auth/register.spec.ts` | 5 |
| Auth | `auth/forgot-password.spec.ts` | 4 |
| Auth | `auth/logout.spec.ts` | 2 |
| Dashboard | `dashboard/dashboard.spec.ts` | 5 |
| Dashboard | `dashboard/navigation.spec.ts` | 3 |
| Accounts | `accounts/accounts-list.spec.ts` | 6 |
| Accounts | `accounts/accounts-crud.spec.ts` | 3 |
| Accounts | `accounts/accounts-bulk.spec.ts` | 4 |
| Library | `library/library-list.spec.ts` | 12 |
| Library | `library/library-detail.spec.ts` | 3 |
| Content | `content/content-create.spec.ts` | 8 |
| Content | `content/content-approve.spec.ts` | 5 |
| Approvals | `approvals/approvals-list.spec.ts` | 11 |
| Approvals | `approvals/approvals-actions.spec.ts` | 6 |
| Calendar | `calendar/calendar.spec.ts` | 17 |
| Analytics | `analytics/analytics-tabs.spec.ts` | 6 |
| Analytics | `analytics/analytics-export.spec.ts` | 3 |
| Affiliate | `affiliate/affiliate-products.spec.ts` | 6 |
| Affiliate | `affiliate/affiliate-storefronts.spec.ts` | 5 |
| Settings | `settings/settings-general.spec.ts` | 4 |
| Settings | `settings/settings-security.spec.ts` | 8 |
| Settings | `settings/settings-appearance.spec.ts` | 6 |
| Settings | `settings/settings-ai.spec.ts` | 7 |
| System | `system/system-health.spec.ts` | 5 |
| Workflows | `workflows/workflows-list.spec.ts` | 6 |
| Shared | `shared/404.spec.ts` | 3 |
| Shared | `shared/auth-guard.spec.ts` | 4 |
| Shared | `shared/keyboard-shortcuts.spec.ts` | 6 |
| Shared | `shared/notifications.spec.ts` | 5 |

### Adding New Tests

- Follow existing patterns in `e2e/tests/`
- Use semantic selectors: `getByLabel`, `getByRole`, `getByText` (not CSS classes)
- Clean up test data in `afterAll` hooks

---

## Seed Data

- Schema: `packages/db/prisma/seed.ts`
- Admin user: `admin@airevstream.local` / `changeme123`
- Known IDs: documented in `e2e/fixtures/test-data.ts`
- Run seed: `npx turbo db:generate && npx prisma db seed --schema=packages/db/prisma/schema.prisma`
