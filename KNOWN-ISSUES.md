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

### KI-021: No JWT Token Revocation on Password Change
**Severity**: Medium
**Status**: Open (Requires Schema Change)
Old JWTs remain valid after password change until they naturally expire (7 days). The change-password route now returns a fresh JWT so clients can replace the old one, but the old token isn't explicitly invalidated.
**Action**: Add `passwordChangedAt` field to User model, check it in `authenticate()` to reject tokens issued before the last password change.

### KI-040: Worker Reliability Issues
**Severity**: Low
**Status**: Partially Fixed (Session 14)
Session 14 hardened worker error handling:
- Content worker: try/catch added to `handlePublishRequest` and `handleApprove` with logging + re-throw
- Account worker: fallback mode removed (honest failure instead of placeholder creation), sync/warm degraded to warn
- Maintenance worker: try/catch around `$transaction` cleanup operations
- Production worker: try/catch around ComfyUI and Remotion chains with failed workflow job recording
Remaining: posting worker conflicting BullMQ + manual retry logic.
**Action**: Clean up posting worker retry logic.

### KI-041: Services Missing Rate Limiting and CORS Restrictions
**Severity**: Medium
**Status**: Open
All 3 Fastify services use `origin: true` CORS (allows any origin) and have no per-user rate limiting on generation endpoints.
**Action**: Restrict CORS to dashboard origin, add rate limiting to AI generation endpoints.

### KI-042: Zero Worker Processor Tests
**Severity**: High
**Status**: Partially Fixed (Session 11)
222 unit tests + 173 E2E tests. E2E tests cover all 17 pages and exercise API routes through the browser. Worker processor unit tests and multi-tenant isolation tests still needed.
**Action**: Add worker processor unit tests and targeted multi-tenant integration tests.

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

### KI-049: Cinema Pipeline Routes Missing Audit Coverage
**Severity**: Medium
**Status**: Open (Session 15)
New API routes added in Session 15 (`/api/v1/pipeline/cinema`, `/api/v1/cinema-bible/*`, `/api/v1/comfyui/models`, `/api/v1/ai/guidance`) are not yet included in the automated audit test known-violations sets. They may lack viewer role checks, rate limiting, or tenant scoping.
**Action**: Run `npm run audit` after cinema routes are fully wired, update audit allowlists as needed.

### KI-050: QC Scoring Uses Heuristics Not ML
**Severity**: Low
**Status**: By Design (Session 15)
The QC scoring module (`qc-scoring.ts`) uses buffer entropy and byte-level statistics for quality evaluation. Prompt adherence scoring is limited without a CLIP model. This is intentional for the zero-dependency baseline; ML-based scoring is a future enhancement.
**Action**: Integrate CLIP-based prompt adherence scoring when an inference endpoint is available.

---

## Recently Fixed (Sessions 10-12)

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
