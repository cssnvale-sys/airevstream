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
**Status**: Open
Analytics export buttons trigger `window.alert("Export coming soon")` instead of generating actual files.
**Action**: Implement CSV generation (client-side) and PDF generation (server-side via puppeteer or @react-pdf/renderer).

---

## Calendar

### KI-004: Calendar Filters Are Client-Side Only
**Severity**: Low
**Status**: Open
Platform/channel/status filters in the calendar view filter the already-fetched data client-side. The API receives `start`/`end` date params but not the filter criteria.
**Action**: Add `platform`, `channelId`, and `status` query params to the calendar API route for server-side filtering.

---

## Content Generation

### KI-005: Generate-Storyboard Returns Hardcoded Shots
**Severity**: Medium
**Status**: Open
The `generate-storyboard` API route returns hardcoded placeholder shots rather than AI-generated storyboard frames. The H.I.C.C. section parser exists but isn't connected to real AI output.
**Action**: Wire storyboard generation to AI service via the content generation pipeline.

### KI-006: Generate-Shot Async Job Has No Completion Polling
**Severity**: Medium
**Status**: Open
The `generate-shot` endpoint creates an async BullMQ job but provides no mechanism for the client to poll for completion or receive a webhook notification. The frontend shows a loading state but has no way to know when the shot is ready.
**Action**: Add job status polling endpoint (`GET /api/v1/content/jobs/:jobId`) or implement SSE notification for job completion.

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
**Status**: Fixed (Session 6)
Fixed in Session 6: all API routes now wrap Decimal fields in `Number()` server-side (analytics/revenue, affiliate/products, affiliate/revenue, approvals, affiliate-pool). Frontend also adds defensive `Number()` casts (affiliate, approvals, dashboard pages). Original design decision D013 still applies for any new Decimal fields.
