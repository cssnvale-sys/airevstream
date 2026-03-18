# Product Requirements Document: AiRevStream MPCAS

## Goals

- Automate the full lifecycle of affiliate marketing content — from AI-powered cinematic video production to multi-platform social media distribution — across 1,200+ email-anchored social media accounts
- Produce cinema-quality content using a JSON-driven audio engine, multi-LLM production pipelines, and specialized AI agents with continuously updated knowledge bases
- Enable a non-developer solo operator to manage the entire operation through an intuitive visual dashboard
- Architect for eventual SaaS multi-tenancy while building for single-operator use first
- Maximize open-source/free AI tools; use paid APIs only when quality demands it

## Background Context

The operator currently manages scattered tools (manual workflows, disconnected services) that don't scale beyond a handful of accounts. No existing platform combines cinematic-quality AI video production with automated multi-platform distribution at the scale of 1,200+ accounts. This platform replaces all fragmented tooling with a single purpose-built system running primarily on a Mac Studio M3 Ultra (512GB RAM, 16TB storage), built in TypeScript end-to-end.

The system treats every video as cinema — sound-first production, image-first generation, asset-factory compositing — producing content that genuinely engages audiences rather than detectable AI-generated material. The channel-as-identity model ensures content is always created FOR a specific channel's full identity (niche, characters, branding, voice, language, affiliate pool), never generically matched.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-16 | 1.0 | Initial PRD creation from approved project brief | John (PM Agent) |

## Requirements

### Functional

- FR1: The system shall manage 1,200–1,500 email accounts with full CRUD operations, bulk import, and per-account data models including profile info, platform credentials, niche tags, AI avatars, branding assets, and language settings
- FR2: The system shall automate social media account creation across YouTube, TikTok, Instagram, and Facebook using browser automation with human-in-the-loop for CAPTCHA/phone verification
- FR3: The system shall implement IP rotation and session management with proxy verification before every account login
- FR4: The system shall warm idle accounts with platform-appropriate automated activity (browsing, liking, commenting) for variable durations (5–300 minutes)
- FR5: The system shall implement the channel-as-identity model where each channel is a complete content identity with assigned niche, characters, branding, voice profiles, language, affiliate pool, and posting cadence
- FR6: The system shall support multi-channel YouTube accounts with per-channel language assignment, playlist management, and channel health validation
- FR7: The system shall support multi-language channel families linking variant channels that share a core concept but are independently tailored per culture/language
- FR8: The system shall maintain a central AI Service Registry tracking all AI providers with credentials, capabilities, rate limits, health status, cost tracking, and fallback chains
- FR9: The system shall implement sequential model selection with fallback — selecting the best model per task based on KPIs, falling back to next-best on subpar output or failure
- FR10: The system shall generate text, image, video, and voice content using modular platform-specific workflow modules assembled from reusable tagged components
- FR11: The system shall implement a cinematic video production pipeline with specialized AI agents (Script, Shot Director, Storyboard, Sound Designer, Animation, Editor, QC, Human Psychology)
- FR12: The system shall generate hyper-detailed timestamped scripts for lip-sync content covering dialogue timing, BG/MG/FG audio cues, emotional markers, character expressions, and camera sync points
- FR13: The system shall implement viseme-based lip sync: generate audio first, derive mouth motion from 15-target viseme set, map to character face rig
- FR14: The system shall implement 8 cinematic audio presets (Intimate, Tension, Power, Awe, Psychological, Emotional, Momentum, Calm) with JSON-driven beat-to-sound automation
- FR15: The system shall render video programmatically via Remotion with frame-accurate audio placement, platform-specific loudness compliance, and stem exports
- FR16: The system shall implement a storyboard system with scene-by-scene AI image generation, drag-and-drop editor, style/transition/duration recommendations, and approval workflow
- FR17: The system shall implement ComfyUI as an asset factory with deterministic seed/steps/CFG/denoise controls, ControlNet conditioning, LoRA adapters, and two-stage upscaling
- FR18: The system shall create and maintain cinema bibles (Look, Character, Environment, Prompt) per channel before content generation
- FR19: The system shall implement three-stage QC gates (Pre-Gen, Gen, Post) with specific criteria at each stage
- FR20: The system shall implement ACES color management for consistent color across shots from different AI models
- FR21: The system shall distribute content to the specific channel it was created for, with options to push to niche families, selected channels, or all channels
- FR22: The system shall implement smart scheduling with per-channel cadence, audience-activity-based timing, and platform-specific optimization
- FR23: The system shall implement a content calendar with filtering by email account, channel, language, platform, niche, with color-coding and language variant grouping
- FR24: The system shall implement adaptive human-in-the-loop approval gates with trust-based progressive autonomy — new pipelines have long review windows that shorten as outcomes improve
- FR25: The system shall track approval gate outcomes per dimension (content type, LLM, workflow, account tier, niche, platform) and adjust gate windows independently
- FR26: The system shall implement affiliate product management with URL investigation, product description generation, link shortening, and trackable shortened URLs
- FR27: The system shall support two-mode affiliate video integration: dedicated product video OR commercial break embed maintaining channel character/brand
- FR28: The system shall implement affiliate product pools assignable to channels by niche fit, with auto-selection during content generation and rotation to avoid repetition
- FR29: The system shall implement per-channel branded storefronts with digital products, affiliate links, and AI sales agents responding in channel character
- FR30: The system shall implement a conversational AI assistant with full system state awareness, multi-turn conversation, response streaming, and searchable history
- FR31: The system shall implement a 4-tier action execution safety system (read-only, low-risk confirmation, medium-risk approval, high-risk multi-step admin verification)
- FR32: The system shall implement self-discovering architecture where the assistant auto-discovers system capabilities by scanning API routes, extracting documentation, and reading parameter schemas
- FR33: The system shall implement RAG-powered knowledge base with system documentation, content memory, real-time state awareness, and contextual knowledge injection
- FR34: The system shall implement specialized AI agent knowledge bases for CivitAI, Remotion, Hugging Face, ComfyUI, and AI Video Production that stay continuously updated
- FR35: The system shall implement continuous research workflows for niche trends, platform strategies, LLM capabilities, and MCP server discovery
- FR36: The system shall implement a content suggestion engine tracking KPIs on all content variables (prompts, LLMs, avatars, hooks, descriptions) with performance prediction
- FR37: The system shall implement competitive intelligence with competitor monitoring, content performance tracking, market trend analysis, and strategic gap identification
- FR38: The system shall implement comprehensive cost management with per-workflow/per-model/per-account tracking, budget alerting, ROI analysis, and automated optimization
- FR39: The system shall implement A/B testing with variation campaigns, traffic splitting, statistical significance testing, auto-promotion of winners, and a knowledge base of successful patterns
- FR40: The system shall implement real-time monitoring with metrics collection, structured logging, distributed tracing, anomaly detection, and audit logging
- FR41: The system shall implement automated alerting with multi-channel delivery, escalation policies, on-call schedules, alert deduplication, and delivery logs
- FR42: The system shall implement error handling with categorization, pattern recognition, one-click resolution, AI-powered suggestions, error prediction, and prevention automation
- FR43: The system shall implement version management with component tracking, compatibility checking, safe rollback, and version comparison
- FR44: The system shall implement resource monitoring targeting 95% utilization with priority-based workflow scheduling and auto-pause of lower-priority work
- FR45: The system shall implement the H.I.C.C. retention architecture (Hook 0–5s, Intro 5–30s, Content with micro-hooks every 60–90s, CTA at peak tension) in all viewer-facing content
- FR46: The system shall implement structured prompt engineering with advanced formula (Subject+Action+Scene+Camera+Lighting+Style+Audio), negative prompt database, and prompt libraries
- FR47: The system shall attach C2PA Content Credentials to generated content for provenance traceability
- FR48: The system shall implement content repurposing: long-form → short-form automatically across YouTube Shorts, TikTok, Reels, Stories
- FR49: The system shall implement thumbnail creation with 60-30-10 rule, emotion-driven faces, mobile-optimized contrast, and 2–3 A/B test variations per video

### Non Functional

- NFR1: The UI must be operable by a non-developer with zero technical knowledge — no terminal, no config files, no code editing for day-to-day operations
- NFR2: The system shall run primarily on a Mac Studio M3 Ultra (512GB RAM, 16TB) with cloud services only for external AI APIs, proxy services, and optional GPU burst
- NFR3: The system shall be built entirely in TypeScript (frontend, backend, scripts, tooling) for maximum AI-developer productivity
- NFR4: The system shall use PostgreSQL with Prisma ORM, Next.js + React frontend, BullMQ for job queues, Playwright for browser automation, Ollama for local LLMs, Remotion for video rendering, MinIO for S3-compatible storage
- NFR5: The architecture shall support eventual SaaS multi-tenancy without requiring a rewrite — API-first design, clean separation of concerns, modular services
- NFR6: The system shall be GDPR/CCPA compliant with configurable data retention (default 90 days), right to deletion, data portability, PII masking, and comprehensive audit trails
- NFR7: The codebase shall be clean, well-documented, and follow consistent patterns to enable AI coding agents (Claude) to produce reliable code across isolated modules
- NFR8: The system shall target 95% server utilization with crash prevention buffer and auto-pause of lower-priority workflows
- NFR9: All WebSocket-connected dashboard views shall update in real-time without page refreshes
- NFR10: The system shall implement API-first design with clean backend APIs consumed by the frontend dashboard
- NFR11: Platform-specific loudness compliance: YouTube -14 LUFS, TikTok/IG -14 to -12 LUFS, true peak -1.0 dBTP
- NFR12: Video rendering shall scale from 7-second reels to 90-minute feature films using the same Remotion pipeline

## User Interface Design Goals

### Overall Vision
The dashboard is the product for the operator — a non-developer's entire interface to a complex 9-system platform. It must feel like managing a business, not operating software.

### Core Dashboard Views
- **Home/Overview**: Real-time system status, today's publishing queue, account health summary, revenue snapshot, pending approvals count
- **Account Manager**: All email accounts with connected socials, health status, niche tags, channel identities, asset assignments
- **Content Calendar**: Visual calendar with drag-and-drop scheduling, filterable by email account, channel, language, platform, niche; color-coded by language or channel; grouped language variants
- **Content Creation Wizard**: Step-by-step guided content creation with AI assistance, template suggestions, platform optimization, real-time preview
- **Content Library**: Search/filter by type, model, status, performance; thumbnails/previews; AI model attribution
- **Analytics Dashboard**: Cross-platform performance, engagement trends, revenue tracking, cost analysis, predictive insights, custom reporting with export
- **System Health Dashboard**: Real-time component monitoring, performance metrics, resource utilization, alerting, diagnostics, capacity planning
- **Affiliate Manager**: Product catalog, link management, channel pool assignments, per-product per-channel performance, revenue tracking
- **AI Assistant Panel**: Conversational interface accessible from every page, context-aware to current view

### UX Principles
- Responsive design for desktop, tablet, and mobile
- Keyboard shortcuts and drag-and-drop for power users
- Real-time updates via WebSocket (no page refreshes)
- Contextual help and onboarding tooltips
- Customizable workspace and widget layout
- Minimal clicks to key functions
- Notification center with actionable alerts
- One-click approve/reject/regenerate in approval queues
- Batch operations for power workflows

### Key User Flows
- **Create content for a channel**: Select channel → Content Creation Wizard auto-populates channel identity → Configure content → Generate → Review in approval queue → Approve → Auto-scheduled and posted
- **Manage accounts**: Import emails → System auto-detects/creates social accounts → Assign niches, avatars, branding → Monitor health in Account Manager
- **Review pending approvals**: Notification badge → Approval queue → Preview with full context → Approve/reject/regenerate → Track outcomes
- **Monitor business performance**: Analytics Dashboard → Filter by channel/niche/platform → View revenue, costs, engagement → Export reports

---

## Epic 1: Foundation (Phase 1)

### Story 1.1: PostgreSQL Database Schema & Core Infrastructure
**As a** system operator, **I want** a properly designed database with all core tables, migrations, and seed data, **so that** all subsequent features have a reliable data foundation.

**Acceptance Criteria:**
1. PostgreSQL database initialized with Prisma ORM and TypeScript type generation
2. Core tables created: email_accounts, social_accounts, channels, niches, keywords, system_config
3. JSONB columns used for flexible schema fields (avatar configs, prompt history, workflow metadata)
4. Full-text search indexes configured for content and account searching
5. Database migration system operational with up/down migrations
6. Connection pooling configured for Mac Studio workload
7. Seed data script for development/testing

### Story 1.2: Next.js Dashboard Shell & Authentication
**As a** system operator, **I want** a responsive web dashboard with authentication, **so that** I have a secure entry point to manage my entire operation.

**Acceptance Criteria:**
1. Next.js 14+ App Router project initialized with TypeScript, Tailwind CSS, shadcn/ui
2. Authentication system with JWT-based login (single operator, SaaS-ready)
3. Responsive layout shell with sidebar navigation, header, and main content area
4. Dashboard home page with placeholder widgets for system status, pending approvals, revenue snapshot
5. Dark/light mode support
6. WebSocket connection infrastructure for real-time updates
7. Notification center UI shell (badge + dropdown)
8. Mobile-responsive navigation

### Story 1.3: Email Account Management
**As a** system operator, **I want** to register, import, and manage my email accounts, **so that** I can build my account infrastructure.

**Acceptance Criteria:**
1. CRUD API for email accounts (create, read, update, delete, bulk import)
2. CSV/JSON bulk import supporting email + password pairs
3. Account Manager UI page showing all email accounts in a searchable, filterable table
4. Per-account detail view showing connected social accounts, assigned niches, health status
5. Account status tracking: active, disabled, flagged, pending setup
6. Encrypted credential storage for email passwords
7. Search and filter by email, status, niche, platform

### Story 1.4: Social Account Registry
**As a** system operator, **I want** to register and track social media accounts linked to each email, **so that** I know which platforms each email is connected to.

**Acceptance Criteria:**
1. Social accounts table linking to email accounts with platform type (YouTube, TikTok, Instagram, Facebook)
2. Per-email social account status: present/active, disabled, not present (needs signup)
3. Social account detail view showing platform credentials, channel info, health status
4. Dashboard widget showing account coverage (how many emails have which platforms)
5. API endpoints for social account CRUD operations
6. Platform-specific metadata fields (YouTube channel IDs, TikTok handles, etc.)

### Story 1.5: Channel Identity Model
**As a** system operator, **I want** to define channels as complete content identities, **so that** all content generation is driven by a channel's full profile rather than generic settings.

**Acceptance Criteria:**
1. Channels table with: primary language, niche(s), assigned avatars/characters, branding/visual style, voice/sound profiles, tone/personality, affiliate product pool, target audience, posting cadence, platform
2. Channel CRUD API with full identity profile management
3. Channel detail UI showing all identity attributes with inline editing
4. Channel-to-email-account relationship (which email/social account hosts this channel)
5. Multi-channel support per YouTube account (multiple channels under one social account)
6. Channel family relationships for multi-language variants of the same concept
7. Channel health validation (checks platform accessibility before operations)

---

## Epic 2: Account Operations (Phase 2)

### Story 2.1: Playwright Browser Automation Framework
**As a** system operator, **I want** automated browser sessions that mimic human behavior, **so that** account operations are reliable and undetectable.

**Acceptance Criteria:**
1. Playwright installed and configured with stealth plugins for anti-detection
2. Browser context manager supporting multiple isolated sessions simultaneously
3. Human-like behavior injection: random delays, mouse movements, scroll patterns
4. Screenshot and error capture for debugging failed sessions
5. Session persistence (cookies/state) for maintaining login across operations
6. Configurable browser fingerprint randomization per session

### Story 2.2: Proxy/IP Rotation Integration
**As a** system operator, **I want** automatic IP rotation before every account login, **so that** accounts are not flagged by platform detection systems.

**Acceptance Criteria:**
1. Residential proxy service integration with configurable provider
2. IP rotation triggered before every account login or sensitive operation
3. IP verification: test login to email/social after rotation, confirm non-blocked
4. If blocked → rotate to next IP → retry (with configurable max retries)
5. Proxy health monitoring dashboard showing success rates per proxy
6. Cost tracking per proxy usage

### Story 2.3: Account Creation Workflows
**As a** system operator, **I want** automated social media account creation with human-in-the-loop for verification steps, **so that** I can scale my account network efficiently.

**Acceptance Criteria:**
1. Automated signup workflows for YouTube, TikTok, Instagram, Facebook
2. Google account sign-in integration for platforms that support it
3. Human-in-the-loop triggers for CAPTCHA, phone verification, and other manual steps
4. HITL notification in dashboard with task description, links, and content needed to complete
5. Workflow resumes automatically after human completes manual step
6. Account creation status tracking: queued, in-progress, needs-human, completed, failed
7. Batch account creation queue with priority management

### Story 2.4: Account Warming System
**As a** system operator, **I want** idle accounts to perform human-like warming activities, **so that** accounts build credibility and avoid suspicion.

**Acceptance Criteria:**
1. Platform-appropriate warming behaviors: browsing, searching, liking, commenting (niche-relevant)
2. Variable duration per session (configurable min/max, default 5–300 minutes)
3. Account status tracking: warming, idle, producing content
4. Warming only runs when account is not actively creating or posting content
5. Cross-account engagement: accounts occasionally view/like content from other accounts in the system
6. Warming session scheduling with priority below content production
7. Warming activity logs for debugging if accounts get flagged

### Story 2.5: Session & Credential Management
**As a** system operator, **I want** dynamic credential injection into all account operations, **so that** workflows always use the correct, current credentials.

**Acceptance Criteria:**
1. Encrypted credential vault for all email and social account credentials
2. Dynamic credential injection: before any workflow uses an account, credentials are fetched and injected
3. Session token management: store, refresh, and rotate platform tokens
4. Multi-account operation queue: when multiple accounts are involved, credentials rotate appropriately
5. Credential update propagation: when credentials change, all affected workflows are updated

---

## Epic 3: Content Generation Core (Phase 3)

### Story 3.1: AI Service Registry & Integration Layer
**As a** system operator, **I want** a central registry of all AI providers with health monitoring and cost tracking, **so that** the system can intelligently select and manage AI services.

**Acceptance Criteria:**
1. AI service registry table: provider name, service type (text/image/video/voice), endpoint, API key (encrypted), rate limits, health status, cost per unit
2. Health monitoring: periodic health checks, availability scoring, circuit breaker for failing services
3. Cost tracking per service per usage with daily/weekly/monthly aggregation
4. Service CRUD UI in dashboard with status indicators
5. Fallback chain configuration: primary → secondary → tertiary per task type
6. New models addable to registry as they become available (extensible design)
7. Performance metrics: response time, success rate, quality scores per model

### Story 3.2: Dynamic Model Selection Engine
**As a** system operator, **I want** the system to automatically select the best AI model for each task, **so that** content quality is optimized while costs are minimized.

**Acceptance Criteria:**
1. Selection algorithm considering: historical KPIs per model per content type, cost-per-quality ratio, current availability, operator feedback (approvals/rejections)
2. Sequential selection with fallback: if output is subpar (low quality score or user rejection) → try next-best model
3. Circuit breaker: if model fails entirely → automatic failover to next model in chain
4. A/B testing support: rotate models over time to compare performance (not simultaneously per piece)
5. Model recommendation dashboard showing performance rankings per task type
6. Budget-aware selection: prefer cheaper models when quality difference is negligible

### Story 3.3: Text Content Generation
**As a** system operator, **I want** to generate text content (scripts, descriptions, titles, hashtags) using multiple AI models, **so that** I can produce written content at scale.

**Acceptance Criteria:**
1. Text generation API supporting: scripts, video descriptions, titles, hashtags, social captions, blog posts
2. Integration with Ollama (local), GPT, Claude, DeepSeek via AI Service Registry
3. Channel identity context injection: tone, style, niche, language automatically included in prompts
4. Template system for common content types with variable substitution
5. Output quality scoring (1–10) with automatic regeneration on low scores
6. Cost tracking per generation
7. Content stored in content library with metadata (model used, prompt, score, channel)

### Story 3.4: Image Generation Workflows
**As a** system operator, **I want** to generate images using multiple AI models with ComfyUI as the primary local engine, **so that** I can produce visual content for storyboards, thumbnails, and social posts.

**Acceptance Criteria:**
1. ComfyUI integration: submit workflow JSON, receive generated images, deterministic with pinned seeds
2. Cloud API integration: DALL-E, Midjourney, Stable Diffusion, Nano Banana, Flux via AI Service Registry
3. ControlNet support for pose/depth/edge conditioning (character and scene consistency)
4. LoRA adapter support: load character LoRAs and style LoRAs with configurable strengths
5. Two-stage upscaling: ESRGAN reconstruction → controlled re-denoise
6. 3 variations per prompt with operator selection
7. Image stored in content library with full generation metadata (workflow JSON, seed, model, LoRA versions)
8. Negative prompt database maintained and applied automatically

### Story 3.5: Content Library & Management
**As a** system operator, **I want** a searchable content library for all generated assets, **so that** I can find, reuse, and manage content efficiently.

**Acceptance Criteria:**
1. Content library table: type (text/image/video/voice), status, channel, AI model attribution, quality score, performance metrics
2. Search by title, type, model, channel, niche, status, date range
3. Content library UI with thumbnail/preview grid, filters, and sort options
4. Content detail view showing: preview, metadata, generation parameters, performance history
5. Bulk operations: delete, archive, reassign to different channel
6. Storage integration with MinIO for file management
7. Automatic content archival after configurable retention period

---

## Epic 4: Video Production Pipeline (Phase 4)

### Story 4.1: Remotion Setup & @cinematic/audio-engine Package
**As a** system operator, **I want** a programmatic video rendering engine with a reusable cinematic audio package, **so that** all video assembly is deterministic, code-driven, and cinema-quality.

**Acceptance Criteria:**
1. Remotion project initialized with TypeScript, configured for Mac Studio rendering
2. @cinematic/audio-engine package created with: RenderAudio component, RMS envelope analysis, auto-ducking, beat tagger, shot-aware SFX, preset map (8 presets)
3. CinematicBeatSoundPlan JSON schema defined and validated
4. Platform-specific loudness export: YouTube -14 LUFS, TikTok/IG -14 to -12 LUFS, true peak -1.0 dBTP
5. Two-pass FFmpeg loudnorm integration
6. Stem export (dialogue, music, SFX) alongside final mix
7. CLI and programmatic render APIs functional

### Story 4.2: Cinema Bible System
**As a** system operator, **I want** to create and manage cinema bibles per channel, **so that** all content generation for a channel follows consistent visual and audio rules.

**Acceptance Criteria:**
1. Cinema bible data model: Look Bible, Character Bible, Environment Bible, Prompt Bible, ShotSpec Template — all versioned
2. Cinema bible CRUD API per channel
3. Dashboard UI for creating/editing cinema bibles with section editors
4. Prompt Bible: global style block, character blocks (per character), shot block templates, negative prompt block
5. Character Bible: identity anchors (turnaround images), wardrobe palette, "never change" list, voiceprint constraints
6. Cinema bible auto-loaded as context for all content generation for that channel
7. Version history with diff comparison

### Story 4.3: Script Agent with Beat Tagging
**As a** system operator, **I want** an AI agent that writes scripts with emotional beat tags, **so that** scripts drive the entire production pipeline with structured intent.

**Acceptance Criteria:**
1. Script generation from channel identity + topic/concept input
2. Beat tagging: each segment tagged with emotional preset (INTIMATE, TENSION, POWER, AWE, PSYCHOLOGICAL, EMOTIONAL, MOMENTUM, CALM)
3. H.I.C.C. framework enforcement: Hook (0–5s), Intro (5–30s), Content (with micro-hooks every 60–90s), CTA at peak tension
4. Affiliate integration: if channel has affiliate products in pool, script includes product placement (dedicated or commercial break mode)
5. Human psychology principles applied: hooks, retention techniques, engagement drivers
6. Output: structured JSON with beat boundaries, text, tags, timing estimates, dialogue directives
7. Lip-sync directive generation for dialogue lines (viseme guidance, expression notes)

### Story 4.4: Shot Director & Storyboard Agents
**As a** system operator, **I want** AI agents that generate shot lists and visual storyboards from scripts, **so that** the visual plan is defined before expensive video generation.

**Acceptance Criteria:**
1. Shot Director: converts tagged script into shot list with camera (lens, framing, movement), lighting, and blocking notes per shot
2. ShotSpec JSON generation per shot: prompt blocks, reference requirements, target duration, fps, resolution
3. Storyboard Agent: generates 3 image variations per shot using ComfyUI/cloud APIs
4. Drag-and-drop storyboard editor UI with timeline view
5. Video style recommendations per platform and niche
6. Scene transition recommendations matched to emotional beats
7. Duration recommendations per platform (YouTube long-form vs TikTok 60s vs Reels 30s)
8. Default video creation presets (cinematic, educational, comedy, sales)
9. Storyboard approval workflow: human reviews and approves before video generation proceeds

### Story 4.5: Sound Designer Agent & Audio System
**As a** system operator, **I want** an AI agent that creates sound plans from tagged scripts, **so that** audio is automatically layered with cinematic intent.

**Acceptance Criteria:**
1. Beat → preset mapping: script beat tags automatically select audio presets
2. SoundPlan JSON output consumed by Remotion @cinematic/audio-engine
3. 10 cinematic sound layers handled: dialogue, subconscious bed, psychological pressure, camera movement, fourth-wall, environmental, foley, impact/transitions, score, silence
4. Auto-ducking: music/beds duck automatically based on dialogue RMS
5. Shot-aware SFX: camera movements automatically get corresponding whoosh/tick sounds
6. Retention cadence enforcement: micro accents every 15s, chapter pivots every 60s, palette resets every 3–5 min
7. Audio asset library management: presets folders with pre-leveled sounds

### Story 4.6: Animation Agent & Video Generation
**As a** system operator, **I want** an AI agent that animates approved storyboard frames into video clips using cloud video APIs, **so that** still images become motion content.

**Acceptance Criteria:**
1. Integration with video generation APIs: Sora, Veo3, Kling, Runway, Pika, Luma via AI Service Registry
2. Image-first workflow: approved storyboard frames uploaded as starting frames
3. Dialogue prompts and camera movement directives included in generation requests
4. Character consistency maintained via reference images across shots
5. Sequential model selection with fallback on subpar output
6. Per-shot cost tracking and quality scoring
7. Generated clips stored with full metadata (model, prompt, seed if available, source storyboard frame)

### Story 4.7: Viseme-Based Lip Sync Pipeline
**As a** system operator, **I want** automated lip sync from generated dialogue audio, **so that** character mouth movements match speech perfectly.

**Acceptance Criteria:**
1. Dialogue audio generated first (WAV, consistent sample rate) via voice synthesis (ElevenLabs, etc.)
2. Viseme extraction from audio: 15-target viseme set with timing data
3. Viseme-to-face-rig mapping for both 2D (timing data) and 3D (blendshape) workflows
4. Lip sync data included in Remotion render pipeline
5. Audio-video sync verification: fps/timebase locked, no drift
6. If dialogue is time-stretched after viseme extraction, system regenerates viseme curves

### Story 4.8: Editor/Assembler Agent & QC Pipeline
**As a** system operator, **I want** automated video assembly and quality control, **so that** final videos are rendered with cinema-quality compositing and pass all technical checks.

**Acceptance Criteria:**
1. Remotion-based assembly: layers video plates + audio (SoundPlan) + overlays + captions + thumbnails
2. ACES color management applied across all shots for visual consistency
3. Three-stage QC: Pre-Gen (ShotSpec validation), Gen (face ID, wardrobe, artifacts), Post (loudness, color, provenance)
4. C2PA Content Credentials attached to output where feasible
5. Platform-specific exports: aspect ratios, resolutions, loudness targets per platform
6. Failure mode detection: identity drift, temporal flicker, motion blur mismatch, sync drift — with automated fix suggestions
7. Final output stored in content library with full provenance chain

### Story 4.9: AI Avatar System
**As a** system operator, **I want** to create and manage AI avatars with consistent identity across all content, **so that** channels have recognizable characters.

**Acceptance Criteria:**
1. Avatar data model: physical/mental/emotional descriptions, multi-angle images (face, face-to-waist, full body front/back), generation prompts, voice profile
2. Avatar creation workflow: photography-grade prompts (85mm f/1.4), 3 variations per prompt, conversational iteration
3. Trait locking: consistent features across all generations (gender, age, hair, skin, face shape)
4. Avatar-to-channel assignment (multiple avatars per channel, same avatar across multiple channels)
5. HeyGen integration for avatar video creation
6. ElevenLabs voice cloning per avatar with per-language voice mapping
7. Avatar panel in dashboard: create, update/modify, view all angles, assign to channels
8. LoRA training integration for ComfyUI character consistency

### Story 4.10: Content Approval & Feedback Interface
**As a** system operator, **I want** a formal approval interface with feedback, versioning, and adaptive trust, **so that** I maintain quality control that gets faster over time.

**Acceptance Criteria:**
1. Approval queue UI: visual preview of finished content with all metadata, quality scores, confidence
2. One-click approve/reject/regenerate
3. Bulk approval for trusted content types
4. Inline feedback and modification requests with annotations
5. Content version control: side-by-side comparison of iterations, revision history
6. Adaptive gate behavior: new/unproven pipelines have long windows; established track records shorten windows
7. Per-dimension trust tracking: by content type, LLM, workflow, account tier, niche, platform
8. Outcome tracking: every approved piece tracked for engagement, performance, revenue — feeding back into gate window calculations
9. Time-based auto-escalation if approval isn't given within gate window

---

## Epic 5: Distribution & Publishing (Phase 5)

### Story 5.1: Content Scheduling Engine
**As a** system operator, **I want** intelligent content scheduling that respects platform rules and optimizes timing, **so that** content posts at the best times without overwhelming platforms.

**Acceptance Criteria:**
1. Per-channel posting cadence (configurable min/max daily/weekly/monthly)
2. Audience activity-based optimal posting time recommendations
3. Platform-specific timing optimization
4. Rate limit respect per platform with backoff
5. Failed post retry logic with configurable max retries and exponential backoff
6. Post queue management with priority system
7. Scheduling API consumed by dashboard content calendar

### Story 5.2: Platform-Specific Posting Workflows
**As a** system operator, **I want** automated posting to YouTube, TikTok, Instagram, and Facebook, **so that** approved content is published without manual intervention.

**Acceptance Criteria:**
1. YouTube posting: video upload with title, description, tags, thumbnail, playlist assignment, channel selection
2. TikTok posting: video upload with caption, hashtags, sounds
3. Instagram posting: Reels/Stories with caption, hashtags, location
4. Facebook posting: video with description, tags
5. Platform-specific content adaptation: dimensions, format, metadata
6. Posting status tracking: queued, posting, posted, failed
7. Error handling with retry and human-in-the-loop escalation for persistent failures

### Story 5.3: Content Calendar
**As a** system operator, **I want** a visual content calendar showing all scheduled and posted content, **so that** I have complete visibility into my publishing pipeline.

**Acceptance Criteria:**
1. Calendar UI with day/week/month views and drag-and-drop rescheduling
2. Filter by: email account, channel, language, platform, niche, status
3. Color-coding by language or channel (configurable)
4. Language variants grouped together in calendar view
5. Status indicators: pending, posted, archived
6. Click-through to content detail/preview
7. Bulk reschedule and bulk cancel operations
8. Live monitoring of scheduled posts with real-time status updates

### Story 5.4: Content Distribution Routing
**As a** system operator, **I want** content routed to the channel it was created for, with options to distribute wider, **so that** content reaches the right audiences.

**Acceptance Criteria:**
1. Default routing: content published to the specific channel it was created for
2. Multi-channel distribution: push to all channels in a niche family
3. Manual channel selection: operator can override and select specific channels
4. Cultural adaptation flag: when distributing to multi-language family, content is adapted not just translated
5. AiRevStream Facebook Page: every video automatically shared
6. Distribution tracking: which channels received which content, when, with what result

### Story 5.5: Content Repurposing Pipeline
**As a** system operator, **I want** long-form content automatically repurposed into short-form for multiple platforms, **so that** I maximize content value across platforms.

**Acceptance Criteria:**
1. Long-form → short-form extraction: identify highlight segments for Shorts/Reels/TikTok
2. Platform-specific formatting: aspect ratio, duration, captions, hashtags per platform
3. Burned-in captions on all short-form content
4. Repurposed content linked to source content in content library
5. Operator approval checkpoint before publishing repurposed content (subject to adaptive gates)
6. One original video → multiple platform-specific outputs generated automatically

---

## Epic 6: Intelligence Layer (Phase 6)

### Story 6.1: AI Assistant Core System
**As a** system operator, **I want** a conversational AI assistant accessible from every page, **so that** I can manage my system through natural language.

**Acceptance Criteria:**
1. Floating chat widget accessible from every dashboard page
2. Natural language processing with multi-turn conversation and persistent history
3. Context-aware: knows which page operator is on, current system state, recent activity
4. Response streaming via WebSocket for real-time feedback
5. Searchable conversation history
6. LLM selection via AI Service Registry (use best available model)
7. PII detection and masking in conversation logs
8. GDPR/CCPA compliant: configurable retention, right to deletion, data export

### Story 6.2: Knowledge Base & RAG System
**As a** system operator, **I want** the assistant to have deep knowledge of my entire system, **so that** it can answer questions and provide guidance accurately.

**Acceptance Criteria:**
1. RAG-powered retrieval from: system documentation, code, API references, workflow definitions
2. Content memory: historical data on content performance, account history, workflow outcomes
3. Real-time system state injection: current workflow status, account health, content queue
4. Contextual knowledge injection into LLM prompts based on the operator's current question/page
5. Knowledge base search with relevance ranking
6. Automatic knowledge base updates as system evolves (new features, new workflows)

### Story 6.3: Action Execution System (4-Tier Safety)
**As a** system operator, **I want** the assistant to execute actions on my behalf with appropriate safety controls, **so that** I can operate the system through conversation.

**Acceptance Criteria:**
1. Tier 1 (read-only): view data, check status, read reports — no approval needed
2. Tier 2 (low-risk): start a workflow, update a setting — simple confirmation dialog
3. Tier 3 (medium-risk): modify account data, change schedules, bulk operations — explicit approval with review
4. Tier 4 (high-risk): delete data, change credentials, deploy changes — multi-step approval with admin verification
5. Action execution registry auto-discovered from API routes (self-discovering architecture)
6. Rollback strategy per action type with execution and verification
7. Comprehensive audit logging with PII masking
8. Batch operation support with partial failure handling
9. Runtime capability detection: assistant knows what APIs are available and healthy

### Story 6.4: Content Suggestion Engine
**As a** system operator, **I want** intelligent content suggestions based on performance data, **so that** I can make data-driven content decisions.

**Acceptance Criteria:**
1. KPI tracking on all content variables: prompts, LLMs, avatars, hooks, descriptions, camera shots, overlays
2. Trending/viral content analysis per platform
3. Platform-specific optimization suggestions: titles, hashtags, posting times, video length
4. Performance prediction for proposed content based on historical patterns
5. Real-time suggestions during content creation (in Content Creation Wizard)
6. A/B test recommendations based on knowledge base of successful patterns

### Story 6.5: Research Workflows
**As a** system operator, **I want** automated research that keeps my system's knowledge current, **so that** content strategies stay ahead of trends.

**Acceptance Criteria:**
1. Scheduled research for niche-relevant news, trends, best practices
2. Platform-specific strategy research (Instagram growth, TikTok algorithms, YouTube retention)
3. LLM capability tracking and best-use-case mapping per model
4. Admin-input research: keyword/niche/URL fed to relevance grading pipeline
5. Relevance grading: helpful (feed forward with URLs and summaries) vs ignore (with reasoning)
6. Deduplication in search term and URL databases
7. Research reports accessible in dashboard

### Story 6.6: Business Intelligence Dashboards
**As a** system operator, **I want** comprehensive analytics dashboards, **so that** I can monitor revenue, costs, and performance across all channels.

**Acceptance Criteria:**
1. Revenue tracking and attribution per account, per niche, per content type, per affiliate product
2. Profit margin analysis: revenue vs AI API costs + infrastructure
3. ROI calculations per channel, per workflow, per content type
4. Content creation efficiency metrics: time to produce, cost per unit, quality scores
5. Audience growth tracking with demographic insights and behavioral patterns
6. Engagement trend analysis with pattern recognition
7. Predictive analytics and performance forecasting
8. Cross-platform performance comparison
9. Custom reporting with export (CSV, JSON, PDF)
10. Competitive benchmarking against industry performance

---

## Epic 7: Affiliate & Monetization (Phase 7)

### Story 7.1: Affiliate Product Management
**As a** system operator, **I want** to manage affiliate products with automatic investigation and description generation, **so that** I can efficiently build my product catalog.

**Acceptance Criteria:**
1. Affiliate product CRUD: add URL, AI investigates product, generates description
2. Product categorization by brand, category, commission rate, niche fit
3. Human psychology workflow generates sales angle per niche/audience
4. Search and filter products by various criteria
5. Product status management: active, inactive, expired
6. Product performance tracking: clicks, conversions, revenue per product

### Story 7.2: Link Shortening & Tracking
**As a** system operator, **I want** custom shortened affiliate links with click tracking, **so that** I can monitor affiliate performance and maintain professional URLs.

**Acceptance Criteria:**
1. Link shortener generating custom short codes
2. Optional custom aliases for branded links
3. Expiration date support
4. Click tracking with detailed analytics: count, source, platform, timestamp
5. Conversion tracking integration
6. Link performance dashboard

### Story 7.3: Affiliate Channel Pool Management
**As a** system operator, **I want** to assign affiliate products to channel pools, **so that** content generation automatically selects appropriate products for each channel.

**Acceptance Criteria:**
1. Affiliate product pool assignment to channels based on niche fit
2. Auto-suggest products for channel pools based on niche matching
3. Manual assign/remove products from channel pools
4. During content generation, system auto-selects from channel's pool (or operator chooses)
5. Affiliate rotation: cycle through pool to avoid repetition
6. Per-product per-channel performance tracking: identifies which products perform best on which channels

### Story 7.4: Two-Mode Affiliate Video Integration
**As a** system operator, **I want** affiliate products integrated into videos in two ways, **so that** monetization feels natural and on-brand.

**Acceptance Criteria:**
1. Mode 1 — Dedicated product video: entire video sells the product, on-brand for channel
2. Mode 2 — Commercial break embed: regular content with integrated sponsor segment, character stays in-brand
3. Affiliate messaging configuration: custom text, in-story callout, character-driven toggle
4. Frequency control: number of times to show, interval in minutes
5. Default placements: on-screen overlay + video description (configurable)
6. Script Agent integration: affiliate context injected into script generation when mode selected

### Story 7.5: Per-Channel Branded Storefronts
**As a** system operator, **I want** branded storefronts per channel, **so that** each channel has a dedicated commerce presence.

**Acceptance Criteria:**
1. Storefront per channel: channel_name.flashshop.com (or equivalent)
2. Decorated with channel's main character/avatar and branding
3. Digital products: coloring books from episodes, flash cards, study guides
4. Affiliate product links with tracking
5. Default merchant account for 24/7/365 sales
6. AI sales agent per store: knows products, knows channel content, responds in character
7. Storefront management UI in dashboard

### Story 7.6: Revenue Tracking & Attribution
**As a** system operator, **I want** comprehensive revenue tracking across all monetization channels, **so that** I know exactly what's making money.

**Acceptance Criteria:**
1. Revenue tracking per: email account, channel, niche, content type, affiliate product, storefront
2. Attribution: which content piece generated which revenue
3. Revenue dashboard with trend analysis and period comparison
4. Cost vs revenue analysis per channel and per content type
5. Revenue alerts for milestones and anomalies
6. Export capabilities for accounting

---

## Epic 8: Optimization & Scale (Phase 8)

### Story 8.1: Specialized Agent Knowledge Bases
**As a** system operator, **I want** AI agents with continuously updated domain expertise, **so that** the system stays current with rapidly evolving tools and best practices.

**Acceptance Criteria:**
1. Knowledge base infrastructure for: CivitAI, Remotion, Hugging Face, ComfyUI, AI Video Production, Platform Operations
2. Scheduled research workflows crawling docs, changelogs, GitHub releases, community forums, YouTube
3. Version-aware knowledge: agents know which version of each tool the system is running
4. Community intelligence: best practices from Reddit, Discord, GitHub issues
5. Knowledge base search API consumed by AI Assistant and production agents
6. Knowledge freshness tracking with staleness alerts

### Story 8.2: Competitive Intelligence System
**As a** system operator, **I want** automated competitive monitoring, **so that** I stay ahead of market trends and competitor strategies.

**Acceptance Criteria:**
1. Competitor monitoring across all target platforms
2. Competitor content performance tracking and pattern identification
3. Market trend analysis with industry benchmark tracking
4. Competitive gap identification and strategic opportunity alerts
5. Intelligence reports with actionable insights
6. Market positioning analysis and recommendations

### Story 8.3: Cost Management & Automated Optimization
**As a** system operator, **I want** comprehensive cost tracking with automated optimization, **so that** I minimize expenses while maintaining quality.

**Acceptance Criteria:**
1. Cost tracking across all AI services, infrastructure, proxies, GPU rental
2. Per-workflow, per-model, per-account cost breakdowns
3. Budget alerting with configurable thresholds
4. Automated cost optimization: shift non-urgent tasks to cheaper models when quality impact is negligible
5. Cost forecasting and budget planning
6. ROI dashboard: cost per content piece vs revenue generated

### Story 8.4: Prompt Optimization Pipelines
**As a** system operator, **I want** systematic prompt improvement across all content types, **so that** generation quality continuously improves.

**Acceptance Criteria:**
1. Structured prompt engineering: Subject+Action+Scene+Camera+Lighting+Style+Audio formula enforced
2. Negative prompts database maintained and auto-applied
3. Prompt libraries: successful prompts cataloged, tagged, reusable
4. Platform-specific prompt adaptation (different models need different styles)
5. Iterative refinement workflow: generate → evaluate → refine → test variations
6. Prompt performance tracking: which prompts produce the best outcomes per model per content type

### Story 8.5: Skills & MCP Development
**As a** system operator, **I want** the system to formalize repetitive processes as reusable skills and discover/create MCPs, **so that** automation continuously deepens.

**Acceptance Criteria:**
1. Skill identification: analyze workflows for repetitive processes that could become skills
2. Skill creation with descriptions, tags, and performance tracking
3. MCP assessment: identify opportunities for MCP integration
4. MCP discovery: search for existing MCPs applicable to system tasks
5. Custom MCP creation when no suitable MCP exists
6. All workflows have triggers for AI agent and MCP invocation

---

## Epic 9: SaaS Preparation (Phase 9)

### Story 9.1: Multi-Tenant Architecture
**As a** future SaaS customer, **I want** isolated tenancy, **so that** my data and operations are completely separate from other users.

**Acceptance Criteria:**
1. Tenant isolation at database level (row-level security or schema-per-tenant)
2. Tenant-scoped API: all endpoints automatically filter by authenticated tenant
3. Tenant provisioning workflow: create new tenant with isolated resources
4. Tenant data migration: import/export tenant data
5. Resource limits per tenant (configurable)
6. Cross-tenant analytics for platform operator (admin dashboard)

### Story 9.2: User Management & Access Control
**As a** SaaS platform operator, **I want** user management with role-based access, **so that** tenants can manage their team members.

**Acceptance Criteria:**
1. User CRUD within tenant scope
2. Role-based access control: admin, operator, viewer
3. Invitation workflow: email-based invite with role assignment
4. Session management: concurrent session limits, forced logout
5. Audit logging for all user actions
6. Password reset and 2FA support

### Story 9.3: Billing & Subscription System
**As a** SaaS platform operator, **I want** usage-based billing, **so that** tenants pay for what they use.

**Acceptance Criteria:**
1. Subscription tiers with feature gating
2. Usage tracking: AI API calls, storage, accounts managed, content generated
3. Payment integration (Stripe or equivalent)
4. Invoice generation and billing history
5. Usage dashboards per tenant
6. Overage handling and upgrade prompts

### Story 9.4: Onboarding & Documentation
**As a** new SaaS customer, **I want** guided onboarding, **so that** I can start using the platform quickly.

**Acceptance Criteria:**
1. Step-by-step onboarding wizard: connect email accounts, set up first channel, create first content
2. Interactive tutorials for key workflows
3. Comprehensive documentation: user guides, API reference, video tutorials
4. In-app contextual help tooltips
5. Template library: pre-built cinema bibles, prompt libraries, workflow templates for common niches

### Story 9.5: External API & Developer Documentation
**As a** developer integrating with AiRevStream, **I want** well-documented APIs, **so that** I can build integrations.

**Acceptance Criteria:**
1. OpenAPI/Swagger documentation for all public endpoints
2. API key management for external access
3. Rate limiting per API key
4. Webhook support for event notifications
5. SDK or code examples for common integrations
6. Developer portal with interactive API explorer

---

**Document Version**: 1.0
**Created**: March 16, 2026
**Author**: John (PM Agent)
**Status**: Draft — Awaiting Review
