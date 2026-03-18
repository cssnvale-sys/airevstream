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

## Build Status
All 9 PRD Epics complete. 14 packages building, 93 tests passing. See `DEV-STATUS.md` for details.

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
