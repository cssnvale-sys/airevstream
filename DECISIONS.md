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
