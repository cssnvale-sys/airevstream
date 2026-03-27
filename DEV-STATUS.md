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
| 3.3 | posting.worker | Done | Publish + schedule with rate limiting + series playlist sync stub |
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
| 5.2 | ComfyUI workflows | Done | 8 SDXL workflow templates + 1 upscale (BSRGAN 2x). 4 general + 4 shot-class + 1 upscale |
| 5.3 | Remotion compositions | Done | 6 compositions: ShortFormVideo (9:16), LongFormVideo (16:9), CinemaVideo (24fps), ThumbnailRenderer (still), SquareSocial (1:1), UltrawideCinema (21:9). 11 transitions, 11 text animations |
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

### Phase 15: Tenant Isolation + Fallback Chain DnD (Session 30) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| TI-1 | Prisma migration 0004 | Done | tenantId on Alert (nullable), Conversation/KB/Prompt/Budget (required) |
| TI-2 | Alert routes tenant scoping | Done | All 6 alert routes + SSE stream scoped by tenantId |
| TI-3 | Conversation/KB/Prompt/Budget scoping | Done | All CRUD routes for 4 models scoped by ctx.tenantId! |
| TI-4 | Worker tenantId propagation | Done | account, posting, research workers resolve + pass tenantId via job data |
| TI-5 | Service tenantId resolution | Done | ai-assistant and workflow-engine resolve tenantId from authenticated user |
| TI-6 | Queue job interface updates | Done | tenantId added to job interfaces + FlowProducer pipeline params |
| TI-7 | Audit fix: system/errors + trending | Done | 2 additional routes scoped by audit catch |
| TI-8 | Fallback chain DnD editor | Done | Interactive drag-and-drop provider reordering in Settings tab, native HTML5 DnD |

### Phase 16: Simplified Cinema Wizard (Session 32) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| SW-1 | Character preset family | Done | 10th family (`character`), 5 built-in presets, CharacterPresetPicker grid |
| SW-2 | Project type expansion | Done | 2 new project presets (total 5), responsive ProjectTypePicker grid |
| SW-3 | Simple mode guardrails | Done | SIMPLE_MODE_GUARDRAILS, PIPELINE_SIMPLE_LABELS, validateSimpleModeConstraints(), agent prompt rules |
| SW-4 | Revision presets | Done | 6 RevisionPreset one-click swaps, deterministic (no LLM), PlanReviewCard component |
| SW-5 | SimpleCreateWizard | Done | 5-screen flow (Project → Style → Describe → Review → Making it), conditional in create page |
| SW-6 | Existing component updates | Done | PresetPicker character tab, PipelineProgress simplified labels, complexity-fields quality tier gating |
| SW-7 | Tests | Done | Updated preset counts, all 14 packages build, all tests pass, 24 audit tests pass |

### Phase 17: AI-Generated Presets (Session 33) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| AIP-1 | UserPreset Prisma model | Done | Migration 0005, tenant/user relations, unique (tenantId, presetId) |
| AIP-2 | AI generation shared module | Done | FAMILY_OVERRIDE_KEYS, system prompt, validateAndNormalizeAiPreset(), generatePresetId() |
| AIP-3 | CRUD API routes | Done | GET (paginated, filterable) + POST + PATCH + DELETE at /presets, /presets/[id] |
| AIP-4 | AI generate endpoint | Done | POST /presets/generate — registry-first with JSON parse + validation |
| AIP-5 | useUserPresets hook | Done | SWR + localStorage sync + optimistic save + generate helper |
| AIP-6 | CreatePresetModal | Done | AI generate → preview → edit → save flow |
| AIP-7 | PresetPicker update | Done | My Presets tab, + Create button, Custom badge, delete on user presets |
| AIP-8 | Tests | Done | 17 new unit tests, audit allowlist updated, 42 Prisma models |

### Phase 18: Full Codebase Audit — 100% Coverage (Session 34) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| FA-1 | D071 conditional tenant scoping | Done | 60+ routes: conditional `ctx.tenantId ? {...} : {}` → unconditional guard + filter |
| FA-2 | Missing tenant guards | Done | 17 routes: `ctx.tenantId!` without null check → explicit 403 guard |
| FA-3 | Silent catch blocks | Done | 15+ instances: added console.error logging |
| FA-4 | Data shape mismatches | Done | 8 fixes: fallback chain, calendar, budget, quality breakdown, preset picker |
| FA-5 | Error handling | Done | 10+ fixes: error boundaries, notification-center, auth plugin |
| FA-6 | Prisma improvements | Done | Missing relations, Decimal wrapping, qualityScore null check |
| FA-7 | Backend packages | Done | 17 fixes: ComfyUI regex, VAE, crypto, seasoning, queue, prompts |
| FA-8 | Services | Done | 12 fixes: register, chat/asset scoping, auth hooks, error leaks |
| FA-9 | Workers | Done | 5 fixes: trends tenantId, stale types, double download, dead code |
| FA-10 | Remotion | Done | 6 fixes: transitions, off-by-one, dead code |
| FA-11 | UI/Layout | Done | 40+ fixes: error boundaries, companion files, headers, pagination, AI panel |
| FA-12 | Debug cleanup | Done | console.log removal from distribute/repurpose routes |

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

### Phase 19: Cinema Pipeline Upgrade — Asset Factory + Film Assembly Engine (Session 35) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| CP-1 | Workflow registry quality tiers | Done | Extended WorkflowMetadata with qualityTiers, tierDefaults, continuityTier, outputFormat, estimatedTimeSec, requiredFields, supportsFrameAnchoring, tags |
| CP-2 | Composition registry | Done | 4 Remotion compositions (ShortFormVideo, LongFormVideo, CinemaVideo, ThumbnailRenderer) with lookup + validation |
| CP-3 | Assembly manifest types | Done | AssemblyManifest + AssembledShot types, persisted agent outputs, beat timings, subtitles, output spec |
| CP-4 | Assembly resolver | Done | resolveForRemotion(), 7 conversion functions, draft manifest, keyframeUrls parser |
| CP-5 | Agent output persistence | Done | agentOutputs on AgentPipelineState, persisted in orchestrator execute() |
| CP-6 | Worker integration | Done | Manifest-aware render, registry-based workflow/composition selection, QC score persistence |
| CP-7 | Preview pipeline DAG | Done | startPreviewPipeline() — simplified 3-step DAG at draft quality |
| CP-8 | Tests | Done | 63 new tests (22 workflow + 16 composition + 25 resolver), all passing |

### Phase 21: Channel-Topic Viral Content Suggestion System (Session 37) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| CT-1 | SuggestionLog Prisma model | Done | `SuggestionLog` (46th model), migration `0007_add_suggestion_logs` |
| CT-2 | Channel-aware orchestrator | Done | `ChannelContext` interface, `suggestPresetVariantForChannel()`, `computeSuggestionBoost()`, 3 boost maps |
| CT-3 | Suggestion API routes | Done | 5 new routes (suggestions CRUD+stats, channel viral-stats, channel topic-suggestions), channel-aware viral-suggestions |
| CT-4 | Experiment feedback loop | Done | `SuggestionLog.viralScoreAfter` updated on experiment winner declaration |
| CT-5 | Channels list page | Done | `/channels` with stat cards + table |
| CT-6 | Channel detail page | Done | 3 tabs (profile/content/viral), `NicheTagInput`, `ChannelViralDashboard` |
| CT-7 | ViralScorePanel accept/reject | Done | Accept/reject buttons + suggestion logging |
| CT-8 | Analytics suggestion performance | Done | Suggestion performance section in experiments tab |
| CT-9 | Channels sidebar nav | Done | Sidebar entry with `c` keyboard shortcut (16 nav items total) |
| CT-10 | Tests | Done | 16 new experiment-orchestrator tests (38 total) |

### Phase 22: Full Codebase Audit — 8-Wave (Session 38) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| FA2-1 | Double /api/v1 prefix | Done | 8 experiment mutation hooks causing 404s on all experiment actions (CRITICAL) |
| FA2-2 | SWR data shape mismatch | Done | Experiments list showed empty due to response shape mismatch |
| FA2-3 | Tenant scoping violations | Done | 12 content CRUD + budget routes missing unconditional guard (D076/D088) |
| FA2-4 | Decimal Number() wrapping | Done | 9 instances in experiment variants + workflow-engine content routes |
| FA2-5 | Silent catch blocks | Done | 19 frontend pages + 3 production worker catches |
| FA2-6 | Zod tone max length | Done | 2 schemas: maxLength 500→50 to match VarChar(50) |
| FA2-7 | Prompt route cleanup | Done | 5 redundant non-null assertions removed |
| FA2-8 | Queue barrel exports | Done | 2 missing exports added |
| FA2-9 | Frontend cleanup | Done | 1 dead import, 1 wrong toast import, 1 logger upgrade |

### Phase 20: Viral Video Discovery & Testing Pipeline (Session 36) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| VD-1 | Experiment Prisma models | Done | `Experiment` + `ExperimentVariant` (44th/45th models), migration `0006_add_experiments` |
| VD-2 | Experiment orchestrator | Done | Rewrote from stub — 4 pure functions: validateExperimentConfig, allocateTraffic, shouldDeclareWinner, suggestPresetVariant |
| VD-3 | Experiment queue + worker | Done | `EXPERIMENT` queue, 2 job types, `experiment.worker.ts` (8th worker) with evaluate + record-metric |
| VD-4 | Experiment API routes | Done | 6 CRUD routes + `viral-suggestions` POST endpoint |
| VD-5 | Experiments frontend | Done | List page (stat cards + table + CreateExperimentModal), detail page (variant comparison + controls) |
| VD-6 | ViralScorePanel enhancements | Done | Weak dimension chips, collapsible issues, preset suggestions, "Test a variant" link |
| VD-7 | Analytics experiments tab | Done | Summary cards (active, completed, win rate, total variants), recent completions table |
| VD-8 | Bug fixes + tests | Done | D071 fix in viral-score, viewer check on viral-suggestions, 24 new unit tests |

### Phase 23: Series System — Sequence→Series Evolution (Session 40) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| SR-1 | Schema migration | Done | Rename Sequence→Series, SequenceItem→Episode, new SeriesAvatar join table, migration 0009 |
| SR-2 | Shared types + utilities | Done | Series/Episode/SeriesAvatar interfaces, series-bible-resolver, preset resolver Layer 2 |
| SR-3 | API routes (11 files) | Done | CRUD, episodes, avatars, bible, presets, analytics, playlist sync, channel series |
| SR-4 | Queue + worker | Done | SeriesPlaylistSyncJob, seriesId in pipeline params, posting worker stub |
| SR-5 | Frontend hooks + pages | Done | 8 SWR hooks, /series list page, /series/[seriesId] detail page (4 tabs) |
| SR-6 | Frontend components | Done | CreateSeriesModal, EpisodeTable, AddEpisodeModal, SeriesAvatarManager, SeriesAnalytics, SeriesCard |
| SR-7 | Integration | Done | Sidebar nav (17 items), channel detail Series tab, simple wizard series dropdown |
| SR-8 | Build verification | Done | All 14 packages build, 27 test tasks pass, 33 audit tests pass, 0 audit violations |

### Phase 24: Asset Management System (Session 41) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| AM-1 | Schema migration | Done | tenantId on Avatar/SceneryAsset, avatarId on AssetRegistryEntry, updatedAt on SceneryAsset, migration 0010 |
| AM-2 | Upload infrastructure | Done | Presigned PUT API route, useUpload hook, FileUpload component (D105) |
| AM-3 | Avatar CRUD (4 routes) | Done | List/create, detail/update/delete, image slot management, ComfyUI generation |
| AM-4 | Scenery CRUD (2 routes) | Done | List/create with category filter, detail/update/delete |
| AM-5 | Channel assets (5 routes) | Done | Branding upsert/generate, scenery assign/unassign, aggregated assets, registry list |
| AM-6 | Production worker | Done | handleAssetGenerate — ComfyUI rendering, MinIO upload, source model update (D106) |
| AM-7 | Frontend hooks | Done | 8 SWR hooks + useUpload in use-assets.ts |
| AM-8 | Assets pages | Done | /assets page (3 tabs), /assets/[assetId] avatar detail page |
| AM-9 | Asset components (8 files) | Done | AvatarCard, SceneryCard, create modals, BrandingEditor, AssetPickerModal, GenerationStatus, ChannelAssetsTab |
| AM-10 | Navigation + integration | Done | Sidebar (Palette icon, `t` shortcut), channel Assets tab, wizard avatar/scenery pickers |
| AM-11 | Build verification | Done | 14 packages build, all tests + 33 audit tests pass |

### Phase 25: Account Lifecycle Pipeline (Session 42) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| AL-1 | AccountLifecycle Prisma model | Done | 50th model, migration `0011_add_account_lifecycle`, unique emailAccountId FK, discoveryResults JSONB |
| AL-2 | Shared types + queue jobs | Done | AccountLifecycleStatus, PlatformDiscoveryResult, ActivityLock types, 6 job interfaces, lifecycle queue |
| AL-3 | Flow producer entry point | Done | `startAccountLifecyclePipeline()` — queues lifecycle:init (not static DAG, D110) |
| AL-4 | Browser discovery + profile | Done | Abstract methods on BasePlatformWorkflow, real YouTube impl, D064 stubs for TikTok/IG/FB |
| AL-5 | Lifecycle worker (6 handlers) | Done | init, discover, plan, signup, set-profile, enroll — 9th worker with concurrency 2 |
| AL-6 | Warm/post coordination | Done | Activity lock helpers, warming reschedule with jitter, posting lock-break priority (D112) |
| AL-7 | API routes (3 new + 2 modified) | Done | lifecycle GET/POST, retry, active list, accounts POST auto-start, accounts GET includes lifecycle |
| AL-8 | Frontend (4 new + 1 modified) | Done | useLifecycle hook, LifecycleStatusPanel, PlatformSelect, AvatarAssignPicker, 4-step wizard |
| AL-9 | Build verification | Done | 14 packages build, 27 test tasks pass, 33 audit tests pass, 0 violations |

### Phase 26: Approval Pipeline & UX Overhaul (Session 43) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| AP-1 | Shot visualization | Done | KeyframeImage component + usePresignedUrl, Studio video preview toggle, plateVideoUrl in API |
| AP-2 | Quality score UX | Done | QualityBadge component (sm/md/lg), thresholds aligned to QUALITY_THRESHOLDS, deployed across 4 surfaces |
| AP-3 | Approval gate logic | Done | approval-gate.ts (evaluateApprovalGate + updateTrustAfterAction), gate window on pending_approval, 5-min timeout checker |
| AP-4 | Trust score updates | Done | Upsert ApprovalTrustScore on all approve/reject routes (3 files), trust scores API route |
| AP-5 | Approval notifications | Done | Alert creation in content worker, SSE→notification center wiring, metadata in SSE events |
| AP-6 | Storyboard approval | Done | pending_review status, QC gate pause, 2 new API routes, Studio review UI with per-shot controls |
| AP-7 | HITL task queue UI | Done | Workflows HITL tab, HitlTaskCard component, sidebar badge (30s SWR polling) |
| AP-8 | UX polish | Done | Gate countdown (urgency colors), trust scores section, dashboard + wizard approval info |
| AP-9 | Build verification | Done | 14 packages build, 33 audit tests pass, 0 violations, 0 regressions |

### Phase 27: Deep UX/UI Audit Fixes (Session 44) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| UX-1 | Storefront tenant-scoped findFirst | Done | GET/PATCH/DELETE combined fetch+ownership into single query |
| UX-2 | Content approve TOCTOU fix | Done | Status check moved inside $transaction (D118) |
| UX-3 | Confirmation dialogs | Done | Content archive + episode delete use ConfirmDialog, approvals bulk reject shows titles |
| UX-4 | AddEpisodeModal accessibility | Done | Escape key, role="dialog", aria-modal="true", toast import |
| UX-5 | Studio skeleton loader | Done | Structured skeleton matching studio layout, AI guidance collapsed in simple mode |
| UX-6 | LifecycleStatusPanel theming | Done | 15+ hardcoded classes → theme-aware equivalents |
| UX-7 | SSE parallel polling | Done | Promise.allSettled for all 4 event types per cycle (D119) |
| UX-8 | Empty state consistency | Done | NotificationCenter + ShotGallery use EmptyState component |
| UX-9 | Content detail polish | Done | Secondary action dropdown (D120), required reject reason, settings link |

### Phase 28: Deep Multi-Wave Codebase Audit (Session 45) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| DA-1 | Wave 1: Auth & system routes | Done | 29 files, 3 agents, 4 issues (silent catches, invalid status) |
| DA-2 | Wave 2: Content & cinema | Done | 63 files, 5 agents, 14 issues (TOCTOU, 2 CRITICAL tenant scoping, data shapes, silent catches) |
| DA-3 | Wave 3: Domain pages | Done | 140 files, 5 agents, 31 issues (10 tenant scoping [7 CRITICAL analytics], 3 Decimal, 14 silent catches) |
| DA-4 | Wave 4: Frontend infra | Done | 66 files, 3 agents, 18 issues (4 CRITICAL lifecycle hook 404s, integration mismatches) |
| DA-5 | Wave 5: Backend packages | Done | 79 files, 5 agents, 24 issues (14 silent catches, dead imports, Decimal, integration mismatches) |
| DA-6 | Wave 6: Services + workers | Done | 31 files, 2 agents, 10 issues (7 Decimal wrapping, 2 silent catches) |
| DA-7 | Wave 7: Remotion | Done | 14 files, 1 agent, 1 issue (unused destructured variable) |
| DA-8 | Build verification | Done | 14 packages build, 507+ unit tests + 33 audit tests pass, 0 regressions |

### Phase 29: Pre-Deployment Full System Audit (Session 46) — COMPLETE
| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| PD-1 | Wave 1: Auth & system routes | Done | 49 files, 3 agents, 24 fixes (tenant scoping, rate limiting, admin checks) |
| PD-2 | Wave 2: Content & cinema | Done | 65 files, 4 agents, 14 fixes (rate limiting, data shapes, tenant scoping, Decimal) |
| PD-3 | Wave 3: Domain pages | Done | 86 files, 5 agents, 13 fixes (cross-tenant avatar, product analytics, dead imports) |
| PD-4 | Wave 4: Remaining API + hooks + libs | Done | 67 files, 4 agents, 11 fixes (knowledge base, usage, assets, jobs tenant scoping) |
| PD-5 | Wave 5: Backend packages | Done | 71 files, 4 agents, 19 fixes (silent catches, quality tier, integration mismatches) |
| PD-6 | Wave 6: Services + workers | Done | 32 files, 3 agents, 59 fixes (try/catch, err.message leaks, unhandled rejections) |
| PD-7 | Wave 7: Remotion + ComfyUI + integration | Done | 38 files, 3 agents, 3 fixes + 7 integration mismatches documented |
| PD-8 | Wave 8: Test infra + config | Done | 66 files, 3 agents, PM2 paths fixed, 2 missing workers, audit regex gap, dead imports |
| PD-9 | Build verification | Done | 14 packages build, all tests pass, 33 audit tests pass, 0 regressions |

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
- **Unit tests**: 349 shared + 158 other = 507+ (all passing via Vitest)
- **Audit tests**: 33 (13 files scanning 133+ API routes + monorepo-wide for 13 bug classes, <1s)
- **E2E tests**: 181 (30 spec files via Playwright, all 17 pages, **100% pass rate** — Session 16)
- **Test tasks**: 27 (all passing via Turbo)
- **14 packages all building successfully** (including audio-engine, browser-automation, Remotion)
- **Pre-deployment audit (Session 46)**: 8-wave, 30-agent audit across 450+ files. ~160 issues fixed. PM2 config corrected. 7 integration mismatches documented (KI-082 through KI-085). 3 decisions (D124-D126). 0 regressions.
- Integration audit (Session 8): All components verified wired, 2 EmptyState gaps fixed
- Codebase audit (Session 12→17): 9 bug classes automated, known violation sets for viewer checks and rate limiting emptied to 0
- Full codebase audit (Session 19): 302 files scanned, 16 fixes applied (2 bugs, 4 silent catches, 9 type safety, 1 config), 0 silent catches remaining
- **Full-stack audit (Session 27)**: 26 issues found (3 CRITICAL, 7 HIGH, 9 MEDIUM, 7 LOW), 20 fixed, 1 accepted risk, 5 deferred. Two consecutive clean test runs achieved.
- **UI response shape audit (Session 28)**: 8 apiPost/navigation bugs found and fixed across 6 components. Root cause: apiPost returns full envelope but components read top-level props.
- **Tenant isolation (Session 30)**: 5 models migrated (Alert nullable, 4 required), ~20 API routes scoped, workers updated, 0 audit violations.
- **Cinema pipeline improvements (Session 31)**: 6 gaps implemented (G1-G6): frame anchoring, AV sync detection, asset graph, QC decision agent, VMAF regression, C2PA embedding. 3 new Prisma models, 9th cinema agent, 6-phase execution order. 76 new tests added.
- **Simplified Cinema Wizard (Session 32)**: 5-screen simple mode wizard, character preset family (10th, 41 total built-in presets), 6 revision presets, 3 new frontend components, simple mode guardrails + constraint validation.
- **AI-Generated Presets (Session 33)**: UserPreset model (42nd Prisma model), 3 API routes (CRUD + generate), AI generation with validation, CreatePresetModal + PresetPicker "My Presets" tab, localStorage sync. 17 new unit tests.
- **Full codebase audit — 100% coverage (Session 34)**: 8-wave audit with 31 parallel agents across ~400 source files. ~210 issues found and fixed. D071 conditional tenant scoping fully resolved (60+ routes). 0 regressions — 134 unit tests + 24 audit tests pass (27 test tasks).
- **Cinema pipeline upgrade (Session 35)**: Workflow registry with quality tiers, composition registry, assembly manifest, assembly resolver, agent output persistence, worker integration, preview pipeline DAG. 63 new tests (22 workflow + 16 composition + 25 resolver). 0 regressions.
- **Viral discovery & testing pipeline (Session 36)**: Experiment orchestrator (from stub to real), Experiment + ExperimentVariant models (44th/45th), experiment worker (8th), 6 API routes + viral-suggestions, experiments page + detail page, ViralScorePanel enhancements, analytics experiments tab. 24 new tests. D071 fix in viral-score. 0 regressions.
- **Channel-Topic Suggestion System (Session 37)**: SuggestionLog model (46th), channel-aware suggestions with niche/tone/platform boosting, 5 new API routes, channels list + detail pages, ChannelViralDashboard, ViralScorePanel accept/reject, experiment feedback loop. 16 new tests. 0 regressions.
- **Full codebase audit — 8-wave (Session 38)**: 606 files (~85K LOC) audited, 60 issues found and fixed across 36 files. CRITICAL: 8x double /api/v1 prefix on experiment mutations. 12x tenant scoping violations, 9x missing Decimal wrapping, 19x silent catch blocks. D095 evaluating status, D096 preset ID extraction. 0 regressions.
- **Targeted 4-wave audit (Session 39)**: 4 new audit tests + targeted fix pass. 78 .strict() removed, 19 tenant scoping fixes, 8 status enum fixes, 4 experiment security/race fixes, 3 channel fixes, 3 type fixes. shouldDeclareWinner now respects primaryMetric (D098). Audit suite: 24→33 tests, 9→13 files. 0 regressions.
- **Account lifecycle pipeline (Session 42)**: AccountLifecycle model (50th), 9th worker (lifecycle), browser login probe discovery, activity lock warm/post coordination, 3 new + 2 modified API routes, 4-step wizard frontend, 5 decisions (D109-D113). 0 regressions.
- **Deep multi-wave codebase audit (Session 45)**: 7-wave audit with 26 agents across 362 files (~96K LOC). 105 issues found and fixed: ~16 tenant scoping (CRITICAL), ~35 silent catches, ~12 Decimal wrapping, ~12 dead imports/code, ~8 integration mismatches, ~4 data shape mismatches, 4 CRITICAL lifecycle hook 404s, 1 TOCTOU, 1 missing DELETE handler. 3 decisions (D121-D123). 3 new KIs flagged (KI-079 through KI-081). 0 regressions.
- **Deep UX/UI audit fixes (Session 44)**: 6-wave audit — TOCTOU race fix, storefront tenant-scoped findFirst, SSE parallel polling (~40s→10s latency), confirmation dialogs, studio skeleton, theme-aware lifecycle panel, empty states, content detail dropdown. ~16 files modified, 3 decisions (D118-D120). 0 regressions.
- **Approval pipeline & UX overhaul (Session 43)**: 7-phase implementation — approval-gate.ts pure functions, QualityBadge component, shot keyframe images, gate window countdown, trust score upsert, storyboard pending_review step, HITL task queue UI, SSE→notification wiring, dashboard + wizard approval info. 6 new files, ~20 modified, 4 decisions (D114-D117). 0 regressions.

## Architecture Highlights
- **Prisma Schema**: 50 models with full-text search GIN indexes on key tables (36 base + SeasoningCohort + SeasoningEnrollment Session 25 + AssetRegistryEntry + Sequence + SequenceItem Session 31 + UserPreset Session 33 + Experiment + ExperimentVariant Session 36 + SuggestionLog Session 37 + Series + Episode + SeriesAvatar Session 40 + AccountLifecycle Session 42)
- **AI Service Registry**: Provider abstraction (Ollama, OpenAI-compat, HTTP), fallback chain orchestration, circuit breaker pattern, health monitoring, cost estimation, usage logging
- **Next.js API Routes**: ~180 route files with JWT auth (jose + scrypt), Prisma queries, pagination, validation. 123 architecture decisions (D001-D123).
- **Dashboard**: 19 views (content detail, approvals, workflows, affiliate, forgot/reset password) + notification center + SSE real-time updates + command palette + breadcrumbs
- **Approval Pipeline**: ApprovalTrustScore adaptive gate windows, evaluateApprovalGate/updateTrustAfterAction pure functions, 5-min timeout auto-approve, storyboard pending_review checkpoint, per-shot approve/reject/regenerate, HITL task queue, QualityBadge component (Session 43)
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
- **Real-time**: SSE endpoint with DB-polled events (alerts, workflow-updates, content-status, system-metrics), auto-reconnect with exponential backoff, parallel polling via Promise.allSettled (D119, Session 44)
- **Security**: AI service API keys encrypted (AES-256-GCM), invite flow hides temp password, API keys SHA-256 hashed with revocation support, admin role checks on all AI service management routes, IP format validation on rate limiter, 30s fetch timeouts on frontend
- **API Key Access**: 13 read-only GET endpoints accept both JWT and API key via authenticateAny() (analytics, content, channels, system, calendar, jobs)
- **Settings**: DB-backed via SystemSetting model (general, notifications, appearance) — persists across restarts
