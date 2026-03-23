# AUDIT COMPLETE — FINAL REPORT

Generated: 2026-03-23T11:15:00Z
Audit ID: AUDIT_20260323

## Executive Summary

- Total issues found: 26
  - CRITICAL: 3 (2 fixed, 1 accepted risk)
  - HIGH: 7 (all fixed)
  - MEDIUM: 9 (7 fixed, 1 deferred — requires migration, 1 deferred — SSE hooks)
  - LOW: 7 (2 fixed, 5 deferred — dependency management)
- Total files modified: 28
- Test iterations completed: 3 (1 failure on regression, 2 consecutive clean)
- Consecutive clean runs achieved: 2
- Build: 14/14 packages pass
- Tests: 329 pass (134 web + 5 workers + 190 shared)
- Audit: 24/24 pass

## Issues Fixed (20)

### CRITICAL

| ID | File | Description | Fix Applied |
|----|------|-------------|-------------|
| ISSUE_019 | 8 API route files | 18 handlers used conditional tenant scoping — null tenantId bypassed all filters | Added tenantId guard + unconditional scoping to all 18 handlers |
| ISSUE_020 | studio/[contentId]/page.tsx | Studio reads res.jobId but API returns {data:{flowJobId}} — progress bar dead | Fixed response type + extraction path |

### HIGH

| ID | File | Description | Fix Applied |
|----|------|-------------|-------------|
| ISSUE_006 | .env.production.example | OLLAMA_URL vs OLLAMA_BASE_URL mismatch | Renamed to OLLAMA_BASE_URL |
| ISSUE_017 | api-keys/route.ts | Non-admin users can create admin-scoped API keys | Added scope validation check |
| ISSUE_018 | seasoning/page.tsx + [cohortId] | Raw err.message leaked, missing AppLayout | Static messages, AppLayout wrapper, loading/error states |
| ISSUE_021 | production.worker.ts | Content type 'short_video'/'long_video' vs schema 'video_short'/'video_long' | Fixed 3 enum references |
| ISSUE_022 | content.worker.ts | Publish handler doesn't update ContentItem.status | Added status='scheduled' update |
| ISSUE_024 | ai-services/route.ts | Service type filter uses wrong enum values | Updated to match schema |
| ISSUE_025 | affiliate/products/[id]/route.ts | Tenant check always passes (Prisma include populates relation) | Direct DB query with ownership chain |

### MEDIUM

| ID | File | Description | Fix Applied |
|----|------|-------------|-------------|
| ISSUE_003 | content/viral-score/route.ts | GET writes to DB, no rate limit | Added rate limiting (20/hr per user) |
| ISSUE_004 | affiliate/redirect/route.ts | Public endpoint, no rate limit — click fraud vector | Added IP-based rate limit (60/min) |
| ISSUE_005 | auth/reset-password/route.ts | Missing passwordChangedAt — sessions survive reset | Set passwordChangedAt = new Date() |
| ISSUE_007 | packages/storage/src/index.ts | MINIO_USE_SSL env var ignored, SSL hardcoded off | Reads from env now |
| ISSUE_008 | packages/shared/src/config.ts | No ENCRYPTION_KEY guard in production | Added fail-fast throw in getConfig() |
| ISSUE_009 | shared <-> browser-automation | Circular dependency via WarmingActivity type | Moved types to shared, browser-automation re-exports |
| ISSUE_023 | posting.worker.ts | Unbounded findMany in checkScheduledPosts | Added take: 100 |
| ISSUE_026 | affiliate/products + links routes | Product/link lists return all tenants' data | Added channelPools.some ownership filter |

### LOW

| ID | File | Description | Fix Applied |
|----|------|-------------|-------------|
| ISSUE_011 | apps/web/src/lib/api.ts | Dead legacy API client | Deleted file + test |
| ISSUE_016 | .env.production.example | Missing 4 env vars | Added NEXT_PUBLIC_APP_URL, CORS_ORIGINS, JWT_REFRESH_SECRET, REGISTRATION_DISABLED |

## Accepted Risk (1)

| ID | File | Description | Rationale |
|----|------|-------------|-----------|
| ISSUE_001 | api-server.ts | JWT_SECRET dev fallback | Already throws in production. Dev fallback is intentional for local development. |

## Deferred (5)

| ID | Severity | Description | Reason |
|----|----------|-------------|--------|
| ISSUE_002 | MEDIUM | Alert model lacks tenantId | Requires Prisma schema migration — tracked as KI-065 |
| ISSUE_010 | LOW | SSE hooks orphaned | Retained for future system health dashboard |
| ISSUE_012 | LOW | class-variance-authority unused | Dependency removal — OPERATOR-TODO |
| ISSUE_013 | LOW | @fastify/websocket unused | Dependency removal — OPERATOR-TODO |
| ISSUE_014 | LOW | playwright-extra + stealth unused | Dependency removal — OPERATOR-TODO |
| ISSUE_015 | LOW | @types/bcrypt version mismatch | Version bump — OPERATOR-TODO |

## Files Modified

### Backend (packages/ + workers/)
- packages/shared/src/types.ts — Added warming types
- packages/shared/src/config.ts — ENCRYPTION_KEY production guard
- packages/shared/src/seasoning-types.ts — Import fix (circular dep)
- packages/shared/src/seasoning-config.ts — Import fix (circular dep)
- packages/shared/src/seasoning-orchestrator.ts — Import fix (circular dep)
- packages/storage/src/index.ts — MINIO_USE_SSL from env
- packages/browser-automation/src/types.ts — Re-export from shared
- workers/src/content.worker.ts — Publish status update
- workers/src/posting.worker.ts — Bounded query
- workers/src/production.worker.ts — Content type enum fix

### Frontend (apps/web/)
- apps/web/src/app/api/v1/auth/reset-password/route.ts — passwordChangedAt
- apps/web/src/app/api/v1/api-keys/route.ts — Admin scope check
- apps/web/src/app/api/v1/accounts/route.ts — Tenant guard
- apps/web/src/app/api/v1/accounts/[id]/socials/route.ts — Tenant guard
- apps/web/src/app/api/v1/channels/route.ts — Tenant guard
- apps/web/src/app/api/v1/channels/[id]/route.ts — Tenant guard
- apps/web/src/app/api/v1/channels/[id]/affiliate-pool/route.ts — Tenant guard
- apps/web/src/app/api/v1/schedule/route.ts — Tenant guard
- apps/web/src/app/api/v1/schedule/[id]/route.ts — Tenant guard
- apps/web/src/app/api/v1/affiliate/storefronts/route.ts — Tenant guard
- apps/web/src/app/api/v1/affiliate/products/route.ts — Tenant filter
- apps/web/src/app/api/v1/affiliate/products/[id]/route.ts — Tenant check fix
- apps/web/src/app/api/v1/affiliate/links/route.ts — Tenant filter
- apps/web/src/app/api/v1/affiliate/redirect/[shortCode]/route.ts — Rate limiting
- apps/web/src/app/api/v1/content/viral-score/route.ts — Rate limiting
- apps/web/src/app/api/v1/ai-services/route.ts — Service type enum fix
- apps/web/src/app/seasoning/page.tsx — AppLayout, error handling, loading states
- apps/web/src/app/seasoning/[cohortId]/page.tsx — Error handling
- apps/web/src/app/studio/[contentId]/page.tsx — Job ID extraction fix
- apps/web/src/lib/api.ts — DELETED (dead code)
- apps/web/src/__tests__/lib.test.ts — Removed dead test

### Config
- .env.production.example — OLLAMA_BASE_URL rename + 4 missing vars

## Out of Scope / Requires Manual Testing

- Live payment flows (no payment integration in codebase)
- Third-party OAuth flows (require real platform credentials)
- SMS delivery via SmsVerifier (D064 stub — requires real SMS service)
- CAPTCHA solving via CaptchaSolver (D064 stub — requires real service)
- ComfyUI workflow execution (requires running ComfyUI server)
- Remotion video rendering (requires Remotion server/headless Chrome)
- Email delivery (requires SMTP configuration)
- Full E2E browser tests (require running dev server — 181 Playwright tests exist)
