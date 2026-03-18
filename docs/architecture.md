# Fullstack Architecture: AiRevStream MPCAS

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-16 | 1.0 | Initial architecture from approved brief, PRD, and front-end spec | Winston (Architect Agent) |

## Starter Template

N/A — Greenfield project. No starter template. Built from scratch using Next.js 14+ with TypeScript.

---

## 1. High-Level Architecture

### 1.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAC STUDIO M3 ULTRA                          │
│                   (512GB RAM / 16TB / Apple Silicon)                 │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐               │
│  │  NEXT.JS    │  │  STANDALONE  │  │  BACKGROUND  │               │
│  │  APP        │  │  SERVICES    │  │  WORKERS     │               │
│  │             │  │              │  │              │               │
│  │ Dashboard   │  │ Workflow     │  │ BullMQ       │               │
│  │ API Routes  │  │ Engine       │  │ Workers      │               │
│  │ WebSocket   │  │ AI Assistant │  │ ─ Content    │               │
│  │ Auth        │  │ Production   │  │ ─ Accounts   │               │
│  │             │  │ Pipeline     │  │ ─ Warming    │               │
│  │ :3000       │  │ :3001        │  │ ─ Research   │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                        │
│         └────────────────┼────────────────┘                        │
│                          │                                          │
│  ┌───────────────────────┼───────────────────────────────────┐     │
│  │                  DATA LAYER                                │     │
│  │  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌─────────────┐ │     │
│  │  │PostgreSQL│  │  Redis  │  │ MinIO  │  │   Ollama    │ │     │
│  │  │  :5432   │  │  :6379  │  │ :9000  │  │   :11434    │ │     │
│  │  │ Primary  │  │ Cache   │  │ S3-    │  │ Local LLMs  │ │     │
│  │  │ Database │  │ Queue   │  │ compat │  │ Llama3/etc  │ │     │
│  │  └──────────┘  └─────────┘  └────────┘  └─────────────┘ │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │                AUTOMATION LAYER                             │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │     │
│  │  │  Playwright  │  │   ComfyUI    │  │    Remotion     │  │     │
│  │  │  Browser     │  │   Asset      │  │    Video        │  │     │
│  │  │  Automation  │  │   Factory    │  │    Rendering    │  │     │
│  │  │  (stealth)   │  │   :8188      │  │    (CLI/API)    │  │     │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │   EXTERNAL SERVICES   │
                    │                       │
                    │ ● Cloud AI APIs       │
                    │   (Veo3, Sora, Kling, │
                    │    Runway, DALL-E,    │
                    │    ElevenLabs, etc.)  │
                    │                       │
                    │ ● Residential Proxies │
                    │                       │
                    │ ● GPU Rental          │
                    │   (RunPod/SimplePod)  │
                    │                       │
                    │ ● Social Platform APIs│
                    │   (YT, TT, IG, FB)   │
                    └───────────────────────┘
```

### 1.2 Two Orchestration Layers

**System Orchestration** (manages the business):
- Account lifecycle (creation, warming, health monitoring)
- Content scheduling and distribution
- Research and optimization workflows
- Resource allocation and priority management
- Alert routing and escalation

**Production Orchestration** (makes the content):
- Per-video agent pipeline (Script → Shot Director → Storyboard → Sound → Animation → Editor → QC)
- ShotSpec-driven job queue
- Multi-LLM sequential selection with fallback
- Three-stage QC gates
- Adaptive approval gates

These are cleanly separated — the system orchestrator triggers production jobs and monitors their status, but the production pipeline manages its own internal agent coordination.

### 1.3 Technology Stack Summary

| Layer | Technology | Justification |
|---|---|---|
| Language | TypeScript (everywhere) | One language across entire stack; best AI-agent coding support |
| Frontend | Next.js 14+ App Router | SSR + client, API routes, file-based routing |
| UI Components | shadcn/ui + Tailwind CSS | Accessible primitives, rapid iteration, consistent design |
| State | SWR + React Context | Lightweight server state caching + minimal client state |
| Real-Time | socket.io | WebSocket with automatic reconnection and fallback |
| Backend API | Next.js API Routes + standalone Express services | API routes for CRUD, standalone for long-running processes |
| ORM | Prisma | Type-safe DB access, migrations, introspection |
| Database | PostgreSQL 16 | JSONB, full-text search, rock-solid at scale |
| Cache/Queue Broker | Redis 7 | BullMQ backing store, session cache, rate limiting |
| Job Queue | BullMQ | Reliable job processing with priorities, retries, concurrency control |
| Object Storage | MinIO | S3-compatible, local, future cloud migration path |
| Local LLMs | Ollama | Runs on Apple Silicon, multiple models, zero API cost |
| Browser Automation | Playwright + stealth plugins | Multi-context, anti-detection, session persistence |
| Video Rendering | Remotion | Programmatic, deterministic, audio-as-code |
| Image Generation | ComfyUI | Node graphs, deterministic seeds, LoRA/ControlNet |
| Search | PostgreSQL FTS + pg_trgm | Built-in, no extra service needed |

---

## 2. Database Architecture

### 2.1 Schema Overview

PostgreSQL with Prisma ORM. JSONB used extensively for flexible schema where structure varies (avatar configs, prompt history, workflow metadata, platform-specific fields).

### 2.2 Core Entity Schemas

```sql
-- ============================================================
-- ACCOUNTS & CHANNELS
-- ============================================================

CREATE TABLE email_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_enc  TEXT NOT NULL,  -- encrypted with AES-256-GCM
  status        VARCHAR(20) DEFAULT 'pending', -- active, disabled, flagged, pending
  tier          VARCHAR(10) DEFAULT 'tier2',   -- tier1, tier2, tier3
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id  UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  platform          VARCHAR(20) NOT NULL, -- youtube, tiktok, instagram, facebook
  platform_user_id  VARCHAR(255),
  username          VARCHAR(255),
  credentials_enc   TEXT, -- encrypted platform tokens/cookies
  status            VARCHAR(20) DEFAULT 'pending', -- active, disabled, flagged, pending, needs_signup
  health_score      INTEGER DEFAULT 100, -- 0-100
  last_login_at     TIMESTAMPTZ,
  last_post_at      TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}', -- platform-specific fields
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_account_id, platform)
);

CREATE TABLE channels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  platform_channel_id VARCHAR(255), -- YouTube channel ID, etc.
  primary_language  VARCHAR(10) NOT NULL DEFAULT 'en', -- ISO 639-1
  family_id         UUID, -- links multi-language variants (self-referencing group)
  
  -- Identity Profile
  niches            TEXT[] DEFAULT '{}', -- array of niche tags
  tone              VARCHAR(50), -- comedic, educational, professional, etc.
  personality       TEXT, -- free-form personality description
  target_audience   TEXT,
  posting_cadence   JSONB DEFAULT '{}', -- { "min_daily": 1, "max_daily": 4, "best_times": ["10:00","16:00"] }
  
  -- Asset References
  cinema_bible_id   UUID, -- REFERENCES cinema_bibles(id)
  
  -- Platform-Specific
  platform_metadata JSONB DEFAULT '{}', -- subscriber count, handle, thumbnails, playlists
  
  -- Status
  status            VARCHAR(20) DEFAULT 'active',
  health_score      INTEGER DEFAULT 100,
  is_primary        BOOLEAN DEFAULT false,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_channels_social_account ON channels(social_account_id);
CREATE INDEX idx_channels_family ON channels(family_id);
CREATE INDEX idx_channels_niches ON channels USING GIN(niches);

-- ============================================================
-- ASSETS: AVATARS, BRANDING, SCENERY, VOICES
-- ============================================================

CREATE TABLE avatars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  
  -- Physical Description
  description     JSONB NOT NULL, -- { physical: {}, mental: {}, emotional: {} }
  trait_lock      JSONB DEFAULT '{}', -- locked traits for consistent generation
  
  -- Images (multi-angle)
  images          JSONB DEFAULT '{}', -- { face: {url, prompt, seed}, waist: {...}, body_front: {...}, body_back: {...} }
  
  -- Voice
  voice_profiles  JSONB DEFAULT '{}', -- { "en": { provider: "elevenlabs", voice_id: "xxx" }, "es": {...} }
  
  -- Generation History
  generation_history JSONB DEFAULT '[]', -- array of generation attempts with metadata
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channel_avatars (
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  avatar_id   UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  role        VARCHAR(50), -- main_character, supporting, narrator
  PRIMARY KEY (channel_id, avatar_id)
);

CREATE TABLE branding_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  logo_url    TEXT,
  banner_url  TEXT,
  colors      JSONB DEFAULT '{}', -- { primary: "#xxx", secondary: "#xxx", accent: "#xxx" }
  fonts       JSONB DEFAULT '{}', -- { heading: "Inter", body: "Inter" }
  templates   JSONB DEFAULT '[]', -- array of template configs
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scenery_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(50), -- city, nature, studio, fantasy, etc.
  image_url   TEXT NOT NULL,
  prompt      TEXT, -- generation prompt used
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channel_scenery (
  channel_id    UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  scenery_id    UUID NOT NULL REFERENCES scenery_assets(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, scenery_id)
);

-- ============================================================
-- CINEMA BIBLES
-- ============================================================

CREATE TABLE cinema_bibles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  version       INTEGER DEFAULT 1,
  
  look_bible    JSONB DEFAULT '{}', -- style refs, lighting, grain, lens kit, aspect ratio
  character_bible JSONB DEFAULT '{}', -- per-character identity anchors, wardrobe, never-change list
  environment_bible JSONB DEFAULT '{}', -- location motifs, time-of-day rules, weather
  prompt_bible  JSONB DEFAULT '{}', -- { global_style: "", character_blocks: {}, negative_block: "" }
  shotspec_template JSONB DEFAULT '{}', -- default ShotSpec fields for this channel
  
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI SERVICE REGISTRY
-- ============================================================

CREATE TABLE ai_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL, -- "openai-gpt4", "ollama-llama3", "veo3", etc.
  provider        VARCHAR(50) NOT NULL, -- openai, anthropic, google, ollama, comfyui, etc.
  service_type    VARCHAR(20) NOT NULL, -- text, image, video, voice
  endpoint        TEXT,
  api_key_enc     TEXT, -- encrypted
  
  -- Capabilities
  capabilities    JSONB DEFAULT '{}', -- model-specific capabilities
  rate_limits     JSONB DEFAULT '{}', -- { rpm: 60, rpd: 10000 }
  cost_per_unit   JSONB DEFAULT '{}', -- { unit: "token", cost: 0.003 } or { unit: "second", cost: 0.20 }
  
  -- Status
  status          VARCHAR(20) DEFAULT 'active', -- active, degraded, down, disabled
  health_score    INTEGER DEFAULT 100,
  last_health_check TIMESTAMPTZ,
  
  -- Performance
  avg_response_ms INTEGER,
  success_rate    DECIMAL(5,4) DEFAULT 1.0,
  avg_quality_score DECIMAL(3,1),
  
  -- Fallback
  fallback_order  INTEGER DEFAULT 0, -- lower = higher priority in fallback chain
  fallback_group  VARCHAR(50), -- groups services for fallback (e.g., "text_gen", "video_gen")
  
  is_local        BOOLEAN DEFAULT false,
  is_free         BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_services_type ON ai_services(service_type);
CREATE INDEX idx_ai_services_fallback ON ai_services(fallback_group, fallback_order);

CREATE TABLE ai_service_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES ai_services(id),
  content_id      UUID, -- optional link to content_items
  channel_id      UUID, -- optional link to channels
  
  request_type    VARCHAR(50), -- generate_text, generate_image, generate_video, etc.
  tokens_used     INTEGER,
  duration_sec    DECIMAL(8,2),
  cost            DECIMAL(10,4),
  quality_score   DECIMAL(3,1),
  success         BOOLEAN DEFAULT true,
  response_ms     INTEGER,
  error_message   TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_usage_service ON ai_service_usage(service_id);
CREATE INDEX idx_ai_usage_date ON ai_service_usage(created_at);

-- ============================================================
-- CONTENT
-- ============================================================

CREATE TABLE content_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES channels(id),
  
  -- Content Identity
  title           VARCHAR(500),
  content_type    VARCHAR(30) NOT NULL, -- text, image, video_short, video_long, voice, thumbnail
  content_purpose VARCHAR(30), -- entertainment, sales, educational, comedy, affiliate
  
  -- Generation
  prompt          TEXT,
  generation_params JSONB DEFAULT '{}', -- model, seed, workflow, etc.
  ai_service_id   UUID REFERENCES ai_services(id),
  quality_score   DECIMAL(3,1),
  
  -- Files
  file_url        TEXT, -- MinIO path
  thumbnail_url   TEXT,
  
  -- Metadata
  platform_metadata JSONB DEFAULT '{}', -- { youtube: {title, desc, tags}, tiktok: {caption, hashtags} }
  beat_tags       JSONB DEFAULT '[]', -- emotional beat tags from script
  duration_sec    DECIMAL(8,2),
  language        VARCHAR(10) DEFAULT 'en',
  
  -- Affiliate
  affiliate_product_id UUID, -- REFERENCES affiliate_products(id)
  affiliate_mode  VARCHAR(20), -- dedicated, commercial_break, none
  
  -- Versioning
  version         INTEGER DEFAULT 1,
  parent_id       UUID REFERENCES content_items(id), -- for revisions
  
  -- Language variants
  language_family_id UUID, -- groups language variants of same content
  
  -- Status
  status          VARCHAR(20) DEFAULT 'draft', -- draft, generating, generated, pending_approval, approved, scheduled, posted, archived, failed
  
  -- Approval
  approval_gate_window_hrs DECIMAL(5,1), -- current gate window for this content
  approved_at     TIMESTAMPTZ,
  approved_by     VARCHAR(50), -- 'operator', 'auto', 'system'
  
  -- Performance (populated post-publish)
  performance     JSONB DEFAULT '{}', -- { views, likes, shares, comments, watch_time, revenue }
  
  -- Provenance
  provenance      JSONB DEFAULT '{}', -- C2PA-style: { models: [], workflows: [], edits: [] }
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_channel ON content_items(channel_id);
CREATE INDEX idx_content_status ON content_items(status);
CREATE INDEX idx_content_type ON content_items(content_type);
CREATE INDEX idx_content_language_family ON content_items(language_family_id);
CREATE INDEX idx_content_search ON content_items USING GIN(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(prompt,'')));

-- ============================================================
-- VIDEO PRODUCTION
-- ============================================================

CREATE TABLE storyboards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'draft', -- draft, approved, in_production
  script_json     JSONB NOT NULL, -- tagged script with beats, timing, dialogue
  sound_plan_json JSONB, -- CinematicBeatSoundPlan
  total_duration_sec DECIMAL(8,2),
  fps             INTEGER DEFAULT 24,
  aspect_ratio    VARCHAR(10) DEFAULT '16:9',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE storyboard_shots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyboard_id   UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  shot_number     INTEGER NOT NULL,
  
  -- ShotSpec
  shotspec        JSONB NOT NULL, -- { prompt_blocks, references, seed, model, duration, fps, camera, lighting, audio_plan }
  
  -- Generated Assets
  keyframe_urls   JSONB DEFAULT '[]', -- array of { url, variation_index, selected: bool }
  plate_video_url TEXT,
  matte_urls      JSONB DEFAULT '[]',
  audio_stem_urls JSONB DEFAULT '{}', -- { dialogue, sfx, music, foley }
  
  -- Status
  status          VARCHAR(20) DEFAULT 'pending', -- pending, generating, generated, approved, failed
  quality_score   DECIMAL(3,1),
  generation_cost DECIMAL(10,4),
  ai_service_id   UUID REFERENCES ai_services(id),
  
  -- Timing
  start_sec       DECIMAL(8,2) NOT NULL,
  end_sec         DECIMAL(8,2) NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shots_storyboard ON storyboard_shots(storyboard_id, shot_number);

-- ============================================================
-- SCHEDULING & DISTRIBUTION
-- ============================================================

CREATE TABLE scheduled_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      UUID NOT NULL REFERENCES content_items(id),
  channel_id      UUID NOT NULL REFERENCES channels(id),
  
  scheduled_at    TIMESTAMPTZ NOT NULL,
  platform        VARCHAR(20) NOT NULL,
  
  -- Platform-specific publish data
  publish_config  JSONB DEFAULT '{}', -- { playlist_id, hashtags, description, etc. }
  
  -- Status
  status          VARCHAR(20) DEFAULT 'scheduled', -- scheduled, posting, posted, failed, cancelled
  posted_at       TIMESTAMPTZ,
  platform_post_id VARCHAR(255), -- returned by platform after posting
  error_message   TEXT,
  retry_count     INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scheduled_channel ON scheduled_posts(channel_id, scheduled_at);
CREATE INDEX idx_scheduled_status ON scheduled_posts(status, scheduled_at);

-- ============================================================
-- AFFILIATE MARKETING
-- ============================================================

CREATE TABLE affiliate_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  url             TEXT NOT NULL,
  short_url       TEXT, -- generated shortened link
  description     TEXT, -- AI-generated
  sales_angle     TEXT, -- human psychology-generated
  category        VARCHAR(100),
  brand           VARCHAR(100),
  commission_rate DECIMAL(5,2), -- percentage
  status          VARCHAR(20) DEFAULT 'active', -- active, inactive, expired
  image_url       TEXT,
  metadata        JSONB DEFAULT '{}',
  
  -- Performance
  total_clicks    INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_revenue   DECIMAL(12,2) DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channel_affiliate_pools (
  channel_id          UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  affiliate_product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  is_auto_suggested   BOOLEAN DEFAULT false,
  performance_score   DECIMAL(5,2) DEFAULT 0, -- per-channel performance
  last_used_at        TIMESTAMPTZ,
  PRIMARY KEY (channel_id, affiliate_product_id)
);

CREATE TABLE affiliate_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES affiliate_products(id),
  content_id      UUID REFERENCES content_items(id),
  channel_id      UUID REFERENCES channels(id),
  platform        VARCHAR(20),
  ip_hash         VARCHAR(64), -- hashed for privacy
  user_agent      TEXT,
  converted       BOOLEAN DEFAULT false,
  revenue         DECIMAL(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clicks_product ON affiliate_clicks(product_id, created_at);

-- ============================================================
-- APPROVAL GATES & TRUST
-- ============================================================

CREATE TABLE approval_trust_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_type  VARCHAR(30) NOT NULL, -- content_type, llm, workflow, tier, niche, platform
  dimension_value VARCHAR(100) NOT NULL, -- e.g., "video_short", "veo3", "comedy", "tiktok"
  
  trust_score     DECIMAL(5,2) DEFAULT 0, -- 0-100, higher = more trusted
  gate_window_hrs DECIMAL(5,1) DEFAULT 24, -- current approval window in hours
  
  total_approved  INTEGER DEFAULT 0,
  total_rejected  INTEGER DEFAULT 0,
  total_auto_approved INTEGER DEFAULT 0,
  avg_outcome_score DECIMAL(5,2) DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dimension_type, dimension_value)
);

-- ============================================================
-- AI ASSISTANT
-- ============================================================

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255),
  context_page    VARCHAR(100), -- which dashboard page the conversation started on
  model_used      VARCHAR(100),
  message_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL, -- user, assistant, system
  content         TEXT NOT NULL,
  tokens_used     INTEGER,
  action_proposed JSONB, -- { action_type, params, tier, status }
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id, created_at);

CREATE TABLE action_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type     VARCHAR(100) NOT NULL,
  tier            INTEGER NOT NULL, -- 1-4
  parameters      JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  status          VARCHAR(20), -- proposed, confirmed, executing, completed, failed, rolled_back
  rollback_data   JSONB, -- data needed to undo
  conversation_id UUID REFERENCES conversations(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKFLOWS & JOBS
-- ============================================================

CREATE TABLE workflow_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        VARCHAR(50) NOT NULL, -- content_production, account_creation, warming, research, posting
  priority        INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  
  -- Context
  channel_id      UUID REFERENCES channels(id),
  content_id      UUID REFERENCES content_items(id),
  email_account_id UUID REFERENCES email_accounts(id),
  
  -- Execution
  status          VARCHAR(20) DEFAULT 'queued', -- queued, running, paused, completed, failed, cancelled
  progress        INTEGER DEFAULT 0, -- 0-100
  eta_sec         INTEGER,
  
  -- Config
  params          JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  error           TEXT,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  
  -- HITL
  needs_human     BOOLEAN DEFAULT false,
  human_task_desc TEXT,
  human_links     JSONB DEFAULT '[]',
  human_completed_at TIMESTAMPTZ,
  
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jobs_status ON workflow_jobs(status, priority);
CREATE INDEX idx_jobs_type ON workflow_jobs(job_type);

-- ============================================================
-- MONITORING & ALERTS
-- ============================================================

CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity        VARCHAR(10) NOT NULL, -- critical, warning, info
  category        VARCHAR(50) NOT NULL, -- account_health, system, workflow, cost, content
  title           VARCHAR(255) NOT NULL,
  message         TEXT,
  source          VARCHAR(100), -- which service generated it
  
  status          VARCHAR(20) DEFAULT 'open', -- open, acknowledged, resolved, suppressed
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_status ON alerts(status, severity);

CREATE TABLE system_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type     VARCHAR(50) NOT NULL, -- cpu, ram, disk, network, queue_depth, sessions
  value           DECIMAL(10,2) NOT NULL,
  unit            VARCHAR(20), -- percent, bytes, count, mbps
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_metrics_type_date ON system_metrics(metric_type, created_at);

-- ============================================================
-- RESEARCH & KNOWLEDGE
-- ============================================================

CREATE TABLE knowledge_base_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          VARCHAR(50) NOT NULL, -- platform_ops, civitai, remotion, huggingface, comfyui, video_production
  category        VARCHAR(100),
  title           VARCHAR(500) NOT NULL,
  content         TEXT NOT NULL,
  source_url      TEXT,
  relevance_score DECIMAL(3,1),
  is_current      BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_kb_domain ON knowledge_base_entries(domain);
CREATE INDEX idx_kb_search ON knowledge_base_entries USING GIN(to_tsvector('english', title || ' ' || content));
```

### 2.3 Key Design Decisions

**JSONB usage**: Avatar configs, platform metadata, prompt history, cinema bibles — all use JSONB because their structure varies per entity and evolves frequently. Prisma supports JSONB natively with TypeScript typing.

**Array columns**: `channels.niches` uses PostgreSQL arrays for efficient GIN-indexed containment queries (`WHERE niches @> ARRAY['comedy']`).

**Encrypted fields**: `_enc` suffix columns (password_enc, api_key_enc, credentials_enc) use AES-256-GCM encryption at the application layer via a shared encryption utility. Keys stored in environment variables, never in code.

**Soft references via family_id**: Language variant channels share a `family_id` UUID. Content items share a `language_family_id`. These are loose groupings, not foreign keys, for flexibility.

**Trust scores as first-class entities**: `approval_trust_scores` track trust per dimension independently, enabling the adaptive gate system to learn granularly.

---

## 3. Service Architecture

### 3.1 Service Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                       │
│                                                             │
│  ┌─ API Routes (/api/v1/...) ────────────────────────────┐ │
│  │ accounts/     channels/     content/     affiliate/    │ │
│  │ calendar/     analytics/    settings/    assistant/     │ │
│  │ auth/         upload/       webhooks/    health/        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ WebSocket Server ────────────────────────────────────┐ │
│  │ Real-time events: workflow progress, content status,   │ │
│  │ account health, alerts, metrics, approval notifications│ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              STANDALONE SERVICES (Express)                    │
│                                                             │
│  ┌─ WorkflowEngine (:3001) ──────────────────────────────┐ │
│  │ Orchestrates all background workflows                  │ │
│  │ Manages BullMQ job lifecycle                           │ │
│  │ Priority-based resource allocation                     │ │
│  │ HITL checkpoint management                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ ProductionPipeline (:3002) ──────────────────────────┐ │
│  │ AI Agent orchestration (Script→Shot→Storyboard→...)    │ │
│  │ ShotSpec job queue                                     │ │
│  │ ComfyUI workflow submission                            │ │
│  │ Remotion render triggering                             │ │
│  │ Three-stage QC execution                               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ AIAssistantService (:3003) ──────────────────────────┐ │
│  │ Conversation management                                │ │
│  │ RAG retrieval + context injection                      │ │
│  │ Action execution (4-tier safety)                       │ │
│  │ Self-discovery (API route scanning)                    │ │
│  │ Proactive suggestions                                  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  BULLMQ WORKERS                              │
│                                                             │
│  ContentWorker    - Content generation jobs                  │
│  AccountWorker    - Account creation, warming, health checks │
│  PostingWorker    - Content posting to platforms              │
│  ResearchWorker   - Research and KB update jobs               │
│  MaintenanceWorker - Cleanup, archival, metric aggregation   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Inter-Service Communication

| From | To | Method | Use Case |
|---|---|---|---|
| Next.js API → WorkflowEngine | HTTP REST | Trigger workflows, check status |
| Next.js API → ProductionPipeline | HTTP REST | Start production jobs, get progress |
| Next.js API → AIAssistant | HTTP + WebSocket | Chat messages, action execution |
| WorkflowEngine → BullMQ Workers | Redis (BullMQ) | Job dispatch and results |
| Any Service → PostgreSQL | Prisma Client | Data operations |
| Any Service → Redis | ioredis | Caching, rate limiting, pub/sub |
| Any Service → MinIO | S3 SDK | File storage/retrieval |
| ProductionPipeline → ComfyUI | HTTP REST | Submit workflow JSON, get outputs |
| ProductionPipeline → Remotion | CLI / programmatic | Trigger video renders |
| ProductionPipeline → Cloud AI | HTTP REST | LLM/video/image/voice generation |
| AccountWorker → Playwright | Node API | Browser automation sessions |
| WebSocket Server → Dashboard | socket.io | Real-time event broadcasting |

### 3.3 Shared Libraries (Internal Packages)

```
packages/
├── @airevstream/db          # Prisma client, models, type exports
├── @airevstream/crypto      # Encryption/decryption utilities
├── @airevstream/ai-client   # Unified AI service client (wraps all providers)
├── @airevstream/queue       # BullMQ job definitions, type-safe producers/consumers
├── @airevstream/storage     # MinIO wrapper with path conventions
├── @cinematic/audio-engine  # Remotion audio package (RenderAudio, presets, ducking, beat tagger)
└── @airevstream/shared      # Constants, enums, validation schemas, error types
```

---

## 4. API Design

### 4.1 API Convention

- Base path: `/api/v1/`
- Authentication: JWT Bearer token in Authorization header
- Content-Type: `application/json`
- Pagination: `?page=1&limit=50` with response `{ data: [], meta: { total, page, limit, pages } }`
- Filtering: query params e.g., `?status=active&platform=youtube`
- Sorting: `?sort=created_at&order=desc`
- Errors: `{ error: { code: "NOT_FOUND", message: "...", details: {} } }`

### 4.2 API Surface

**Accounts & Channels**
| Method | Path | Description |
|---|---|---|
| GET | `/accounts` | List email accounts (paginated, filterable) |
| POST | `/accounts` | Create email account |
| POST | `/accounts/bulk-import` | Import CSV/JSON of accounts |
| GET | `/accounts/:id` | Get account detail |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |
| GET | `/accounts/:id/socials` | List social accounts for email |
| POST | `/accounts/:id/socials` | Create social account |
| GET | `/channels` | List all channels (filterable by niche, platform, language) |
| POST | `/channels` | Create channel with identity profile |
| GET | `/channels/:id` | Get channel detail with full identity |
| PUT | `/channels/:id` | Update channel identity |
| GET | `/channels/:id/cinema-bible` | Get cinema bible |
| PUT | `/channels/:id/cinema-bible` | Update cinema bible |
| GET | `/channels/:id/avatars` | List assigned avatars |
| POST | `/channels/:id/avatars` | Assign avatar to channel |
| GET | `/channels/:id/affiliate-pool` | List affiliate products in pool |
| POST | `/channels/:id/affiliate-pool` | Add product to pool |

**Content & Production**
| Method | Path | Description |
|---|---|---|
| GET | `/content` | List content (paginated, filterable by type/channel/status) |
| POST | `/content/generate` | Start content generation (triggers production pipeline) |
| GET | `/content/:id` | Get content detail with full metadata |
| PUT | `/content/:id` | Update content metadata |
| POST | `/content/:id/approve` | Approve content |
| POST | `/content/:id/reject` | Reject content with feedback |
| POST | `/content/:id/regenerate` | Regenerate content |
| GET | `/content/:id/versions` | List content versions |
| GET | `/content/:id/storyboard` | Get storyboard for content |
| PUT | `/content/:id/storyboard` | Update storyboard |
| POST | `/content/:id/storyboard/approve` | Approve storyboard |
| GET | `/approvals` | List pending approvals (filterable) |
| POST | `/approvals/bulk` | Bulk approve/reject |

**Scheduling & Distribution**
| Method | Path | Description |
|---|---|---|
| GET | `/calendar` | Get calendar events (date range, filters) |
| POST | `/schedule` | Schedule content for posting |
| PUT | `/schedule/:id` | Reschedule post |
| DELETE | `/schedule/:id` | Cancel scheduled post |
| POST | `/distribute` | Distribute content to channel(s) |

**Affiliate**
| Method | Path | Description |
|---|---|---|
| GET | `/affiliate/products` | List products |
| POST | `/affiliate/products` | Add product (URL → AI investigation) |
| PUT | `/affiliate/products/:id` | Update product |
| GET | `/affiliate/products/:id/analytics` | Product performance |
| GET | `/affiliate/links` | List shortened links |
| POST | `/affiliate/links` | Create shortened link |
| GET | `/affiliate/clicks` | Click analytics |
| GET | `/affiliate/revenue` | Revenue dashboard data |

**AI Assistant**
| Method | Path | Description |
|---|---|---|
| POST | `/assistant/chat` | Send message (returns streamed response) |
| GET | `/assistant/conversations` | List conversations |
| GET | `/assistant/conversations/:id` | Get conversation history |
| DELETE | `/assistant/conversations/:id` | Delete conversation |
| POST | `/assistant/actions/:id/confirm` | Confirm proposed action |
| POST | `/assistant/actions/:id/rollback` | Rollback executed action |
| GET | `/assistant/capabilities` | List discovered system capabilities |

**AI Services**
| Method | Path | Description |
|---|---|---|
| GET | `/ai-services` | List registered AI services |
| POST | `/ai-services` | Register new AI service |
| PUT | `/ai-services/:id` | Update service config |
| POST | `/ai-services/health-check` | Trigger health check for all services |
| GET | `/ai-services/usage` | Usage analytics |
| GET | `/ai-services/costs` | Cost breakdown |

**System & Monitoring**
| Method | Path | Description |
|---|---|---|
| GET | `/system/health` | System health summary |
| GET | `/system/metrics` | Current system metrics |
| GET | `/system/workflows` | Active workflows |
| GET | `/system/alerts` | Active alerts |
| POST | `/system/alerts/:id/acknowledge` | Acknowledge alert |
| GET | `/system/errors` | Recent errors |

**Analytics**
| Method | Path | Description |
|---|---|---|
| GET | `/analytics/revenue` | Revenue data (filterable by channel/niche/product/period) |
| GET | `/analytics/engagement` | Engagement metrics |
| GET | `/analytics/content-performance` | Content performance |
| GET | `/analytics/costs` | Cost analysis |
| GET | `/analytics/audience` | Audience insights |
| GET | `/analytics/export` | Export report (CSV/JSON/PDF) |

---

## 5. Infrastructure Architecture

### 5.1 Mac Studio Service Map

| Service | Port | RAM Budget | Storage | Startup Order |
|---|---|---|---|---|
| PostgreSQL 16 | 5432 | 16 GB | 500 GB (data) | 1 |
| Redis 7 | 6379 | 4 GB | 1 GB | 2 |
| MinIO | 9000/9001 | 4 GB | 14 TB (content) | 3 |
| Ollama | 11434 | 80-120 GB | 200 GB (models) | 4 |
| ComfyUI | 8188 | 16 GB | 500 GB (models/outputs) | 5 |
| Next.js App | 3000 | 4 GB | — | 6 |
| WorkflowEngine | 3001 | 8 GB | — | 7 |
| ProductionPipeline | 3002 | 8 GB | — | 8 |
| AIAssistantService | 3003 | 4 GB | — | 9 |
| BullMQ Workers (5) | — | 20 GB | — | 10 |
| Playwright Sessions | — | 20 GB (10 sessions) | — | On-demand |
| Remotion Renders | — | Variable | — | On-demand |
| **Total Baseline** | — | **~184 GB** | **~15.2 TB** | — |
| **Available** | — | **512 GB** | **16 TB** | — |
| **Headroom** | — | **~328 GB** | **~800 GB** | — |

### 5.2 Process Management

Use **PM2** for process management on Mac Studio:
- Auto-restart on crash
- Log management (rotation, aggregation)
- CPU/memory monitoring per process
- Cluster mode for Next.js (utilize multiple CPU cores)
- Startup script for system boot

### 5.3 Backup Strategy

| What | Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | pg_dump → compressed → MinIO | Every 6 hours | 30 days |
| Redis | RDB snapshots | Every hour | 7 days |
| MinIO content | Incremental sync to external drive | Daily | 90 days |
| Configuration | Git repo | On change | Permanent |
| Workflow JSON | Git repo | On change | Permanent |

### 5.4 Security Architecture

**Authentication**: JWT with RS256 signing. Access tokens (15 min) + refresh tokens (7 days). Single-user for now, multi-tenant ready.

**Encryption at Rest**: AES-256-GCM for sensitive fields (passwords, API keys, tokens). Encryption key in environment variable, never committed.

**Encryption in Transit**: HTTPS via reverse proxy (Caddy) for all services. Internal service communication over localhost (acceptable for single-machine deployment).

**Network**: All services bind to localhost except Caddy reverse proxy. Proxy handles TLS termination and routes to internal ports.

**Rate Limiting**: Redis-backed rate limiter. Per-route configurable. Default: 100 req/15min for API, 60 req/min for AI assistant chat.

**Input Validation**: Zod schemas on all API inputs. Sanitization for XSS prevention. UUID validation on all ID parameters.

**Audit Trail**: All state-changing operations logged to `action_audit_log` with PII masking.

---

## 6. Key Technical Patterns

### 6.1 Job Priority System

```typescript
enum JobPriority {
  CRITICAL = 1,    // Time-sensitive posting, error recovery
  HIGH = 3,        // Content production, scheduled posts
  MEDIUM = 5,      // Account creation, research
  LOW = 7,         // Warming, cleanup, archival
  BACKGROUND = 10  // Analytics aggregation, KB updates
}
```

WorkflowEngine monitors total system load. When resources exceed 90%, it pauses LOW and BACKGROUND jobs. When a CRITICAL job arrives, it can preempt MEDIUM jobs.

### 6.2 AI Service Client Pattern

```typescript
// Unified client wrapping all AI providers
const aiClient = new AIServiceClient(prisma, redis);

// Sequential selection with fallback
const result = await aiClient.generate({
  type: 'text',
  task: 'script_generation',
  prompt: "...",
  channelId: "...",       // for context injection
  maxRetries: 3,          // fallback chain depth
  budgetLimit: 0.50,      // max cost for this generation
  minQualityScore: 7.0,   // reject below this score
});
// Internally: selects best model → generates → scores → if subpar, falls back → logs usage
```

### 6.3 Adaptive Approval Gate Pattern

```typescript
// When content is generated, calculate gate window
const gateWindow = await calculateGateWindow(content, {
  contentType: content.content_type,
  aiService: content.ai_service_id,
  channel: content.channel_id,
  niche: channel.niches[0],
  platform: channel.platform,
});

// gateWindow returns hours (e.g., 24 for new pipeline, 0.5 for trusted)
// If 0, content is auto-approved with post-publish monitoring
// If > 0, content enters approval queue with timeout

// After outcome is known (engagement data collected):
await updateTrustScores(content, outcome);
// Adjusts trust_score and gate_window_hrs for all matching dimensions
```

### 6.4 WebSocket Event Bus

```typescript
// Server-side: emit events from any service
eventBus.emit('content:status', { contentId, status: 'approved', channelName });
eventBus.emit('workflow:progress', { jobId, progress: 45, eta: 180 });
eventBus.emit('alert:new', { severity: 'warning', title: 'Proxy pool low' });

// Client-side: subscribe in React components
const { data } = useRealtimeEvent('content:status');
const { data } = useRealtimeEvent('system:metrics');
```

### 6.5 Content Production Pipeline Flow

```
[Content Generation Request]
        │
        ▼
[1. Load Channel Identity + Cinema Bible]
        │
        ▼
[2. Script Agent: Generate tagged script]
  ├─ Beat tagging (8 presets)
  ├─ H.I.C.C. framework enforcement
  ├─ Affiliate integration (if applicable)
  └─ Lip-sync directives
        │
        ▼
[3. Shot Director: Generate ShotSpecs]
  ├─ Camera, lens, framing per shot
  ├─ Lighting and blocking notes
  └─ Duration allocation per platform
        │
        ▼
[4. Storyboard Agent: Generate keyframes]
  ├─ 3 variations per shot via ComfyUI/cloud
  ├─ ControlNet for pose/depth consistency
  ├─ LoRA for character identity
  └─ ── APPROVAL GATE: Storyboard ──
        │
        ▼
[5. Sound Designer: Create SoundPlan JSON]
  ├─ Beat → preset mapping
  ├─ Shot-aware SFX placement
  ├─ Retention cadence enforcement
  └─ Dialogue audio generation (ElevenLabs/etc.)
        │
        ▼
[6. Animation Agent: Generate video plates]
  ├─ Upload storyboard frames as starting frames
  ├─ Sequential model selection (Veo3 → Kling → fallback)
  ├─ Reference images for character consistency
  └─ Per-shot cost tracking
        │
        ▼
[7. Viseme Pipeline (if lip-sync)]
  ├─ Extract visemes from dialogue audio
  └─ Map to character face rig
        │
        ▼
[8. Editor/Assembler: Remotion render]
  ├─ Composite video + audio + overlays + captions
  ├─ ACES color pipeline
  ├─ Platform-specific exports
  └─ Stem exports (dialogue, music, SFX)
        │
        ▼
[9. QC Agent: Three-stage QC]
  ├─ Technical: fps, duration, resolution
  ├─ Continuity: face ID, wardrobe, props
  ├─ Audio: loudness compliance, intelligibility
  ├─ Provenance: C2PA metadata attached
  └─ Quality score calculated
        │
        ▼
[10. ── APPROVAL GATE: Final Content ──]
  ├─ Gate window based on trust scores
  ├─ Enters approval queue (or auto-approved if trusted)
  └─ Operator: approve / reject / regenerate
        │
        ▼
[11. Schedule & Distribute]
  ├─ Route to channel's platform
  ├─ Optimal timing selection
  └─ Platform-specific metadata applied
        │
        ▼
[12. Post-Publish Monitoring]
  ├─ Track engagement metrics
  ├─ Feed outcomes back to trust scores
  └─ Feed to content suggestion engine
```

---

## 7. Project Structure

```
airevstream/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/                      # App Router pages
│       │   ├── (dashboard)/          # Dashboard layout group
│       │   │   ├── page.tsx          # Home / Overview
│       │   │   ├── accounts/
│       │   │   ├── calendar/
│       │   │   ├── create/
│       │   │   ├── library/
│       │   │   ├── analytics/
│       │   │   ├── system/
│       │   │   ├── affiliate/
│       │   │   └── settings/
│       │   ├── api/v1/               # API routes
│       │   │   ├── accounts/
│       │   │   ├── channels/
│       │   │   ├── content/
│       │   │   ├── calendar/
│       │   │   ├── schedule/
│       │   │   ├── affiliate/
│       │   │   ├── assistant/
│       │   │   ├── ai-services/
│       │   │   ├── analytics/
│       │   │   ├── system/
│       │   │   └── auth/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── dashboard/            # Dashboard-specific components
│       │   ├── accounts/
│       │   ├── content/
│       │   ├── calendar/
│       │   ├── create/               # Content Creation Wizard
│       │   ├── analytics/
│       │   ├── affiliate/
│       │   ├── system/
│       │   ├── assistant/            # AI Chat Widget
│       │   └── shared/               # StatusBadge, KPICard, FilterBar, etc.
│       ├── hooks/                    # Custom React hooks
│       ├── lib/                      # Client utilities
│       └── styles/
│
├── services/
│   ├── workflow-engine/              # Standalone Express service (:3001)
│   ├── production-pipeline/          # Standalone Express service (:3002)
│   └── ai-assistant/                 # Standalone Express service (:3003)
│
├── workers/
│   ├── content.worker.ts
│   ├── account.worker.ts
│   ├── posting.worker.ts
│   ├── research.worker.ts
│   └── maintenance.worker.ts
│
├── packages/
│   ├── db/                           # @airevstream/db (Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   ├── crypto/                       # @airevstream/crypto
│   ├── ai-client/                    # @airevstream/ai-client
│   ├── queue/                        # @airevstream/queue
│   ├── storage/                      # @airevstream/storage
│   ├── audio-engine/                 # @cinematic/audio-engine
│   └── shared/                       # @airevstream/shared
│
├── remotion/                         # Remotion video project
│   ├── src/
│   │   ├── compositions/
│   │   ├── components/
│   │   └── lib/
│   └── public/audio/                 # Audio presets, foley, accents
│
├── comfyui-workflows/                # Versioned ComfyUI workflow JSONs
│   ├── character/
│   ├── environment/
│   ├── upscale/
│   └── style/
│
├── docs/
│   ├── brief.md
│   ├── prd.md
│   ├── front-end-spec.md
│   └── architecture.md
│
├── docker-compose.yml                # PostgreSQL, Redis, MinIO, ComfyUI
├── ecosystem.config.js               # PM2 config
├── turbo.json                        # Turborepo config
├── package.json
└── tsconfig.base.json
```

### 7.1 Monorepo Strategy

**Turborepo** for monorepo management:
- Shared TypeScript configs
- Package dependency resolution
- Incremental builds
- Task pipeline (build packages → build apps → start services)

---

## 8. Coding Standards

### 8.1 TypeScript

- Strict mode enabled (`"strict": true`)
- No `any` types (use `unknown` and narrow)
- Explicit return types on exported functions
- Zod schemas for all external data boundaries (API input, AI service responses, webhook payloads)
- Prisma-generated types for all database operations

### 8.2 API Routes

- One file per route group (e.g., `app/api/v1/accounts/route.ts`)
- Zod validation on all inputs before processing
- Consistent error response format
- Try-catch with structured error logging
- Rate limiting middleware applied per route

### 8.3 React Components

- Functional components only
- Custom hooks for data fetching (SWR-based)
- Colocation: component + styles + tests in same directory
- shadcn/ui primitives extended, never raw HTML for interactive elements
- Loading/error/empty states for every data-dependent component

### 8.4 Testing Strategy

- Unit tests: Vitest (fast, TypeScript-native)
- API integration tests: Vitest + supertest
- Component tests: Vitest + React Testing Library
- E2E: Playwright (same tool as browser automation — shared knowledge)
- Coverage target: 80% for services, 70% for UI

---

## 9. Deployment & Operations

### 9.1 Local Deployment (Mac Studio)

```bash
# Infrastructure (Docker Compose)
docker compose up -d  # PostgreSQL, Redis, MinIO, ComfyUI

# Ollama (native, Apple Silicon optimized)
ollama serve &
ollama pull llama3
ollama pull codellama

# Application services (PM2)
pm2 start ecosystem.config.js

# Remotion (on-demand, CLI)
# Triggered programmatically by ProductionPipeline service
```

### 9.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://airevstream:xxx@localhost:5432/airevstream

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=xxx
MINIO_SECRET_KEY=xxx

# Encryption
ENCRYPTION_KEY=xxx  # 32-byte hex

# JWT
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# AI Services (added via AI Service Registry, stored encrypted in DB)
# Not in .env — managed through dashboard Settings > AI Services

# Proxy
PROXY_PROVIDER_URL=xxx
PROXY_API_KEY=xxx
```

---

## 10. Migration Path to SaaS (Phase 9)

The architecture is designed for single-tenant now with clear migration points:

| Concern | Current (Single-Tenant) | SaaS Migration |
|---|---|---|
| Auth | Single JWT user | Add tenant_id to JWT, multi-user per tenant |
| Data | All tables global | Add `tenant_id` column to all tables, row-level security |
| Storage | Single MinIO bucket | Bucket-per-tenant or prefix-per-tenant |
| Queue | Single queue namespace | Tenant-prefixed queues with fair scheduling |
| AI Services | Shared registry | Per-tenant API key management |
| Billing | None | Stripe integration, usage metering per tenant |

**Key design decisions that enable this migration:**
- API-first architecture (dashboard consumes same APIs external clients will)
- Clean service boundaries (no cross-cutting database queries)
- JSONB for tenant-specific configuration without schema changes
- BullMQ supports named queues (easy to namespace per tenant)

---

## Next Steps

### Architect Recommendations for PRD Updates
No PRD changes required — the architecture fully supports all 46 stories across 9 epics as defined.

### PO Validation
This architecture document should be validated against the PRD for completeness and consistency using the PO master checklist.

### Implementation Order
Follow the 9-phase delivery order. Phase 1 (Foundation) starts with:
1. Initialize monorepo with Turborepo
2. Set up `@airevstream/db` package with Prisma schema
3. Run initial migration
4. Scaffold Next.js app with authentication
5. Build Account Manager (first visible feature)

---

**Document Version**: 1.0
**Created**: March 16, 2026
**Author**: Winston (Architect Agent)
**Status**: Draft — Awaiting Review
