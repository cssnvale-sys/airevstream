# Project Brief: AiRevStream — Multi-Platform Content Automation System (MPCAS)

## Executive Summary

AiRevStream is a custom full-stack platform that automates the entire lifecycle of affiliate marketing content — from AI-powered video production to multi-platform social media distribution — across 1,200+ email-anchored social media accounts. The system treats every piece of content as cinema, not "AI content," using a JSON-driven cinematic audio engine, multi-LLM video production pipelines, and specialized AI agents with continuously updated knowledge bases.

The platform runs primarily on a Mac Studio M3 Ultra (512GB RAM, 16TB storage), is built in TypeScript end-to-end, and is architected for eventual SaaS multi-tenancy. It replaces Google Sheets, n8n, and manual workflows with a purpose-built orchestration engine, real-time dashboard, and an AI assistant that serves as the operator's command center.

The primary user is a non-developer solo operator who directs the system through an intuitive visual interface, with AI coding agents (Claude) handling all development.

## Problem Statement

Building a profitable affiliate marketing operation at scale requires managing thousands of social media accounts, generating unique high-quality content for each, maintaining account health across platforms, and tracking performance — all while staying ahead of platform detection systems and algorithm changes. Current tools are fragmented: n8n handles workflow automation but becomes a bottleneck at scale, Google Sheets breaks down as a database beyond hundreds of accounts, and no existing platform combines cinematic-quality AI video production with automated multi-platform distribution.

The operator needs a single unified system that handles everything from account creation to revenue tracking, produces content that genuinely engages audiences (not detectable AI slop), and can be managed by one person through a clean visual interface — with the architecture ready to become a SaaS product serving other operators.

## Proposed Solution

A custom-built full-stack platform with nine integrated systems:

1. **Account Infrastructure** — Automated lifecycle management for 1,200–1,500 email-anchored social accounts across YouTube, TikTok, Instagram, and Facebook, with proxy rotation, session management, and account warming.

2. **Content Pipeline** — Modular content generation workflows producing text, images, and video across multiple formats (short-form, long-form, UGC, sales, entertainment, educational), with multi-LLM rotation and A/B testing.

3. **Cinematic Video Production Studio** — A film-production-grade pipeline with specialized AI agents (Script, Shot Director, Storyboard, Sound Designer, Animation, Editor, QC, Human Psychology), JSON-driven beat-to-sound automation, and Remotion as the programmatic rendering engine.

4. **Distribution & Publishing** — Intelligent content routing to single accounts, account groups, or niche clusters, with platform-specific optimization, rate limit respect, and retry logic.

5. **Database & Storage** — PostgreSQL backend with custom web dashboard (no Google Sheets), local file storage on 16TB Mac Studio with S3-compatible interface (MinIO) for future cloud migration.

6. **Affiliate Marketing Engine** — Product investigation, link shortening, two-mode video integration (dedicated product video OR in-content "commercial break"), per-channel branded storefronts with AI sales agents.

7. **AI Assistant / Command Center** — Conversational interface with full system awareness, RAG-powered knowledge retrieval, tiered action execution (read-only through high-risk), proactive optimization suggestions, and input deduplication.

8. **Research & Optimization Engine** — Continuous research workflows crawling docs, changelogs, community forums, and YouTube for best practices; content suggestion engine with KPI tracking on every variable; prompt optimization for images, text, and video.

9. **Infrastructure & Resource Management** — Real-time server monitoring targeting 95% utilization, priority-based workflow scheduling, AWS Lambda integration for serverless burst, GPU rental integration (RunPod/SimplePod) for heavy rendering.

The platform differentiates itself through cinematic content quality (sound-first production philosophy), full automation depth (script to published post with human-in-the-loop checkpoints), and architecture that serves one operator today and many tomorrow.

## Target Users

### Primary User: Solo Operator (The Builder)

- **Profile**: Non-developer entrepreneur running an affiliate marketing business
- **Technical ability**: Can navigate web interfaces confidently but does not write code; relies on AI agents for all development
- **Current workflow**: Managing scattered tools (n8n, Google Sheets, manual processes) that don't scale
- **Pain points**: Too many manual steps between idea and published content; can't maintain quality at volume; losing track of which accounts are healthy; no unified view of revenue performance
- **Goals**: Run 1,200+ accounts profitably from a single dashboard with minimal daily hands-on time; produce content that looks and sounds professional; scale revenue through affiliate marketing
- **Critical need**: The UI must be intuitive, visual, and require zero technical knowledge to operate day-to-day

### Secondary User (Future): SaaS Customers

- **Profile**: Other affiliate marketers, content agencies, social media managers
- **Needs**: Multi-tenant version of the same platform with account isolation
- **Timeline**: Phase 2 — after the platform is proven in production for the primary user

## Goals & Success Metrics

### Business Objectives

- Generate affiliate revenue across 1,200+ social media accounts
- Achieve full automation from content ideation to published post (with human approval checkpoints)
- Produce cinematic-quality content that outperforms typical AI-generated content in engagement metrics
- Build a platform architecture ready for SaaS multi-tenancy

### User Success Metrics

- Time from "content idea" to "published across accounts" measured in minutes, not hours
- All account management (creation, warming, health monitoring) runs without daily intervention
- Dashboard provides complete operational visibility without needing to check external tools
- Human-in-the-loop interventions are clearly surfaced with all context needed to act quickly

### Key Performance Indicators (KPIs)

- **Revenue per account**: Monthly affiliate revenue tracked per email account
- **Content production rate**: Videos produced per day across all content types
- **Account health rate**: Percentage of active, non-flagged accounts across platforms
- **Engagement rate**: Views, likes, comments, shares per post by platform and content type
- **Cost per content unit**: Total AI API + infrastructure cost per published video
- **System uptime**: Platform availability and workflow success rate
- **Time-to-publish**: Average elapsed time from content trigger to live post

## Scope — Full System

This is not an MVP. The full system is being built in phased delivery order based on dependencies, but no features are being cut. Every system described below is in scope.

### System 1: Account Infrastructure

**Email Account Management**
- Register accounts by adding email + password to the system
- Support for 1,200–1,500 email accounts, scalable beyond
- Per-account data model: profile info, platform credentials, niche tags (multi-niche), AI avatars (multiple per account), branding assets (banners, avatars per platform), language setting, content history, performance metrics, revenue tracking

**Account Asset Management**
Each account is a rich entity with assignable, trackable assets:
- Branding packages (logos, color schemes, fonts, templates per platform)
- AI avatars and characters (multiple per account, swappable)
- Common scenery/backgrounds (reusable across videos for visual consistency)
- Voice/sound profiles (specific voices, audio presets per character)
- Affiliate product pools — each channel/account has a pool of affiliate products/links it can draw from when generating content
- All assets are linkable, swappable, and trackable per account through the dashboard

**Channel-as-Identity Model (Critical Architectural Concept)**
A channel is NOT just a language endpoint — it is a **complete content identity**. Content is created FOR a specific channel based on that channel's full identity profile:
- Primary language
- Niche(s) and content themes
- Characters/AI avatars assigned to that channel
- Branding and visual style
- Voice/sound profiles
- Tone, style, and personality
- Affiliate product pool
- Target audience
- Posting cadence and schedule
- Platform (YouTube, TikTok, Instagram, Facebook)

Content generation always starts from a channel's identity. The system does not produce generic "language X" content and find a matching channel — it produces content **for Channel X** which embodies all of that channel's characteristics.

**Multi-Language Channel Families**
When the same channel concept is intentionally replicated across languages (e.g., "Funny History" exists as English, Spanish, and French versions), each language version is its own distinct channel with:
- Its own channel identity profile
- Its own audience and cultural adaptation
- Its own performance tracking
- A family relationship linking the variants for coordination
- Shared core concept but independently tailored content

**Multi-Channel Support (YouTube)**
- Each social account can have multiple YouTube channels (not just one)
- Each channel has a primary language assignment
- Playlist assignment per channel during upload
- Channel metadata tracking (name, handle, subscriber count, thumbnails)
- Channel health validation before distribution
- Manual channel override available during content distribution

**Social Account Lifecycle**
- Auto-detect existing social accounts per email
- Automated account creation with browser automation (Playwright) and human-in-the-loop when required (CAPTCHA, phone verify)
- Platforms: YouTube, TikTok, Instagram, Facebook

**Session & Anonymity Management**
- IP rotation before every login via residential proxy service
- Error detection → rotate IP → retry logic
- Dynamic credential injection into workflows before execution
- Scheduled research workflows to stay ahead of platform detection methods

**Account Warming**
- Automated browsing, liking, commenting, searching (platform-appropriate behavior)
- Variable duration (5–300 minutes)
- Status tracking: warming / idle / producing content
- Runs when accounts are not actively posting or creating content

### System 2: Content Pipeline

**Content Types**
- Text, images, video (short-form, long-form), voice-overs/narrations
- Video subtypes: UGC, sales, entertainment, faceless, storytelling, animated, talking head, slideshow, demo/tutorial, testimonial, 4th-wall-breaking, vlog, affiliate sales
- Ability to add new content types dynamically

**Content Generation (Modular Architecture)**
- Platform-specific workflow modules (YouTube long/short, TikTok, Instagram Reels/Stories, Facebook)
- Each workflow assembled from reusable tagged modules — no duplication
- Content purpose tags: entertainment, sales, educational, comedy, motivational, cinematic, mimic, shorts, multi-shot/scene
- Multi-language support: content generated in the language of the target account (English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi)

**Content Configuration Interface**
- Topic/subject input
- Industry/niche specification
- Target audience definition
- Tone selection
- Keywords (comma-separated)
- Video output mode: voice-over only vs. mouth mimicry (lip-sync)
- Channel distribution: single, multiple, or all channels
- Video production workflow selection (animated, talking head, slideshow, story-driven, demo, testimonial, sales, 4th-wall-breaking)
- Custom duration control
- Script/dialogue input
- Character descriptions
- Animation style selection

**Multi-LLM Strategy & AI Service Registry**
- **AI Service Registry**: Central registry of all AI providers with credentials, capabilities, rate limits, health status, and cost tracking. New models are added to the registry as they become available — the system is designed to continuously expand its model roster.
- **Sequential model selection with fallback**: The system selects the best model for a task based on KPIs and historical performance. If that model produces subpar output (low quality score, user rejection, or failure), the system falls back to the next-best model and tries again. This is one model at a time, not parallel generation.
- **Model selection informed by**: operator feedback (human-in-the-loop rejections/approvals), automated quality scoring, historical KPIs per model per content type, cost constraints, and availability
- Text generation: GPT, Claude, DeepSeek, Ollama (self-hosted) — and new models as they emerge
- Image generation: Nano Banana, DALL-E, Midjourney, Stable Diffusion, Flux, Freepik — and new models as they emerge
- Video generation: Sora, Veo3, Kling, Runway, Pika, Luma — and new models as they emerge
- Voice synthesis: ElevenLabs, NaturalReaders, OpenAI TTS, PlayHT — and new models as they emerge
- **Dynamic model selection**: Algorithm considers performance scores, cost-per-quality ratio, current availability, and task-specific suitability
- **Fallback chains**: If primary model produces rejected output → try next-best model; if model fails entirely → circuit breaker → automatic failover
- A/B testing framework across providers per task type (over time, not simultaneously per content piece)
- Cost tracking per usage per model with budget alerts
- Rotation of models over time until best process is identified per content type
- **Prompt optimization system**: Templates per content type, negative prompt database, prompt quality scoring, iterative improvement
- **Quality assessment per output**: Automated scoring (1–10) on technical quality, content appropriateness, and engagement potential — low scores trigger fallback to next model or regeneration with improved prompt

**A/B Testing & Learning System**
- Create and manage A/B test campaigns with multiple content variations
- Automatically split distribution between test variations with configurable ratios
- Track performance metrics per variation in real-time
- Statistical significance testing to determine winning variations
- Auto-promote winning variations and deprecate losing ones
- Learn from test results and apply insights to future content generation (feeds into adaptive approval gates)
- Knowledge base of successful content patterns and strategies
- Multi-variate testing for complex content variations
- Test history with rollback to previous winning variations
- Machine learning models for content performance prediction

**Content Repurposing**
- Long-form → short-form automatically
- YouTube → Shorts, TikTok, Reels, Stories
- Cross-platform format adaptation (dimensions, hashtags, descriptions, titles)
- One version of every video shared to AiRevStream Facebook Page

**Free & Paid Production Tools — Open-Source First**
- **Core principle**: Maximize use of open-source/free AI tools for all generation tasks. Use paid APIs only when open-source cannot match required quality. This minimizes operational costs and enables rapid scaling.
- Free/Open-source: ComfyUI, CivitAI, OpenArt, Ollama (local LLMs), Stable Diffusion, Flux
- Paid (when quality demands it): Veo3, Gemini, Nano Banana, Sora, Kling, Runway, Midjourney, ElevenLabs
- GPU rental integration: SimplePod, RunPod for heavy rendering batches

### System 3: Cinematic Video Production Studio

**Production Philosophy**
- Every video is treated as cinema, not "content"
- Sound drives emotion; visuals serve the story
- Audio is post-process — never baked into visual generation
- AI visuals can be imperfect; cinematic audio forgives everything
- **Image-first video production**: Generate still images FIRST, iterate and approve them, THEN animate into video. This is cheaper, gives more control, and avoids wasting expensive video generation on bad compositions. Text-to-video directly is a last resort.
- **Asset-factory approach**: Generate controllable assets separately (characters, environments, motion plates, clean dialogue), then composite. Never try to force one model to produce everything in one shot. This enables re-cutting, re-timing, and re-mixing without full regeneration.
- **Open-source first**: Use free tools by default, paid APIs only when quality demands it
- **Every shot is a reproducible job**: ShotSpec → prompts/references → generation queue → QC gates → publish. Deterministic with pinned seeds, pinned model versions, and versioned workflow JSON.
- **Programmatic video creation is the core differentiator**: The pipeline must be designed so AI agents can autonomously produce high-quality video with minimal human intervention — structured inputs, deterministic generation, automated QC, and machine-readable artifacts throughout.

**Cinema Bible (Preproduction Artifacts)**
Before any content is generated for a channel, a versioned "cinema bible" must exist:
- **Look Bible**: Style references, lighting rules, grain/sharpness stance, lens kit, aspect ratio, camera language
- **Character Bible**: Identity anchors (front/3/4/profile turnarounds), wardrobe palette, "never change" list (hair, scars, accessories), voiceprint constraints
- **Environment Bible**: Location motifs, time-of-day rules, practical lights, weather continuity
- **Prompt Bible**: Canonical prompt blocks — global style block (constant across project), character block (per character), shot block (per shot), negative block (project-wide artifact bans)
- **ShotSpec Template**: Every shot defined as a job ticket with: prompt blocks, references, seeds, model/LoRA versions, target duration, fps, resolution, camera/lens/movement, lighting, audio plan

**ComfyUI as Asset Factory**
- Node graphs with explicit seed, steps, CFG, and denoise controls for deterministic, repeatable generation
- Workflow JSON files versioned in code — treat "look recipes" as code
- ControlNet for spatial conditioning: pose continuity, camera geometry, object placement, depth separation
- LoRA adapters for character identity (face/wardrobe) and style consistency; multiple LoRAs chained with adjustable strengths
- Two-stage upscaling: ESRGAN for detail reconstruction → controlled re-denoise (low denoise) for coherent detail without identity drift
- Denoise parameter = identity drift knob: too high = different actor, too low = blurry truth

**Asset Relationship Graph**
All production assets tracked with explicit relationships:
- Project → Sequence → Shot → ShotSpec
- ShotSpec → Prompt Blocks, Reference Images, Workflow JSON, Model/LoRA Versions
- Shot → Plate Video, Keyframe Images, Matte Passes, Audio Stems, Comp Renders
- Sequence → Edit Timeline → Master Deliverables
- ComfyUI workflow metadata embedded in generated images for full traceability

**AI Production Agent Team**
Each agent is a domain expert with a continuously updated knowledge base:

- **Script Agent**: Writes scripts with beat tags, emotional arcs, affiliate integration, human psychology principles
- **Shot Director Agent**: Generates shot lists, camera movements, scene compositions; knows which AI video tools handle which movements best
- **Storyboard Agent**: Creates/selects images per shot using multiple LLMs (Reve, Nano Banana, Flux, DALL-E); manages approval queue
- **Sound Designer Agent**: Maps beats → audio presets, auto-ducking, shot-aware SFX placement; outputs SoundPlan JSON
- **Animation Agent**: Sends storyboard frames to video LLMs (Sora/Veo3/Kling); manages consistent character identity across scenes
- **Editor/Assembler Agent**: Remotion-based assembly — layers video + audio + overlays + text
- **QC Agent**: Loudness compliance, layer count validation, retention optimization, dialogue intelligibility checks
- **Human Psychology Agent**: Expert in sales psychology, copywriting, script writing; ensures content hooks viewer, maintains attention, drives clicks (buy/subscribe/consume); integrates into scripts, overlays, descriptions, scene shot prompts

**Cinematic Audio System**
- 8 emotional presets: Intimate, Tension, Power, Awe, Psychological, Emotional, Momentum, Calm
- JSON-driven CinematicBeatSoundPlan schema — the contract between all agents
- 10 cinematic sound layers: dialogue (anchor), subconscious bed, psychological pressure, camera movement sounds, fourth-wall sounds, environmental world, foley, impact/transitions, musical score, intentional silence
- Auto-ducking based on dialogue RMS analysis
- Shot-aware SFX (push-in = whoosh, whip = hard whoosh, cut = tick)
- Rule-based + LLM-assisted beat tagging from script text
- Retention sound cadence: micro accents every 15s, chapter pivots every 60s, palette resets every 3–5 min

**Rendering Engine: Remotion**
- Audio as code — frame-accurate placement, layering, fades, volume automation
- @cinematic/audio-engine reusable package (RenderAudio, RMS envelope, ducking, beat tagger, shot-aware SFX, preset map)
- Platform-specific loudness-compliant export (YouTube: -14 LUFS, TikTok/IG: -14 to -12 LUFS, true peak -1.0 dBTP)
- Two-pass FFmpeg loudnorm for best quality
- Stem exports (dialogue, music, SFX) alongside final mix
- Scales from 7-second reels to 90-minute feature films
- Act-based audio logic for long-form (Act I: discovery, Act II: conflict, Act III: resolution)

**Hyper-Detailed Timestamped Scripts for Lip-Sync**
Every piece of content involving lip-sync must be accompanied by a production-grade timestamped script that includes:
- Dialogue with precise start/end timing per line
- Background, foreground, and midground audio cues with timing (BG/MG/FG layer model)
- Emotional tone markers per beat (ties into the 8 cinematic audio presets)
- Character expression and movement direction notes per shot
- Camera motion sync points (so whooshes, cuts, and movements align)
- This script serves as the single source of truth that all downstream agents (animation, sound, editor) consume — ensuring perfect alignment between audio, video, expressions, and motion

**Viseme-Based Lip Sync Pipeline**
- Generate final dialogue audio FIRST (WAV, consistent sample rate)
- Derive mouth motion from visemes (visual phonemes) — 15-target viseme set interpolated over time
- Map visemes to character face rig (blendshapes or 2D mouth targets)
- Never time-stretch dialogue after viseme extraction without regenerating curves
- Supports both 2D workflows (Rhubarb Lip Sync-style timing data) and 3D workflows (blendshape-driven)
- Lock fps/timebase to prevent audio-video sync drift

**Color Management: ACES Pipeline**
- Industry-standard ACES (Academy Color Encoding System) for consistent color across shots and deliverables
- All shots graded within the same color pipeline — no accidental gamut clipping
- Ensures shots from different AI models and different generation sessions look like one film

**Content Provenance (C2PA)**
- Attach Content Credentials (C2PA standard) to generated content where feasible
- Cryptographically verifiable provenance: which tools, which models, which edits
- Increasingly required by platforms; design for it now rather than retrofitting
- Model provenance capture: model name, version, license terms, source hub
- Workflow provenance: ComfyUI workflow JSON + seeds + node versions

**Three-Stage QC Gates**
- **Pre-Gen QC** (before spending compute): ShotSpec complete? Character constraints explicit? Reference pack present for high-continuity shots?
- **Gen QC** (immediately after generation, per shot): Duration/fps correct? Face ID stable across frames? Wardrobe/props stable? No hand/eye/physics artifacts?
- **Post QC** (after comp + grade + mix): Color pipeline consistent? Dialogue intelligible? Loudness targets met? No clipping? Provenance/disclosure satisfied?

**Common Failure Modes (Agent Troubleshooting Knowledge)**
- Character identity drift → stronger reference conditioning, lower denoise, reduce competing LoRAs, lock seeds
- Temporal flicker → reduce high-frequency detail in base pass, add detail in controlled comp
- Motion blur mismatches → standardize camera/shutter choices, use vector-based blur in comp
- Audio-video sync drift → lock fps/timebase, regenerate viseme curves if dialogue is time-stretched

**Multi-Language Video Generation (Two Modes)**
- Mode 1: Multiple Videos — one video per language with lip-sync matching each language's audio
- Mode 2: Single Video with Multi-Language Audio — one base video with multiple audio tracks (one per language)
- Language variant parent-child tracking in database
- Per-language cost tracking
- Character voice mapping per language (same character, language-appropriate voice)

**Video Production Pipeline**
1. Big idea & scripting (human psychology agent integration, channel identity drives concept)
2. Shot list generation (camera movements, compositions)
3. **Storyboard generation & editing** — formal storyboard system with:
   - Scene-by-scene AI image generation (multiple LLM options, 3 variations per prompt)
   - Drag-and-drop storyboard editor UI
   - Video style recommendations per platform and niche
   - Scene transition recommendations (cuts, fades, wipes — matched to emotional beats)
   - Duration recommendations per platform (YouTube long-form vs. TikTok 60s vs. Reels 30s)
   - Default video creation presets (cinematic, educational, comedy, sales, etc.)
   - Storyboard review and approval workflow (human checkpoint before video generation)
4. AI animation (upload approved storyboard frames as starting frames, add dialogue prompts, use reference images for character consistency)
5. Final video assembly via Remotion (video + audio layers + overlays)
6. QC pass (loudness, retention optimization, quality check)
7. **Content approval interface** — formal approval system with:
   - Visual preview of finished content with all metadata
   - One-click approve/reject/regenerate
   - Bulk approval for trusted content types
   - Feedback and modification requests with inline annotations
   - Content version control and comparison (side-by-side diff of iterations)
   - Revision workflows with change tracking
   - Collaborative review support (future SaaS feature)
8. Publish to calendar (routed to the specific channel the content was created for)
9. Track engagement & iterate

**AI Avatar System**
- Multiple AI avatars per email account
- Image panel: face, face-to-waist, full body — each with reference images and generation prompts
- Physical, mental, emotional descriptions for character consistency
- HeyGen integration for avatar creation
- ElevenLabs voice cloning per avatar
- Consistent character identity maintained across scenes via reference images
- **Avatar creation methodology**:
  - Multi-angle generation: face close-up, face-to-waist, full body front, full body back
  - Trait locking: consistent features (gender, age, hair, skin tone, eye color, face shape) across all generated variations
  - Photography-grade prompts: 85mm f/1.4, shallow depth of field, studio lighting, visible skin texture
  - 3 variations generated per prompt — operator selects best, then iterates conversationally ("make this a close-up," "add freckles")
  - Avatar panel in dashboard: create, update/modify, view all angles, assign to channels

**Thumbnail Creation**
- Research thumbnails of most viral content in niche
- AI-generated thumbnail images + text overlay
- **Thumbnail science**: 60-30-10 rule (60% content visual, 30% brand elements, 10% logo)
- Faces with strong emotion increase CTR 20–30%
- High contrast colors optimized for mobile (yellow/black, blue/orange)
- Text limit: 5–6 words maximum for mobile readability
- 2–3 variations per video for A/B testing
- Train AI model on successful thumbnail patterns in niche

**Structured Prompt Engineering System**
- Not ad-hoc prompting — a formalized methodology used by all production agents
- **Advanced prompt formula**: Subject (with description) + Action + Scene (with description) + Camera Movement + Lighting + Style + Audio
- Negative prompts database (quality issues, anatomical problems, visual artifacts, unwanted effects)
- Platform-specific prompt adaptation (different models need different prompt styles)
- Prompt libraries: successful prompts cataloged, tagged, and reusable across projects
- Iterative refinement: first output → evaluate → refine systematically → test variations
- One action per prompt rule (multiple actions confuse AI models)

**Content Retention Architecture (H.I.C.C. Framework)**
- Applied to all viewer-facing content by the Human Psychology Agent:
  - **Hook** (0–5s): Pattern interrupt, open loop, or unexpected visual
  - **Intro** (5–30s): Value proposition — why keep watching
  - **Content** (bulk): Deliver on promise with micro-hooks every 60–90s maintaining engagement
  - **Call-to-action**: Placed at peak tension/value delivery moment
- Target retention: 50–60% (good), 70%+ (exceptional) — vs. YouTube average of 23.7%
- Post-overstimulation era pacing: clarity over speed, 23 cuts per 60s max, purposeful pacing
- Burned-in captions required on all short-form (15–25% retention increase)

### System 4: Distribution & Publishing

**Content Distribution Logic**
- Content is always created FOR a specific channel — distribution routes it to that channel's platform account
- Operator can also push content to: multiple channels (within the same niche family), all channels in a niche, or manually selected channels
- When distributing to multi-language channel families: content is culturally adapted per channel, not just translated
- Every video also shared to AiRevStream Facebook Page
- Content bundled in labeled files, stored in local storage, linked back to master database

**Smart Scheduling**
- Per-channel posting cadence (configurable min/max daily/weekly/monthly)
- Intelligent scheduling based on audience activity data and optimal posting times
- Platform-specific timing optimization (different best-times for YouTube vs. TikTok vs. Instagram)
- Platform-specific rate limit respect
- Failed post retry logic with error handling
- Queue management with priority system

**Content Calendar**
- Per account, per platform tracking
- Status flow: pending → posted → archived
- Archived content compressed and moved to storage
- Live scheduled posts monitoring with real-time status
- Post queue management

### System 5: Database & Storage

**Database: PostgreSQL**
- Structured relational data with JSONB columns for flexible schema (avatar configs, prompt history, workflow metadata)
- Full-text search built in
- Prisma ORM for TypeScript type safety
- Tables for: email accounts, social accounts, content, workflows, niches/keywords/hashtags, AI avatars, affiliate products, LLM registry, server status, human-in-the-loop tasks, posting calendar, logs/notifications, content performance

**Storage: Local (Mac Studio) + MinIO**
- 16TB local storage as primary
- MinIO (S3-compatible) running locally for API-based access and future cloud migration path
- All generated content stored post-publish
- Organized by account, niche, content type, date

**Business Intelligence**
- Revenue tracking and attribution per account, per niche, per content type, per affiliate product
- Profit margin analysis (revenue vs. AI API costs + infrastructure)
- ROI calculations per channel, per workflow, per content type
- Content creation efficiency metrics (time to produce, cost per unit, quality scores)
- Audience growth tracking with demographic insights and behavioral patterns
- Engagement trend analysis with pattern recognition
- Predictive analytics and performance forecasting
- Cross-platform content performance comparison
- Workflow cost tracking (cost per run, updated as workflows/LLMs adjusted)
- Competitive benchmarking against industry performance
- Opportunity identification based on trend/gap analysis
- Custom reporting with export (CSV, JSON, PDF)

**Data Compliance**
- GDPR/CCPA compliant: configurable data retention (default 90 days)
- Right to deletion (permanent)
- Data portability (export functionality)
- PII detection and masking in all logs and exports
- Comprehensive audit trails for all data access

### System 6: Affiliate Marketing Engine

**Affiliate Product Management**
- Input: add affiliate URL to product database
- AI agent investigates product URL, creates product description
- Human psychology workflow creates sales angle per niche/audience
- Link shortener creates trackable shortened URLs
- Links integrated as: watermark, description, narration mention, text overlay (configurable)

**Two-Mode Affiliate Video Integration**
1. **Dedicated product video**: Entire video sells the affiliate product, on-brand for the channel
2. **Commercial break embed**: Regular channel content with an integrated "sponsor" segment — character stays in-brand while pitching (e.g., stick figure farming channel pitching socks: "today's sponsor... socks... as we all know stick figures need socks...")

**Affiliate Messaging Configuration**
- Custom call-out text
- In-story callout woven into content
- Character-driven affiliate messaging toggle
- Frequency control: number of times to show, interval in minutes
- Affiliate link appears as on-screen overlay and in video description by default

**Per-Channel Branded Storefronts**
- channel_name.flashshop.com for each channel
- Decorated with channel's main character/avatar
- Digital products: coloring books from episodes, flash cards, study guides, RemNote-style study systems
- Affiliate product links
- Default merchant account for 24/7/365 sales
- AI sales agent per store: knows products, knows channel content, responds in character

### System 7: AI Assistant / Command Center

**Conversational Interface**
- Natural language chat with full system state awareness
- Multi-turn conversation with persistent history
- Context-aware responses based on current page/system state
- Response streaming for real-time feedback
- Searchable conversation history
- Integration with AI Service Registry for LLM selection

**Knowledge Base**
- System documentation, code, and API reference integration
- Content memory for historical data access
- Real-time system state awareness (workflows, accounts, content status)
- Contextual knowledge injection into LLM prompts
- Knowledge base search and ranking algorithms
- RAG-powered efficient retrieval

**Action Execution System (4-Tier Safety)**
- **Tier 1 — Read-only**: No approval needed (view data, check status, read reports)
- **Tier 2 — Low-risk**: Simple confirmation dialog (start a workflow, update a setting)
- **Tier 3 — Medium-risk**: Explicit approval with review (modify account data, change schedules, bulk operations)
- **Tier 4 — High-risk**: Multi-step approval with admin verification (delete data, change credentials, deploy changes)
- Action execution registry with all available system operations
- Rollback strategy identification per action type, with rollback execution and verification
- Comprehensive audit logging with PII masking (GDPR/CCPA compliant)
- Batch operation support with partial failure handling and batch status tracking
- Transaction support for multi-step atomic operations

**Self-Discovering Architecture**
- The assistant auto-discovers available system capabilities by scanning API routes, extracting JSDoc documentation, and reading parameter schemas — no manual configuration needed
- As the codebase evolves and new features are built, the assistant automatically learns what it can do
- Runtime capability detection verifies which APIs are actually available and healthy
- API usage analytics track which capabilities are used most and how effectively
- This means the assistant grows smarter as the system grows, without requiring manual updates to its knowledge of available actions

**Proactive Intelligence**
- Context-aware suggestions based on current page/system state
- Performance optimization recommendations
- Workflow optimization suggestions
- Content optimization recommendations
- Account health alerts
- Cost optimization suggestions
- Trend analysis and predictive insights
- Learning from user patterns and preferences
- Input deduplication — filters ideas for redundancy before implementing

**Role as Executive Assistant**
- Filters all operator ideas: understands input, determines redundancy, gives feedback
- Helps improve input before implementation
- Plans, delegates to, and creates sub-agents/workflows when necessary
- Keeps the business running smoothly, efficiently, and to the best of its abilities
- Well-versed in all workflows, automations, and system architecture

### System 8: Research & Optimization Engine

**Specialized AI Agent Knowledge Bases**
Each domain-expert agent maintains a living, continuously updated knowledge base:

| Domain | Scope | Update Method |
|---|---|---|
| Platform Operations | Full system architecture, workflows, metrics | Auto-updated as system evolves |
| CivitAI | Models, LoRAs, checkpoints, community workflows | Scheduled crawls of community, docs, releases |
| Remotion | API, features, plugins, rendering optimization | GitHub releases, changelog monitoring |
| Hugging Face | Models, spaces, datasets, inference APIs | Scheduled research, new model alerts |
| ComfyUI | Nodes, custom nodes, workflow patterns, compatibility | Community forums, GitHub, YouTube |
| AI Video Production | Sora, Veo3, Kling, Runway capabilities & pricing | Tool update monitoring, community best practices |

**Continuous Research Workflows**
- Niche-relevant news, trends, best practices
- Platform-specific strategy research (Instagram growth, TikTok algorithms, YouTube retention)
- n8n community and YouTube workflow pattern discovery (for inspiration, even though not using n8n)
- LLM capability tracking and best-use-case mapping
- MCP server discovery and creation
- Admin-input research: keyword/niche/URL fed to relevance grading
- Scheduled search term and URL database maintenance with deduplication
- Relevance grading: helpful (feed forward) vs. ignore (with reasoning)

**Competitive Intelligence & Market Analysis**
- Comprehensive competitor monitoring across all platforms
- Competitor content performance tracking and pattern identification
- Market trend analysis and industry benchmark tracking
- Competitive gap identification and strategic opportunity alerts
- Competitive intelligence reports with actionable insights
- Market positioning analysis and recommendations

**Cost Management & Optimization**
- Comprehensive cost tracking across all AI services and infrastructure
- Intelligent cost optimization algorithms with actionable recommendations
- Real-time cost monitoring with budget alerting and threshold notifications
- Cost analytics, forecasting, and budget planning
- Automated cost optimization (e.g., shifting non-urgent tasks to cheaper models)
- Cost reporting dashboards with per-workflow, per-model, per-account breakdowns
- ROI tracking: cost per content piece vs. revenue generated

**Content Suggestion Engine**
- Track KPIs on everything: prompts, languages, workflows, LLMs, images, videos, scripts, avatars, overlays, camera shots, visual hooks, descriptions
- Analyze trending/viral content per platform
- Score and categorize every element of popular content
- Platform-specific optimization: titles, hashtags, descriptions, video length, video size, posting times
- A/B testing framework for content optimization
- Performance prediction via machine learning
- Real-time optimization suggestions during content creation

**Prompt Optimization Workflows**
- Image prompt improvement and testing
- Text prompt improvement and testing
- Video prompt improvement and testing
- Understand → improve cycle

**Skills Development**
- Assess workflows and system tasks for repetitive processes
- Identify processes that benefit from formalization as reusable skills
- Create skills with descriptions and tags for easy reference
- Performance tracking per skill

**MCP Assessment**
- Assess workflows, user requests, and system tasks for MCP opportunities
- Search for existing MCPs; create custom MCPs when unavailable
- Ensure all workflows have triggers for AI agent and MCP invocation

### System 9: Infrastructure & Resource Management

**Mac Studio as Primary Server (M3 Ultra, 512GB RAM, 16TB)**

| Service | Est. RAM | Purpose |
|---|---|---|
| PostgreSQL | 8–16 GB | Primary database |
| Next.js Dashboard | 2–4 GB | Command center UI |
| Workflow Engine | 4–8 GB | Custom orchestration |
| Ollama (2–3 models) | 40–120 GB | Local LLM inference |
| Playwright (10+ contexts) | 10–20 GB | Browser automation |
| BullMQ Workers | 4–8 GB | Job queue processing |
| MinIO | 2–4 GB | S3-compatible local storage |
| AI Assistant Service | 4–8 GB | Conversational interface |
| **Total** | **~75–190 GB** | **300+ GB headroom** |

**Resource Monitoring & Allocation**
- Real-time usage statistics dashboard
- Target: 95% utilization with crash prevention buffer
- Priority hierarchy (highest to lowest):
  1. Content production/scheduling workflows
  2. Social account creation workflows
  3. Research workflows
  4. Account warming workflows
  5. System update workflows
  6. Other workflows
- Auto-pause lower-priority work for critical/time-sensitive tasks

**Cloud Services (Minimal — Only What Can't Self-Host)**
- AI video generation APIs (Sora, Veo3, Kling, Runway) — require vendor cloud
- Residential proxy/IP rotation service
- GPU rental (RunPod/SimplePod) for ComfyUI/Stable Diffusion heavy batches if needed

**AWS Lambda Integration**
- Identify workflow steps that benefit from serverless execution
- Lambda configuration schema generation
- Cost optimization through serverless where appropriate

**Human-in-the-Loop Tracking**
- Dedicated tracking: task name, process description, what human needs to do, hyperlinks, content needed
- Database triggers to resume paused workflows after human action

**Workflow Management**
- All workflows fully connected with real parameters (not stubs)
- Built with efficiency, modularity, and iterability in mind
- No bloat, no redundancy
- Tagged for easy cataloging and performance tracking
- Descriptions on every workflow
- Before building any workflow: research best practices, find YouTube examples, gather ideas
- Use MCP servers when possible for proper builds and configurations
- Workflow reference tracking: URL, description, output, keywords, nodes, integrations

**Real-Time Monitoring & Observability**
- Comprehensive metrics collection: infrastructure, application, and business metrics
- Real-time monitoring dashboards with customizable views
- Structured logging with proper categorization and severity levels
- Distributed tracing for workflow execution and API requests
- Performance anomaly detection
- Audit logging for compliance and security

**Automated Alerting & Escalation System**
- Intelligent alert routing and escalation based on severity and context
- Multi-channel notification delivery: email, Slack, SMS, webhook, dashboard
- HMAC-signed notifications for security
- Alert deduplication and correlation to prevent alert storms
- Alert suppression for maintenance windows
- Acknowledgment and resolution tracking
- Alert analytics for effectiveness optimization
- **Escalation policies**: Multi-step time-based routing — if alert isn't acknowledged within X minutes, escalate to next channel/recipient
- **On-call schedules**: Basic rotation support determining active recipient(s) per escalation step
- **Delivery logs**: Full history with status, attempts, latency, and errors

**Error Handling & Resolution System**
- Errors categorized by type, severity, and source with unique identifiers
- Comprehensive structured error logs with context
- Pattern recognition for recurring errors
- One-click resolution for common errors
- AI-powered resolution suggestions based on error patterns
- Error prediction before they occur using pattern analysis
- Prevention measures suggested and automatable
- Error resolution tracking with success rate monitoring

**Version Management**
- System component versions tracked with unique identifiers and metadata
- Version compatibility checking between components
- Safe rollback with data integrity preservation
- Version comparison with detailed diffs
- Compatibility issue auto-detection and reporting

**Real-Time Workflow Monitoring**
- Execution status dashboard
- Progress tracking and ETA calculations
- Error monitoring and alerting
- Resource usage monitoring per workflow

## Technical Decisions

### Tech Stack

- **Language**: TypeScript everywhere (frontend, backend, scripts, tooling)
- **Frontend**: Next.js + React with shadcn/ui + Tailwind CSS
- **Backend**: Next.js API routes + standalone Node.js services for long-running work
- **Database**: PostgreSQL with Prisma ORM, JSONB for flexible schema
- **Job Queue**: BullMQ for managing account operations and content workflows
- **Browser Automation**: Playwright with stealth plugins
- **Local LLMs**: Ollama (runs on Mac Studio M3 Ultra)
- **Video Rendering**: Remotion (programmatic, audio as code)
- **Local Storage**: MinIO (S3-compatible interface)
- **Image/Video Gen**: ComfyUI locally + cloud APIs (Sora, Veo3, Kling, Runway, etc.)

### Architecture Principles

- **API-first design**: Clean backend APIs consumed by the frontend dashboard; enables SaaS transition
- **Convention over configuration**: Sensible defaults everywhere, advanced options available but not required
- **Two orchestration layers**: System orchestration (accounts, scheduling, distribution) and Production orchestration (per-video agent pipeline) — cleanly separated
- **Modular services**: Each system is independently deployable; AI agents can work on isolated pieces
- **Strong typing**: TypeScript + Prisma provides end-to-end type safety
- **Non-developer friendly UI**: Every operation available through the visual dashboard — no terminal, no config files
- **AI-developer friendly codebase**: Clean, well-documented, consistent patterns so Claude and other AI coding agents produce reliable code

### Comprehensive Dashboard & UI (Critical — This IS the Product for the Operator)

The dashboard is not an afterthought — it's the primary interface through which a non-developer runs an entire business. It must be:

**Core Dashboard Views:**
- **Home/Overview**: Real-time system status, today's publishing queue, account health summary, revenue snapshot, pending approvals count
- **Account Manager**: All email accounts with connected socials, health status, niche tags, channel identities, asset assignments
- **Content Calendar**: Visual calendar with drag-and-drop scheduling, filterable by email account, channel, language, platform, niche; color-coded by language or channel; grouped language variants
- **Content Creation Wizard**: Step-by-step guided content creation with AI assistance, template suggestions, platform optimization, real-time preview
- **Content Library**: Search/filter by type, model, status, performance; thumbnails/previews; AI model attribution
- **Analytics Dashboard**: Cross-platform performance, engagement trends, revenue tracking, cost analysis, predictive insights, custom reporting with export (CSV, JSON, PDF)
- **System Health Dashboard**: Real-time component monitoring, performance metrics, resource utilization, intelligent alerting, diagnostics tools, capacity planning
- **Affiliate Manager**: Product catalog, link management, channel pool assignments, performance per product per channel, revenue tracking
- **AI Assistant Panel**: Conversational interface accessible from every page, context-aware to current view

**UX Requirements:**
- Responsive design for desktop, tablet, and mobile
- Keyboard shortcuts and drag-and-drop for power users
- Real-time updates via WebSocket (no page refreshes needed)
- Contextual help and onboarding tooltips
- Customizable workspace and widget layout
- Minimal clicks to key functions
- Notification center with actionable alerts

### Infrastructure

- **Primary**: Mac Studio M3 Ultra (512GB RAM, 16TB storage) running all core services
- **Cloud**: Only for external AI APIs, proxy services, and optional GPU burst
- **No n8n**: Fully custom workflow orchestration engine
- **No Google Sheets**: PostgreSQL + custom dashboard

## Constraints & Assumptions

### Constraints

- **Budget**: Optimize for low operational cost; leverage local compute and self-hosted LLMs where possible
- **Team**: Solo developer + AI coding agents — architecture must support this workflow
- **Timeline**: Phased delivery in dependency order; no artificial deadlines but move with urgency
- **Technical**: Mac Studio is ARM (M3) — all tools must be Apple Silicon compatible
- **Platform Risk**: Social media platforms may change APIs, detection methods, or ToS at any time

### Key Assumptions

- Residential proxy services will remain available and effective for account management
- AI video generation APIs (Sora, Veo3, Kling) will maintain or improve quality and reduce pricing over time
- The operator will be available for human-in-the-loop approvals during business hours
- Affiliate programs will continue to accept traffic from social media sources
- Remotion will continue to be actively maintained and support the required audio/video capabilities
- Ollama models running on M3 Ultra will provide sufficient quality for content generation tasks that don't require frontier models

## Risks & Open Questions

### Key Risks

- **Platform ban waves**: Mass account bans could wipe out significant infrastructure overnight; mitigated by tiered strategy (Flagship accounts are fully compliant, Tier 2 expects attrition, Tier 3 is owned properties)
- **AI detection evolution**: Platforms are improving detection of AI-generated content; mitigated by cinematic production quality, unique content per account, and continuous research into detection methods
- **Single point of failure**: Mac Studio as sole server; mitigated by regular backups and architecture that can migrate to cloud
- **API cost escalation**: Video generation API costs could increase; mitigated by multi-provider strategy, rotation, and local generation (ComfyUI) where possible
- **Scope complexity**: 9 interconnected systems built by one person + AI; mitigated by clean separation of concerns and phased delivery

### Open Questions

- Specific affiliate networks and programs to target first
- Niche selection priority for initial account clusters
- Proxy service provider selection and pricing
- Exact posting cadence targets per platform per tier
- Voice cloning legal considerations per jurisdiction
- Per-channel storefront implementation details (FlashShop integration or custom)
- Specific GPU rental thresholds (when local M3 Ultra isn't enough)

### Areas Needing Further Research

- Current state of browser automation detection across YouTube, TikTok, Instagram
- Optimal account warming patterns per platform (duration, activity types, frequency)
- Best self-hosted LLM models for script writing, content generation on M3 Ultra
- Remotion performance benchmarks for feature-length rendering on Apple Silicon
- ComfyUI custom node ecosystem compatibility with Apple Silicon
- Comparative quality/cost analysis across video generation APIs for different content types

## Tiered Account Strategy

### Tier 1 — Flagship Accounts (5–20 accounts)

- Fully legitimate, compliant with all platform ToS
- Real brand identities with official API integrations
- Monetization paths: YouTube Partner Program, TikTok Creator Fund, Instagram Shopping
- Highest content quality investment
- Long-term business assets

### Tier 2 — Niche Network (50–200 accounts)

- Niche-themed brand accounts across verticals
- Unique personas with distinct content styles
- Automated content creation with human-realistic posting cadence (2–4 posts/day)
- IP rotation, staggered activity, unique device fingerprints
- Bridge pages and owned landing pages for affiliate links
- Built to expect and recover from some attrition

### Tier 3 — Owned Properties (Remaining 1,000+ emails)

- Blogs, newsletters, landing pages, SEO properties
- Zero platform ToS risk — full control
- Social accounts in Tiers 1 & 2 drive traffic here
- Email lists as most durable asset
- Affiliate links live on properties you own

## Adaptive Human-in-the-Loop Approval Gates

The system uses a trust-based approval system that learns from outcomes and progressively grants autonomy:

**Gate Behavior:**
- **New/unproven workflows, LLMs, or content types**: Long approval gate window — human reviews everything before publishing, no auto-approval
- **Established track record with "wins"**: Window shortens progressively as the system demonstrates consistent quality
- **Fully trusted pipelines**: Near-instant approval or auto-publish with post-publish monitoring

**Outcome Tracking:**
- Every piece of content that passes through an approval gate gets its outcome tracked: engagement metrics, performance scores, audience response, revenue generated
- Increasingly better outcomes = shorter approval windows — the system earns autonomy through demonstrated results
- Poor outcomes trigger window expansion (system loses trust and requires more human oversight)

**Per-Dimension Trust:**
Trust levels are tracked independently across multiple dimensions:
- By content type (short-form may be trusted while long-form still requires review)
- By LLM/model (Claude scripts may be trusted while a new model is still gated)
- By workflow (image generation pipeline trusted, video pipeline still learning)
- By account tier (Tier 1 flagship content always reviewed, Tier 2 niche content may auto-publish)
- By niche (comedy content trusted, financial/health content always reviewed)
- By platform (TikTok posting trusted, YouTube long-form still gated)

**Approval Interface:**
- Clear visual queue of items awaiting approval in the dashboard
- All context needed to approve/reject shown inline (preview, metrics, confidence scores)
- One-click approve/reject/regenerate
- Batch approval for trusted content types
- Time-based auto-escalation if approval isn't given within the gate window

## Affiliate Link Management & Channel Pools

**Affiliate Product → Channel Assignment:**
- Affiliate products/links are assigned to channel pools
- Each channel/account has a pool of eligible affiliate products it can draw from
- Pool assignment based on niche fit (a fitness channel's pool contains fitness-related affiliate products)
- When content is generated for a channel, the system knows which affiliate products are eligible
- Operator can manually assign/remove products from channel pools, or the system can auto-suggest based on niche matching

**Content Integration:**
- During content generation, the system auto-selects an appropriate affiliate product from the channel's pool (or the operator chooses)
- Affiliate link appears in content via configurable placements: video overlay, description, narration mention, bio link
- Two integration modes (as described in Affiliate Marketing Engine): dedicated product video OR commercial break embed
- Affiliate rotation — system can cycle through a channel's product pool to avoid repetition
- Performance tracking per affiliate product per channel — identifies which products perform best on which channels

## Phased Delivery Order

The full system is built in logical dependency order. Each phase produces functional capability while building toward the complete vision.

**Phase 1 — Foundation**
- PostgreSQL database schema and migrations
- Next.js dashboard shell with authentication
- Email account management (CRUD, import)
- Basic social account registry

**Phase 2 — Account Operations**
- Playwright browser automation framework
- Proxy/IP rotation integration
- Account creation workflows (with human-in-the-loop)
- Account warming system
- Session management

**Phase 3 — Content Generation Core**
- Multi-LLM integration layer (Ollama local + cloud APIs)
- Text content generation workflows
- Image generation workflows (ComfyUI + cloud APIs)
- Content library and management

**Phase 4 — Video Production Pipeline**
- Remotion setup and @cinematic/audio-engine package
- Script agent with beat tagging
- Shot director and storyboard agents
- Sound designer agent with preset system
- Animation agent (cloud video API integration)
- Editor/assembler agent
- QC agent with loudness compliance

**Phase 5 — Distribution & Publishing**
- Content scheduling engine
- Platform-specific posting workflows
- Content calendar
- Distribution routing (single/multiple/niche)
- Content repurposing pipeline

**Phase 6 — Intelligence Layer**
- AI Assistant conversational interface
- RAG-powered knowledge base
- Content suggestion engine
- Research workflows
- Business intelligence dashboards

**Phase 7 — Affiliate & Monetization**
- Affiliate product management
- Link shortening and tracking
- Two-mode video integration
- Per-channel storefronts
- Revenue tracking per account/niche

**Phase 8 — Optimization & Scale**
- Specialized agent knowledge bases (CivitAI, Remotion, HuggingFace, ComfyUI, AI Video)
- Continuous research and self-improvement workflows
- Resource optimization and auto-scaling
- Skills and MCP development
- Prompt optimization pipelines

**Phase 9 — SaaS Preparation**
- Multi-tenant architecture
- User management and access control
- Billing and subscription system
- Onboarding flows
- API documentation for external developers

## Next Steps

### Immediate Actions

1. Review and approve this project brief
2. Transform into PM agent to create comprehensive PRD with epics and stories
3. Transform into UX Expert to create front-end specification (critical given non-developer user requirement)
4. Transform into Architect to create full-stack architecture document

### PM Handoff

This Project Brief provides the full context for AiRevStream MPCAS. The PM should use this to create a detailed PRD covering all nine systems, with epics organized by the phased delivery order and user stories that account for the non-developer operator persona. Special attention should be paid to the UI/UX requirements — this is the operator's entire interface to a complex system, and it must feel simple.

---

**Document Version**: 1.0
**Created**: March 16, 2026
**Author**: Mary (Analyst Agent)
**Status**: Draft — Awaiting Review
