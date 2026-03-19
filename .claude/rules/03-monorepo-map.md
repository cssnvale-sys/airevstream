# Monorepo Map

## Directory Layout

```
apps/
  web/                    → Next.js 14 App Router (port 3000)
    src/app/api/v1/       → 106 API route files (BFF pattern, D011)
    src/components/       → React components (dark theme Tailwind)
    src/hooks/            → SWR hooks (use-api.ts, useSSE)
    src/lib/              → api-server.ts (authenticate), utils

services/
  workflow-engine/        → Fastify REST API (port 3001)
  ai-assistant/           → AI chat + content gen (port 3003)
  production-pipeline/    → Video/image production (port 3002)

packages/
  shared/                 → Types, config, constants, utilities
  db/                     → Prisma schema (36 models) + client
  crypto/                 → AES-256-GCM encryption
  storage/                → MinIO/S3 client
  queue/                  → BullMQ job definitions + helpers
  ai-client/              → Multi-provider AI service registry
  audio-engine/           → TTS (Piper + ElevenLabs)
  browser-automation/     → Stealth Playwright + human behavior

workers/                  → BullMQ worker processes (content, account, posting, research, maintenance, production)
remotion/                 → Video compositions (short, long, thumbnail)
comfyui-workflows/        → SDXL workflow JSON templates
```

## Package Dependency Chain

```
shared ← db ← crypto ← storage ← queue ← ai-client
                                         ← audio-engine
                                         ← browser-automation
All packages ← services ← workers
All packages ← apps/web
```

## Key Files

| File | Path | Purpose |
|------|------|---------|
| API auth | `apps/web/src/lib/api-server.ts` | `authenticate()` → `ApiContext { userId, role, tenantId, db }` |
| SWR hooks | `apps/web/src/hooks/use-api.ts` | `useApi<T>()`, `apiPost`, `apiPut`, `apiDelete` |
| Prisma schema | `packages/db/prisma/schema.prisma` | 36 models, GIN indexes |
| Shared types | `packages/shared/src/types.ts` | All TypeScript types |
| Turbo config | `turbo.json` | Build tasks (uses `tasks` not `pipeline`) |
| PM2 config | `ecosystem.config.js` | Process management |
| Base tsconfig | `tsconfig.base.json` | Shared compiler options |

## Tracking Files

| File | Purpose |
|------|---------|
| `DEV-STATUS.md` | Phase/epic completion, test counts |
| `KNOWN-ISSUES.md` | 48 tracked issues (KI-001 through KI-048) |
| `DECISIONS.md` | 25 architecture decisions (D001–D025) |
| `SESSION-LOG.md` | Per-session development history |
| `CHANGELOG.md` | Keep a Changelog format |
| `OPERATOR-TODO.md` | Setup actions for the operator |
