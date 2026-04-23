# Known Issues

Tracked bugs, limitations, and technical debt.

---

## Open Issues

### KI-093: ~~Auth pages rendered generic fallback for every validation error~~ — FIXED (Session 50)
**Severity**: High (users couldn't see which field was wrong on register/reset/forgot)
**Status**: Fixed (Session 50)
`formatZodErrors()` (in `apps/web/src/lib/api-server.ts`) prefixes each message with the field path — e.g. `"password: Password must be at least 8 characters"`. The auth-page `safeMessages` allowlists only contained the bare messages, so every validation error dropped to the generic fallback. Fix: new `pickSafeMessage()` helper tolerates both the exact string and the prefixed variant, stripping `"field: "` before matching.
**Action**: None — resolved.

### KI-094: ~~POST /content dropped storyboard shots into generationParams instead of persisting them~~ — FIXED (Session 50)
**Severity**: Critical (production-pipeline workers rendered nothing)
**Status**: Fixed (Session 50)
The create path serialised the shot array into `ContentItem.generationParams` JSON and never touched `Storyboard` / `StoryboardShot`. Workers that read from the relational tables saw empty shot lists even when the assistant generated a full board. Fix: wrap create in a `$transaction`; when shots are provided, insert the `Storyboard` row plus a `StoryboardShot` per shot with cumulative `startSec/endSec`, `shotspec={promptBlocks, duration}`, `keyframeUrls`, `status='pending'`.
**Action**: None — resolved.

### KI-095: ~~No affiliate click conversion endpoint — revenue permanently zero~~ — FIXED (Session 50)
**Severity**: Critical (entire revenue dashboard was decorative)
**Status**: Fixed (Session 50)
The redirect endpoint only knew about clicks; there was no way to record conversion. Postbacks from Amazon Associates / Impact / ShareASale had nowhere to land, and the manual admin "mark converted" flow didn't exist. Fix: new `POST /api/v1/affiliate/clicks/[id]/convert`, accepting Bearer JWT or X-API-Key, tenant-scoped through the channel chain, transactional, 409 on double-conversion, bumps `AffiliateProduct.totalRevenue` / `totalConversions`.
**Action**: None — resolved. Operators wanting automatic attribution still need to configure postback URLs at the network (outside the codebase).

### KI-096: ~~Budget check computed thresholds but never persisted Alert rows~~ — FIXED (Session 50)
**Severity**: High (cost/alerts page was empty no matter what)
**Status**: Fixed (Session 50)
`GET /api/v1/budgets/check` returned the over-threshold list in the response but never wrote an `Alert` row. The system/alerts UI has no "virtual alerts" concept, so there was nothing for operators to acknowledge. Fix: the check endpoint now inserts `Alert` rows with metadata `alertKey = budget:<id>:<threshold|exceeded>` and dedupes against any open/acknowledged cost alert from the last 24 h.
**Action**: None — resolved.

### KI-097: ~~No public storefront page — /p/[slug] 404'd~~ — FIXED (Session 50)
**Severity**: High (storefronts were invisible to end users)
**Status**: Fixed (Session 50)
`Storefront.slug` and `status='published'` existed in the schema but nothing rendered them publicly. Shareable storefront URLs in the dashboard led to a Next.js 404. Fix: new `apps/web/src/app/p/[slug]/page.tsx` + `apps/web/src/app/api/v1/public/storefronts/[slug]/route.ts`. Both 404 for non-published slugs so drafts can't be scraped; the API is rate-limited at 120 req/min per IP; outbound links carry `rel="sponsored nofollow noopener"`.
**Action**: None — resolved.

### KI-098: ~~No manual-winner-declaration endpoint for experiments~~ — FIXED (Session 50)
**Severity**: Medium (partial automation — some experiments need operator judgement)
**Status**: Fixed (Session 50)
The evaluate worker auto-declared winners when significance + sample size met thresholds, but operators had no endpoint to complete an experiment that needed human judgement (low traffic, qualitative trade-offs). Fix: new `POST /api/v1/experiments/[id]/declare-winner` accepts `{ variantId, notes? }` from `running | evaluating | stopped`, validates variant ownership, sets `status='completed'`, `winnerId`, `endedAt`, and stamps `declaredWinner: { declaredBy, declaredAt, notes }` into `config` for audit.
**Action**: None — resolved.

### KI-087: ~~minio-init Entrypoint Heredoc Broken by YAML Folding~~ — FIXED (Session 49)
**Severity**: Critical (blocked fresh-machine bringup)
**Status**: Fixed (Session 49)
`docker-compose.yml`'s `minio-init` service used `entrypoint: >` (folded scalar) around a heredoc configuring the S3 CORS policy. YAML folded the heredoc body into a single line, so `cat <<CORS … CORS` ran as `cat '{' '…' '}' 'CORS'` and exited with `cat: '{': No such file or directory`. `make bootstrap` failed at the container-init step on a clean checkout. Rewrote the entrypoint to use a single-line `echo '{json}' > /tmp/cors.json` that survives YAML folding.
**Action**: None — resolved.

### KI-092: ~~Workers Boot MaxListenersExceededWarning~~ — FIXED (Session 49)
**Severity**: Low (cosmetic; masked real leaks)
**Status**: Fixed (Session 49)
Nine BullMQ Worker instances each install a SIGTERM/SIGINT exit listener on `process`, putting the count at 11 and tripping Node's default limit of 10 with `(node:NNN) MaxListenersExceededWarning: Possible EventEmitter memory leak detected`. Fix: `workers/src/index.ts` calls `process.setMaxListeners(20)` at module load. Still well below the threshold that would indicate a real leak, but silences the false positive and keeps the log signal-to-noise up.
**Action**: None — resolved.

### KI-091: ~~Workers Process Exits Silently on Uncaught Exception~~ — FIXED (Session 49)
**Severity**: High (cost 1+ hr of debugging a symptom — stuck jobs with no log evidence)
**Status**: Fixed (Session 49)
During E2E verification, an unhandled exception inside a worker processor (suspected in the registry/ollama path under qwen3.5:122b load) killed the workers node process with zero log output. Node's default `uncaughtException` handler exits when no listener is registered. Jobs remained in `bull:content:active` with stale `:lock` keys; the stalled-check watchdog couldn't recover them because the process was gone. Fix: `workers/src/index.ts` registers `process.on('uncaughtException', …)` that logs the full stack via Pino before calling `process.exit(1)` with a 100 ms pino-flush delay so a supervisor (PM2/launchd/systemd) can restart cleanly. `unhandledRejection` logs only — BullMQ job failures should surface through per-queue `on('failed')` handlers, not kill the host. Next silent crash will leave a stack trace.
**Action**: None — resolved. Operators running workers under PM2/launchd should verify the restart policy (`pm2 start workers --restart-delay 5000` recommended).

### KI-090: ~~qwen3 Thinking Mode Makes Content Generation Take 4+ Minutes by Default~~ — FIXED (Session 49)
**Severity**: Medium (usability — not a correctness bug)
**Status**: Fixed (Session 49)
Qwen3 models (and other reasoning-capable models: deepseek-r1, etc.) run an extensive internal thinking pass before emitting the answer tokens. During E2E verification, a short HICC script generation on qwen3:8b took ~4 min wall-clock. Output was clean (`<think>` tags not in `platformMetadata.script`), but the latency made the default UX unworkable. Fix: `OllamaProvider` now defaults to `think: false` on all three chat paths (`generateText`, `generateChat`, `streamChat`), passing the flag through to `ollama-js` which disables the reasoning phase at the model level. `TextRequest` / `ChatRequest` gained `think?: boolean` so callers can opt into reasoning mode explicitly for tasks that benefit from it (viral scoring, storyboard planning, multi-step analysis). Defensive `stripThinkingTags()` also removes `<think>…</think>` blocks from response content in case a model ignores the flag. See D132.
**Action**: Callers that want deep reasoning for specific tasks (e.g. plot structure analysis) should pass `think: true` to `registry.generate()` / `provider.generateText()`. Default behavior is optimized for latency.

### KI-089: ~~Ollama Default Model Hardcoded to qwen3:8b, Ignored Operator's Pulled Tag~~ — FIXED (Session 49)
**Severity**: High (AI features returned "model not found" on any machine whose operator pulled a different tag)
**Status**: Fixed (Session 49)
The ai-client default model was compiled in as `'qwen3:8b'` in three places — the legacy `packages/ai-client/src/index.ts` API, the `OllamaProvider` itself, and the `ServiceRegistry.getModelFromCapabilities()` path that reads the seeded `AiService.capabilities.defaultModel`. Operators with a larger tag pulled (e.g. `qwen3.5:122b` on the 512 GB Mac Studio) would see the first chat or content-gen request fail because the Ollama daemon only had their tag, not `qwen3:8b`. Fixed by introducing `OLLAMA_DEFAULT_MODEL` as an env override that wins over both the compiled fallback and the DB capability when `service.provider === 'ollama'`. Evaluated at request time (not module load) so PM2 per-worker env blocks are respected. `.env.example` now documents it (default `qwen3:8b` with a comment on how to override). `scripts/doctor.sh` reads the same env var so the model-installed check matches what the code will try. See D131 for the full resolution order.
**Action**: Operators should set `OLLAMA_DEFAULT_MODEL=<your-tag>` in `.env` to match whatever tag they have pulled (check with `curl -s localhost:11434/api/tags | jq '.models[].name'`).

### KI-088: ~~Host Port Collisions on Default AiRevStream Ports~~ — FIXED (Session 49)
**Severity**: Medium
**Status**: Fixed (Session 49)
On machines that already run other dev projects, host ports 3000 (Next.js), 3001 (mission-control/openclaw), 6379 (Homebrew Redis), 11434 (Ollama) can be occupied. Fixed across the stack:
- `scripts/doctor.sh` port table now checks `3011:workflow-engine` and `6389:redis` (the new defaults) instead of `3001` and `6379`. The Redis probe parses `REDIS_URL` so any operator override is respected.
- `services/workflow-engine/src/index.ts`, `ai-assistant/src/index.ts`, and `production-pipeline/src/index.ts` now read their own named port env vars (`WORKFLOW_ENGINE_PORT`, `AI_ASSISTANT_PORT`, `PRODUCTION_PIPELINE_PORT`) before falling back to `PORT` and their defaults. The workflow-engine default is `3011`.
- `packages/shared/src/constants.ts::PORTS.WORKFLOW_ENGINE` = 3011. `ecosystem.config.js` PM2 env = 3011. `.env.example` default = 3011. `docker-compose.yml` maps Redis `6389:6379`.
- `CLAUDE.md`, `.claude/rules/03-monorepo-map.md`, and `apps/web/src/app/system/page.tsx` display labels updated to match.

Port 3000 conflicts are still the operator's call (see KI-056 for precedent with `delegayt-dashboard` LaunchAgent needing `launchctl bootout`).
**Action**: If port 3000 is taken, disable the owning LaunchAgent (`launchctl bootout gui/$UID/<label>`) or change `PORT=` in `.env`.

### KI-082: ~~SoundOutput Layer Shape Incompatible with AudioLayerSpec~~ — FIXED (Session 46)
**Status**: Fixed — Added `toAudioLayerSpec()` mapping function in production worker. Sound agent's descriptive `source` string maps to `text` field with `source: 'generate'`.

### KI-083: ~~Film Grain/Vignette Lost in Assembly Pipeline~~ — FIXED (Session 46)
**Status**: Fixed — Added `filmGrain`/`vignette` to `ColorGradeSpec`, updated `toColorGrade()`, and merged `FinishingOutput.postProcess` into render color grade in production worker.

### KI-084: ~~qualityTier vs qualityPreset Naming Inconsistency~~ — FIXED (Session 46)
**Status**: Fixed — Renamed `qualityPreset` to `qualityTier` across all 15 files (packages, queue, workers, API routes, frontend components).

### KI-085: ~~runPreGenQC Hardcodes Cinema Tier for Cost Estimation~~ — FIXED (Session 46)
**Status**: Fixed — `runPreGenQC()` now accepts a `qualityTier` parameter (default `'standard'`). Cinema route passes the actual requested tier.

### KI-079: ~~Fastify Service Routes Lack Tenant Scoping~~ — FIXED
**Severity**: High
**Status**: Fixed — Created `services/workflow-engine/src/lib/tenant.ts` with shared `resolveTenantId()` and `getTenantScope()` helpers. Applied to all account, content, and workflow route handlers. Write routes gate on tenant (403 if no context); GET reads on EmailAccount remain global (intentional per KI-020). ContentItem and WorkflowJob scoped via channel/content ownership chain.

### KI-080: ~~ColorGradeSpec Missing filmGrain/vignette Fields~~ — FIXED (Session 46)
**Status**: Fixed — Same as KI-083. Fields added to `ColorGradeSpec`, `toColorGrade()` updated, `FinishingOutput.postProcess` merged in render path.

### KI-081: ~~Duplicate ContinuityLocks Type Definition~~ — FIXED
**Severity**: Low
**Status**: Fixed — Removed duplicate `type ContinuityLocks` and `type ContinuityLockLevel` from `presets/schema.ts`. Canonical types remain in `types.ts`. Zod schemas (`ContinuityLocksSchema`, `ContinuityLockLevelSchema`) kept in `schema.ts` for runtime validation.

### KI-073: ~~Suggestion Log Migration Not Yet Applied~~ — FIXED (Session 40)
**Severity**: Medium
**Status**: Fixed — All 9 migrations applied via `prisma migrate deploy`.

### KI-076: ~~AccountLifecycle Migration Not Yet Applied~~ — FIXED (Session 48)
**Status**: Fixed — Migration `0011_add_account_lifecycle` exists and creates the AccountLifecycle table.

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

### KI-074: ~~Asset Tenant Scoping Migration Not Yet Applied~~ — FIXED (Session 48)
**Status**: Fixed — Migration `0010_add_asset_tenant_scoping` exists and adds tenantId to Avatar and SceneryAsset.

### KI-075: ~~MinIO CORS Configuration Required for Direct Uploads~~ — FIXED
**Severity**: Medium
**Status**: Fixed — Added `minio-init` service to `docker-compose.yml` using `minio/mc` that creates the `airevstream` bucket and configures CORS to allow GET/PUT/POST/DELETE/HEAD from all localhost service origins. Runs after MinIO is healthy, then exits cleanly.

### KI-070: ~~Simple Wizard Plan Generation Uses Fallback Only~~ — FIXED
**Severity**: Low
**Status**: Fixed — Added `POST /api/v1/pipeline/simple-plan` endpoint (`apps/web/src/app/api/v1/pipeline/simple-plan/route.ts`). Runs 2-agent director→storyboard pipeline with SIMPLE_MODE_GUARDRAILS applied server-side (max 60s, max shots, rate limited). Graceful fallback to heuristic plan if AI unavailable. SimpleCreateWizard wired to call this endpoint.

### KI-066: Unused Dependencies (3 packages)
**Severity**: Low
**Status**: Fixed
- `class-variance-authority` removed from apps/web
- `@fastify/websocket` removed from services/ai-assistant
- `playwright-extra` + `puppeteer-extra-plugin-stealth` removed from packages/browser-automation
All four packages confirmed to have zero imports before removal.

### KI-067: ~~@types/bcrypt Version Mismatch~~ — RESOLVED (Session 48)
**Status**: Resolved — bcrypt and @types/bcrypt are no longer used in the codebase. Password hashing uses a custom implementation in `apps/web/src/lib/password.ts`.

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

### KI-005: ~~Generate-Storyboard Returns Hardcoded Shots~~ — FIXED
**Severity**: Medium
**Status**: Fixed — Replaced hardcoded H.I.C.C. shots with `generateJSON()` from `@airevstream/ai-client`. AI prompt instructs model to break scripts into structured H.I.C.C. shots. Graceful fallback to original logic if AI service is unavailable.

### KI-068: ~~Asset Registry + Sequence Prisma Migration Not Yet Applied~~ — FIXED (Session 48)
**Status**: Fixed — Migration `0008_add_seasoning_assets_sequences` exists. Sequence model renamed to Series via `0009_rename_sequence_to_series`.

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

### KI-042: ~~Zero Worker Processor Tests~~ — FIXED
**Severity**: High
**Status**: Fixed — Added unit tests for content, account, and posting worker processors in `workers/src/__tests__/`. Tests mock getDb, queue, and AI client. All 27 test tasks pass (507+ unit tests total).

### KI-050: QC Scoring Uses Heuristics Not ML
**Severity**: Low
**Status**: By Design (Sessions 15+20)
The QC scoring module (`qc-scoring.ts`) uses buffer entropy and byte-level statistics for quality evaluation. Now wired into the QC gate (Session 20) with per-shot retry. Prompt adherence scoring is limited without a CLIP model. This is intentional for the zero-dependency baseline; ML-based scoring is a future enhancement.
**Action**: Integrate CLIP-based prompt adherence scoring when an inference endpoint is available.

### KI-057: ~~Cinema Bible LoRA/Lens Fields Not in UI~~ — FIXED
**Severity**: Medium
**Status**: Fixed — All four editors exist in `bible-editor.tsx`: LoRA picker (fetches from ComfyUI models API), LensKit editor (primaryLens, aperture, filter, anamorphic, support lenses), CharacterLoras (per-character LoRA assignment), LightingSetups (TagListEditor). Color pipeline editor also present.

### KI-059: ~~Library AI Model Filter is Client-Side~~ — FIXED (Session 47)
**Status**: Fixed — Added `aiServiceId` query param to GET `/api/v1/content` route. Library page now sends filter server-side in query params instead of filtering client-side post-pagination.

### KI-060: ~~Calendar Schedule Query Param Not Handled~~ — FIXED
**Severity**: Low
**Status**: Fixed — Calendar page now reads `?schedule=<contentId>` via `useSearchParams()` and opens a scheduling modal pre-populated with content info, channel, and platform. Modal submits via POST `/api/v1/schedule`.

### KI-058: ~~Empty ComfyUI Workflow Subdirectories~~ — FIXED (Session 47)
**Severity**: Low
**Status**: Fixed — `upscale/bsrgan-2x.json` added (4-node BSRGAN 2x upscale workflow). All subdirectories now have templates.

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
