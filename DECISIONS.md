# Architecture & Design Decisions

## D001: Fastify over Express for Services
**Date**: 2026-03-17
**Decision**: Use Fastify as the HTTP framework for all backend services.
**Rationale**: Fastify is significantly faster than Express, has first-class TypeScript support, built-in JSON schema validation, and a robust plugin ecosystem. It also supports async/await natively without wrapper hacks.

## D002: Prisma as ORM
**Date**: 2026-03-17
**Decision**: Use Prisma ORM for database access.
**Rationale**: Prisma provides type-safe database queries, automatic migration management, and excellent DX with auto-generated types. It integrates well with TypeScript monorepos.

## D003: BullMQ for Job Queues
**Date**: 2026-03-17
**Decision**: Use BullMQ (backed by Redis) for all background job processing.
**Rationale**: BullMQ is the de facto standard for Node.js job queues. It provides reliable job processing, rate limiting, job scheduling, retries, and dashboard monitoring via Bull Board.

## D004: Zod for Runtime Validation
**Date**: 2026-03-17
**Decision**: Use Zod for all runtime validation and schema definitions.
**Rationale**: Zod provides TypeScript-first schema validation with excellent type inference. Schemas can be shared between frontend and backend, ensuring consistent validation.

## D005: Pino for Logging
**Date**: 2026-03-17
**Decision**: Use Pino as the logging library across all services and packages.
**Rationale**: Pino is the fastest Node.js logger, outputs structured JSON, and integrates natively with Fastify. Consistent logging across the monorepo simplifies debugging and monitoring.

## D006: Vitest for Testing
**Date**: 2026-03-17
**Decision**: Use Vitest for all unit and integration tests.
**Rationale**: Vitest is fast, has native ESM support, is compatible with the Jest API (easy migration), and works well with TypeScript without extra configuration.

## D007: AES-256-GCM for Secret Encryption
**Date**: 2026-03-17
**Decision**: Use AES-256-GCM for encrypting stored secrets (API tokens, OAuth credentials).
**Rationale**: AES-256-GCM provides authenticated encryption, preventing both decryption without the key and tampering. It's the industry standard for at-rest encryption and is available natively in Node.js crypto module.

## D008: Ollama as Default AI Provider
**Date**: 2026-03-17
**Decision**: Use Ollama as the default/primary AI provider, with the ai-client package designed to support additional providers later.
**Rationale**: Ollama provides free, local AI inference with no API costs. The system is designed for self-hosted operation, so local AI aligns with the architecture. The client abstraction allows adding OpenAI/Anthropic/etc. later.

## D009: Multi-Provider AI Service Registry with Fallback Chains
**Date**: 2026-03-17
**Decision**: Evolve @airevstream/ai-client from a thin Ollama wrapper into a full Service Registry with provider abstraction, fallback chains, circuit breaker, and cost tracking.
**Rationale**: The PRD requires multi-provider support (Ollama, OpenAI, Anthropic, ComfyUI, ElevenLabs, video APIs). The registry pattern allows: (1) dynamic service selection based on type/health/cost/quality, (2) automatic fallback when a service fails, (3) circuit breaker to avoid hammering failing services, (4) usage/cost tracking per request. The design uses dependency injection (ServiceFetcher, UsageLogger) to avoid tight coupling to Prisma, keeping the package testable without a database.

## D010: CSS Variable Design System with RGB Channel Format
**Date**: 2026-03-17
**Decision**: Use CSS custom properties with RGB channel values (e.g., `--accent-blue: 59 130 246`) rather than hex colors.
**Rationale**: Tailwind CSS opacity modifiers (e.g., `bg-accent-blue/50`) require colors defined as color channels, not opaque hex values. The RGB channel format with `rgb(var(--color) / <alpha-value>)` in tailwind.config.ts enables full opacity modifier support while maintaining dark/light theme switching via CSS variable overrides.

## D011: Next.js API Routes as Backend-for-Frontend
**Date**: 2026-03-17
**Decision**: Use Next.js API routes (/api/v1/*) as the primary web dashboard backend instead of proxying to separate Fastify services.
**Rationale**: Running Prisma queries directly in API routes eliminates network hops, simplifies deployment, and allows the dashboard to function independently. The Fastify services (workflow-engine, ai-assistant, production-pipeline) remain as separate microservices for worker orchestration, long-running AI tasks, and production pipeline operations. This BFF pattern gives the best of both worlds: fast dashboard queries + specialized service processes.

## D012: SWR for Client-Side Data Fetching
**Date**: 2026-03-17
**Decision**: Use SWR (stale-while-revalidate) for all dashboard data fetching instead of React Query or raw fetch.
**Rationale**: SWR is lightweight (~4KB), integrates naturally with Next.js (same team), provides automatic revalidation, deduplication, and optimistic updates. The `useApi()` hook wraps SWR with auth headers and error handling, while `apiPost/apiPut/apiDelete` helpers handle mutations with SWR cache invalidation.

## D013: Prisma Decimal Fields Serialize as Strings
**Date**: 2026-03-18
**Decision**: Accept that Prisma `Decimal` fields serialize to strings in JSON responses and convert on the frontend with `Number()`.
**Rationale**: Prisma uses `Decimal.js` internally for precision, which serializes to string in JSON (e.g., `"8.5"` instead of `8.5`). Changing the Prisma schema to `Float` would lose precision for financial fields (budgets, revenue). The frontend already handles this via `Number()` casting where needed (quality scores, budgets, costs). This is documented in KNOWN-ISSUES.md KI-012.

## D014: Store Script/Shots in ContentItem.generationParams JSON
**Date**: 2026-03-18
**Decision**: Store generated scripts and storyboard shots in the `ContentItem.generationParams` JSON field rather than creating new database tables.
**Rationale**: Scripts and shots are intermediate generation artifacts tied to a specific content item. Creating separate `Script` and `Shot` tables would add schema complexity and migration overhead for data that is: (1) always accessed with its parent content item, (2) variable in structure across content types, (3) not queried independently. The JSON field provides flexibility while keeping the schema simple.

## D015: Workflow Jobs Fetched Without Status Filter
**Date**: 2026-03-18
**Decision**: Fetch workflow jobs without a status filter in the API, allowing the frontend to categorize by status client-side.
**Rationale**: The system health page needs to show jobs in all states (active, completed, failed, waiting). Initially, a server-side status filter was applied which hid failed/errored jobs. Removing the filter ensures all job states are visible. Client-side categorization is acceptable because the total job count per page load is bounded (paginated to 50).

## D016: Analytics Missing-Data Fields Return Empty Arrays
**Date**: 2026-03-18
**Decision**: Analytics endpoints return empty arrays `[]` for data fields that have no backing data (engagement, ROI by type, audience) rather than returning errors or null.
**Rationale**: Graceful degradation — the frontend Recharts components render cleanly with empty data (showing "no data" states) without needing conditional error handling. As real analytics data accumulates from posting and engagement tracking, these arrays will populate naturally. This avoids premature optimization of analytics queries for data that doesn't exist yet.

## D017: 4-Commit Git Structure for Bulk Changes
**Date**: 2026-03-18
**Decision**: Organize large uncommitted changesets into 4 logical commits: (1) backend packages/services, (2) frontend pages/components/API routes, (3) docs/configs, (4) build artifacts/.gitignore.
**Rationale**: After multiple audit rounds and feature additions, a large number of files were uncommitted. A single commit would be unreviable. The 4-commit structure groups changes by concern: backend logic is reviewable independently of frontend UI, docs are separate from code, and gitignore changes are isolated. This makes `git log` and `git blame` more useful for understanding what changed and why.

## D018: Reusable UI Component Library Pattern
**Date**: 2026-03-18
**Decision**: Create shared UI primitives (`ConfirmDialog`, `EmptyState`, `CopyButton`, `KeyboardShortcutsModal`) in `apps/web/src/components/ui/` and a `toast` wrapper in `apps/web/src/lib/toast.ts`.
**Rationale**: Multiple pages needed the same patterns (confirmation before destructive actions, empty state displays, clipboard copy). Extracting to shared components ensures consistent UX, reduces duplication, and makes it trivial to add these patterns to new pages. The toast wrapper standardizes sonner usage with pre-configured styles.

## D019: Forgot Password via JWT Reset Tokens (No Email Service)
**Date**: 2026-03-18
**Decision**: Implement forgot password using short-lived JWT tokens (15min expiry) with `purpose: 'password-reset'` claim. In dev mode, the token is logged to console rather than emailed.
**Rationale**: The system doesn't have an email service configured yet. JWT tokens provide a secure, stateless reset mechanism that doesn't require a database table for reset tokens. The `purpose` claim prevents token reuse for authentication. When an email service is added later, the only change needed is sending the token via email instead of logging it.

## D020: Session Indicator Cookie for Middleware Auth
**Date**: 2026-03-18
**Decision**: Use a non-sensitive `airevstream_auth=1` cookie as a session indicator for Next.js middleware, while keeping the actual JWT in localStorage.
**Rationale**: Next.js middleware runs on the edge and cannot access localStorage. Rather than moving the JWT to an HttpOnly cookie (which would require CSRF protection), we set a lightweight indicator cookie alongside the localStorage token. The middleware checks this cookie to gate protected routes — preventing HTML leakage of dashboard pages to unauthenticated users. The actual JWT remains in localStorage for API calls via Authorization header. This avoids CSRF complexity while providing server-side route protection.

## D021: Interactive Transactions for TOCTOU Prevention
**Date**: 2026-03-18
**Decision**: Use Prisma interactive transactions (`$transaction(async (tx) => { ... })`) instead of batch transactions when status checks must be atomic with subsequent mutations.
**Rationale**: The find-then-update pattern (findFirst to check status, then separate update) creates a TOCTOU race window. For destructive operations (DELETE with status guard), state mutations (approve/reject), and idempotency checks (HITL complete), we wrap both the check and mutation in an interactive transaction. The transaction callback returns a discriminated union (`{ kind: 'not_found' | 'invalid_status' | 'success', ... }`) to avoid throwing for control flow. Batch transactions (`$transaction([...])`) are still used when no conditional logic is needed between operations.

## D022: Universal Viewer Role Guard on Write Endpoints
**Date**: 2026-03-18
**Decision**: Every POST/PUT/PATCH/DELETE handler that goes through `authenticate()` must check `ctx.role === 'viewer'` and return `forbidden()`.
**Rationale**: Found 53 write endpoints missing viewer checks in Session 9 audit. Rather than relying on frontend-only enforcement (hiding buttons from viewers), the backend must independently enforce role restrictions. The check goes immediately after `authenticate()` + NextResponse guard, before any rate limiting or business logic.

## D024: Vitest Codebase Audit System
**Date**: 2026-03-18
**Decision**: Use Vitest-based tests that read source files as strings to detect recurring bug patterns, rather than custom ESLint rules, ts-morph AST analysis, or shell scripts.
**Rationale**: Over 10 sessions, manual audits found 150+ bugs across 9 recurring bug classes. ESLint is not installed (~30 packages needed) and can't do cross-file analysis. ts-morph adds ~15MB and is overkill for regex-detectable patterns. Shell scripts lack TypeScript, Vitest integration, and are fragile. Vitest is already installed, runs via `turbo audit`, provides familiar TypeScript API, executes in <1 second, and grows by adding `it()` blocks. Pre-existing violations are tracked in known violation Sets rather than fixed all at once — this prevents regressions without blocking the build.

## D023: Playwright E2E Test Architecture
**Date**: 2026-03-19
**Decision**: Use Playwright with sequential execution (workers: 1), storageState auth pattern, and manual dev server start.
**Rationale**: Sequential execution avoids test conflicts on a shared real database. The storageState pattern logs in once via UI and reuses the authenticated state across all tests, avoiding per-test login overhead. Manual dev server start is more reliable than Playwright's webServer auto-start for a Turborepo monorepo with complex startup. Test-created data uses `e2e-*@e2e-test.local` emails for cleanup isolation.

## D025: Prisma Migration Baselining Strategy
**Date**: 2026-03-18
**Decision**: Use `prisma migrate diff --from-empty` to generate migration SQL from the current schema, then `prisma migrate resolve --applied` to mark it as already applied against an existing database.
**Rationale**: The database was originally set up via `db push` (no migration history). The old migration files were stale (12 tables vs 36 models). Running `prisma migrate dev` would try to reset the database, destroying all data. The baselining approach creates a correct migration file that matches the current schema while marking it as applied so Prisma doesn't try to re-run it. Fresh deployments can use `prisma migrate deploy` and get the correct 36-table schema. GIN fulltext search indexes are in a separate migration for clarity.

## D026: BullMQ FlowProducer for Content Pipeline DAG
**Date**: 2026-03-18
**Decision**: Use BullMQ `FlowProducer` to define content pipeline DAGs (research → generate → production) rather than chaining jobs manually via worker callbacks.
**Rationale**: FlowProducer provides native job dependency tracking — child jobs only start when parents complete. This eliminates manual job chaining, provides built-in flow visualization, and supports complex DAGs. The pipeline is triggered via a single `POST /pipeline/content` endpoint that submits the entire flow, returning a flow job ID for tracking.

## D027: Presigned URL Route as MinIO Proxy
**Date**: 2026-03-18
**Decision**: Create a catch-all API route (`/api/v1/media/[...path]`) that generates presigned URLs from MinIO rather than exposing MinIO directly to the browser.
**Rationale**: MinIO is internal (Docker network). Exposing it directly would require public access or CORS configuration. The proxy route adds auth (JWT), rate limiting (30/min), and bucket validation (allowlist from BUCKETS constant). Presigned URLs expire in 1 hour and are cached by the frontend (50-min SWR TTL). This keeps MinIO private while enabling secure media access.

## D028: Multi-Stage Docker Builds
**Date**: 2026-03-18
**Decision**: Use 3-stage Dockerfile pattern (deps → build → runtime) with `node:20-slim` as the runtime base for all containers.
**Rationale**: Multi-stage builds minimize image size (only runtime deps + built artifacts in final image). `node:20-slim` provides a small Debian base with necessary native deps. The web Dockerfile uses Next.js `output: 'standalone'` to produce a minimal deployment folder. Services use a shared Dockerfile with a `SERVICE` build arg. Workers include `postgresql-client` for pg_dump backups.

## D029: Command Palette Pattern (Cmd+K)
**Date**: 2026-03-18
**Decision**: Implement a global search command palette activated by `Cmd+K` / `Ctrl+K` with debounced search across content, channels, and accounts.
**Rationale**: Command palettes are a proven UX pattern for keyboard-driven navigation (VS Code, GitHub, Linear). The unified search endpoint (`/api/v1/search`) queries 3 models with tenant scoping and returns max 5 results per category. The 200ms debounce prevents excessive API calls. Keyboard navigation (up/down/enter/escape) provides a fast workflow for power users.

## D030: ShotSpec as Universal Job Ticket
**Date**: 2026-03-19
**Decision**: Every shot flows through the pipeline as a typed ShotSpec in StoryboardShot.shotspec JSON. All parameters needed for generation, QC, audio, and render are in the spec. No runtime hardcoded values.
**Rationale**: A single canonical spec object eliminates parameter drift between pipeline stages, makes shots reproducible (same spec = same output with locked seed), and simplifies debugging by providing a complete snapshot of intent at each stage.

## D031: Composable ComfyUI Workflows
**Date**: 2026-03-19
**Decision**: Static JSON templates replaced by programmatic node graph assembly. Builder functions (addLoraNodes, addControlNetNodes, etc.) compose workflows from ShotSpec. Presets provide backward compat.
**Rationale**: Static templates could not express dynamic combinations of LoRAs, ControlNets, refiners, and upscalers. Programmatic composition ensures correct node wiring (model/CLIP/conditioning chains), supports arbitrary feature combinations, and is testable via unit tests. Presets map to the old static template behavior.

## D032: Video Provider Async Polling
**Date**: 2026-03-19
**Decision**: All video providers (ComfyUI, Veo, Sora) follow submit->poll->download pattern.
**Rationale**: Matches BullMQ job architecture where workers poll for completion. Video generation is inherently asynchronous (minutes to hours). The unified interface allows swapping providers without changing worker code.

## D033: 3-Layer Audio Model
**Date**: 2026-03-19
**Decision**: Audio uses BG (background, loopable, 0.1-0.3 volume), MG (midground events), FG (foreground dialogue). WAV PCM mixing without external dependencies.
**Rationale**: The 3-layer model mirrors professional audio mixing (bed/sweetener/dialogue). WAV PCM mixing avoids FFmpeg dependency for simple cases. The AudioMixer handles volume, fading, looping, and timed placement purely in Node.js.

## D034: 8-Step Cinema Pipeline DAG
**Date**: 2026-03-19
**Decision**: research -> script -> storyboard -> shots -> QC -> audio -> render -> review. Uses BullMQ FlowProducer with children-before-parent execution.
**Rationale**: The 8-step DAG ensures each stage completes before its dependents start. FlowProducer handles dependency resolution, retry, and failure propagation. Each step is independently testable and replaceable.

## D036: globalThis Pattern for Prisma Singleton in Next.js
**Date**: 2026-03-19
**Decision**: Use `globalThis.__prisma` to store the Prisma client singleton instead of a module-level variable in `packages/db/src/index.ts`.
**Rationale**: Next.js HMR in development mode re-imports modules on every change, creating new `PrismaClient` instances while the old ones retain their connection pools. This caused PostgreSQL connection pool exhaustion during E2E test runs (100+ connections). The `globalThis` pattern survives HMR reloads because `globalThis` persists across module re-evaluations. This is the pattern recommended by the Prisma documentation for Next.js projects.

## D037: JWT Revocation via passwordChangedAt
**Date**: 2026-03-22
**Decision**: Add `passwordChangedAt` timestamp to User model. `authenticate()` compares JWT `iat` against this value and rejects tokens issued before the last password change.
**Rationale**: Avoids the complexity of a token blacklist or Redis-backed revocation store. The comparison is O(1) per request and requires only a single DB field. The change-password route sets `passwordChangedAt` atomically with the password hash update.

## D038: CORS Origin Restriction via Environment Variable
**Date**: 2026-03-22
**Decision**: All 3 Fastify services read `CORS_ORIGINS` env var (comma-separated list) instead of `origin: true`. Default: `http://localhost:3000`.
**Rationale**: `origin: true` allows any origin, which is insecure in production. Environment-based configuration allows operators to add multiple dashboard origins (e.g., staging + production) without code changes.

## D039: Audit Handler Extraction Fix for Destructured Params
**Date**: 2026-03-22
**Decision**: `extractHandlers()` in audit-helpers.ts now skips past the function parameter list (counting parentheses) before finding the function body opening brace.
**Rationale**: The previous implementation found the first `{` after the function name, which matched destructured parameters like `{ params }` instead of the function body. This caused the audit to extract the wrong text for handler body checks, masked by the known violation sets.

## D040: QC Gate Real Scoring
**Date**: 2026-03-22
**Decision**: QC gate downloads keyframe images from storage and runs the 5-dimension `scoreShot()` function (technical, prompt adherence, consistency, composition, color quality) instead of a binary keyframe-presence check.
**Rationale**: The scoring module existed but was never called. Using real scoring enables meaningful quality gating — auto-approve ≥85, manual review 60-84, reject/regenerate <60. Falls back to basic check if image download fails.

## D041: Cinema Tier ProRes Codec
**Date**: 2026-03-22
**Decision**: Cinema quality tier renders using ProRes codec (.mov), while standard/draft tiers use h264 (.mp4).
**Rationale**: ProRes preserves maximum quality for archival and re-editing. Social media export (h264) can be done as a secondary pass. The CinemaVideo composition runs at 24fps (cinema standard) vs 30fps for other compositions.

## D042: QC Retry Seed Increment
**Date**: 2026-03-22
**Decision**: When a shot fails QC and is re-queued for generation, its seed is incremented by 1 (not randomized), with a `qcRetryCount` tracking retries (max 2).
**Rationale**: Incrementing preserves reproducibility — you can predict and replay the retry sequence. Max 2 retries prevents infinite loops. After exhausting retries, the shot is marked as failed for manual review.

## D043: UI Complexity Mode in localStorage
**Date**: 2026-03-22
**Decision**: Store the UI complexity mode (`simple`/`advanced`/`complex`) in `localStorage` rather than in the database.
**Rationale**: This is purely a frontend display preference — the backend resolver runs identically regardless of mode. localStorage avoids a database migration, API endpoint, and latency for a per-device preference. If multi-device sync is needed later, it can be promoted to the User model.

## D044: Preset Resolver Precedence
**Date**: 2026-03-22
**Decision**: Preset resolver uses deterministic deep merge with 3-layer precedence: recipe presets (in order) → individual presets → user overrides (highest priority).
**Rationale**: Lower layers provide defaults, higher layers override. Recipes are convenience bundles that combine presets. User overrides always win, preserving manual edits. Deep merge allows partial overrides (e.g., just camera.lens) without losing other fields.

## D045: Export Variants as Separate Render Jobs
**Date**: 2026-03-22
**Decision**: Each export variant (YouTube 16:9, Reels 9:16, Square 1:1, ProRes) renders as a separate BullMQ job sharing the same storyboard/timeline data. The `ExportVariant` type carries width/height/fps/aspect/codec per job.
**Rationale**: Separate jobs allow parallel rendering across workers, individual failure/retry, and progress tracking per variant. The alternative (single job rendering all variants sequentially) would block the worker for too long and make partial failure recovery impossible.

## D046: Seed Policy XOR Hash
**Date**: 2026-03-22
**Decision**: Seed policies use XOR-based hash for deterministic scene/series locking: `baseSeed XOR hash(sceneId/seriesId)`.
**Rationale**: XOR is fast, deterministic, and distributes evenly across the seed space. The same scene ID always produces the same seed offset, ensuring visual consistency across shots in a scene. Series lock ensures consistency across episodes.

## D047: LUFS Measurement Approach
**Date**: 2026-03-22
**Decision**: Use simplified ITU-R BS.1770-4 with 400ms sliding window for LUFS measurement, with a -70 LUFS absolute gate.
**Rationale**: Full ITU-R BS.1770-4 requires K-weighting filters which add complexity. The simplified approach (RMS-based with a sliding window and gate) provides sufficient accuracy for automated loudness normalization in a content pipeline. Platform targets: -14 LUFS (YouTube), -16 LUFS (broadcast).

## D048: Prompt Safety Linting
**Date**: 2026-03-22
**Decision**: Use pattern-based prompt safety linting (regex) for 8 categories (violence, sexual, hate, self_harm, illegal, pii, copyright, deceptive) rather than ML-based content moderation.
**Rationale**: Pattern matching is fast, deterministic, runs offline, and has zero inference cost. Sufficient for pre-generation filtering. ML-based moderation can be added as a secondary pass for edge cases.

## D049: Viral Scoring Heuristics
**Date**: 2026-03-22
**Decision**: Viral scoring uses heuristic analysis (pacing metrics, emotional keywords, platform duration fit, trend keyword matching, CTA detection) rather than ML models.
**Rationale**: No training data available for our specific content types. Heuristic approach is interpretable (each dimension has clear factors), fast, and can be refined incrementally. Integrates into final review as an automatic advisory step.

## D050: Identity Drift via Statistical Fingerprinting
**Date**: 2026-03-22
**Decision**: Use statistical image fingerprinting (color histograms, quadrant brightness/entropy, spatial frequency energy) as a proxy for character identity consistency rather than face embeddings or CLIP.
**Rationale**: Face embedding models require GPU inference and ML dependencies. Statistical fingerprinting is fast (pure math), runs on raw image bytes, and provides a "good enough" signal for detecting visual drift between shots. Can be upgraded to CLIP/face embedding later.

## D051: 5-Phase Agent DAG
**Date**: 2026-03-22
**Decision**: The 7 cinema agents execute in a 5-phase DAG: Director → LookDev+Dialogue → ShotSpec → Render+Sound → Finishing. Agents within a phase run in parallel.
**Rationale**: Dependencies between agents form a natural DAG. The Director must set vision before LookDev/Dialogue can work. ShotSpec needs both LookDev and Dialogue outputs. Render and Sound can process shots independently. Finishing is a final pass.

## D052: Letter-Based Viseme Approximation
**Date**: 2026-03-22
**Decision**: Lip-sync uses letter/digraph-based phoneme approximation rather than audio analysis (forced alignment).
**Rationale**: Forced alignment requires audio input, which isn't available during pre-production planning. Letter-based approximation provides a viseme timeline from text alone, suitable for subtitle-only and overlay modes. Character-rig mode can upgrade to audio-based alignment at render time.

## D053: A/B Test Significance via Z-Test
**Date**: 2026-03-22
**Decision**: A/B test statistical significance uses a two-proportion z-test with Abramowitz & Stegun normal CDF approximation.
**Rationale**: The z-test is the standard approach for comparing two proportions (engagement rates). The Abramowitz & Stegun approximation is fast and accurate to 7+ decimal places. No external statistics library needed.

## D054: Pipeline Status Derived from DB State
**Date**: 2026-03-22
**Decision**: The pipeline-status endpoint derives step completion from content status, storyboard/shot statuses, and QC scores rather than tracking BullMQ job progress directly.
**Rationale**: Avoids Redis dependency in the API layer. DB state is the single source of truth. No need to correlate job IDs across 8 steps. The 8-step pipeline maps naturally to observable DB states (has storyboard? has shots? shots generated? QC scores present? etc.).

## D055: Pre-Generation QC Gate
**Date**: 2026-03-22
**Decision**: All shots must pass constraint validation and budget check before the pipeline commits to generation. Violations with severity 'error' block the pipeline; 'warning' allows proceed with advisory.
**Rationale**: Prevents wasted compute and API costs. Catching invalid specs (e.g., Veo with unsupported aspect ratio) early avoids failed jobs. Budget check prevents runaway costs.

## D056: Prompt Slot Substitution Patterns
**Date**: 2026-03-22
**Decision**: Use `{slotName}` for user-defined slots, `{char:key}` for per-character prompt blocks, `{env:key}` for per-environment blocks. Substitution happens in `composePrompt()` before sending to ComfyUI.
**Rationale**: Templates with named slots allow reusable prompt structures across shots while maintaining consistency. The `char:/env:` namespacing avoids collisions between user slots and bible blocks.

## D057: Agent Complexity Mode Awareness
**Date**: 2026-03-22
**Decision**: Agents receive mode-specific instructions via `getAgentPromptForMode()`. In Simple mode, non-critical agent failures are marked 'skipped' (graceful degradation) rather than 'failed'.
**Rationale**: Simple mode should never block on optional agent output (e.g., sound design). The mode instructions tell agents which fields to skip, reducing cognitive load and token usage.

## D058: Static Provider Constraints
**Date**: 2026-03-22
**Decision**: Provider constraints (max FPS, supported aspects, max duration, max steps/dimensions) are defined as static constants, not queried from provider APIs.
**Rationale**: Provider APIs don't expose constraint metadata. Static constraints are fast, offline, and can be updated with the codebase. The alternative (discovery at runtime) is fragile and adds latency.

## D059: Shot Class → Workflow Template Mapping
**Date**: 2026-03-22
**Decision**: 8 standard shot classes (Dialogue_Closeup, Establishing_Wide, etc.) map to ComfyUI workflow templates via `WORKFLOW_TEMPLATE_MAP`. If no shotClass is set, the composer builds a workflow dynamically.
**Rationale**: Pre-built templates provide optimized defaults (lens, DOF, resolution) for common shot types. Dynamic composition remains available for custom shots. Templates are simple 7-node graphs that are easy to maintain.

## D060: Auto-Variants as Separate Render Jobs
**Date**: 2026-03-22
**Decision**: Auto-render variants (9:16 portrait, 16:9 captioned, etc.) are queued as separate BullMQ render jobs after the primary render completes, sharing the same bundle.
**Rationale**: Extends D045. Separate jobs enable parallel rendering, individual failure recovery, and independent progress tracking per variant.

## D061: Copyright Compliance via License Map
**Date**: 2026-03-22
**Decision**: Use a static `KNOWN_LICENSES` map (10 SPDX/model licenses) for copyright compliance checking rather than querying license databases.
**Rationale**: Covers all major open-source model licenses. Static lookup is fast and offline. Unknown licenses trigger a warning for manual review rather than blocking.

## D062: CMU ARPAbet Phoneme Upgrade for Lip-Sync
**Date**: 2026-03-22
**Decision**: When TTS provides phoneme timestamps (CMU ARPAbet format), use the 39-phoneme → 15-viseme mapping for accurate lip-sync. Falls back to letter-based approximation when timestamps unavailable.
**Rationale**: CMU ARPAbet is the standard phoneme set used by Piper, ElevenLabs, and most TTS engines. Phoneme-level mapping produces significantly better mouth animation than letter approximation. The fallback ensures lip-sync always works.

## D063: Preset Ranges for Bounded Sliders
**Date**: 2026-03-22
**Decision**: Presets can define `ranges: Record<string, {min, max}>` to constrain slider values. `getActiveRanges()` merges ranges from recipe presets and individual presets (later presets override).
**Rationale**: Some visual styles require constrained parameter ranges (e.g., film-noir requires negative saturation). Ranges prevent users from accidentally breaking the style's intent while still allowing adjustment within bounds.

## D064: Tier 3 Stub Pattern
**Date**: 2026-03-22
**Decision**: Features requiring external infrastructure (YouTube API keys, ML models, VMAF tooling) are implemented as typed interfaces + stub functions that throw descriptive errors referencing OPERATOR-TODO.md.
**Rationale**: Provides full type contracts for future implementation without broken runtime behavior. Error messages guide operators to the setup steps. Stubs compile and export cleanly, so downstream code can import types without conditional dependencies.

## D065: Schedule Hybrid — Code Defaults + DB Overrides
**Date**: 2026-03-23
**Decision**: Seasoning schedule defined as code constants (DEFAULT_SEASONING_SCHEDULE) with per-cohort DB overrides via scheduleConfig JSON.
**Rationale**: Deterministic defaults ensure consistent behavior across cohorts. DB overrides allow per-cohort customization without code changes. The schedule is too complex for purely DB-driven config, but too rigid as pure code.

## D066: Repeatable Scheduler (15-min Poll) Not DAG
**Date**: 2026-03-23
**Decision**: Seasoning uses a repeatable BullMQ job (every 15 min) to scan for due sessions, not a FlowProducer DAG.
**Rationale**: Seasoning is ongoing over weeks, not a linear pipeline. Accounts warm at different rates, pause/resume independently. A repeatable scanner that checks `nextScheduledAt <= now()` is simpler and more resilient than a pre-planned DAG.

## D067: Proxy Pinning in Enrollment Record
**Date**: 2026-03-23
**Decision**: Pinned proxy stored as `proxyServer` string on SeasoningEnrollment, fingerprint ID also on enrollment.
**Rationale**: Per-account proxy consistency is critical for avoiding detection. Storing on the enrollment record (not metadata JSON) makes it queryable and ensures each account always connects from the same IP.

## D068: Extend Account Worker for Seasoning
**Date**: 2026-03-23
**Decision**: Add seasoning handlers to the existing account worker rather than creating a separate worker.
**Rationale**: Reuses the existing lazy-loaded browser automation infrastructure, session management, and browser context pooling. The `seasoning` queue is separate from `account` for job isolation, but the processor shares code.

## D069: CAPTCHA/SMS as Typed Stubs
**Date**: 2026-03-23
**Decision**: CaptchaSolver and SmsVerifier are stub classes that throw without API keys, following the D064 pattern.
**Rationale**: The interfaces and integration points are defined now. When the operator provides 2Captcha/sms-activate.org API keys, the stubs can be replaced with real implementations without changing the calling code.

## D070: Type-Only Barrel Exports for Stub Modules
**Date**: 2026-03-23
**Decision**: Replace `export *` with `export type { ... }` for the 4 Tier-3 stub modules in packages/shared/src/index.ts.
**Rationale**: Stub functions that always throw should not be importable from the barrel. Type-only exports keep the interfaces available for future implementation while preventing accidental usage of throwing functions. Verified by grep that no code imports these functions.

## D071: Unconditional Tenant Scoping
**Date**: 2026-03-23
**Decision**: All tenant-scoped API routes must guard with `if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403)` before any query, and use unconditional `tenantId: ctx.tenantId` (never conditional `ctx.tenantId ? {...} : {}`).
**Rationale**: Session 27 audit found 18 handlers across 8 files using conditional scoping like `if (ctx.tenantId) where.tenantId = ctx.tenantId`. When tenantId is null, these patterns silently skip tenant filtering, returning data from all tenants. This is the single largest security class fixed in the audit.

## D072: Rate Limit Public and Write-Amplifiable Endpoints
**Date**: 2026-03-23
**Decision**: All unauthenticated endpoints and authenticated endpoints that perform writes on GET must have rate limiting.
**Rationale**: Session 27 audit found the affiliate redirect (public, unauthenticated) had no rate limiting, enabling click fraud. The viral score GET endpoint performed DB writes without throttling, enabling write amplification.

## D073: WarmingActivity Canonical Home in Shared
**Date**: 2026-03-23
**Decision**: WarmingActivity, WarmingConfig, WarmingActivityResult, and WarmingSessionResult types are defined in `packages/shared/src/types.ts` and re-exported from `packages/browser-automation/src/types.ts`.
**Rationale**: These types were originally in browser-automation, creating a circular dependency (shared → browser-automation → shared). Moving them to shared breaks the cycle while maintaining backward compatibility via re-exports.

## D035: Studio UI Architecture
**Date**: 2026-03-19
**Decision**: Full-screen workspace: shot list (left), preview (center), properties (right), timeline (bottom), AI guidance (sidebar). Components are composable and independently testable.
**Rationale**: Professional video editing UIs (DaVinci Resolve, Premiere) use this layout pattern. The component decomposition allows each panel to be developed and tested independently while the Studio page composes them into a cohesive workspace.


## D074: Native HTML5 Drag-and-Drop for Calendar
**Date**: 2026-03-23
**Decision**: Use native HTML5 DnD API instead of @dnd-kit for calendar rescheduling.
**Rationale**: Avoids adding a new dependency. The calendar DnD use case is simple (move a post to a new time slot) and doesn't need the advanced features of @dnd-kit (sortable lists, collision detection). Native DnD is well-supported and sufficient.

## D075: Multi-Language Modes in platformMetadata
**Date**: 2026-03-23
**Decision**: Store language configuration (languages[], languageMode) in ContentItem.platformMetadata rather than adding new DB columns.

## D076: Tenant Isolation for Remaining Models — Nullable vs Required tenantId
**Date**: 2026-03-23
**Decision**: Alert gets `tenantId String?` (nullable); Conversation, KnowledgeBaseEntry, PromptTemplate, CostBudget get `tenantId String` (required). API routes use `ctx.tenantId!` (non-null assertion) for required-tenantId models, always preceded by an unconditional `if (!ctx.tenantId) return error('FORBIDDEN', ..., 403)` guard.
**Rationale**: Workers create system-wide operational alerts (disk full, service down) that all tenants and admins should see — nullable allows null to mean "global". Application-level data (conversations, knowledge, prompts, budgets) is always owned by a tenant, so required enforces the invariant at the DB layer. The non-null assertion is safe because the 403 guard fires first; TypeScript cannot infer this from the control flow without the assertion.
**Rationale**: The language config is only needed during pipeline processing. Adding schema columns would require a migration and only serve a subset of content items. JSON storage in platformMetadata is flexible and doesn't require schema changes.
