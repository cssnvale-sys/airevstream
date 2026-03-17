# AiRevStream MPCAS — Multi-Platform Content Automation System

## Project Overview
AiRevStream is a self-hosted, AI-powered content automation platform that generates, manages, and publishes content across multiple social media platforms. It uses local AI (Ollama) for text generation, ComfyUI for image generation, and Remotion for video rendering.

## Tech Stack
- **Monorepo**: Turborepo + npm workspaces
- **Language**: TypeScript (ES2022, strict mode)
- **Web**: Next.js 14 (App Router)
- **Services**: Fastify
- **Database**: PostgreSQL 16 + Prisma ORM
- **Queue**: BullMQ + Redis
- **Storage**: MinIO (S3-compatible)
- **AI**: Ollama (local LLM)
- **Images**: ComfyUI
- **Video**: Remotion
- **Testing**: Vitest
- **Process Manager**: PM2

## Architecture

```
apps/web              → Next.js dashboard (port 3000)
services/
  workflow-engine     → REST API + workflow orchestration (port 3001)
  ai-assistant        → AI chat + content generation (port 3003)
  production-pipeline → Video/image production (port 3002)
packages/
  shared              → Types, config, constants, utilities
  db                  → Prisma schema + client
  crypto              → Encryption for stored secrets
  storage             → MinIO/S3 client
  queue               → BullMQ job definitions + helpers
  ai-client           → Ollama client wrapper
  audio-engine        → Audio processing (TTS, mixing)
workers/              → BullMQ worker processes
comfyui-workflows/    → ComfyUI workflow JSON templates
remotion/             → Remotion video compositions
```

## Phased Build Plan

### Phase 1: Foundation (Shared Packages)
1. `@airevstream/shared` — config, types, constants, utilities
2. `@airevstream/db` — Prisma schema, client, migrations
3. `@airevstream/crypto` — AES-256-GCM encryption
4. `@airevstream/storage` — MinIO client
5. `@airevstream/queue` — BullMQ queues + job types
6. `@airevstream/ai-client` — Ollama client

### Phase 2: Core Services
1. `workflow-engine` — REST API, auth, CRUD, workflow orchestration
2. `ai-assistant` — AI chat, content generation
3. `production-pipeline` — ComfyUI + Remotion integration

### Phase 3: Workers
1. Content worker — generates text/scripts
2. Account worker — manages platform accounts
3. Posting worker — publishes to platforms
4. Research worker — trend analysis, topic research
5. Maintenance worker — cleanup, health checks

### Phase 4: Web Dashboard
1. Auth (login/register)
2. Dashboard overview
3. Content management
4. Account management
5. Workflow builder
6. AI assistant chat

### Phase 5: Integration & Polish
1. ComfyUI workflow templates
2. Remotion compositions
3. End-to-end testing
4. Production deployment config

## Conventions
- Package names: `@airevstream/<name>`
- All packages export from `src/index.ts`
- All packages build to `dist/`
- Use `vitest` for all tests
- Use `zod` for runtime validation
- Use barrel exports (index.ts re-exports)
- Error handling: custom error classes extending base AppError
- Logging: pino logger
- Environment: dotenv loaded via shared config

## Tracking Files
- `DEV-STATUS.md` — Current progress, what's done, what's next
- `OPERATOR-TODO.md` — Actions needed from the operator (API keys, accounts, decisions)
- `KNOWN-ISSUES.md` — Known bugs and limitations
- `DECISIONS.md` — Architecture and design decisions with rationale
