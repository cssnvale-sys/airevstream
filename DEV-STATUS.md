# Development Status

## Current Phase: PRD Epics — Working through Epics 1-9

### Phase 1: Foundation (Shared Packages) — COMPLETE
| Step | Package | Status | Notes |
|------|---------|--------|-------|
| 1.1 | @airevstream/shared | Done | Config, errors, logger, types (full schema-aligned), utils. 8 tests |
| 1.2 | @airevstream/db | Done | Prisma schema (32 models), all relations, JSON columns, full-text search GIN indexes. 4 tests |
| 1.3 | @airevstream/crypto | Done | AES-256-GCM encrypt/decrypt. 10 tests |
| 1.4 | @airevstream/storage | Done | MinIO client with full CRUD. 3 tests |
| 1.5 | @airevstream/queue | Done | BullMQ queues with typed jobs. 5 tests |
| 1.6 | @airevstream/ai-client | Done | Multi-provider Service Registry + Ollama/OpenAI-compat/HTTP providers. 14 tests |

### Phase 2: Core Services — COMPLETE
| Step | Service | Status | Notes |
|------|---------|--------|-------|
| 2.1 | workflow-engine | Done | REST API: auth, content, accounts, channels, workflows. 8 tests |
| 2.2 | ai-assistant | Done | Chat + content generation endpoints. 5 tests |
| 2.3 | production-pipeline | Done | Image, video, audio, asset management. 5 tests |

### Phase 3: Workers — COMPLETE
| Step | Worker | Status | Notes |
|------|--------|--------|-------|
| 3.1 | content.worker | Done | AI content generation + approve/reject/regenerate |
| 3.2 | account.worker | Done | Create + sync + health check + warm with browser automation (graceful fallback) |
| 3.3 | posting.worker | Done | Publish + schedule with rate limiting |
| 3.4 | research.worker | Done | Trend analysis + topic generation via AI |
| 3.5 | maintenance.worker | Done | Cleanup + backup. All 5 tested |

### Phase 4: Web Dashboard — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 4.1 | Auth pages | Done | Login + register with JWT (scrypt hashing) |
| 4.2 | Dashboard (Home) | Done | KPI cards, approval queue, timeline, workflows, system health, platform coverage widget, activity feed |
| 4.3 | Accounts | Done | Full CRUD, bulk import (JSON + CSV), detail panel with tabs, social accounts, channel linking |
| 4.4 | Calendar | Done | Week/Day/Month grid, drag scheduling, filter by channel/platform/status |
| 4.5 | Create (Wizard) | Done | 6-step wizard: Channel → Concept → Script (H.I.C.C.) → Storyboard → Generate → Review |
| 4.6 | Content Library | Done | Grid/List views, multi-filter, sort, type-coded thumbnails, quality scores |
| 4.7 | Analytics | Done | Revenue/Engagement/Content/Costs/Audience tabs with Recharts, KPI cards, export |
| 4.8 | System Health | Done | Resource usage, services grid, active workflows, alerts, error log |
| 4.9 | Settings | Done | General/AI Services/Notifications/Security/Appearance tabs |
| 4.10 | Affiliate Manager | Done | Products CRUD, channel pools, links, performance matrix |
| 4.11 | API Routes | Done | 99 Next.js API route files under /api/v1/ covering all endpoint groups |
| 4.12 | Design System | Done | CSS variable tokens (dark/light), component classes, layout components |
| 4.13 | AI Assistant Panel | Done | Collapsible 380px chat panel, context-aware |
| 4.14 | Notification Center | Done | Bell icon with badge, dropdown panel, mark all read, sonner toast integration |
| 4.15 | Real-time (SSE) | Done | Server-Sent Events endpoint, useSSE/useSystemEvents hooks, typed events, auto-reconnect |

### Phase 5: Integration & Polish
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 5.1 | AI Service Registry | Done | Multi-provider with fallback chains, circuit breaker, health checks, cost tracking |
| 5.2 | ComfyUI workflows | Done | 4 SDXL workflow templates: thumbnail, scenery, avatar, storyboard-frame |
| 5.3 | Remotion compositions | Done | 3 compositions: ShortFormVideo (9:16), LongFormVideo (16:9), ThumbnailRenderer (still). H.I.C.C. beat system, Ken Burns, transitions, audio viz |
| 5.4 | Full-text search | Done | PostgreSQL GIN indexes on content, knowledge base, accounts, channels, alerts, conversations |
| 5.5 | Channel families | Done | API for family CRUD + grouping language-variant channels |
| 5.6 | Account stats | Done | Platform coverage, distribution, tier breakdown, health averages |
| 5.7 | Browser Automation | Done | @airevstream/browser-automation: stealth contexts, human behavior (Bezier/Gaussian), proxy rotation, session persistence, 4 platform workflows (YT/TT/IG/FB), HITL API |
| 5.8 | Audit fixes (round 1) | Done | AI chat/script/shot wired to real AI, security hardening, DB-backed settings, tenant scoping, real SSE, error retry |
| 5.11 | Audit fixes (round 2) | Done | Analytics overview API, settings form field mapping, AI service DELETE, platform filter fix, metrics shape fix, workflows/approvals pages, approvedBy audit trail, content [id] tenant scoping, health check pings, security settings route |
| 5.12 | Audit fixes (round 3) | Done | 30+ frontend↔API data shape fixes: content POST handler, calendar start/end params, @airevstream/ai-client dep, dashboard activity/revenue/health/workflow shapes, status bar auth, notification center paginated response, system page severity/status/jobType fields, analytics mock data removal, create page shot error handling |
| 5.13 | Audit fixes (round 4) | Done | Settings page: chain.chain→services crash fix, serviceType field, notifications type vs channel, API keys keyPrefix, removed invalid embedding type. Dashboard: approval channelName→channel.name, qualityScore Decimal type, status=pending_approval, dead code removal. System: workflows status filter removed (errors now visible), unused import, nullable AlertItem.message. Create: storyboard durationSeconds→duration, shot async status handling, generate-script affiliateProductId. Analytics: revenueOverTime from DB, costByModel aggregation, missing fields with graceful empty arrays |
| 5.14 | Audit fixes (round 5) | Done | 7 getDb()→ctx.db tenant isolation fixes (KI-009), 28 silent catch blocks→console.error (KI-010), Decimal Number() wrapping in 5 API routes + 3 frontend pages (KI-012), 3 data shape mismatches fixed |
| 5.15 | Audit fixes (round 6) | Done | 15 more silent catches, Decimal in 20+ routes (ai-services, analytics/costs, content, storyboard, affiliate, budgets, knowledge-base, prompts), ENCRYPTION_KEY guard, system health false positive |
| 5.16 | Audit fixes (round 7) | Done | Frontend↔API shape fixes: create page channel/product fields, dashboard phantom fields, settings ApiKey/AiService fields, affiliate pool DELETE handler |
| 5.17 | Audit fixes (round 8) | Done | **CRITICAL security:** tenant/user/schedule/calendar access control. Auth hardening: deleted user rejection, NaN param handling, 401 redirect, AI panel stale closure, SSE poll order |
| 5.18 | Audit fixes (round 9) | Done | Decimal in 9 more routes, 5 settings routes err.message leak prevention |
| 5.19 | UI components (session 7) | Done | ConfirmDialog, EmptyState, CopyButton, KeyboardShortcutsModal, toast wrapper |
| 5.20 | Error toasts + confirmations | Done | Toast notifications + ConfirmDialog on destructive actions across 4 pages |
| 5.21 | Empty states with CTAs | Done | Actionable empty states on library, workflows, approvals, accounts |
| 5.22 | DELETE endpoints | Done | Channel DELETE (cascade), Content DELETE (draft/archived/failed), library delete UI |
| 5.23 | Job status polling (KI-006) | Done | GET /api/v1/jobs/:id + useJobStatus hook (2s polling) |
| 5.24 | CSV export (KI-003) | Done | exportToCSV utility, analytics export per tab |
| 5.25 | Forgot password flow | Done | API routes + frontend pages for forgot/reset password |
| 5.26 | Accounts bulk actions | Done | POST /api/v1/accounts/bulk-delete + bulk toolbar (delete/export/clear) |
| 5.27 | Calendar server filters (KI-004) | Done | channelId, platform, status query params passed to API |
| 5.28 | Keyboard shortcuts | Done | Global shortcuts (?/N/L/A), modal, sidebar help button |
| 5.29 | Copy-to-clipboard | Done | CopyButton on affiliate short URLs, API key prefixes, job IDs |
| 5.30 | Error toasts (round 2) | Done | Dashboard handleApproval + System 3 silent catches → toast feedback |
| 5.31 | Workflows improvements | Done | Pagination (20/page), job type filter, retry failed, refresh |
| 5.32 | Approvals improvements | Done | Bulk approve/reject, select-all, pagination, content type filter |
| 5.33 | Accessibility quick wins | Done | aria-current, aria-labels, role=grid on sidebar/modals/calendar/accounts |
| 5.34 | Analytics error state | Done | Error display card when analytics API fails |
| 5.35 | Settings dirty state | Done | useUnsavedChanges hook + dirty tracking on general tab |
| 5.36 | Search debounce | Done | useDebounce hook (300ms) on library + accounts search |
| 5.37 | Analytics tenant scoping | Done | **CRITICAL:** Tenant scoping on all 7 analytics routes (KI-016) |
| 5.38 | Error message leak prevention | Done | Static error strings in auth/create/affiliate pages |
| 5.39 | Memory leak fixes | Done | CopyButton timer cleanup, notification-center error logging |
| 5.40 | Silent catch fixes (round 2) | Done | console.error in create/affiliate catch blocks |
| 5.41 | Security fixes (round 3) | Done | err:any leak in health-check, NODE_ENV guard on reset token log |
| 5.42 | Page metadata (SEO) | Done | title.template + 11 layout.tsx files with page-specific titles |
| 5.43 | Form validation | Done | Password minLength, submit disabled, topic validation, error leak fixes |
| 5.44 | Error boundaries | Done | error.tsx for global app + all 11 page segments |
| 5.45 | AI service health check | Done | "Test All" button on settings AI services tab |
| 5.46 | Auth middleware | Done | Server-side route protection via Next.js middleware, session indicator cookie, redirect after login |
| 5.47 | Custom 404 + loading skeletons | Done | Branded not-found.tsx, loading.tsx for all 11 page segments |
| 5.48 | NaN guards | Done | parseInt/parseFloat NaN fallbacks in analytics, metrics, usage, affiliate routes |
| 5.49 | Accessibility round 2 | Done | aria-label on shortcuts button, NaN guard on qualityScore, descriptive alt text on shots |
| 5.50 | Approvals tenant scoping | Done | **CRITICAL:** Tenant scoping on approvals GET + POST, err:any fix |
| 5.51 | Auth + data quality | Done | JWT expiry check in isAuthenticated(), healthScore Decimal, use-api error fallback |
| 5.52 | Tenant scoping round 2 | Done | **CRITICAL:** accounts/[id], channels/[id] detail routes tenant-scoped |
| 5.53 | Tenant scoping round 3 | Done | system/workflows, activity, affiliate/revenue, affiliate/clicks tenant-scoped |
| 5.54 | Tenant scoping gaps documented | Done | KI-020: 7 models need tenantId schema migration |
| 5.55 | Tenant scoping round 4 | Done | **CRITICAL:** channels/families, accounts/stats, bulk-import, subscriptions auth |
| 5.56 | SSE tenant scoping | Done | Workflow/content pollers scoped by tenant channels |
| 5.57 | err:any cleanup | Done | Removed all 11 remaining err:any types across API routes |
| 5.58 | Rate limiting | Done | In-memory sliding window rate limiter on 4 auth routes (login, register, forgot-password, reset-password) |
| 5.59 | Zod input validation | Done | Zod schemas on 8 POST/PUT routes (settings, api-keys, ai-services, affiliate/products, channels) |
| 5.60 | Security headers | Done | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| 5.61 | Image optimization | Done | next/image on create page storyboard shots |
| 5.62 | Password change security | Done | Rate limiting + fresh JWT on change-password; invite rate limiting |
| 5.63 | Zod validation (PUT routes) | Done | content/[id], channels/[id], accounts/[id], ai-services/[id] PUT handlers |
| 5.64 | Password visibility toggle | Done | Eye/EyeOff toggle on login + register pages |
| 5.65 | Sidebar state persistence | Done | Collapsed state saved to localStorage |
| 5.66 | Create wizard progress bar | Done | "Step X of 6" text + animated percentage bar |
| 5.67 | System refresh button | Done | Manual re-fetch all health data with toast feedback |
| 5.68 | Workflows tenant scoping | Done | WorkflowJob list scoped via tenant channel/account IDs |
| 5.69 | Content approve tenant scoping | Done | findFirst with tenant chain instead of findUnique |
| 5.70 | Validation improvements | Done | Budget max cap, knowledge-base domain enum, metadata cast |
| 5.71 | AI services scope docs | Done | Documented global scope as intentional for self-hosted |
| 5.72 | Accounts _count cleanup | Done | Proper destructuring removes _count from JSON response |
| 5.73 | Zod validation (content gen) | Done | 5 content generation/reject routes with full schemas |
| 5.74 | Zod validation (accounts/affiliate) | Done | 5 accounts/affiliate/assistant routes with schemas |
| 5.75 | Content reject tenant scoping | Done | findFirst with tenant chain + Zod schema |
| 5.76 | Channel sub-routes tenant scoping | Done | cinema-bible, affiliate-pool, avatars findFirst |
| 5.77 | Content sub-routes tenant scoping | Done | quality-score, storyboard, variants, regenerate |
| 5.78 | Approvals bulk tenant scoping | Done | Zod schema + tenant channel filtering |
| 5.79 | Bulk import Zod validation | Done | Email, password, tier enum for JSON path |
| 5.80 | Tenants _count cleanup | Done | Proper destructuring in list and detail routes |
| 5.81 | Channels POST tenant scoping | Done | socialAccount findFirst with tenant chain |
| 5.82 | Content generate tenant scoping | Done | channel findFirst with tenant chain |
| 5.83 | Schedule consolidated tenant check | Done | Merged redundant findUnique + tenant check into findFirst |
| 5.84 | Jobs tenant verification | Done | Channel/account ownership check after findUnique |
| 5.85 | Socials tenant scoping | Done | emailAccount findFirst with tenantId in GET+POST |
| 5.86 | Assistant actions tenant scoping | Done | **CRITICAL:** 5 executors scoped via findFirst |
| 5.87 | Schedule POST Zod validation | Done | Replaced manual checks with uuid, date, platform enum |
| 5.88 | Storefronts tenant scoping | Done | **CRITICAL:** Channel ownership verified on GET+POST |
| 5.89 | Create page toasts | Done | Toast notifications on all mutation outcomes |
| 5.90 | Validation hardening | Done | NaN guard on analytics days, silent JSON catch fix |
| 5.91 | GET query param validation | Done | Enum allowlists on 11 GET API routes |
| 5.92 | Accessibility improvements | Done | aria-labels on icon buttons, search, copy button |
| 5.93 | Unused imports cleanup | Done | Removed 3 unused `success` imports |
| 5.94 | SWR revalidation fix | Done | Added mutateWorkflows() after job retry on system page |
| 5.95 | Sort/date/CSP security | Done | Sort allowlists (6 routes), date validation (5 routes), CSP header, order param |
| 5.96 | Rate limiting (operations) | Done | contentGeneration (20/hr), bulkOperation (5/hr), analyticsExport (10/hr) on 4 routes |
| 5.97 | Zod validation (auth+more) | Done | Schemas on accounts POST, variants POST, login, register, forgot-password, reset-password |
| 5.98 | Accounts unsafe cast fix | Done | Removed non-existent .channels access, use socialAccountsCount |
| 5.99 | Prisma transactions | Done | Multi-step writes wrapped in $transaction() on 5 routes |
| 5.100 | Code quality fixes | Done | CSV bounds, duration validation, parseInt radix, hash split defense |
| 5.101 | Resource cleanup | Done | SSE error logging, health check timeout cleanup, rate limiter bounds warning |
| 5.102 | API helper JSON parse | Done | Handle non-JSON responses in apiPost/apiPut/apiDelete |
| 5.103 | Service/worker hardening | Done | main() .catch(), safe error messages, JSON.parse guards, registry logging |
| 5.104 | Package-level safety | Done | Crypto decrypt validation, JSON.parse guard in generateJSON, empty messages check |
| 5.105 | LLM abort signals | Done | 120s timeout on generate, 300s on stream — prevents server hangs |
| 5.106 | Storefront tenant verification | Done | **SECURITY:** Channel ownership verification on GET/PATCH/DELETE |
| 5.107 | Date isNaN guards | Done | 5 analytics routes: invalid dates silently ignored |
| 5.108 | Unbounded query caps | Done | Analytics overview: revenueClicks + qualityScores capped at 5000 |
| 5.109 | Frontend error states | Done | Error banners on dashboard, workflows, system, calendar, settings |
| 5.110 | AI provider type safety | Done | Replaced providerType: any with proper AiServiceProvider type |
| 5.111 | Misc cleanup | Done | Approvals catch logging, library duplicate import |
| 5.112 | HITL/retry tenant scoping | Done | Dual-path scoping via content or emailAccount chain |
| 5.113 | Storefront products tenant scoping | Done | Two-step channel ownership verification |
| 5.114 | Zod validation (5 routes) | Done | cinema-bible, avatars, families, affiliate-pool, storyboard |
| 5.115 | System metrics type safety | Done | metricType allowlist, removed as-any casts |
| 5.116 | Production worker getDb | Done | Replaced new PrismaClient() with getDb() singleton |
| 5.117 | Browser context cleanup | Done | try-finally on all 4 account worker handlers |
| 5.118 | Service error message leaks | Done | 3 generate routes + 4 service parseInt NaN |
| 5.119 | catch err:any elimination | Done | All 6 remaining files fixed (zero left in codebase) |
| 5.120 | Production JWT guard | Done | All 3 services throw on missing JWT_SECRET in prod |
| 5.121 | Prisma indexes | Done | 4 new indexes on storyboards, conversations, audit log, cinema bibles |
| 5.122 | Lazy JWT_SECRET init | Done | api-server.ts getJwtSecret() prevents build-time crash |
| 5.123 | Assistant tenant scoping | Done | analytics/content queries + content queue stats scoped to tenant |
| 5.124 | Assistant error message leak | Done | Static error message in action executor failure |
| 5.125 | Zod validation (last 4) | Done | schedule PUT, change-password, snooze, approvals action |
| 5.126 | JWT_SECRET centralization | Done | Exported getJwtSecret(), removed 5 duplicate declarations |
| 5.127 | Password hashing centralization | Done | Shared password.ts, removed 5 duplicate hashPassword/verifyPassword |
| 5.128 | String length limits | Done | .max() constraints on 9 unbounded Zod string fields |
| 5.129 | Rate limiting (write endpoints) | Done | standardWrite (60/min), adminWrite (30/min) on 6 high-risk routes |
| 5.130 | API key authentication (KI-022) | Done | authenticateApiKey(), authenticateAny(), scope enforcement, per-key RPM |
| 5.9 | E2E testing | Not Started | Requires Playwright browser install |
| 5.10 | Production config | Partial | PM2 ecosystem.config.js exists |

### PRD Epic Progress
| Epic | Title | Status | Notes |
|------|-------|--------|-------|
| 1 | Foundation | Done | DB, auth, accounts, social accounts, channel identity, bulk import, full-text search |
| 2 | Account Operations | Done | Browser automation pkg (stealth, human behavior, proxy, sessions), 4 platform workflows (YouTube/TikTok/Instagram/Facebook), account worker integration, HITL API |
| 3 | Content Generation | Done | Text gen (H.I.C.C. + registry), ComfyUI client + template renderer, production worker (image/video/audio/storyboard), quality scoring (5-criteria), content variants/A/B testing |
| 4 | Video Production | Done | Remotion CLI render via production worker, TTS via @airevstream/audio-engine (Piper/ElevenLabs), storyboard generation (H.I.C.C. parser), ComfyUI image pipeline |
| 5 | Distribution | Done | Platform posting adapters (YouTube Data API v3, TikTok Content Posting API, Instagram Graph API, Facebook Graph API), scheduling engine, credential decryption, presigned URL resolution |
| 6 | Intelligence Layer | Done | Knowledge base CRUD + search, action executor (4-tier safety with 11 actions), context-aware chat (alerts/workflows/content stats/KB injection) |
| 7 | Affiliate & Monetization | Done | Storefront CRUD + products, link redirect with click tracking, revenue analytics (time series, groupBy), channel pools |
| 8 | Optimization & Scale | Done | Prompt template library (CRUD + scoring), cost budget management (daily/weekly/monthly + threshold alerts), knowledge base population worker |
| 9 | SaaS Preparation | Done | Multi-tenant (Tenant model + RBAC), user roles (admin/operator/viewer) + invites, API key management, subscription CRUD, usage metering |

## Test Summary
- **Total tests**: 93 (all passing across 27 test tasks)
- Packages: 64 tests (shared: 20, db: 4, crypto: 10, storage: 3, queue: 5, ai-client: 14, audio-engine: 5, browser-automation: 3)
- Services: 18 tests (workflow-engine: 8, ai-assistant: 5, production-pipeline: 5)
- Workers: 5 tests
- Web: 61 tests (lib: 6, password: 11, rate-limit: 14, api-server: 30) + Next.js build (106 API routes, 14 dashboard pages)
- **14 packages all building successfully** (including audio-engine, browser-automation, Remotion)

## Architecture Highlights
- **Prisma Schema**: 33 models (+ SystemSetting) with full-text search GIN indexes on key tables
- **AI Service Registry**: Provider abstraction (Ollama, OpenAI-compat, HTTP), fallback chain orchestration, circuit breaker pattern, health monitoring, cost estimation, usage logging
- **Next.js API Routes**: 106 server-side route handlers with JWT auth (jose + scrypt), Prisma queries, pagination, validation
- **Dashboard**: 16 views (+ workflows, approvals, affiliate, forgot/reset password) + notification center + SSE real-time updates
- **Browser Automation**: Stealth Playwright contexts, Bezier mouse paths, Gaussian delays, QWERTY typos, proxy rotation with circuit breaker, session persistence, 4 platform workflows (YouTube/TikTok/Instagram/Facebook)
- **Remotion**: 3 compositions (short 9:16, long 16:9, thumbnail still) with H.I.C.C. beat timing
- **ComfyUI**: 4 SDXL workflow templates with {{placeholder}} syntax + client API wrapper + template renderer
- **Audio Engine**: @airevstream/audio-engine with TTSClient supporting Piper (local) and ElevenLabs (cloud) providers, placeholder fallback
- **Production Worker**: Image generation (ComfyUI), video render (Remotion CLI), audio generation (TTS), storyboard generation (H.I.C.C. section parser)
- **Platform Posting**: 4 platform adapters (YouTube resumable upload, TikTok PULL_FROM_URL, Instagram container publish, Facebook Graph API), credential decryption, presigned URL resolution
- **Quality Scoring**: 5-criteria algorithm (hook strength, length, CTA, readability, engagement) with 0-10 scale and breakdown
- **Content Variants**: A/B testing via version chains (parentId → variants), clone + modify API
- **Intelligence Layer**: Knowledge base CRUD + keyword search, 4-tier action executor (11 actions with audit logging, rollback), context-aware chat (injects alerts, workflows, content queue, relevant KB entries)
- **Storefronts**: Per-channel storefronts with product management, public link redirect with click tracking + IP hashing, revenue analytics with time series
- **Prompt Library**: Template CRUD with category/platform/tag filtering, usage tracking, running average quality scoring
- **Cost Management**: Budget CRUD (daily/weekly/monthly), spend threshold alerts, auto-check against AiServiceUsage aggregates
- **Multi-Tenancy**: Tenant model with plan-based limits, User roles (admin/operator/viewer), invite workflow, tenant-scoped queries (accounts, channels, content, usage)
- **API Keys**: Secure key generation (ars_ prefix), SHA-256 hashed storage, scope-based access control, rate limiting
- **Subscriptions**: Plan management with period tracking, usage metering (accounts/channels/content/API calls/storage)
- **Database Seed**: Full seed script with admin user, AI services, sample content, channels, accounts
- **Real-time**: SSE endpoint with DB-polled events (alerts, workflow-updates, content-status, system-metrics), auto-reconnect with exponential backoff
- **Security**: AI service API keys encrypted (AES-256-GCM), invite flow hides temp password, API keys SHA-256 hashed with revocation support, admin role checks on all AI service management routes, IP format validation on rate limiter, 30s fetch timeouts on frontend
- **API Key Access**: 13 read-only GET endpoints accept both JWT and API key via authenticateAny() (analytics, content, channels, system, calendar, jobs)
- **Settings**: DB-backed via SystemSetting model (general, notifications, appearance) — persists across restarts
