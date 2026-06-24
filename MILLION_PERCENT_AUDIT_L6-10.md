# AIRevStream Audit — Layers 6-10

**Date:** 2026-06-24 | **Method:** Read-only checks, no containers restarted

---

## L6: Infrastructure & Queue Health

- **Docker containers:** Redis, PostgreSQL, MinIO all healthy (Up 4h). ⚠️ `leadgen-f6-scoring_api-1` restarting (not AIRevStream, but shares host).
- **Redis keys:** BullMQ queues active (`posting`, `research`, `seasoning`, `experiment`). Repeat jobs present — system is processing scheduled work.
- **Retry/backoff:** Workers have exponential backoff configured in `lifecycle.worker.ts` (attempts + exponential delay) and `account.worker.ts` (2 attempts, 30-60s backoff). ✅ Good.

## L7: Database & Migrations

- **Migrations:** 11 migrations found, schema up to date. ✅
- **Tables:** ~50 tables (53 lines in `\dt` output = ~49 tables + headers).
- **Users:** 19 total users.
- **Test/E2E users:** 17 test/e2e users in DB. 🔴 **CRITICAL** — Test data not cleaned. Includes `test@example.com`, `audit-test@airevstream.ai`, multiple `e2e-register-*@e2e-test.local`.

## L8: Storage & AI Infra

- **Redis maxmemory-policy:** `noeviction` — writes will fail when memory full. 🟡 **MEDIUM** — should be `allkeys-lru` for cache workloads.
- **Ollama:** Running, 5 models available (gemma2:latest, qwen3.5:122b, qwen3:4b, qwen2.5vl:7b, qwen3:8b). ✅
- **MinIO health:** Responding (empty body = healthy live check). ✅
- **.env vs .env.example:** Significant drift — .env.example has structured headers/comments, .env has bare values. 🟡 **LOW** — cosmetic but could mask missing vars.

## L9: API Security

- **Rate limiting:** All 3 Fastify services register `@fastify/rate-limit` (100 req/min). ✅ Good baseline.
- **CORS:** All services use `@fastify/cors` with `origin: allowedOrigins` + `credentials: true`. ✅ Properly configured (not wildcard).
- **Helmet/CSP/HSTS:** No results found. 🔴 **HIGH** — No security headers (CSP, HSTS, X-Frame-Options) on any service. Should add `@fastify/helmet`.

## L10: Error Handling

- **API routes:** `apps/web/src/app/api` has structured error handling — try/catch blocks with typed error responses (`VALIDATION_ERROR`, `INTERNAL_ERROR`, `FORBIDDEN`, `RATE_LIMITED`). Logging via pino. ✅ Good.
- **Services:** Minimal error handling found in `services/` — only `ai-assistant/chat.ts` has try/catch with graceful degradation (falls back to legacy AI client). 🟡 **MEDIUM** — Other service routes may lack comprehensive error handling, or patterns are in middleware not captured by grep.

---

## Summary by Severity

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 Critical | 2 | Test/e2e users in DB (17); No security headers (Helmet/CSP/HSTS) |
| 🟡 Medium | 3 | Redis noeviction policy; Sparse service-level error handling; .env drift |
| 🟢 Info/OK | 5 | Migrations current; Ollama healthy; MinIO healthy; Rate limiting present; CORS properly configured |
| **Total Findings** | **10** | |