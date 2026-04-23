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

## D077: Frame Anchoring — img2img vs ControlNet Modes
**Date**: 2026-03-23
**Decision**: `FrameAnchor` supports two modes: `img2img` (default) rewires KSampler latent input via VAEEncode with `denoise = 1 - strength`; `controlnet` delegates to existing `addControlNetNodes()` with the anchor frame as source image.
**Rationale**: img2img provides strong visual continuity (first frame of next shot matches last frame of previous), while controlnet provides structural guidance without locking colors. Both are useful for different editorial scenarios. Default img2img covers the common case of shot-to-shot continuity.

## D078: Asset Registry — Non-Blocking Registration Pattern
**Date**: 2026-03-23
**Decision**: `registerAsset()` in the production worker uses try/catch with `logger.warn` — asset registration failures don't block the pipeline.
**Rationale**: The asset registry is a metadata layer for tracking and versioning. A registration failure (DB timeout, constraint violation) should not prevent the primary pipeline from delivering its output. Critical path integrity is preserved while the registry populates on a best-effort basis.

## D079: QC Decision Agent — 9th Agent with 6-Phase Execution
**Date**: 2026-03-23
**Decision**: Added `qc-decision` as a dedicated agent (Phase 5) between render (Phase 4) and finishing (Phase 6). Uses a verdict system: `approve` (score ≥ 85), `soft-fix` (60-84, fixable issues), `regenerate` (60-84 with identity drift, or < 60), `escalate` (ambiguous or >50% shots need regen).
**Rationale**: Hardcoded QC thresholds can't account for the interaction between multiple quality dimensions (e.g., technical score fine but identity drifted). An LLM agent can reason about trade-offs and prescribe specific repair actions (LoRA strength delta, CFG boost, seed lock) rather than just pass/fail.

## D080: VMAF Quality Regression — Injectable execFn Pattern
**Date**: 2026-03-23
**Decision**: `compareVMAF()` shells out to ffmpeg CLI with injectable `execFn` for testability. Uses dynamic `import()` for node: modules to avoid webpack bundling. Barrel export is type-only; workers import from `dist/quality-regression.js` directly.
**Rationale**: Same injectable pattern as C2PA CLI (D082) — keeps functions unit-testable with mock executors. Dynamic imports avoid Next.js webpack errors when the barrel is imported client-side. Type-only barrel export gives consumers access to interfaces without pulling in node: runtime code.

## D081: AV Sync Validation — Frame-Snapped Drift Detection
**Date**: 2026-03-23
**Decision**: `validateAVSync()` snaps video timings to frame boundaries before computing drift, using `snapToFrame(ms, fps) = Math.round(ms / frameDuration) * frameDuration`. Default thresholds: 80ms max error (~2 frames at 24fps), 40ms warning (~1 frame). Detects monotonically increasing drift (accumulation) when 75%+ of consecutive drift changes are same-sign.
**Rationale**: Video playback is quantized to frame boundaries — comparing raw millisecond timings creates false drift alerts. Frame-snapping aligns the comparison to what the viewer actually sees. Drift accumulation detection catches systematic timing offset that worsens over the clip (e.g., TTS running slightly fast/slow relative to viseme timeline).

## D082: C2PA CLI Embedding — Separate File for Node-Only Code
**Date**: 2026-03-23
**Decision**: C2PA CLI runtime functions live in `provenance-c2pa-cli.ts` (NOT barrel-exported from index.ts). Workers import directly via `@airevstream/shared/dist/provenance-c2pa-cli.js`. Types remain in `provenance.ts` and are barrel-exported.
**Rationale**: Even dynamic `import('node:...')` expressions are analyzed by webpack in Next.js client bundles. Keeping node-only runtime code in a file that's never imported by the barrel prevents build errors while maintaining clean type access for all consumers. This applies to both C2PA CLI and VMAF regression modules.

## D083: SimpleCreateWizard as Extracted Component
**Date**: 2026-03-23
**Decision**: The simple mode 5-screen wizard is extracted into a standalone `SimpleCreateWizard` component rather than adding conditional logic to the existing create page.
**Rationale**: The existing create page is already 1290 lines with a 6-step wizard. Adding a completely different 5-screen flow with character presets, plan review, and revision buttons would make the file unmaintainable. The extracted component owns its own state machine and screen transitions, while the parent page just renders it conditionally based on complexity mode.

## D084: Revision Presets as Deterministic Preset Swaps
**Date**: 2026-03-23
**Decision**: The 6 revision presets (e.g., "Make it shorter", "More cinematic") are deterministic preset parameter swaps, not LLM-generated re-plans.
**Rationale**: LLM round-trips introduce latency (3-10s), non-determinism (different results each click), and cost. Preset swaps are instant (<1ms), predictable (same button always produces the same change), and free. The one-click revision pattern is designed for simple mode users who want fast, obvious adjustments — not AI-powered re-imagination.

## D085: Character Presets as Separate Family
**Date**: 2026-03-23
**Decision**: Character presets are a new top-level preset family (`character`) rather than a sub-category of the `dialogue` family or a property on project presets.
**Rationale**: Character setup (number of speakers, dialogue style, face presence) crosscuts multiple other concerns — it affects dialogue, shot composition, audio, and rendering. Making it a first-class family enables a dedicated `CharacterPresetPicker` UI tab, clean `resolvePresets()` merge behavior, and independent evolution. A dialogue subfamily would conflate "how characters talk" with "who the characters are".

## D086: Separate Generate and Save API Calls for AI Presets
**Date**: 2026-03-23
**Decision**: The `/presets/generate` endpoint returns a preview without saving; the user explicitly saves via `POST /presets` after reviewing.
**Rationale**: AI output quality is unpredictable — auto-saving would pollute the user's preset library with garbage. Separating generate from save lets users review, edit name/description, and regenerate before committing. The modal UX flows: generate → preview → edit → save.

## D088: Unconditional Tenant Guard Standard (100% Coverage)
**Date**: 2026-03-24
**Decision**: All tenant-scoped API routes must use the unconditional guard pattern: `if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403)` followed by `tenantId: ctx.tenantId` in all queries. The conditional pattern `ctx.tenantId ? { tenantId: ctx.tenantId } : {}` is permanently banned.
**Rationale**: Session 34's 100% coverage audit found 60+ routes still using the conditional pattern (D071 was identified in Session 27 but not fully enforced). When `ctx.tenantId` is null, the conditional pattern silently returns data from all tenants. The unconditional guard makes tenant scoping fail-safe: requests without tenant context are rejected with 403 before any data query executes. This is now enforced across every API route in the codebase, not just the subset found in Session 27. The automated audit tests (`tenant-scoping.audit.test.ts`) catch regressions.

## D087: localStorage-First Optimistic Write for User Presets
**Date**: 2026-03-23
**Decision**: When saving a user preset, write to localStorage immediately (optimistic), then POST to the API in the background. On page load, merge localStorage with API response (API is source of truth by presetId).
**Rationale**: Instant UX — the preset appears in the picker immediately without waiting for a round-trip. If the API call fails (network issue), the preset is still available locally and will sync on next successful load. The tradeoff (possible temporary inconsistency across devices) is acceptable for a non-critical feature.

## D089: Assembly Manifest as Pipeline Contract
**Date**: 2026-03-24
**Decision**: Introduce `AssemblyManifest` as the shared data contract between ComfyUI (asset factory) and Remotion (film assembly engine). The manifest is stored in the existing `Storyboard.scriptJson` JSON column — no migration needed. The worker detects manifests via `schemaVersion === '1.0.0'` and falls back to legacy inline props building for storyboards created before this change.
**Rationale**: Agent outputs (director sections, dialogue tracks, sound layers, finishing color grades) were previously in-memory only and lost between pipeline stages. The manifest persists all agent outputs, carries per-shot dialogue/audio/continuity data, and provides a single `resolveForRemotion()` function to convert sec-based timeline data to Remotion's frame-based props. Backward compatibility is preserved via the schemaVersion detection pattern.

## D090: Composition and Workflow Registries
**Date**: 2026-03-24
**Decision**: Create `composition-registry.ts` for Remotion compositions and extend `workflow-registry.ts` with quality tiers, tier defaults, continuity levels, output formats, and tags. The worker uses `getWorkflowWithDefaults()` to apply tier-appropriate generation parameters and `getCompositionForProduction()` to select the correct Remotion composition.
**Rationale**: The worker previously hardcoded a `WORKFLOW_TEMPLATE_MAP` for workflow selection and used inline conditionals for composition selection. The registries centralize this metadata, making it accessible to both the worker and the frontend (cost estimation, pipeline preview, constraint validation). All new metadata fields are optional for backward compatibility.

## D091: Experiment Orchestrator Stays Pure
**Date**: 2026-03-24
**Decision**: The experiment orchestrator (`experiment-orchestrator.ts`) contains only pure functions with no database access, no `node:` imports, and is barrel-exported from `@airevstream/shared`. Workers and API routes handle all persistence.
**Rationale**: Follows D082 (node-only code pattern) — keeping the orchestrator pure means it can be imported by both the Next.js frontend (for validation/preview) and the worker (for evaluation). `shouldDeclareWinner()` reuses `calculateSignificance()` from viral-scoring.ts rather than duplicating the math. The worker handles DB reads/writes and queue orchestration.

## D092: Deterministic Preset Suggestions
**Date**: 2026-03-24
**Decision**: `suggestPresetVariant()` uses a rule-based mapping from weak viral dimensions to preset IDs. No LLM calls are involved.
**Rationale**: Follows the same philosophy as D084 (deterministic revision presets). Dimension-to-preset mappings are predictable and testable. For example, a low `hookStrength` score maps to presets with high-impact openings. This keeps suggestions instant, free, and reproducible — important for A/B experiment variant creation where consistency matters.

## D093: Channel-Aware Suggestions Use Deterministic Mapping
**Date**: 2026-03-25
**Decision**: `suggestPresetVariantForChannel()` extends the base `suggestPresetVariant()` with channel context (niche, tone, platform) to compute boost scores via 3 static maps (`NICHE_PRESET_BOOST`, `PLATFORM_PRESET_BOOST`, `TONE_PRESET_BOOST`). No LLM calls are involved.
**Rationale**: Extends D092's deterministic philosophy to channel-specific suggestions. Niche/tone/platform context improves suggestion relevance without adding latency or cost. The boost maps are additive scores applied to the base dimension-to-preset mapping, keeping the system predictable and testable. A channel focused on "tech reviews" with a "professional" tone on YouTube will get different preset rankings than a "comedy" channel with "casual" tone on TikTok.

## D094: SuggestionLog Tenant-Scoped with Direct tenantId
**Date**: 2026-03-25
**Decision**: `SuggestionLog` has a direct `tenantId` field (required) for fast queries, with optional `channelId` and `contentId` foreign keys for linking to specific channels and content items.
**Rationale**: Suggestion logs are queried frequently for analytics (accept/reject rates, outcome tracking, performance by channel). A direct tenantId avoids expensive joins through channel→socialAccount→emailAccount→tenant chains. Optional FKs allow logging suggestions that are not yet tied to specific content (e.g., proactive channel-level suggestions) while still supporting drill-down analytics when content is created.

## D095: Evaluating Status for Experiments
**Date**: 2026-03-25
**Decision**: Add an `evaluating` status to experiments as an optimistic concurrency lock. When a worker picks up an evaluate job, it sets `status = 'evaluating'` before performing the evaluation. Other workers skip experiments already in this state.
**Rationale**: The experiment worker runs with `concurrency: 2`. Without a lock, two evaluate jobs for the same experiment could run simultaneously, causing race conditions when declaring a winner and updating variant stats. The `evaluating` status acts as an application-level mutex — cheap, simple, and sufficient for the expected concurrency level. If the worker crashes mid-evaluation, a periodic cleanup job can reset stale `evaluating` experiments back to `running`.

## D096: Channel-Aware Preset ID Extraction
**Date**: 2026-03-25
**Decision**: When extracting preset IDs from `presetOverrides` for channel-aware suggestions, scan both keys and string values of the overrides object. Keys represent the preset family (e.g., `visual`, `camera`), and values may contain preset IDs as strings (e.g., `"cinematic-warm"`).
**Rationale**: The `presetOverrides` structure uses family names as keys and either preset IDs (strings) or partial override objects as values. To correctly identify which presets a piece of content uses — needed for suggestion outcome tracking and experiment variant comparison — both locations must be checked. This ensures the suggestion engine can correlate applied presets with viral score outcomes regardless of how presets were specified in the content creation flow.

## D097: Grandfathered Allowlist Pattern for Audit Tests
**Date**: 2026-03-25
**Decision**: New audit tests use a `KNOWN_*` Set allowlist to grandfather all pre-existing violations. The test catches only NEW violations (regressions). Entries are removed from the allowlist as they're fixed — the test prevents them from returning.
**Rationale**: Adding a new audit test to a codebase with many existing instances of the pattern would either fail immediately (blocking CI) or require fixing all instances first (blocking adoption). The allowlist pattern lets us ship the test immediately, prevent regressions, and fix existing violations incrementally. This pattern was already proven by `KNOWN_SILENT_CATCHES`, `KNOWN_MISSING_TENANT_SCOPE`, etc. in earlier audit tests. Applied to: `.strict()` Zod schemas (78→0 after targeted audit), incomplete status enum checks (27→22 after evaluation), console.log/debugger (0), double `/api/v1` prefix (0).

## D098: shouldDeclareWinner Respects primaryMetric
**Date**: 2026-03-25
**Decision**: The `shouldDeclareWinner()` function in experiment-orchestrator now accepts an optional `primaryMetric` parameter to determine which metric field to use for winner evaluation. Defaults to `'engagement'` for backward compatibility.
**Rationale**: The Experiment model has `primaryMetric` with 5 valid values (views, engagement, retention, clickRate, viralScore), but the orchestrator always used `engagementRate`. This made the metric selection meaningless. Now `getMetricRate(variant, primaryMetric)` maps each metric to the corresponding VariantMetrics field (e.g., retention→completionRate, clickRate→clicks/impressions). The worker passes `experiment.primaryMetric` to the function.

## D099: Rename Sequence to Series
**Date**: 2026-03-25
**Decision**: Rename the `Sequence` Prisma model to `Series` and `SequenceItem` to `Episode`. Use data-preserving ALTER TABLE RENAME migration.
**Rationale**: The Sequence model had zero consumers (no API routes, no frontend, no workers). "Series" is the correct domain concept — a channel has multiple series (e.g., "Ancient Rome", "WWII"), each with episodes, avatars, and style settings. Renaming rather than creating new models avoids data loss and preserves the existing schema structure.

## D100: Series Preset Resolution Layer
**Date**: 2026-03-25
**Decision**: Insert series default presets as a new layer in the 5-layer preset resolution stack: recipe → **series defaults** → individual → user overrides.
**Rationale**: Series style is more specific than a recipe but less specific than per-shot presets. This follows the existing `resolvePresets()` deep-merge pattern. Series presets auto-populate the preset picker when creating content within a series, providing visual consistency across episodes without requiring manual preset selection.

## D101: CinemaBible Overrides via Deep Merge
**Date**: 2026-03-25
**Decision**: Series stores `bibleOverrides` as a JSON object that deep-merges on top of the channel's CinemaBible, rather than a separate bible per series.
**Rationale**: CinemaBible data is large (look, character, environment, prompt sections). Duplicating it per series would be wasteful and error-prone. The override stores only diffs — a series can override the look bible's color palette while inheriting everything else. Null values in overrides remove the key, enabling selective deletion.

## D102: SeriesAvatar Join Table
**Date**: 2026-03-25
**Decision**: Use a `SeriesAvatar` join table with composite PK `(seriesId, avatarId)` and `role`/`isPrimary` fields, rather than a JSON array on the Series model.
**Rationale**: Matches the existing `ChannelAvatar` pattern. Enables Prisma includes, cascade deletes, FK constraints, and proper relational queries. Roles (main_character, supporting, narrator, antagonist) provide semantic meaning for agent pipelines.

## D103: Episode UUID PK with Separate episodeNumber
**Date**: 2026-03-25
**Decision**: Episodes have their own UUID primary key plus a separate `episodeNumber` (user-facing) and `position` (internal sort order), with `@@unique([seriesId, episodeNumber])`.
**Rationale**: Episode numbers are user-facing and stable — a creator may skip numbers (e.g., Episode 1, 2, 5) for content strategy reasons. Position is internal sort order for drag-reorder, decoupled from the public numbering. The UUID PK enables standard REST patterns (GET /episodes/:id) and avoids the composite key complexity of the old SequenceItem model.

## D104: Tenant Scoping for Avatar and SceneryAsset
**Date**: 2026-03-26
**Decision**: Add `tenantId` (required, FK → Tenant) to Avatar and SceneryAsset models with backfill migration.
**Rationale**: Both models lacked tenant isolation. Any user could see/modify any avatar or scenery. Required for multi-tenant security. Migration backfills existing rows to the first tenant, then sets NOT NULL. Follows D076 pattern.

## D105: Presigned PUT Upload Pattern
**Date**: 2026-03-26
**Decision**: Browser uploads files directly to MinIO via presigned PUT URLs. API route generates tenant-prefixed keys and presigned URLs, frontend PUTs directly.
**Rationale**: Avoids streaming large files through Next.js server (memory pressure, timeouts). The API only generates a signed URL with tenant-namespaced key (`{tenantId}/{type}/{uuid}/{filename}`), keeping files organized and tenant-isolated. Frontend tracks progress via XHR upload events.

## D106: Reuse Production Queue for Asset Generation
**Date**: 2026-03-26
**Decision**: Add `ProductionAssetGenerateJob` to existing production queue rather than creating a new queue.
**Rationale**: Production worker already has ComfyUI client, template rendering, bucket upload, and asset registration logic. Adding a new job type to the existing queue avoids queue proliferation and reuses proven infrastructure. Job routes via `production:asset-generate` name.

## D107: Avatar Images Store Bucket/Key Not URLs
**Date**: 2026-03-26
**Decision**: Avatar `images` JSON stores `{ bucket, key }` pairs per slot rather than presigned URLs.
**Rationale**: Presigned URLs expire (typically 1 hour). Storing bucket/key enables on-demand URL generation via the existing `usePresignedUrl` hook with 50-minute SWR cache. This is consistent with the existing asset registry pattern.

## D108: Asset Browser as Reusable Picker Component
**Date**: 2026-03-26
**Decision**: Single `AssetPickerModal` component accepts `type: 'avatar' | 'scenery'` and is reused across /assets page, channel detail Assets tab, and simple wizard.
**Rationale**: Avoids duplicating search/filter/grid UI across multiple contexts. The picker fetches its own data via SWR hooks, supports exclusion lists (for already-assigned assets), and returns only the selected ID to the parent.

## D109: AccountLifecycle Model as Single Source of Truth
**Date**: 2026-03-26
**Decision**: Create a dedicated `AccountLifecycle` Prisma model (1:1 with EmailAccount) that tracks end-to-end pipeline status per email, per platform.
**Rationale**: A single source of truth for lifecycle progress (discovery → signup → profile → seasoning). Drives the UI progress view with per-platform discoveryResults JSONB. Status state machine has 8 normal states + failed, allowing retry from failure point.

## D110: Worker-Chained Saga for Lifecycle Pipeline
**Date**: 2026-03-26
**Decision**: Use a worker-chained saga pattern instead of a static FlowProducer DAG for the lifecycle pipeline. Each handler queues the next step based on runtime state.
**Rationale**: Unlike the cinema pipeline where all steps are known upfront, lifecycle steps depend on runtime discovery results — can't build a static DAG because we don't know which platforms need signup vs. which already exist. Init handler chains subsequent jobs based on discoveryResults.

## D111: Discovery via Browser Login Probe
**Date**: 2026-03-26
**Decision**: Detect existing platform accounts by navigating to the login page with the email and checking the platform's response (password prompt = exists, "account not found" = doesn't exist).
**Rationale**: Platform APIs require OAuth developer accounts and approval processes. Login probe uses existing browser automation infrastructure (stealth Playwright, fingerprinting, proxy rotation). Slower but zero external dependencies. CAPTCHA triggers result in `exists: 'unknown'` with needs_human flag.

## D112: Activity Lock in SocialAccount.metadata
**Date**: 2026-03-26
**Decision**: Use a lightweight optimistic lock stored in `SocialAccount.metadata.activityLock` with type, lockedAt, expiresAt, and jobId fields for coordinating warming and posting activities.
**Rationale**: Both seasoning (warming) and posting workers need the same browser session but can't run simultaneously on the same account. Redis distributed locks would add complexity. The metadata lock uses Prisma optimistic concurrency with TTL-based expiry for crash recovery. Posting can break a warming lock if time-sensitive (posting is higher priority).

## D113: Lifecycle Worker as 9th Worker
**Date**: 2026-03-26
**Decision**: Create a dedicated `lifecycle.worker.ts` with its own `lifecycle` BullMQ queue rather than extending the existing account worker.
**Rationale**: The lifecycle worker is an orchestration layer that calls into existing account/seasoning primitives. Keeping it separate from the account worker maintains clean separation of concerns — account worker handles individual account operations, lifecycle worker coordinates the multi-step pipeline across multiple accounts and platforms.

## D114: Approval Gate Logic as Pure Functions in Shared Package
**Date**: 2026-03-26
**Decision**: Implement `evaluateApprovalGate()` and `updateTrustAfterAction()` as pure functions in `packages/shared/src/approval-gate.ts`, with no database or Node.js dependencies.
**Rationale**: Pure functions are easily testable and composable. Workers call them to evaluate gate status, API routes call them to update trust scores. The logic stays in one place rather than being scattered across workers and routes.

## D115: Trust Score Update via Upsert on Approve/Reject
**Date**: 2026-03-26
**Decision**: Update `ApprovalTrustScore` via Prisma `upsert` in all approve/reject routes, incrementing `totalApproved`/`totalRejected` and adjusting trust score and gate window.
**Rationale**: The `ApprovalTrustScore` model was already migrated but never written to. Upsert handles both first-time creation and subsequent updates. Trust adjustments are small (±2/±5) to avoid wild swings. Gate window shrinks on approval (faster auto-approve) and grows on rejection (more review time).

## D116: Storyboard pending_review Pauses Pipeline at QC Gate
**Date**: 2026-03-26
**Decision**: When the production worker QC gate completes for non-draft quality, set storyboard status to `pending_review` instead of proceeding to audio mix. Pipeline resumes when user approves via the storyboard approve API route.
**Rationale**: Leverages the existing FlowProducer DAG structure — child jobs (audio mix, render) are queued separately when the user approves, rather than being pre-queued. No DAG modification needed. The storyboard approve route queues the remaining pipeline steps.

## D117: HITL Task Count via SWR Polling in Sidebar
**Date**: 2026-03-26
**Decision**: Show HITL task count in the sidebar via a SWR-based fetch to `/workflows/hitl?limit=1` with 30-second refresh, rather than using SSE.
**Rationale**: SSE events are already used for real-time alerts and content status updates. Adding another SSE subscription for HITL count would increase server-side polling load for a low-priority indicator. SWR polling at 30s is sufficient for a sidebar badge and avoids adding another SSE event type.

## D118: TOCTOU Fix — Status Check Inside $transaction
**Date**: 2026-03-26
**Decision**: Move status validation checks inside Prisma `$transaction` blocks for approve/reject operations, so the read and write happen atomically.
**Rationale**: A separate `findFirst` followed by an `update` creates a time-of-check-to-time-of-use (TOCTOU) window where another request could change the status between the check and the update. Using `$transaction` with an interactive transaction ensures the status check and state change are atomic.

## D119: SSE Parallel Polling with Promise.allSettled
**Date**: 2026-03-26
**Decision**: Replace the SSE round-robin single-poller pattern (polling one event type per 10s cycle) with `Promise.allSettled` parallel polling of all 4 event types per cycle. Use a pre-query timestamp for `lastCheck` to avoid missing events.
**Rationale**: The round-robin pattern meant each event type was only polled every ~40s (4 types x 10s interval). Parallel polling queries all types simultaneously, reducing effective latency to the 10s cycle interval. `Promise.allSettled` ensures one failing query does not block the others. Pre-query timestamp prevents missed events that arrive during query execution.

## D120: Secondary Action Grouping via Dropdown Menu
**Date**: 2026-03-26
**Decision**: Group secondary content detail actions (rescore, repurpose, distribute, archive) into a "More..." dropdown menu instead of showing individual buttons.
**Rationale**: The content detail header had too many action buttons (approve, reject, schedule, edit, rescore, repurpose, distribute, archive), creating visual clutter and reducing the prominence of primary actions. Grouping secondary actions behind a dropdown keeps primary actions visible while making secondary ones accessible. This follows the progressive disclosure principle.

## D121: Deep Audit Wave Methodology — 7 Waves, 26 Agents
**Date**: 2026-03-26
**Decision**: Structure deep codebase audits as 7 sequential waves with strict file ownership per agent, processing 362 non-test source files (~96K LOC) with 26 agents total: Auth & system (3), Content & cinema (5), Domain pages (5), Frontend infra (3), Backend packages (5), Services + workers (2), Remotion (1).
**Rationale**: Sequential waves allow verification after each wave before proceeding, preventing cascading breakage. Strict file ownership (no overlapping file edits) eliminates merge conflicts between parallel agents. Agent count per wave scales with file count and complexity — more agents for larger waves, fewer for simpler ones. This methodology produced 105 fixes with 0 regressions across all 7 waves.

## D122: Silent Catch Logging Level Differentiation
**Date**: 2026-03-26
**Decision**: Use `console.warn` or `logger.debug` for expected/recoverable failures (health check pings, SSE JSON parse errors, optional feature probes) and `console.error` for unexpected failures (database errors, authentication failures, data corruption).
**Rationale**: The audit found ~35 silent catch blocks. Not all failures warrant `console.error` — some are expected operational conditions (e.g., a health check failing is informational, not an error). Differentiating log levels keeps error logs actionable and reduces noise while still ensuring no catch block is completely silent.

## D123: Lifecycle Hook URL Leading Slash Requirement
**Date**: 2026-03-26
**Decision**: All URL paths passed to `useApi()` and mutation helpers (`apiPost`, `apiPut`, `apiPatch`, `apiDelete`) must start with a leading `/`. The helpers prepend `/api/v1` to the path, so a missing slash causes path concatenation errors (e.g., `/api/v1accounts/...` instead of `/api/v1/accounts/...`).
**Rationale**: 4 lifecycle hooks were missing the leading slash, causing all lifecycle API calls to return 404. This was a CRITICAL runtime bug that was invisible at build time. The fix is simple (add the slash) but the pattern is easy to miss during development. Codified as a decision so future code reviews catch it.

## D124: Pre-Deployment Audit Methodology — 8 Waves, 30 Agents
**Date**: 2026-03-26
**Decision**: Structure the final pre-deployment audit as 8 sequential waves with 30 agents total: Auth & system (3), Content & cinema (4), Domain pages (5), Remaining API + hooks + libs (4), Backend packages (4), Services + workers (3), Remotion + ComfyUI + integration (3), Test infrastructure + config (3). Verify after each wave with `turbo build --force && turbo test && npm run audit`.
**Rationale**: Building on the proven D121 methodology from Session 45. Added an 8th wave (test infra + config) since audit allowlists and PM2 config were never audited. Integration tracing (Wave 7-C) was run as read-only to document cross-boundary mismatches without fixing them — these are architectural issues needing design decisions, not quick fixes.

## D125: PM2 Worker Path Convention
**Date**: 2026-03-26
**Decision**: All PM2 worker entries use script paths relative to project root: `workers/dist/<name>.worker.js`. Do not use `dist/workers/` (wrong directory) or set `cwd` to the workers directory (inconsistent with services).
**Rationale**: All 6 original PM2 worker entries had `script: 'dist/workers/<name>.worker.js'` which resolves to `<root>/dist/workers/` — a directory that doesn't exist. The compiled output is at `workers/dist/`. Additionally, 2 workers added in later sessions (experiment, lifecycle) were never added to PM2. This would have caused all workers to crash on `pm2 start` in production.

## D127: Unified qualityTier Naming Convention
**Date**: 2026-03-26
**Decision**: Use `qualityTier` (not `qualityPreset`) as the canonical field name for the quality level (`'draft' | 'standard' | 'cinema'`) across all packages, queue job interfaces, API routes, workers, and frontend components.
**Rationale**: The codebase had a split naming convention — shared/types used `qualityTier` while queue/API/workers used `qualityPreset`, requiring implicit casts at boundaries. Unifying to `qualityTier` matches the workflow-registry's `QualityTier` export and the `AssemblyManifest.qualityTier` field. 15 files updated in a single coordinated rename.

## D128: SoundOutput→AudioLayerSpec Mapping via toAudioLayerSpec()
**Date**: 2026-03-26
**Decision**: Map sound agent output layers to `AudioLayerSpec` using a `toAudioLayerSpec()` helper in the production worker, setting `source: 'generate'` and mapping the agent's descriptive `source` string to the `text` field.
**Rationale**: The sound agent outputs creative direction (`{ source: "ambient forest sounds", volume: 0.3, description: "..." }`) which is semantically a generation request, not a file reference or TTS command. The `'generate'` source type signals the mix handler to synthesize or search for matching audio. This preserves the agent's creative intent while conforming to the `AudioLayerSpec` contract.

## D126: Catch Regex Completeness in Audit Tests
**Date**: 2026-03-26
**Decision**: The `extractCatchBlocks()` regex in audit-helpers.ts must match both `catch(err) {` and modern `catch {` (paren-less) syntax.
**Rationale**: The original regex `\bcatch\s*\([^)]*\)\s*\{` only matched `catch(err) {`, missing 7 route files using ES2019 optional catch binding (`catch {`). These routes were invisible to the silent-catch audit test. Updated to `\bcatch\s*(?:\([^)]*\)\s*)?\{`.

## D129: force-dynamic on All Non-Parameterized API Routes
**Date**: 2026-03-27
**Decision**: Add `export const dynamic = 'force-dynamic'` to all 83 non-parameterized API route files.
**Rationale**: During `next build`, Next.js tries to statically pre-render non-parameterized routes. Routes using `authenticate()` read `request.headers`, which throws `DynamicServerError` inside try/catch blocks, producing misleading error log lines in the build output. Adding the explicit `force-dynamic` export tells Next.js to skip static rendering probes entirely, eliminating false error signals.

## D130: Fail-Fast Environment Validation + Scripted Bootstrap
**Date**: 2026-04-20
**Decision**: (1) Every process that loads `@airevstream/shared` config validates `process.env` against a strict Zod schema at startup and throws with a complete list of missing/placeholder values before any service code runs — no silent fallbacks to demo secrets, no partial-boot paths that fail at first Redis/MinIO/Prisma call. (2) Fresh-machine bringup is driven by two vetted scripts: `scripts/doctor.sh` (preflight — Docker running, required binaries present, optional binaries hinted via `brew install`, host ports free, `.env` exists and is populated) and `scripts/bootstrap.sh` (idempotent bringup — docker compose up, wait healthy, prisma migrate deploy, turbo build, then stop). Makefile targets `make doctor`, `make bootstrap`, `make reset` wrap them. Bootstrap intentionally stops short of creating an admin user or starting dev servers so the operator makes those calls explicitly.
**Rationale**: The project had been unusable on a fresh checkout because misconfigured env, busy host ports, and a broken `minio-init` entrypoint would each fail silently or at an unrelated layer, leaving the operator to chase red herrings. Fail-fast validation converts "looks like it started but nothing works" into "refused to start, here's exactly what's missing." The scripted bootstrap replaces a fragile README checklist with an execution path that has been end-to-end verified. Choosing fail-fast in all environments (not just prod) is deliberate — dev drift is the source of almost every "works on my machine" report. The two-script split (doctor vs. bootstrap) keeps diagnostics runnable without side effects when something fails mid-bringup.

## D131: OLLAMA_DEFAULT_MODEL Env Override Trumps Code + DB Defaults
**Date**: 2026-04-20
**Decision**: The Ollama model tag used by every non-explicit call site is resolved in this priority order, evaluated at request time (not module load): (1) the caller's explicit `request.model`, (2) `process.env.OLLAMA_DEFAULT_MODEL?.trim()` if set, (3) the seeded `AiService.capabilities.defaultModel` in the DB (for `ServiceRegistry` paths only), (4) the compiled-in fallback `'qwen3:8b'`. Implemented in three files: `packages/ai-client/src/providers/ollama.ts` (`getDefaultModel()`), `packages/ai-client/src/index.ts` legacy path (`defaultModel()`), and `packages/ai-client/src/registry.ts::getModelFromCapabilities()` which short-circuits the DB capability lookup for `provider === 'ollama'` when the env var is set.
**Rationale**: Operators frequently pull larger Ollama tags than what the seed row advertises — e.g. `qwen3.5:122b` on a 512 GB Mac Studio — and it's hostile to force them to hand-edit the `capabilities` JSON on the `AiService` row to match. The env var was already the documented override in `.env.example`, but the registry path was reading the DB capability first and winning, so the env var silently had no effect on the main `ServiceRegistry.generate()` code path. Env wins for Ollama specifically because Ollama tags are local-machine state the operator controls; other providers (OpenAI, Anthropic, Google) continue to honor the DB row because those models are API-side and shouldn't shift without a deliberate write. Evaluation at request time (not module load) is required so that per-process env overrides — e.g. PM2 per-worker env blocks — are respected even when the ai-client is bundled.

## D133: `pickSafeMessage()` Helper Handles formatZodErrors Field Prefixes
**Date**: 2026-04-21
**Decision**: Auth pages (register, reset-password, forgot-password, and any future page that shows Zod validation errors) must route `data?.error?.message` through the new `pickSafeMessage(raw, safeMessages, fallback)` helper in `apps/web/src/lib/safe-messages.ts` instead of a raw `safeMessages.includes(raw)` check. The helper matches either the exact message or the `"field: message"` variant produced by `formatZodErrors()`, stripping the prefix before lookup.
**Rationale**: `formatZodErrors()` (in `api-server.ts`) is the central Zod-error formatter and prefixes each message with the field path for human readability — e.g. `"password: Password must be at least 8 characters"`. The auth-page `safeMessages` allowlists were written against the bare messages, so every validation error silently dropped to the generic `"Invalid request"` fallback. Rather than duplicate the allowlists with prefixed variants (fragile, drifts with schema changes) or rewrite `formatZodErrors()` to strip the prefix (loses the useful field context on the API side), centralise the stripping on the presentation side. `pickSafeMessage()` is a 10-line utility; auth-page contributors can adopt it without changing any API contract. If the API ever adopts a different prefix separator, we change one file.

## D134: Affiliate Conversion Endpoint Accepts JWT or API Key; Always Transactional
**Date**: 2026-04-21
**Decision**: `POST /api/v1/affiliate/clicks/[id]/convert` authenticates via either Bearer JWT or X-API-Key (through `authenticateAny(req, 'write')`), tenant-scopes the click through the `channel → socialAccount → emailAccount` chain, and wraps the click update + `AffiliateProduct` counter bump in a `$transaction`. Double-conversion returns 409 and does not write. The product counter bump is wrapped in a `catch` that logs and swallows, so older deployments that predate the `totalRevenue`/`totalConversions` columns still record the conversion on the click row.
**Rationale**: Affiliate-network postbacks (Amazon Associates Reports, Impact postbacks, ShareASale pixels) arrive from public IPs with no user session, so API-key auth is required. Operators also need a manual override path from the admin UI, which uses Bearer JWT. Using `authenticateAny` (which the codebase already had for the redirect endpoint) covers both in one route without duplicating logic. Tenant-scoping through the channel chain mirrors how other affiliate routes verify ownership — clicks have no direct `tenantId` column. The transaction prevents the double-counting race where two postbacks land simultaneously; the 409 guard prevents replay. The counter-bump-catch is defensive: the `AffiliateProduct.totalRevenue/totalConversions` columns were added in a later migration and some production deployments may not have them yet — we'd rather record the click conversion than refuse the postback over a column that doesn't exist.

## D135: Budget Alerts De-duplicated by metadata.alertKey within 24 h
**Date**: 2026-04-21
**Decision**: `GET /api/v1/budgets/check` writes one `Alert` row per `(budgetId, kind)` pair per 24-hour window, where `kind ∈ { threshold, exceeded }`. The dedup key is written into `Alert.metadata.alertKey = "budget:<budgetId>:<kind>"` and the check queries any open/acknowledged cost alert in the last 24 h to decide whether to skip the insert.
**Rationale**: Budgets are checked on every request to the endpoint (e.g. by a cron pinging every minute), so naive inserts would flood the alerts table. `Alert` doesn't have a unique constraint on `(tenantId, category, source, metadata.alertKey)` because Postgres JSONB unique constraints are awkward, so we enforce the invariant in code. The 24-hour window is a deliberate balance: short enough that a budget that clears and re-breaches gets a new alert the next day, long enough that a single cron run doesn't produce duplicate noise. Using `metadata.alertKey` rather than synthesising a top-level `key` column keeps the `Alert` schema generic — other sources (health-check failures, content QC regressions) can follow the same pattern with their own key formats.

## D136: Public Storefront Pages 404 for Drafts; API Rate-Limited Per IP
**Date**: 2026-04-21
**Decision**: `/p/[slug]` (server component) and `GET /api/v1/public/storefronts/[slug]` (public API) both filter on `status='published'` and return 404 when no match. Drafts, archived, and never-existed slugs are indistinguishable in the response. The API applies a per-IP rate limit of 120 requests per minute using the existing `checkRateLimit` utility. The page uses `revalidate = 60` so publishing a change propagates within a minute without a full ISR invalidation flow. Outbound affiliate links carry `rel="sponsored nofollow noopener"` and target the existing `/api/v1/affiliate/redirect/<shortCode>` URL so clicks are logged before the final redirect.
**Rationale**: Slugs are short, guessable, and frequently shared — treating "not published" as 404 (rather than 403 or redirect-to-login) prevents URL scraping: attackers can't enumerate draft slugs to front-run launches. 120 req/min per IP is generous enough for legitimate social-media click-throughs (a viral TikTok might drive a few hundred /min) but low enough to dent naive scrapers; operators hitting the limit get a clean 429 with a `Retry-After`-compatible message. The 60-second revalidate matches the ops cadence in the dashboard — operators expect storefront edits to go live "in about a minute" without clicking a separate "publish" button. `rel="sponsored nofollow noopener"` is required by Google's affiliate-link policy and prevents tabnabbing on third-party sites.

## D132: Ollama `think` Defaults Off; Opt-In Per Request
**Date**: 2026-04-21
**Decision**: The `OllamaProvider` passes `think: false` to `ollama.chat()` by default for all three code paths (`generateText`, `generateChat`, `streamChat`). Callers who want reasoning-mode output must opt in explicitly via `request.think = true` on `TextRequest`/`ChatRequest`. In both cases, the provider defensively strips any `<think>...</think>` blocks that still appear in `message.content` — including tags that span chunk boundaries in streaming mode — before returning. The compiled-in fallback model remains `qwen3:8b`.
**Rationale**: Thinking-capable models (qwen3, deepseek-r1, etc.) emit long internal reasoning that typically quadruples latency without improving the short, tightly-structured outputs the content pipeline needs (HICC scripts, captions, thumbnails). The first real E2E run on 2026-04-21 surfaced this plainly: a single content generation job took ~4 minutes end-to-end because qwen3:8b was thinking through a ~200-word script. The BullMQ userflow timed out at 3 minutes and reported the pipeline as stuck, even though Redis showed `finishedOn`/`returnvalue` = completed — a misdiagnosis that would recur every time an operator sanity-tested the system. Defaulting `think: false` makes the common case fast; explicit opt-in preserves the capability for code paths that genuinely benefit from chain-of-thought (complex research synthesis, multi-step planning). The defensive strip covers two edge cases: (a) models that ignore the top-level `think` flag and inline `<think>` tags anyway, (b) future upgrades to the ollama-js SDK that change the flag semantics. Stripping tags server-side keeps downstream consumers (DB writes, UI renders, post-processing regexes) unaware of the distinction.
