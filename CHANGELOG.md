# Changelog

All notable changes to AiRevStream MPCAS are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `.claude/rules/` — 6 modular rules files codifying development patterns
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

### Fixed

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
