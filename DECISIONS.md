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
