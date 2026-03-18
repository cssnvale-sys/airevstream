# Known Issues

Tracked bugs, limitations, and technical debt.

---

## Testing

### KI-001: E2E Tests Not Set Up
**Severity**: Medium
**Status**: Open
Playwright is not installed. No end-to-end browser tests exist. All 93 tests are unit/integration level via Vitest.
**Action**: `npx playwright install` + write E2E test suite for critical flows (auth, content creation, dashboard).

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
Added `GET /api/v1/jobs/:id` endpoint returning job status from WorkflowJob model, plus `useJobStatus(jobId)` SWR hook that polls every 2s until terminal state (completed/failed/cancelled).

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
**Status**: Open
`ecosystem.config.js` exists but may not cover all services/workers or have optimal resource allocation settings.
**Action**: Complete PM2 config with all processes, memory limits, restart policies, and log rotation.

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

### KI-015: Auth Utility Bugs (Deleted Users, NaN Params, No 401 Redirect)
**Severity**: Medium
**Status**: Fixed (Session 6, Round 8)
Three utility-level bugs fixed:
- `authenticate()` / `authenticateSSE()` didn't reject deleted users with valid JWTs
- `parseQuery()` produced `NaN` for non-numeric page/limit params
- `use-api.ts` fetcher had no 401 handling — no redirect to login
- AI panel stale closure bug — `input` read after `setInput('')` cleared it
