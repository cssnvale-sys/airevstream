# Development Status

## Current Phase: PRD Epics — Working through Epics 1-9

### Phase 1: Foundation (Shared Packages) — COMPLETE
| Step | Package | Status | Notes |
|------|---------|--------|-------|
| 1.1 | @airevstream/shared | Done | Config, errors, logger, types (full schema-aligned), utils. 8 tests |
| 1.2 | @airevstream/db | Done | Prisma schema (36 models), all relations, JSON columns, full-text search GIN indexes. 4 tests |
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
| 3.2 | account.worker | Done | Create + sync + health check + warm + 5 seasoning handlers (enroll, signup, warm, check-due, graduate) |
| 3.3 | posting.worker | Done | Publish + schedule with rate limiting |
| 3.4 | research.worker | Done | Trend analysis + topic generation via AI |
| 3.5 | maintenance.worker | Done | Cleanup + backup. All 5 tested |

### Phase 4: Web Dashboard — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 4.1 | Auth pages | Done | Login + register with JWT (scrypt hashing) |
| 4.2 | Dashboard (Home) | Done | KPI cards, approval queue, timeline, workflows, system health, platform coverage widget, activity feed |
| 4.3 | Accounts | Done | Full CRUD, bulk import (JSON + CSV), detail panel with tabs, social accounts, channel linking |
| 4.4 | Calendar | Done | Day/Week/Month views, HTML5 drag-and-drop rescheduling, filter by channel/platform/status |
| 4.5 | Create (Wizard) | Done | 6-step wizard: Channel → Concept → Script (H.I.C.C.) → Storyboard → Generate → Review |
| 4.6 | Content Library | Done | Grid/List views, multi-filter, sort, type-coded thumbnails, quality scores |
| 4.7 | Analytics | Done | Revenue/Engagement/Content/Costs/Audience tabs with Recharts, KPI cards, export |
| 4.8 | System Health | Done | Resource usage, services grid, active workflows, alerts, error log |
| 4.9 | Settings | Done | General/AI Services/Notifications/Security/Appearance/Proxies/Data tabs |
| 4.10 | Affiliate Manager | Done | Products CRUD, channel pools, links, performance matrix |
| 4.11 | API Routes | Done | ~130 Next.js API route files under /api/v1/ covering all endpoint groups |
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
| 5.x | Session 7 improvements (155 batches) | Done | UI components, error handling, delete endpoints, job polling, CSV export, forgot-password, bulk actions, calendar filters, keyboard shortcuts, copy buttons, accessibility, search debounce, page metadata, error boundaries, loading skeletons, auth middleware, 404 page, password toggle, sidebar persistence, progress bar, system refresh, type-safe hooks, UUID validation, 222 tests, API key auth, Prisma indexes, graceful shutdown, PM2 hardening, security hardening (tenant scoping, SSRF, open redirect, rate limiter, N+1 queries, access control) |
| 5.21 | Security hardening — Session 17 | Done | 72 viewer checks (0 gaps), 33 rate limits (0 gaps), 2 tenant scoping fixes, JWT revocation, Fastify CORS + rate-limit, posting worker retry cleanup, audit extractHandlers fix |
| 5.22 | Infra & config fixes — Session 18 | Done | Deployed pending migration (passwordChangedAt), fixed COMFYUI env var mismatch, removed deprecated docker-compose version, added missing env vars |
| 5.19 | Deep audit — Session 9 (20 rounds) | Done | 53 viewer role checks, 3 TOCTOU fixes (interactive transactions), N+1 budgets/check, 3 tenant scoping gaps, 5 settings GET try/catch, DB error logging in authenticate(), service auth logging, ComfyUI URL leak, rate limiting on 5 endpoints, pagination limits, 3 frontend silent catches |
| 5.20 | Verified audit — Session 10 (10 rounds) | Done | Runtime-verified: .next cache fix, all 17 pages + 21 API routes verified at runtime, 3 content lifecycle bugs fixed (status enum, reject validation, regenerate Decimal), 8 packages barrel exports verified, 0 data shape mismatches, 0 error handling gaps |
| 5.9 | E2E testing | Done | Playwright E2E suite: 30 spec files, 181 tests, all 17 pages, **100% pass rate** (Sessions 11+16) |
| 5.10 | Production config | Done | PM2, Dockerfiles, GitHub Actions CI, Makefile, .env.production.example |

### Phase 6: Feature Build (Session 14) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 6.1 | Presigned URL route | Done | `/api/v1/media/[...path]` with auth, rate limit, bucket validation |
| 6.2 | Scheduled post trigger | Done | `posting:check-scheduled` repeatable job every 60s |
| 6.3 | Worker hardening | Done | try/catch in content, account (honest fail), maintenance, production |
| 6.4 | Content detail page | Done | `/content/[id]` with metadata, script, shots, actions |
| 6.5 | Media preview | Done | `MediaPreview` + `usePresignedUrl` (50-min cache) |
| 6.6 | Quality breakdown | Done | Overall score + 5 breakdown bars |
| 6.7 | Shot gallery | Done | Expandable cards with script, visual, camera motion |
| 6.8 | Breadcrumbs | Done | Auto-generated from pathname in dashboard layout |
| 6.9 | Command palette | Done | Cmd+K global search with keyboard navigation |
| 6.10 | Unified search API | Done | `/api/v1/search` across content, channels, accounts |
| 6.11 | Pagination component | Done | Reusable with page numbers, per-page selector |
| 6.12 | FlowProducer pipeline | Done | BullMQ DAG: research → generate → production |
| 6.13 | Database backup | Done | pg_dump → gzip → MinIO, 7 retention, 24h cycle |
| 6.14 | Docker health checks | Done | PostgreSQL, Redis, MinIO in docker-compose.yml |
| 6.15 | Dockerfiles | Done | Multi-stage: web, services (build arg), workers |
| 6.16 | GitHub Actions CI | Done | Build + test + audit pipeline with PG/Redis services |
| 6.17 | Makefile | Done | dev, build, test, audit, docker-build, db-migrate |
| 6.18 | Production env | Done | `.env.production.example` with all required vars |

### Phase 7: Cinema Pipeline (Session 15) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 7.1 | Extended shared types | Done | ShotSpec, CameraSpec, GenerationSpec, LoraSpec, ControlNetSpec, UpscaleSpec, RefinerSpec, AudioPlan, etc. |
| 7.2 | Cinema constants | Done | CINEMA_PRESETS (aspect ratios, lens, camera movements, color grades), QUALITY_THRESHOLDS |
| 7.3 | ComfyUI workflow composer | Done | Composable node graph builder: base + LoRA + ControlNet + refiner + upscale |
| 7.4 | Video provider abstraction | Done | ComfyUI AnimateDiff, Google Veo, OpenAI Sora — submit/poll/download |
| 7.5 | Audio mixer | Done | WAV PCM mixing, 3-layer model (BG/MG/FG), volume/fade/loop |
| 7.6 | QC scoring module | Done | 5-dimension scoring (technical, promptAdherence, consistency, composition, colorQuality) |
| 7.7 | Cinema pipeline DAG | Done | 8-step FlowProducer: research → script → storyboard → shots → QC → audio → render → review |
| 7.8 | CinemaVideo Remotion | Done | 24fps composition with CameraMotion, ColorGrade, MultiTrackAudio, SubtitleOverlay |
| 7.9 | Studio UI | Done | Shot editor, visual timeline, AI guidance, cinema bible editor |
| 7.10 | Cinema API routes | Done | POST /pipeline/cinema, CRUD /cinema-bible, GET /comfyui/models, POST /ai/guidance |
| 7.11 | Quality tier selector | Done | Quick/Standard/Cinema tiers in create wizard |
| 7.12 | Unit tests | Done | 37 tests: composer (16), QC scoring (9), mixer (7), constants (5) |

### Phase 8B: UX + Pipeline Enhancements (Session 21) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| ME-1 | Three-tier complexity toggle | Done | Simple/Advanced/Complex localStorage mode, context+hook, visibility config, 4 new Complex sections |
| ME-2 | Preset registry + resolver | Done | 15 presets (6 visual, 5 camera, 4 audio) + 3 recipes, deep-merge resolver, tabbed PresetPicker UI |
| ME-3 | Multi-aspect export | Done | ExportVariant type, 4 formats (YT/Reels/Square/ProRes), worker variant support, Studio UI |
| ME-4 | Audio ducking + loudness | Done | LUFS measurement, normalization, true peak limiter, RMS envelope ducking in mixer |
| ME-5 | Seed policy system | Done | 4 policies (free/shot-offset/scene-lock/series-lock), XOR hash, UI controls |
| ME-6 | Cost estimation + budgets | Done | Pipeline cost estimator, CRUD budget page, sidebar nav, Create wizard cost preview |

### Phase 8C: Cinema Pipeline Enhancements (Session 22) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| LE-6 | ComfyUI repair workflows | Done | 3 repair types (inpaint, face-fix, lighting-harmonize), composable node graphs |
| LE-5 | Identity drift detection | Done | Statistical fingerprinting, drift comparison, flicker detection, auto-conditioning |
| LE-1 | Specialized agent system | Done | 7 agents, 5-phase orchestrator, QC gates, retry logic |
| LE-2 | Lip-sync pipeline | Done | 15-viseme system, phoneme mapping, word timing, frame timeline |
| LE-4 | C2PA provenance + safety | Done | ProvenanceRecord, C2PAManifest, prompt safety linting, ProvenanceViewer |
| LE-3 | Viral scoring + A/B testing | Done | 6-dimension scoring, trend matching, significance calculator, ViralScorePanel |

### Phase 10: SA-1 Systematic Gap Closure (Session 24) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| SA-1.B1 | Foundation types + presets + constraints | Done | ShotSpec enrichment, 14 new presets (5 families), constraint validator, pre-gen QC, workflow registry |
| SA-1.B2 | Agent complexity + cost preview + PromptBible | Done | Mode-aware agents, cost preview API, prompt slot substitution, Cinema Bible UI enrichment |
| SA-1.B3 | Pipeline pre-flight + auto-variants + safety | Done | Pre-flight gate, safety defaults, auto-render variants |
| SA-1.B4 | ComfyUI shot classes + provenance + dialogue | Done | 4 workflow templates, provenance chain, copyright, C2PA sidecar, dialogue TTS |
| SA-1.B5 | Frontend — cards, table, cost panel | Done | StyleCardPicker, ProjectTypePicker, ShotTable, CostPreviewPanel |
| SA-1.B6 | Lip-sync + preset ranges + codec | Done | CMU phoneme mapping, getActiveRanges(), codec presets |
| SA-1.B7 | Tests + Tier 3 stubs | Done | 49 new tests, 4 stub modules |
| SA-1.B8 | Documentation + tracking files | Done | All 7 tracking files updated |

### Phase 11: AS-1 Seasoning Pipeline (Session 25) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| AS-1.B1 | Seasoning types + config | Done | EnrollmentStatus (11 states), SeasoningPhase (6 values), 4-phase schedule, platform constraints, risk thresholds |
| AS-1.B2 | Database schema + queue types | Done | SeasoningCohort + SeasoningEnrollment models, 5 job interfaces, `seasoning` queue |
| AS-1.B3 | Orchestrator + risk management | Done | State machine (determineNextAction), phase advancement, graduation, Gaussian jitter scheduling, risk assessment (5 factors) |
| AS-1.B4 | Worker extension + flow producer | Done | 5 seasoning handlers in account.worker, repeatable 15-min scanner, staggered enrollment flow |
| AS-1.B5 | API routes | Done | 6 route files: cohorts CRUD, enroll, enrollments, enrollment detail, stats |
| AS-1.B6 | Frontend dashboard | Done | Cohort list, detail page, phase pipeline viz, enrollment table, create modal, SWR hooks |
| AS-1.B7 | CAPTCHA/SMS stubs | Done | CaptchaSolver + SmsVerifier (D064 stub pattern), browser-automation exports |
| AS-1.B8 | Tests + documentation | Done | 35 new tests (24 orchestrator + 11 config), all tracking files updated |

### Phase 12: Orphan Integration (Session 26) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| OI-B1 | Navigation & discoverability | Done | Workflows sidebar + W shortcut, breadcrumb labels, command palette page links |
| OI-B2 | Worker bootstrap + repeatables | Done | Seasoning worker started, maintenance cleanup/metrics, research trends repeatables |
| OI-B3 | Account action API routes + UI | Done | 3 action routes (sync/health-check/warm), research dispatcher, action buttons in detail panel |
| OI-B4 | Content lifecycle actions + job status | Done | Publish/rescore API routes, Publish Now + Rescore buttons, useJobStatus wired in studio |
| OI-B5 | Tier-3 stub cleanup | Done | Type-only barrel exports, @internal JSDoc on stub functions |
| OI-B6 | Remaining orphan fixes | Done | Pagination component wired (accounts+library), MediaPreview in content detail, Storefronts tab in affiliate page, apiPatch helper |

### Phase 13: UI Response Shape Audit (Session 28) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| UI-1 | CostPreviewPanel response fix | Done | `res.estimate` → `res.data.estimate` |
| UI-2 | Studio AI guidance response fix | Done | `res.suggestions` → `res.data.suggestions` |
| UI-3 | Studio channelId derivation | Done | Empty string → content.channelId ?? channel.id |
| UI-4 | ExportVariants topic/contentType | Done | Added props, passes real values |
| UI-5 | ShotTable thumbnail rendering | Done | Empty div → img element |
| UI-6 | Seasoning cohort AppLayout | Done | Added missing wrapper |
| UI-7 | Calendar language filter wiring | Done | UI → API query params |
| UI-8 | Calendar content navigation | Done | Fallback to scheduledPost ID removed |

### Phase 14: Spec Gap Closure (Session 29) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| GC-B1 | Calendar Day/Month views + DnD | Done | 24h Day column, Month dot grid, HTML5 drag-and-drop reschedule |
| GC-B2 | Settings Proxies + Data tabs | Done | Proxy CRUD + test, CSV export, data retention, alert escalation |
| GC-B3 | Content repurpose + distribute | Done | Repurpose API (child content), distribute API (multi-channel), engagement API |
| GC-B4 | Fallback chain API | Done | GET/PUT for AI provider ordering in SystemSetting |
| GC-B5 | Psychology agent + post-gen QC | Done | 8th agent (AIDA), post-gen QC gate, continuity check |
| GC-B6 | Mobile responsive sidebar | Done | Hamburger menu, slide-out drawer, scroll lock, safe-area-inset |
| GC-B7 | Warming duration UI | Done | Popover with range slider (15-120 min) |
| GC-B8 | Multi-language video | Done | 19 languages, separate/multi-audio modes, create wizard, translation pipeline |

### Phase 9: UI Audit & Fixes (Session 23) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| 9.1 | PUT /storyboard-shots/[shotId] | Done | Shot property updates with tenant scoping |
| 9.2 | POST /storyboard-shots/[shotId]/generate | Done | Individual shot generation trigger |
| 9.3 | GET /content/[id]/pipeline-status | Done | 8-step pipeline progress derived from DB state |
| 9.4 | Content reject field fix | Done | `reason` → `feedback` matching API schema |
| 9.5 | Content reject dialog textarea | Done | Inline dialog with reason textarea |
| 9.6 | Schedule action handler | Done | Redirects to calendar page |
| 9.7 | Studio sort param fix | Done | Separate sort/order params matching parseQuery |

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
- **Unit tests**: 329 (all passing via Vitest — 190 shared + 134 web + 5 workers)
- **Audit tests**: 24 (9 files scanning 130+ API routes for 9 bug classes, <1s)
- **E2E tests**: 181 (30 spec files via Playwright, all 17 pages, **100% pass rate** — Session 16)
- **Total**: 534 tests
- Audit: 24 tests across 9 files — **0 known violations** for viewer checks and rate limiting (all fixed Session 17)
- E2E: 181 tests across 30 files (all 17 pages covered, 100% pass rate)
- **14 packages all building successfully** (including audio-engine, browser-automation, Remotion)
- Integration audit (Session 8): All components verified wired, 2 EmptyState gaps fixed
- Codebase audit (Session 12→17): 9 bug classes automated, known violation sets for viewer checks and rate limiting emptied to 0
- Full codebase audit (Session 19): 302 files scanned, 16 fixes applied (2 bugs, 4 silent catches, 9 type safety, 1 config), 0 silent catches remaining
- **Full-stack audit (Session 27)**: 26 issues found (3 CRITICAL, 7 HIGH, 9 MEDIUM, 7 LOW), 20 fixed, 1 accepted risk, 5 deferred. Two consecutive clean test runs achieved.
- **UI response shape audit (Session 28)**: 8 apiPost/navigation bugs found and fixed across 6 components. Root cause: apiPost returns full envelope but components read top-level props.

## Architecture Highlights
- **Prisma Schema**: 36 models with full-text search GIN indexes on key tables
- **AI Service Registry**: Provider abstraction (Ollama, OpenAI-compat, HTTP), fallback chain orchestration, circuit breaker pattern, health monitoring, cost estimation, usage logging
- **Next.js API Routes**: 124 route files with JWT auth (jose + scrypt), Prisma queries, pagination, validation
- **Dashboard**: 18 views (content detail, approvals, workflows, affiliate, forgot/reset password) + notification center + SSE real-time updates + command palette + breadcrumbs
- **Browser Automation**: Stealth Playwright contexts, Bezier mouse paths, Gaussian delays, QWERTY typos, proxy rotation with circuit breaker, session persistence, 4 platform workflows (YouTube/TikTok/Instagram/Facebook)
- **Remotion**: 4 compositions (short 9:16, long 16:9, thumbnail still, CinemaVideo 24fps) with H.I.C.C. beat timing — CinemaVideo now wired in render handler (Session 20)
- **ComfyUI**: 4 SDXL workflow templates with {{placeholder}} syntax + client API wrapper + template renderer
- **Audio Engine**: @airevstream/audio-engine with TTSClient supporting Piper (local) and ElevenLabs (cloud) providers, 3-layer mixing (BG/MG/FG) now fully wired (Session 20)
- **Production Worker**: Image generation (ComfyUI), video render (Remotion CLI with cinema tier support), audio generation (TTS), storyboard generation (H.I.C.C. section parser), 5-dimension QC scoring with per-shot retry (Session 20)
- **Platform Posting**: 4 platform adapters (YouTube resumable upload, TikTok PULL_FROM_URL, Instagram container publish, Facebook Graph API), credential decryption, presigned URL resolution
- **Quality Scoring**: Content: 5-criteria (hook, length, CTA, readability, engagement) 0-10 scale. Shot QC: 5-dimension (technical, prompt adherence, consistency, composition, color) 0-100 scale — auto-approve/review/reject thresholds (Session 20)
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
