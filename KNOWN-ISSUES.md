# Known Issues

Tracked bugs, limitations, and technical debt.

---

## Open Issues

### KI-073: ~~Suggestion Log Migration Not Yet Applied~~ — FIXED (Session 40)
**Severity**: Medium
**Status**: Fixed — All 9 migrations applied via `prisma migrate deploy`.

### KI-076: AccountLifecycle Migration Not Yet Applied
**Severity**: Medium
**Status**: Open (Session 42)
**Context**: Migration `0011_add_account_lifecycle` creates the AccountLifecycle table. Must run `prisma migrate deploy` before lifecycle features work. Required for email account lifecycle pipeline (discovery → signup → seasoning enrollment).

### KI-077: Non-YouTube Discovery Stubs Return Unknown
**Severity**: Low
**Status**: By Design (Session 42, D064 pattern)
**Context**: TikTok, Instagram, Facebook `discoverAccount()` implementations are stubs that return `exists: 'unknown'`. This triggers `needsHuman: true` in the lifecycle planner, requiring manual intervention for non-YouTube platforms. YouTube is the only platform with real login probe discovery.
**Action**: Implement real discovery for each platform as browser automation matures.

### KI-078: Non-YouTube Profile Setup Stubs Are No-Op
**Severity**: Low
**Status**: By Design (Session 42, D064 pattern)
**Context**: TikTok, Instagram, Facebook `setProfileAssets()` implementations are stubs that return success without doing anything. Profile setup will be "skipped" on these platforms (lifecycle continues, doesn't block). Only YouTube has real profile upload via YouTube Studio branding page.
**Action**: Implement real profile upload for each platform as browser automation matures.

### KI-074: Asset Tenant Scoping Migration Not Yet Applied
**Severity**: Medium
**Status**: Open (Session 41)
**Context**: Migration `0010_add_asset_tenant_scoping` adds tenantId to Avatar and SceneryAsset, avatarId to AssetRegistryEntry. Must run `prisma migrate deploy` before asset management features work. Existing rows will be backfilled to the first tenant.

### KI-075: MinIO CORS Configuration Required for Direct Uploads
**Severity**: Medium
**Status**: Open (Session 41)
**Context**: Presigned PUT uploads from the browser require MinIO CORS to allow PUT requests from the web origin. Update MinIO configuration or docker-compose to set `MINIO_BROWSER_CORS_ORIGIN`.

### KI-070: Simple Wizard Plan Generation Uses Fallback Only
**Severity**: Low
**Status**: Open (Session 32)
The SimpleCreateWizard generates plans using the existing content generation pipeline with preset-based configuration. There is no dedicated "simple plan" API endpoint — the wizard relies on the standard pipeline with simple mode guardrails applied client-side and via agent prompts. A dedicated endpoint could optimize plan generation for the constrained simple mode parameters.
**Action**: Consider adding a POST `/api/v1/pipeline/simple-plan` endpoint that runs a trimmed agent pipeline (director + storyboard only) with hard-coded simple mode constraints server-side.

### KI-066: Unused Dependencies (3 packages)
**Severity**: Low
**Status**: Open (Session 27 Audit — ISSUE_012/013/014)
- `class-variance-authority` in apps/web (never imported)
- `@fastify/websocket` in services/ai-assistant (never imported)
- `playwright-extra` + `puppeteer-extra-plugin-stealth` in packages/browser-automation (stealth done inline)
**Action**: `npm uninstall` each from respective workspace.

### KI-067: @types/bcrypt Version Mismatch
**Severity**: Low
**Status**: Open (Session 27 Audit — ISSUE_015)
@types/bcrypt ^5.0.0 declared but bcrypt is ^6.0.0. Types may be incomplete for v6 APIs.
**Action**: `npm install @types/bcrypt@^6.0.0` in apps/web.

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

### KI-068: Asset Registry + Sequence Prisma Migration Not Yet Applied
**Severity**: Medium
**Status**: Open (Session 31)
3 new Prisma models added to schema (AssetRegistryEntry, Sequence, SequenceItem) but `prisma migrate dev` not yet run. `prisma generate` has been run so types are available. Migration needed before production worker can register assets.
**Action**: Run `npx prisma migrate dev --name add-asset-registry-and-sequences` from packages/db.

### KI-069: VMAF + C2PA CLI Tools Not Installed
**Severity**: Low
**Status**: Open (Session 31)
G4 (VMAF) requires `ffmpeg` compiled with `--enable-libvmaf`. G6 (C2PA) requires `c2patool` CLI. Both features gracefully degrade (return failure/false) when tools are absent.
**Action**: See OPERATOR-TODO.md for installation instructions.

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
**Status**: Fixed (Session 30) — Partially (2 models remain by design)
Migration `0004_add_tenant_scoping` added tenantId to 5 models: Alert (nullable), Conversation, KnowledgeBaseEntry, PromptTemplate, CostBudget (required). All related API routes updated.
Remaining global models (intentional):
- **AiService** — global AI service registry is intentional for self-hosted deployments
- **AffiliateProduct** — shared product catalog; tenant scoping deferred pending product design decision

### KI-042: Zero Worker Processor Tests
**Severity**: High
**Status**: Partially Fixed (Session 16)
222 unit tests + 181 E2E tests (100% pass rate). E2E tests cover all 17 pages and exercise API routes through the browser. Worker processor unit tests and multi-tenant isolation tests still needed.
**Action**: Add worker processor unit tests and targeted multi-tenant integration tests.

### KI-050: QC Scoring Uses Heuristics Not ML
**Severity**: Low
**Status**: By Design (Sessions 15+20)
The QC scoring module (`qc-scoring.ts`) uses buffer entropy and byte-level statistics for quality evaluation. Now wired into the QC gate (Session 20) with per-shot retry. Prompt adherence scoring is limited without a CLIP model. This is intentional for the zero-dependency baseline; ML-based scoring is a future enhancement.
**Action**: Integrate CLIP-based prompt adherence scoring when an inference endpoint is available.

### KI-057: Cinema Bible LoRA/Lens Fields Not in UI
**Severity**: Medium
**Status**: Open (Session 20 gap analysis)
`LookBible.loras`, `LookBible.lensKit`, `CharacterBible.characterLoras`, `EnvironmentBible.lightingSetups` are all typed but have no UI editor in the Cinema Bible settings page.
**Action**: Add LoRA picker (from ComfyUI model list API), lens kit editor, color pipeline editor to Bible tabs.

### KI-059: Library AI Model Filter is Client-Side
**Severity**: Low
**Status**: Open (Session 23 audit)
The library page's AI model filter applies client-side after pagination, so it only filters items on the current page. To fix, add `aiServiceId` as a server-side query param in the content list API route.
**Action**: Add `aiServiceId` filter to GET /content route and pass from frontend.

### KI-060: Calendar Schedule Query Param Not Handled
**Severity**: Low
**Status**: Open (Session 23 audit)
The content detail "Schedule" button redirects to `/calendar?schedule={id}` but the calendar page doesn't read this query param to auto-open a scheduling dialog.
**Action**: Read `schedule` search param in calendar page and open the schedule creation form pre-populated with the content ID.

### KI-058: Empty ComfyUI Workflow Subdirectories — Partially Fixed (Session 24)
**Severity**: Low
**Status**: Partially Fixed (Session 24)
`comfyui-workflows/character/`, `environment/`, `style/` now have workflow templates (dialogue-closeup, insert-hands, establishing-wide, action-tracking). `upscale/` remains empty.
**Action**: Add upscale workflow template to `comfyui-workflows/upscale/` if needed.

### KI-062: Seasoning Pipeline Untested Against Real Platforms
**Severity**: Medium
**Status**: Open
The seasoning pipeline (signup, warming, graduation) is fully implemented but untested against real YouTube/TikTok/Instagram/Facebook. Browser automation workflows depend on platform DOM structures that may change. The pipeline is designed for graceful failure (HITL fallback), but initial runs will likely need human monitoring.
**Action**: Test with a small cohort (1-2 accounts per platform) with `headless: false` for visual verification.

### KI-063: CAPTCHA/SMS Integration Stubs Only
**Severity**: Medium
**Status**: Open
CaptchaSolver and SmsVerifier are D064 stubs — they throw without API keys and return placeholder data with them. Signup automation will hit CAPTCHA/SMS walls on all platforms without real implementations.
**Action**: Obtain 2Captcha API key and sms-activate.org API key, then implement real solver logic.

### KI-064: ~~Prisma Migration Not Applied for Seasoning Models~~ — FIXED (Session 40)
**Severity**: High
**Status**: Fixed — Migration `0008_add_seasoning_assets_sequences` applied via `prisma migrate deploy`.

### KI-072: ~~Experiment Migration Not Yet Applied~~ — FIXED (Session 40)
**Severity**: Medium
**Status**: Fixed — Migration `0006_add_experiments` applied via `prisma migrate deploy`.

### KI-061: Tier 3 Features Require External Setup
**Severity**: Low
**Status**: Partially Resolved (Session 37)
Two stub modules remain: `viral-discovery` (YouTube/TikTok API keys), `quality-regression` (ffmpeg with libvmaf). `experiment-orchestrator` was activated in Session 36. `channel-suggestions` was activated in Session 37 with channel-topic suggestion system (deterministic, no ML model needed).
**Action**: Implement remaining stubs when external dependencies are available. See OPERATOR-TODO.md.

### KI-056: Port 3000 Conflict with External Project — Fixed (Session 18)
**Severity**: Medium
**Status**: Fixed (Session 18)
A separate project (`delegayt-dashboard`, Next.js + uvicorn) was occupying port 3000, causing all AiRevStream API route tests to return `{"detail":"Not Found"}` with `server: uvicorn` headers. Killed the conflicting process and started AiRevStream's Next.js dev server. Developers should ensure no other apps are running on port 3000 before starting AiRevStream.
**Action**: None — resolved. Consider adding a port-check to dev startup scripts.

---

## Recently Fixed (Sessions 10-34)

### KI-071: D071 Conditional Tenant Scoping — Fully Resolved (Session 34)
All 60+ API routes using the `ctx.tenantId ? {...} : {}` conditional scoping pattern replaced with unconditional guard + filter. 17 additional routes using `ctx.tenantId!` without null guard also fixed. ~210 total issues fixed across 12 categories in 8-wave audit.

### KI-065: Alert Model Lacks tenantId — Fixed (Session 30)
Added nullable `tenantId` to Alert model via migration `0004_add_tenant_scoping`. All 6 alert routes and SSE stream now scope by tenantId.

### KI-056: Port 3000 Conflict with External Project — Fixed (Session 18)
A separate project (`delegayt-dashboard`) was running on port 3000 instead of AiRevStream. Killed the process and started the correct Next.js app.

### KI-053: Pending Migration 0003_add_password_changed_at Not Deployed — Fixed (Session 18)
Migration `0003_add_password_changed_at` was present in source but not applied to the database, preventing JWT revocation from functioning. Deployed via `prisma migrate deploy`.

### KI-054: .env COMFYUI_BASE_URL Mismatched Code Expectation — Fixed (Session 18)
`.env` had `COMFYUI_BASE_URL` but code and `.env.example` use `COMFYUI_URL`. Renamed env var and added missing `COMFYUI_TIMEOUT_MS`, `CORS_ORIGINS`, `NEXT_PUBLIC_APP_URL`.

### KI-055: docker-compose.yml Deprecated `version` Key — Fixed (Session 18)
Removed deprecated `version: '3.8'` that caused warning noise on every `docker compose` command.

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
