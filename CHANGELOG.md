# Changelog

All notable changes to AiRevStream MPCAS are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `.claude/rules/` — 6 modular rules files codifying development patterns
- **API Key Authentication** (Session 7): `authenticateApiKey()` and `authenticateAny()` in api-server.ts — validates X-API-Key header, enforces scopes and per-key rate limiting (KI-022)
- **Rate Limiting** (Session 7): In-memory sliding window rate limiter on login, register, forgot-password, reset-password routes; standardWrite/adminWrite presets on 6 high-risk write endpoints
- **Security Headers** (Session 7): X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy via next.config.js
- **Reusable UI Components** (Session 7): `ConfirmDialog`, `EmptyState`, `CopyButton`, `KeyboardShortcutsModal`, toast wrapper
- **Forgot Password Flow** (Session 7): forgot-password + reset-password API routes and frontend pages
- **Job Status Polling** (Session 7): `GET /api/v1/jobs/:id` endpoint + `useJobStatus` SWR hook (KI-006)
- **CSV Export** (Session 7): `exportToCSV()` utility, analytics export per tab (KI-003)
- **Accounts Bulk Delete** (Session 7): `POST /api/v1/accounts/bulk-delete` + bulk toolbar UI
- **Channel DELETE** (Session 7): `DELETE /api/v1/channels/:id` with cascade cleanup
- **Content DELETE** (Session 7): `DELETE /api/v1/content/:id` for draft/archived/failed content
- **Keyboard Shortcuts** (Session 7): Global shortcuts (? N L A), shortcuts modal, sidebar help button
- **Copy-to-Clipboard** (Session 7): Copy buttons on affiliate short URLs, API key prefixes, job IDs
- **Empty States** (Session 7): Actionable empty states with CTAs on library, workflows, approvals, accounts pages
- **Server-Side Calendar Filters** (Session 7): channelId, platform, status query params (KI-004)
- **Error Toasts** (Session 7): Toast notifications replacing silent catches on settings, approvals, accounts, affiliate, dashboard, system
- **Confirmation Dialogs** (Session 7): ConfirmDialog on API key revocation, content rejection, content deletion, bulk delete, bulk reject
- **Workflows Pagination & Filters** (Session 7): 20-per-page pagination, job type filter, retry failed jobs, refresh button
- **Approvals Bulk Actions** (Session 7): Bulk approve/reject with select-all, pagination, content type filter
- **Accessibility** (Session 7): aria-current on sidebar, aria-labels on nav/buttons/checkboxes/modals, role=grid on calendar
- **Analytics Error State** (Session 7): Error display card when analytics data fails to load
- **Unsaved Changes Warning** (Session 7): useUnsavedChanges hook + dirty state tracking on settings general tab
- **Search Debounce** (Session 7): useDebounce hook (300ms) on library and accounts search inputs
- **Page Metadata** (Session 7): SEO titles for all 11 dashboard pages via layout.tsx files + root title template
- **Error Boundaries** (Session 7): error.tsx for global app and all 11 page segments
- **AI Service Health Check** (Session 7): "Test All" button on settings AI services tab
- **Auth Middleware** (Session 7): Server-side route protection via Next.js middleware with session indicator cookie
- **Custom 404 Page** (Session 7): Branded not-found.tsx with dashboard link
- **Loading Skeletons** (Session 7): Pulse-animated loading.tsx for all 11 dashboard page segments

- **Password Visibility Toggle** (Session 7): Eye/EyeOff toggle on login and register password fields
- **Sidebar State Persistence** (Session 7): Collapsed state saved to localStorage
- **Create Wizard Progress Bar** (Session 7): "Step X of 6" text + animated percentage bar
- **System Refresh Button** (Session 7): Manual re-fetch of all health/metrics data with toast feedback

- **Unit Tests** (Session 7): 55 new web tests — password (11), rate-limit (14), api-server (30). Total: 61 web tests
- **API Key Access on Read Endpoints** (Session 7): 13 GET routes accept both JWT and API key via authenticateAny()
- **Prisma Indexes** (Session 7): @@index([status, jobType]) on WorkflowJob, @@index([status, resolvedAt]) on Alert

### Fixed

**Audit Round 41 (Session 7) — Input Validation, Accessibility, Worker Safety**
- Zod validation on 4 Fastify PUT/bulk routes (content update, content bulk approvals, account update, bulk import with max 500)
- Sort field allowlists on content + workflow GET routes (prevent Prisma injection)
- Worker shutdown: Promise.allSettled with per-worker try-catch
- Posting worker: JSON.parse wrapped in try-catch for decrypted credentials
- Account route: warn log when ENCRYPTION_KEY missing (plaintext fallback)
- ComfyUI error response truncated to 500 chars, prompt_id validated
- Storage listObjects: configurable timeout (default 60s) with stream cleanup
- ARIA roles on settings tabs (role=tablist/tab, aria-selected, aria-controls)
- ARIA roles on analytics tabs (role=tablist/tab, aria-selected)
- Calendar item buttons: descriptive aria-label (channel, platform, status)
- Analytics PDF export button: visual disabled state
- Create wizard: block step 2 when affiliate enabled but no product selected
- Content worker: error logging before status update, nested try-catch for DB errors
- Account worker: 4 closeContext() calls wrapped in .catch() to prevent error masking

**Audit Round 40 (Session 7) — Security, Config, Transactions**
- Open redirect vulnerability fixed on login page (validate redirect param is relative path)
- Affiliate short URL matching: `contains` → `endsWith /code` (prevents false positive matches)
- Defensive optional chaining on accounts page (flatMap, every, reduce)
- ComfyUI timeout and platform API versions extracted to env vars
- Maintenance worker cleanup deletes wrapped in Prisma $transaction

**Audit Round 39 (Session 7) — Security Hardening, Role Checks**
- IP format validation in getClientIp() — prevents rate-limit key pollution from spoofed X-Forwarded-For headers
- 30s fetch timeouts on all frontend API calls (fetcher, apiPost, apiPut, apiDelete)
- Silent catch on apiKey lastUsedAt update now logs errors
- Commission rate clamped to 0-100 on affiliate product create/edit forms
- Admin role checks added to 5 AI service routes (POST create, PUT update, POST health-check, GET costs, GET usage)

**Audit Round 38 (Session 7) — Centralization, Validation, Tenant Scoping**
- Centralized JWT_SECRET into lazy `getJwtSecret()` in api-server.ts (prevents build-time crash, removes 5 duplicates)
- Centralized password hashing into `password.ts` (removes 5 duplicate hashPassword/verifyPassword functions)
- Added Zod validation to last 4 unvalidated routes (schedule PUT, change-password, snooze, approvals action)
- Tenant-scoped assistant analytics queries (contentItem, scheduledPost, affiliateClick, content queue stats)
- Fixed error message leak in assistant action executor failure response
- Added `.max()` string length limits to 9 unbounded Zod schema fields
- Fixed publishConfig Prisma InputJsonValue cast in schedule/[id]

**Audit Round 37 (Session 7) — Type Safety, Production Guards, Indexes**
- Eliminated all `catch (err: any)` across codebase — 6 files fixed with `instanceof Error` guards
- All 3 services: JWT_SECRET required in production mode (throws at startup)
- All 3 services: removed `(error as any).code` cast in error handlers
- Prisma schema: added 4 missing indexes (storyboards, conversations, action_audit_log, cinema_bibles)

**Audit Round 36 (Session 7) — Worker/Service Safety**
- production.worker: replaced `new PrismaClient()` with `getDb()` singleton (prevents broken tenant isolation)
- account.worker: added try-finally for browser context cleanup on all 4 handlers (prevents context leaks)
- content.worker: added logging to silent catch in service registry init
- ai-assistant generate: stopped returning raw `error.message` to clients (3 routes)
- 4 service routes: fixed parseInt NaN on page/limit query params (chat, content, account, workflow)
- system/metrics: added metricType allowlist validation, removed `as any` casts

**Audit Round 35 (Session 7) — Tenant Scoping & Validation**
- HITL complete + error retry: tenant scoping via content relation OR emailAccountId chain
- Storefront products GET/POST/PATCH/DELETE: two-step channel ownership verification
- 5 API routes: added Zod validation schemas (cinema-bible, avatars, families, affiliate-pool, storyboard)

**Audit Round 34 (Session 7) — Type Safety, Error States, Query Safety**
- AI providers: replaced `providerType: any` with proper `AiServiceProvider` type
- 5 frontend pages: destructured error from useApi hooks with error banners (dashboard, workflows, system, calendar, settings)
- 5 analytics routes: date isNaN guard on query param parsing
- Analytics overview: capped unbounded findMany queries at 5000 rows
- Storefront GET/PATCH/DELETE: tenant ownership verification through channel chain (security fix)
- LLM fetch calls: abort signal timeouts (120s generate, 300s stream) to prevent server hangs
- Crypto decrypt: minimum ciphertext length validation
- ai-client generateJSON: try-catch on JSON.parse
- HTTP provider: empty messages array guard
- Approvals bulk action: error logging in catch block
- Library page: merged duplicate apiDelete import

**Audit Round 32 (Session 7) — Service/Worker Hardening**
- 3 service entry points: .catch() on main() to handle startup failures
- 3 service global error handlers: static safe error messages (no error.message leaks)
- Research worker: try-catch on JSON.parse for AI-generated responses
- AI assistant: logged silent registry initialization failures
- apiPost/apiPut/apiDelete: handle non-JSON responses (502/503) with clean fallback

**Audit Round 30 (Session 7) — Resource Cleanup & Code Quality**
- SSE stream: log unexpected close errors instead of swallowing
- AI health check: clear fetch timeout on error path (was leaking on failure)
- Rate limiter: warn when in-memory store exceeds 10k entries
- CSV bulk import: skip lines with fewer than 2 fields
- Alert snooze: validate duration range (0-86400 seconds)
- parseQuery: explicit radix 10 on parseInt
- Login/change-password: defensive hash split with length check

**Audit Round 28 (Session 7) — Prisma Transactions**
- Wrapped multi-step writes in `$transaction()` on 5 routes to prevent race conditions: content approve/reject, bulk approvals, avatar assignment, subscription plan changes

**Audit Round 27 (Session 7) — Zod Validation, Rate Limiting, Security, Data Quality**
- Zod validation schemas on 6 more routes: accounts POST, content variants POST, auth/login, auth/register, auth/forgot-password, auth/reset-password
- Rate limiting on expensive operations: content generation (20/hr), bulk import (5/hr), analytics export (10/hr)
- Sort field allowlists on 6 GET routes to prevent sort injection
- Date input validation on 5 analytics routes (invalid dates silently ignored instead of creating Invalid Date)
- Content-Security-Policy header added to next.config.js
- `parseQuery` order param now only accepts 'asc'/'desc'
- Fixed accounts page unsafe `.channels` type cast (accessing non-existent field)
- SWR revalidation after job retry on system page
- Removed unused `json` import from analytics/export

**Audit Round 25 (Session 7) — Query Params, Accessibility, Cleanup**
- Enum allowlist validation on GET query params across 11 API routes (accounts, channels, content, users, alerts, subscriptions, budgets, prompts, tenants, knowledge-base, ai-services)
- Accessibility: aria-label on header buttons, search input, copy button, dashboard actions
- Removed 3 unused imports

**Audit Round 24 (Session 7) — Validation, Tenant Scoping & UX**
- **CRITICAL:** Tenant scoping on affiliate/storefronts GET+POST (channel ownership check)
- Zod validation schema on schedule POST (was manual string checks)
- NaN guard on assistant/actions analytics.query days parameter
- Fixed silent JSON catch on content/[id]/reject
- Added toast notifications to create page (script, storyboard, shot, save mutations)

**Audit Round 23 (Session 7) — Final findUnique Sweep**
- **CRITICAL:** Tenant scoping on channels POST (socialAccount ownership check)
- **CRITICAL:** Tenant scoping on content/generate (channel ownership check)
- **CRITICAL:** Tenant scoping on assistant/actions — 5 executors (content.generate, content.schedule, content.approve, account.create, account.delete)
- Tenant scoping on schedule POST (consolidated redundant checks)
- Tenant scoping on jobs/[id] GET (channel/account ownership verification)
- Tenant scoping on accounts/[id]/socials GET+POST (emailAccount tenantId filter)

**Audit Round 22 (Session 7) — Tenant Scoping & Validation Expansion**
- **CRITICAL:** Tenant scoping on channels/[id]/cinema-bible, affiliate-pool, avatars sub-routes
- **CRITICAL:** Tenant scoping on content/[id]/quality-score, storyboard, variants, regenerate
- **CRITICAL:** Tenant scoping on approvals/bulk POST (cross-tenant bulk approve/reject possible)
- Zod validation on approvals/bulk (ids array, action enum)
- Zod validation on accounts/bulk-import JSON path (email, password, tier)
- Fixed _count leak in tenants list and detail routes

**Audit Round 21 (Session 7) — Comprehensive Zod Validation**
- Added Zod validation schemas to 11 more POST/PUT routes: content/generate, generate-script, generate-storyboard, generate-shot, content/[id]/reject, accounts/bulk-delete, accounts/[id]/socials, affiliate/links, affiliate/products/[id], assistant/chat
- Content reject route now tenant-scoped via findFirst with channel chain
- Fixed _count leak in accounts/[id]/socials GET response

**Audit Round 20 (Session 7) — Tenant Scoping, Validation & Cleanup**
- **CRITICAL:** Tenant scoping on workflows list route (was returning all tenants' jobs)
- **CRITICAL:** Tenant scoping on content approve route (could approve any tenant's content)
- Budget limitAmount capped at 1M max to prevent accidental huge amounts
- Knowledge base domain validated against enum (6 allowed values)
- Prompts metadata field `as any` cast for Prisma InputJsonValue compatibility
- Accounts GET: properly destructured `_count` to prevent it leaking in JSON response
- AI services routes documented as intentionally global scope (shared infra)

**Audit Round 18 (Session 7) — Password Security, PUT Validation & Image Optimization**
- Added rate limiting to change-password (5/15min) and users/invite (10/hr) routes
- Change-password now returns fresh JWT for token rotation
- Added Zod validation schemas to 4 PUT routes (content/[id], channels/[id], accounts/[id], ai-services/[id])
- Converted raw img tag to next/image in create page storyboard shots

**Audit Round 17 (Session 7) — Rate Limiting, Validation & Security Headers**
- Added in-memory sliding window rate limiter to 4 auth routes (login, register, forgot-password, reset-password)
- Added Zod validation schemas to 8 POST/PUT routes (settings/general, appearance, notifications, security, api-keys, ai-services, affiliate/products, channels)
- Added security headers via next.config.js (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)

**Audit Round 13 (Session 7) — NaN Guards & Accessibility**
- Added isNaN fallback on parseInt in analytics/engagement and system/metrics routes
- Added safePercent helper with NaN guard in usage route for all percentage calculations
- Added NaN fallback on affiliate/analytics period parseInt
- Fixed error message leak in create page save content catch block
- Added aria-label on keyboard shortcuts button in sidebar
- Added NaN guard on dashboard qualityScore display
- Improved alt text on create page storyboard shot images

**Audit Round 14 (Session 7) — Tenant Scoping & Auth**
- **CRITICAL:** Added tenant scoping to approvals GET route (any user could see all tenants' approvals)
- **CRITICAL:** Added tenant scoping to approvals POST approve/reject (cross-tenant action possible)
- Fixed `err: any` type in approvals action catch block
- Added JWT expiry check in `isAuthenticated()` — expired tokens now auto-cleared
- Added `Number()` wrapping on `healthScore` Decimal in accounts GET route
- Improved error message extraction in `use-api.ts` — falls back to `error.code` if `message` is missing

**Audit Round 15 (Session 7) — Comprehensive Tenant Scoping**
- **CRITICAL:** Tenant scoping on accounts/[id] GET/PUT/DELETE (any user could access other tenants' accounts)
- **CRITICAL:** Tenant scoping on channels/[id] GET/PUT (any user could view/edit other tenants' channels)
- Tenant scoping on system/workflows (scoped by tenant channels/accounts)
- Tenant scoping on activity feed (content/posts scoped by tenant channels)
- Tenant scoping on affiliate/revenue and affiliate/clicks (scoped by tenant channels)
- Fixed `err: any` type in activity route
- Documented 7 models needing `tenantId` schema migration (KI-020)

**Audit Round 16 (Session 7) — Comprehensive Tenant Scoping & Type Safety**
- **CRITICAL:** Tenant scoping on channels/families GET (returned all tenants' channels)
- **CRITICAL:** Tenant scoping on channels/families POST (could group any tenant's channels)
- **CRITICAL:** Tenant scoping on accounts/stats (returned system-wide statistics)
- **CRITICAL:** Tenant scoping on accounts/bulk-import (email enumeration across tenants)
- Authorization check on subscriptions POST (could create subscription for any tenant)
- SSE event stream: workflow/content pollers scoped by tenant channels
- Removed all 11 remaining `err: any` types across API routes

**Audit Round 12 (Session 7) — Validation & Polish**
- Added password minLength and submit disabled state to accounts add-email modal
- Added required/minLength/maxLength to create page topic field
- Fixed error message leaks in accounts modal, settings password change, settings API key create/revoke
- Fixed `err: any` → `err: unknown` in AI health-check route
- Guarded reset token console.log with `NODE_ENV === 'development'`

**Audit Round 10 (Session 7) — Security**
- **CRITICAL:** Added tenant scoping to all 7 analytics routes (overview, engagement, revenue, costs, content-performance, audience, export) — any authenticated user could previously see all tenants' analytics data (KI-016)

**Audit Round 11 (Session 7) — Error Handling & Quality**
- Fixed error message leaks in login, register, create, and affiliate pages — replaced raw `err.message` with static strings
- Fixed memory leak in CopyButton (setTimeout without cleanup on unmount)
- Added error logging to 4 silent catch blocks in create and affiliate pages
- Added error logging to notification-center dismiss/markAllRead catches

**Audit Round 5 (Session 6)**
- Fixed 7 API routes using `getDb()` instead of tenant-scoped `ctx.db` (KI-009)
- Added `console.error` logging to 28 silent catch blocks across 20+ API routes (KI-010)
- Fixed Prisma Decimal field serialization in 5 API routes + 3 frontend pages (KI-012)

**Audit Round 6 (Session 6)**
- Fixed 15 more silent catch blocks (usage, users, subscriptions, api-keys, tenants, events/stream)
- Decimal `Number()` wrapping in 20+ additional API routes (ai-services, analytics/costs, content, storyboard, affiliate products, budgets, knowledge-base, prompts)
- Fixed `ENCRYPTION_KEY` non-null assertion bug in ai-services routes
- Fixed system health false positive when no services exist

**Audit Round 7 (Session 6)**
- Create page: `channel.platform` → `channel.socialAccount.platform`, `channel.identity` → top-level fields, `product.commission` → `product.commissionRate`
- Dashboard: removed phantom `postedAt` field, fixed `qualityScore` type
- Settings: added `status/expiresAt` to ApiKey, removed phantom `model` from AiService
- Affiliate: added DELETE handler for pool removal

**Audit Round 8 (Session 6) — Security**
- Fixed missing auth on tenants POST (anonymous access)
- Fixed missing access control on tenants GET/PUT/DELETE `[id]`
- Fixed missing self-or-admin check on users `[id]` routes
- Fixed missing tenant scoping on schedule POST/PUT/DELETE
- Fixed missing tenant scoping on calendar GET
- `authenticate()` now rejects deleted users with valid JWTs
- `parseQuery()` handles NaN page/limit params
- `use-api.ts`: 401 auto-redirect to login, safe JSON parsing
- AI panel: stale closure fix, error feedback on failure
- SSE: poll order fix (asc not desc), error logging

**Audit Round 9 (Session 6)**
- Decimal `Number()` wrapping in 9 more routes (ai-services/costs, affiliate/analytics, affiliate/clicks, content versions/approve/reject, analytics/export, system/metrics, assistant/actions)
- Fixed 5 settings routes leaking `err.message` to clients

### To Do
- E2E test suite (Playwright)
- Complete PM2 production config
- Platform API credential setup + real adapter testing
- Analytics CSV/PDF export implementation
- Storyboard AI integration (currently hardcoded)
- Shot generation completion polling/webhook

## [0.1.0] — 2026-03-18

Initial development release. All 9 PRD epics complete, 93 tests passing, 14 packages building.

### Added

**Foundation Packages**
- `@airevstream/shared` — config, errors, logger, types (full schema-aligned), utilities
- `@airevstream/db` — Prisma schema (32 models), relations, JSON columns, full-text search GIN indexes
- `@airevstream/crypto` — AES-256-GCM encrypt/decrypt for stored secrets
- `@airevstream/storage` — MinIO/S3 client with full CRUD operations
- `@airevstream/queue` — BullMQ queue definitions with typed jobs
- `@airevstream/ai-client` — Multi-provider AI Service Registry with Ollama, OpenAI-compatible, and HTTP providers; fallback chains, circuit breaker, health monitoring, cost tracking

**Integration Packages**
- `@airevstream/audio-engine` — TTS client supporting Piper (local) and ElevenLabs (cloud) with placeholder fallback
- `@airevstream/browser-automation` — Stealth Playwright contexts, Bezier mouse paths, Gaussian delays, QWERTY typo simulation, proxy rotation with circuit breaker, session persistence, 4 platform workflows (YouTube/TikTok/Instagram/Facebook), HITL API

**Core Services**
- `workflow-engine` (port 3001) — REST API with JWT auth, CRUD for content/accounts/channels/workflows
- `ai-assistant` (port 3003) — AI chat with context-aware responses, content generation endpoints
- `production-pipeline` (port 3002) — ComfyUI image generation, Remotion video rendering, audio/asset management

**Workers**
- Content worker — AI text generation with approve/reject/regenerate flow
- Account worker — Platform account creation, sync, health check with browser automation fallback
- Posting worker — Multi-platform publishing with rate limiting and scheduling
- Research worker — Trend analysis and topic generation via AI
- Maintenance worker — Cleanup and backup routines
- Production worker — Image (ComfyUI), video (Remotion CLI), audio (TTS), storyboard generation

**Web Dashboard (Next.js 14)**
- Auth pages (login/register with JWT + scrypt hashing)
- Dashboard home with KPI cards, approval queue, timeline, workflows, system health, activity feed
- Accounts management with full CRUD, bulk import (JSON + CSV), detail panel with tabs
- Calendar with week/day/month views, drag scheduling, filter by channel/platform/status
- Content creation wizard (6-step: Channel → Concept → Script → Storyboard → Generate → Review)
- Content library with grid/list views, multi-filter, sort, type-coded thumbnails, quality scores
- Analytics with Revenue/Engagement/Content/Costs/Audience tabs (Recharts)
- System health monitor with resource usage, services grid, active workflows, alerts, error log
- Settings with General/AI Services/Notifications/Security/Appearance tabs (DB-backed)
- Affiliate manager with products CRUD, channel pools, links, performance matrix
- Notification center with bell badge, dropdown panel, mark all read, sonner toast integration
- AI assistant collapsible chat panel (380px, context-aware)
- Real-time updates via SSE with auto-reconnect and exponential backoff
- 99 Next.js API route files under `/api/v1/`

**Platform Adapters**
- YouTube Data API v3 (resumable upload)
- TikTok Content Posting API (PULL_FROM_URL)
- Instagram Graph API (container publish)
- Facebook Graph API

**Content Production**
- ComfyUI workflow templates: thumbnail, scenery, avatar, storyboard-frame (SDXL)
- Remotion compositions: ShortFormVideo (9:16), LongFormVideo (16:9), ThumbnailRenderer (still)
- H.I.C.C. beat timing system for video pacing
- Quality scoring algorithm (5 criteria: hook strength, length, CTA, readability, engagement)
- Content variants with A/B testing via version chains

**Intelligence Layer**
- Knowledge base CRUD with keyword search
- 4-tier action executor (11 actions with audit logging and rollback)
- Context-aware AI chat (injects alerts, workflows, content stats, KB entries)

**Monetization**
- Per-channel storefronts with product management
- Public affiliate link redirect with click tracking and IP hashing
- Revenue analytics with time series and groupBy aggregation
- Prompt template library with CRUD, scoring, and usage tracking
- Cost budget management (daily/weekly/monthly with threshold alerts)

**SaaS / Multi-Tenancy**
- Tenant model with plan-based limits
- User roles (admin/operator/viewer) with invite workflow
- API key management (ars_ prefix, SHA-256 hashed, scope-based)
- Subscription CRUD with period tracking and usage metering

**Infrastructure**
- Docker Compose for PostgreSQL 16, Redis 7, MinIO
- PM2 ecosystem config (partial)
- CSS variable design system with RGB channel format for Tailwind opacity
- Database seed script with admin user, AI services, sample data

### Fixed

**Audit Round 1 (5.8)**
- AI chat, script generation, and shot generation wired to real AI service (were stubs)
- Security hardening across API routes
- Settings persisted to DB via SystemSetting model (were in-memory)
- Tenant scoping added to content queries
- SSE endpoint connected to real DB-polled events
- Error retry logic in content generation

**Audit Round 2 (5.11)**
- Analytics overview API route returning correct shape
- Settings form fields mapped to correct DB columns
- AI service DELETE endpoint added
- Platform filter working in content library
- Metrics shape aligned between API and frontend
- Workflows and approvals pages rendering correctly
- ApprovedBy audit trail on content approval
- Content detail page tenant-scoped
- Health check ping endpoints for all services
- Security settings API route added

**Audit Round 3 (5.12)**
- ~30 frontend↔API data shape mismatches resolved
- Content POST handler accepting correct body shape
- Calendar API using start/end date params correctly
- Dashboard activity, revenue, health, workflow widgets aligned with API response shapes
- Status bar auth state synced
- Notification center handling paginated response format
- System page severity/status/jobType fields mapped
- Analytics mock data removed (real queries used)
- Create page shot error handling improved

**Audit Round 4 (5.13)**
- Settings: `chain.chain` → `services` nested access crash
- Settings: `serviceType` field used instead of `type` for AI services
- Settings: notifications `type` vs `channel` field name mismatch
- Settings: API keys using `keyPrefix` instead of full key display
- Settings: removed invalid `embedding` service type option
- Dashboard: approval queue using `channel.name` instead of flat `channelName`
- Dashboard: `qualityScore` Decimal→Number conversion
- Dashboard: content status filter using `pending_approval`
- System: workflow status filter removed so errors are visible
- System: nullable `AlertItem.message` handled
- Create: storyboard `durationSeconds` → `duration` field name
- Create: shot async job status handling
- Create: `generate-script` using `affiliateProductId` param
- Analytics: `revenueOverTime` reading from DB instead of mock
- Analytics: `costByModel` aggregation query
- Analytics: missing data fields returning empty arrays for graceful degradation
