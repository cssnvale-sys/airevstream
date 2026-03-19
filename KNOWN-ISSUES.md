# Known Issues

Tracked bugs, limitations, and technical debt.

---

## Testing

### KI-001: E2E Tests Not Set Up
**Severity**: Medium
**Status**: Fixed (Session 11)
Playwright E2E test suite implemented: 30 spec files with 170 test cases covering all 17 pages (auth, dashboard, accounts, library, create, approvals, calendar, analytics, affiliate, workflows, system, settings, 404, keyboard shortcuts, auth guard, notifications). Infrastructure includes storageState auth, API helpers, wait helpers, and global setup/teardown.

---

## Analytics

### KI-002: Analytics Endpoints Return Empty Arrays for Missing Data
**Severity**: Low
**Status**: By Design
`engagement`, `roiByType`, and `audience` analytics endpoints return empty arrays when no data exists. This is intentional graceful degradation — the frontend renders "no data" states. However, these endpoints need real data models and aggregation logic to be useful.
**Action**: Populate analytics data via posting/content workers, then verify aggregation queries.

### KI-003: CSV/PDF Export Buttons Are Stubs
**Severity**: Low
**Status**: Partially Fixed (Session 7)
CSV export implemented via `exportToCSV()` utility — all 5 analytics tabs export to CSV. PDF export remains unimplemented.
**Action**: Implement PDF generation (server-side via puppeteer or @react-pdf/renderer).

---

## Calendar

### KI-004: Calendar Filters Are Client-Side Only
**Severity**: Low
**Status**: Fixed (Session 7)
Calendar page now passes channelId, platform, and status as query params to the API for server-side filtering.

---

## Content Generation

### KI-005: Generate-Storyboard Returns Hardcoded Shots
**Severity**: Medium
**Status**: Open
The `generate-storyboard` API route returns hardcoded placeholder shots rather than AI-generated storyboard frames. The H.I.C.C. section parser exists but isn't connected to real AI output.
**Action**: Wire storyboard generation to AI service via the content generation pipeline.

### KI-006: Generate-Shot Async Job Has No Completion Polling
**Severity**: Medium
**Status**: Fixed (Session 7)
Added `GET /api/v1/jobs/:id` endpoint returning job status from WorkflowJob model, plus `useJobStatus(jobId)` SWR hook that polls every 2s until terminal state (completed/failed/cancelled). **Note**: The create page uses per-shot local state simulation instead of the hook — the hook is available for future features (e.g. video rendering progress) but has zero current importers.

---

## Platform Integration

### KI-007: Platform Posting Adapters Untested Against Real APIs
**Severity**: High
**Status**: Open
All 4 platform adapters (YouTube Data API v3, TikTok Content Posting API, Instagram Graph API, Facebook Graph API) are implemented but untested against real platform APIs. They require valid OAuth credentials.
**Action**: Set up developer accounts, configure OAuth credentials (see OPERATOR-TODO.md #6), and test each adapter with real API calls.

### KI-008: Browser Automation Untested in Production
**Severity**: Medium
**Status**: Open
The `@airevstream/browser-automation` package (stealth Playwright, human behavior simulation, proxy rotation) is implemented and has 3 unit tests, but has not been tested with real browsers, real proxies, or real platform login flows.
**Action**: Test in a controlled environment with real browser sessions and proxy infrastructure.

---

## API Quality

### KI-009: Multiple API Routes Use getDb() Instead of ctx.db
**Severity**: Medium
**Status**: Fixed (Session 6)
Fixed 7 API routes that called `getDb()` instead of `ctx.db`: auth/me, auth/change-password, activity, approvals/[id]/[action], system/health, system/alerts/[id]/snooze, settings/ai/fallback-chains. Auth routes (login, register) are excluded — they don't have authenticated context.

### KI-010: Silent Catch Blocks in 14+ API Routes
**Severity**: Medium
**Status**: Fixed (Session 6)
Added `console.error` logging to 28 silent catch blocks across settings (4), auth (3), accounts (9), channels (12), and workflows (1) API routes. All catch blocks now log the error with route/method context before returning the error response.

---

## Infrastructure

### KI-011: PM2 Production Config Is Partial
**Severity**: Low
**Status**: Fixed (Session 7)
`ecosystem.config.js` now covers all 4 services + 6 workers with full production config: max_memory_restart (128M–512M), restart_delay (5s), min_uptime (10s), max_restarts (10), structured log files per process, log_date_format. All 3 Fastify services have SIGTERM/SIGINT graceful shutdown handlers.

---

## Data Types

### KI-012: Prisma Decimal Fields Serialize as Strings
**Severity**: Low
**Status**: Fixed (Session 6, Rounds 5-6-9)
Fixed across 30+ API routes and 6 frontend pages. All Decimal fields now wrapped in `Number()` server-side. Frontend adds defensive `Number()` casts. Original design decision D013 still applies for any new Decimal fields.

---

## Security (Found & Fixed in Session 6)

### KI-013: Missing Access Control on Tenant/User/Schedule/Calendar APIs
**Severity**: Critical
**Status**: Fixed (Session 6, Round 8)
Four critical authorization bypass vulnerabilities found and fixed:
- Tenants POST had no auth — any anonymous request could create tenants
- Tenants GET/PUT/DELETE `[id]` had no access control — any authenticated user could modify any tenant
- Users GET/PUT/DELETE `[id]` had no self-or-admin check — any user could read/modify other users
- Schedule POST/PUT/DELETE had no tenant scoping — content from other tenants could be scheduled
- Calendar GET had no tenant scoping — events from other tenants were visible

### KI-014: API Routes Leaking err.message to Clients
**Severity**: Medium
**Status**: Fixed (Session 6, Round 9)
5 settings routes returned raw `err.message` in error responses, potentially leaking internal Prisma/DB error details to clients. Replaced with static error strings.

### KI-016: Missing Tenant Scoping on Analytics Routes
**Severity**: Critical
**Status**: Fixed (Session 7, Batch 21)
All 7 analytics routes (overview, engagement, revenue, costs, content-performance, audience, export) had no tenant scoping — any authenticated user could see analytics data from all tenants. Fixed by pre-fetching tenant channel IDs and filtering all queries.

### KI-017: Missing Tenant Scoping on Approvals Routes
**Severity**: Critical
**Status**: Fixed (Session 7, Batch 39)
Approvals GET returned all tenants' content. Approvals POST approve/reject allowed cross-tenant actions. Fixed by adding channel→socialAccount→emailAccount→tenantId filter on GET and using findFirst with tenant scope on POST.

### KI-018: Missing Tenant Scoping on accounts/channels Detail Routes
**Severity**: Critical
**Status**: Fixed (Session 7, Batch 42)
GET/PUT/DELETE on accounts/[id] had no tenantId check. GET/PUT on channels/[id] had no tenant chain verification. Fixed by using findFirst with tenant scope.

### KI-019: Missing Tenant Scoping on System/Activity/Affiliate Routes
**Severity**: High
**Status**: Fixed (Session 7, Batch 43)
system/workflows returned all tenants' jobs. Activity feed showed all tenants' content/posts. Affiliate revenue/clicks had no tenant filtering. Fixed by scoping via tenant channel/account IDs.

### KI-020: Models Without tenantId — Need Schema Migration
**Severity**: Medium
**Status**: Open (Requires Schema Change)
Several models lack `tenantId` and cannot be tenant-scoped without a Prisma schema migration:
- **Conversation** — AI chat conversations are globally visible. Needs `userId` and/or `tenantId` field.
- **KnowledgeBaseEntry** — Knowledge base entries are shared globally. Needs `tenantId` for isolation.
- **PromptTemplate** — Prompt templates are shared globally. Needs `tenantId` for isolation.
- **CostBudget** — Cost budgets are not tenant-scoped. Needs `tenantId` field.
- **Alert** — System alerts are global. Needs `tenantId` or category-based scoping.
- **AiService** — AI service registry is global (may be intentional for self-hosted).
- **AffiliateProduct** — Products are global (may need `tenantId` or shared product catalog design).
**Action**: Add `tenantId` fields to these models in a future schema migration and update all related API routes.

### KI-021: No JWT Token Revocation on Password Change
**Severity**: Medium
**Status**: Open (Requires Schema Change)
Old JWTs remain valid after password change until they naturally expire (7 days). The change-password route now returns a fresh JWT so clients can replace the old one, but the old token isn't explicitly invalidated.
**Action**: Add `passwordChangedAt` field to User model, check it in `authenticate()` to reject tokens issued before the last password change.

### KI-022: API Key Authentication Not Implemented
**Severity**: Medium
**Status**: Fixed (Session 7, Batch 111)
Added `authenticateApiKey()` and `authenticateAny()` functions in api-server.ts. Validates X-API-Key header, verifies hash against DB, checks status/expiry, enforces scope requirements, and applies per-key rate limiting (rateLimitRpm). Routes can use `authenticateAny()` to accept either JWT or API key.

### KI-024: Open Redirect Vulnerability on Login Page
**Severity**: High
**Status**: Fixed (Session 7, Batch 118)
Login page accepted arbitrary redirect URLs from query params, allowing attackers to redirect authenticated users to external phishing sites. Fixed by validating redirect param starts with `/` and not `//`.

### KI-023: Missing Admin Role Checks on AI Service Routes
**Severity**: High
**Status**: Fixed (Session 7, Batch 116)
5 AI service management routes had no role check — any authenticated user could register/modify services or view infrastructure cost data. Fixed by adding `ctx.role !== 'admin'` guards to POST create, PUT update, POST health-check, GET costs, GET usage. DELETE already had the check.

### KI-025: SSRF in AI Health-Check Endpoint
**Severity**: Critical
**Status**: Fixed (Session 7, Batch 135)
AI health-check fetched arbitrary URLs from DB `endpoint` field. Admin could point to internal IPs (169.254.169.254, localhost, RFC1918). Fixed with `isPrivateUrl()` check — blocks loopback/link-local/RFC1918 except Ollama on localhost:11434.

### KI-026: Open Redirect via Affiliate Link
**Severity**: High
**Status**: Fixed (Session 7, Batch 135)
Public `/api/v1/affiliate/redirect/[shortCode]` redirected to `product.url` without protocol validation. URLs with `javascript:`, `data:`, or `ftp:` scheme could be used. Fixed by validating protocol is `http:` or `https:` at redirect time.

### KI-027: Rate Limiter Cleanup Bug
**Severity**: High
**Status**: Fixed (Session 7, Batch 135)
The cleanup interval captured the `windowMs` from the first `checkRateLimit` call and used it for ALL entries. Entries with longer windows (e.g., 1-hour content generation) were incorrectly evicted using a shorter window (e.g., 15-minute login). Fixed by storing `windowMs` per entry.

### KI-028: Auth Pages Error Handling Mismatch + Missing Tenant on Register
**Severity**: Critical
**Status**: Fixed (Session 8)
Multiple auth flow bugs:
1. Login page error allowlist had `'Invalid credentials'` but API returned `'Invalid email or password'` — ALL login errors displayed as generic "Login failed" hiding real cause (wrong password, rate limited, server error)
2. Register page safe messages list had `'Email already registered'` but API returned `'A user with this email already exists'` — ALL register errors showed "Registration failed"
3. Forgot-password and reset-password pages passed raw `data.error.message` to UI — leaked internal error messages
4. Register route created users without a tenant (`tenantId: null`), breaking every tenant-scoped API call after login
5. Seed script admin user created without a tenant
**Fix**: Corrected allowlists to match actual API messages, added sanitized error handling to forgot/reset pages, register now creates tenant+user in a transaction, seed creates default tenant.

### KI-015: Auth Utility Bugs (Deleted Users, NaN Params, No 401 Redirect)
**Severity**: Medium
**Status**: Fixed (Session 6, Round 8)
Three utility-level bugs fixed:
- `authenticate()` / `authenticateSSE()` didn't reject deleted users with valid JWTs
- `parseQuery()` produced `NaN` for non-numeric page/limit params
- `use-api.ts` fetcher had no 401 handling — no redirect to login
- AI panel stale closure bug — `input` read after `setInput('')` cleared it

### KI-029: Missing Viewer Role Checks on 53 Write Endpoints
**Severity**: Critical
**Status**: Fixed (Session 9)
53 POST/PUT/PATCH/DELETE handlers had no `ctx.role === 'viewer'` guard — any authenticated user with viewer role could create/modify/delete resources. Fixed by adding `forbidden('Viewers cannot perform this action')` checks to all write endpoints across accounts, channels, content, affiliate, budgets, schedule, knowledge-base, prompts, api-keys, approvals, and system alerts.

### KI-030: TOCTOU Race Conditions in State-Check-Then-Update Patterns
**Severity**: Medium
**Status**: Fixed (Session 9)
Multiple routes had find-then-update without atomic transactions:
- `approvals/[id]/[action]` — could approve content whose status changed between check and update
- `content/[id]` DELETE — could delete content whose status changed (destructive)
- `workflows/hitl/[id]/complete` — could double-complete a HITL task
Fixed by converting to interactive `$transaction(async (tx) => { ... })` pattern.

### KI-031: N+1 Query in budgets/check Endpoint
**Severity**: Medium
**Status**: Fixed (Session 9)
`GET /api/v1/budgets/check` ran serial aggregate + update queries per budget in a for loop. With 50 budgets, this meant 100 sequential DB queries. Fixed with `Promise.all` for parallel aggregation + batch `$transaction` for updates.

### KI-032: Tenant Scoping Gaps in Content Variants/Versions Queries
**Severity**: High
**Status**: Fixed (Session 9)
`content/[id]/variants` GET and `content/[id]/versions` GET had secondary `findMany` queries for variant/version chains without tenant scoping — an attacker with a valid rootId could read cross-tenant content variants/versions. Fixed by adding tenant chain filter.

### KI-033: Silent authenticate() DB Failures
**Severity**: Medium
**Status**: Fixed (Session 9)
`authenticate()` and `authenticateSSE()` in api-server.ts had a single catch block covering both JWT verification (expected) and DB user lookup (unexpected). A DB connection failure silently returned 401 "Invalid or expired token" instead of logging the real error. Fixed by separating into nested try/catch — JWT errors return 401, DB errors log + return 500.

### KI-034: Service Auth Plugins Lack Error Logging
**Severity**: Medium
**Status**: Fixed (Session 9)
All 3 Fastify service auth plugins (workflow-engine, ai-assistant, production-pipeline) caught JWT verification errors without logging — made security auditing impossible. Fixed by adding `fastify.log.warn()` with error details, URL, and method.

### KI-035: ComfyUI URL Leaked in Status Endpoint Response
**Severity**: Medium
**Status**: Fixed (Session 9)
`/api/images/comfyui/status` endpoint returned the internal `COMFYUI_URL` in the response body, leaking infrastructure details to authenticated users. Removed URL from response.

### KI-036: Settings GET Handlers Missing try/catch
**Severity**: Low
**Status**: Fixed (Session 9)
5 settings GET handlers (security, general, appearance, notifications, api-keys) had no try/catch — DB errors would propagate as unhandled promise rejections. Fixed by wrapping in try/catch with error logging.

### KI-037: Missing Rate Limiting on Content Write Endpoints
**Severity**: Low
**Status**: Fixed (Session 9)
Several content write endpoints (variants POST, storyboard PUT, affiliate-pool POST/DELETE) had no rate limiting while similar endpoints did. Fixed by adding `checkRateLimit()` calls.

### KI-038: Unbounded findMany on Variants/Versions
**Severity**: Low
**Status**: Fixed (Session 9)
`content/[id]/variants` and `content/[id]/versions` had `findMany` without `take` limit — could return unbounded results for content with many versions. Added `take: 100`.

### KI-039: Frontend Silent Catch Blocks
**Severity**: Low
**Status**: Fixed (Session 9)
3 frontend catch blocks missing `console.error()`: analytics CSV export, library delete, accounts bulk import. Fixed by adding error logging.

### KI-040: Worker Reliability Issues (Documented)
**Severity**: Medium
**Status**: Open (Needs Deeper Refactoring)
Workers have several reliability patterns that need addressing:
- Account worker fallback mode masks failures (creates placeholder when automation fails)
- Content worker `handlePublishRequest` and `handleApprove` have no try/catch
- Production worker has unhandled async operations in ComfyUI/Remotion chains
- Posting worker has conflicting BullMQ + manual retry logic
- Maintenance worker cleanup has no try/catch
**Action**: Refactor worker error handling — each processor should use try/catch, update job status on failure, not create fallback entities.

### KI-041: Services Missing Rate Limiting and CORS Restrictions
**Severity**: Medium
**Status**: Open
All 3 Fastify services use `origin: true` CORS (allows any origin) and have no per-user rate limiting on generation endpoints.
**Action**: Restrict CORS to dashboard origin, add rate limiting to AI generation endpoints.

### KI-042: Zero API Route and Worker Processor Tests
**Severity**: High
**Status**: Partially Fixed (Session 11)
222 unit tests + 170 E2E tests. E2E tests cover all 17 pages and exercise API routes through the browser (login, CRUD, approvals, settings). Worker processor unit tests and multi-tenant isolation tests still needed.
**Action**: Add worker processor unit tests and targeted multi-tenant integration tests.

### KI-043: Status Enum Inconsistency in Content Routes
**Severity**: Medium
**Status**: Fixed (Session 10)
`content/route.ts` GET validStatuses and POST schema used `'review'` while the Prisma schema and 15+ other route files used `'pending_approval'`. The approve route also had both `'review'` and `'pending_approval'` in its approvableStatuses. Fixed by replacing `'review'` with `'pending_approval'` consistently.

### KI-044: Missing Status Validation on Content Reject
**Severity**: High
**Status**: Fixed (Session 10)
`content/[id]/reject` could reject content in any status — including `posted`, `archived`, `approved`, or `draft`. This allowed reverting published content to draft without proper validation. Fixed by adding rejectableStatuses guard (`['generated', 'pending_approval']`).

### KI-045: Missing Decimal Conversion on Content Regenerate
**Severity**: Medium
**Status**: Fixed (Session 10)
`content/[id]/regenerate` returned raw Prisma object with Decimal fields serialized as strings. All other content routes (approve, reject, GET, PUT) properly converted Decimal fields with `Number()`. Fixed for consistency.

### KI-046: 70 Write Handlers Missing Viewer Role Checks
**Severity**: High
**Status**: Open (Tracked by audit, Session 12)
70 POST/PUT/PATCH/DELETE handlers in authenticated routes do not check `ctx.role === 'viewer'`. Viewers could potentially perform write operations. All violations tracked in `KNOWN_MISSING_VIEWER_CHECKS` in `apps/web/src/__tests__/audit/audit-helpers.ts`. Automated audit test prevents new regressions.
**Action**: Add viewer check to each handler. Remove from known list as fixed.

### KI-047: 31 Write Handlers Missing Rate Limiting
**Severity**: Medium
**Status**: Open (Tracked by audit, Session 12)
31 POST/PUT/PATCH/DELETE handlers lack `checkRateLimit()` calls. Tracked in `KNOWN_MISSING_RATE_LIMIT`.
**Action**: Add rate limiting to each handler. Remove from known list as fixed.

### KI-048: 12 Routes Missing Tenant Scoping
**Severity**: High
**Status**: Open (Tracked by audit, Session 12)
12 routes access tenant-scoped models without filtering by `ctx.tenantId`. Some are legitimate (admin-only, self-service by userId), others are real gaps (affiliate analytics). Tracked in `KNOWN_MISSING_TENANT_SCOPE`.
**Action**: Assess each route — fix real gaps, document legitimate exceptions.
