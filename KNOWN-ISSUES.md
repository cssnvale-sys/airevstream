# Known Issues

Tracked bugs, limitations, and technical debt.

---

## Open Issues

### KI-002: Analytics Endpoints Return Empty Arrays for Missing Data
**Severity**: Low
**Status**: By Design
`engagement`, `roiByType`, and `audience` analytics endpoints return empty arrays when no data exists. This is intentional graceful degradation — the frontend renders "no data" states. However, these endpoints need real data models and aggregation logic to be useful.
**Action**: Populate analytics data via posting/content workers, then verify aggregation queries.

### KI-003: PDF Export Not Implemented
**Severity**: Low
**Status**: Partially Fixed (Session 7)
CSV export implemented via `exportToCSV()` utility — all 5 analytics tabs export to CSV. PDF export remains unimplemented.
**Action**: Implement PDF generation (server-side via puppeteer or @react-pdf/renderer).

### KI-005: Generate-Storyboard Returns Hardcoded Shots
**Severity**: Medium
**Status**: Open
The `generate-storyboard` API route returns hardcoded placeholder shots rather than AI-generated storyboard frames. The H.I.C.C. section parser exists but isn't connected to real AI output.
**Action**: Wire storyboard generation to AI service via the content generation pipeline.

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

### KI-042: Zero Worker Processor Tests
**Severity**: High
**Status**: Partially Fixed (Session 16)
222 unit tests + 181 E2E tests (100% pass rate). E2E tests cover all 17 pages and exercise API routes through the browser. Worker processor unit tests and multi-tenant isolation tests still needed.
**Action**: Add worker processor unit tests and targeted multi-tenant integration tests.

### KI-050: QC Scoring Uses Heuristics Not ML
**Severity**: Low
**Status**: By Design (Session 15)
The QC scoring module (`qc-scoring.ts`) uses buffer entropy and byte-level statistics for quality evaluation. Prompt adherence scoring is limited without a CLIP model. This is intentional for the zero-dependency baseline; ML-based scoring is a future enhancement.
**Action**: Integrate CLIP-based prompt adherence scoring when an inference endpoint is available.

---

## Recently Fixed (Sessions 10-17)

### KI-046: 72 Write Handlers Missing Viewer Role Checks — Fixed (Session 17)
All write handlers now have viewer role checks. `KNOWN_MISSING_VIEWER_CHECKS` reduced from 72 to 0. Audit handler extraction bug fixed (destructured params).

### KI-047: 33 Write Handlers Missing Rate Limiting — Fixed (Session 17)
All write handlers now have `checkRateLimit()`. `KNOWN_MISSING_RATE_LIMIT` reduced from 33 to 0.

### KI-048: Tenant Scoping Gaps in Affiliate Analytics — Fixed (Session 17)
Added tenant channel filtering to `affiliate/analytics` and `affiliate/products/[id]/analytics`. 2 real gaps fixed, 10 legitimate exceptions remain.

### KI-049: Cinema Pipeline Routes Missing Audit Coverage — Fixed (Session 17)
Cinema routes (`pipeline/cinema`, `cinema-bible`, `ai/guidance`) now have viewer checks and rate limiting.

### KI-021: JWT Token Revocation on Password Change — Fixed (Session 17)
Added `passwordChangedAt` to User model. `authenticate()` rejects JWTs issued before last password change.

### KI-041: Services Missing Rate Limiting and CORS — Fixed (Session 17)
All 3 Fastify services now use restricted CORS (`CORS_ORIGINS` env var) and `@fastify/rate-limit` (100 req/min).

### KI-040: Posting Worker Retry Logic — Fixed (Session 17)
Removed conflicting manual retry counting. Now uses BullMQ's `job.attemptsMade` with exponential backoff.

### KI-051: PostgreSQL Connection Pool Exhaustion During E2E Runs — Fixed (Session 16)
Prisma client used a module-level singleton that leaked connections during Next.js HMR. Switched to `globalThis` pattern (D030).

### KI-052: E2E Test Suite 18 Failures (90% Pass Rate) — Fixed (Session 16)
Fixed 18 failing E2E tests across 11 spec files. Root causes: Playwright strict mode violations, HTML5 `minLength` blocking React forms, import modal dismiss, pagination resilience, ARIA role mismatches. Now 181/181 (100%).

### KI-001: E2E Tests — Fixed (Session 11)
Playwright E2E test suite: 30 spec files, 173 test cases covering all 17 pages.

### KI-043: Status Enum Inconsistency — Fixed (Session 10)
Replaced `'review'` with `'pending_approval'` in content GET/POST schemas.

### KI-044: Missing Status Validation on Content Reject — Fixed (Session 10)
Added rejectableStatuses guard (`['generated', 'pending_approval']`).

### KI-045: Missing Decimal Conversion on Regenerate — Fixed (Session 10)
Added `Number()` conversion for Decimal fields in content regenerate.

---

## Archived Fixed Issues (Sessions 6-9)

31 issues fixed across Sessions 6-9 (KI-004, KI-006, KI-009 through KI-019, KI-022 through KI-039). See `SESSION-LOG.md` and `CHANGELOG.md` for details.
