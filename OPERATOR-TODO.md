# Operator TODO

Actions needed from the operator to bring AiRevStream online and keep it running.

---

## 🚀 First-time setup (fresh machine)

**TL;DR** — three commands, in this order:

```bash
cp .env.example .env        # then edit: fill in ENCRYPTION_KEY, JWT_SECRET, JWT_REFRESH_SECRET
make doctor                 # verifies Docker, ports, secrets, Ollama
make bootstrap              # infra + install + migrate + build (idempotent)
npm run dev                 # start everything
```

Then open <http://localhost:3000> and register. You become the admin of a new tenant.

### Generate the three required secrets

```bash
# Paste the outputs into your .env file.
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

All three are now **required at startup** (no silent dev fallback). If they're missing or too short, every service will refuse to start with a clear, actionable message.

### What `make doctor` checks

- Node ≥ 20, npm, docker (daemon running), openssl, curl
- Required ports free: 3000 (web), 3011 (workflow-engine), 3002 (production-pipeline), 3003 (ai-assistant), 5432 (postgres), 6389 (redis, host-mapped from container 6379), 9000/9001 (MinIO), 11434 (Ollama)
- Port 3011 (instead of 3001) avoids collision with mission-control / openclaw dashboards; port 6389 avoids collision with Homebrew's default Redis on 6379. If either 3000 or 11434 is in use by another project (e.g. `delegayt-dashboard` LaunchAgent), disable it with `launchctl bootout gui/$UID/<label>` or edit `.env` `PORT=`.
- `.env` present and every required secret ≥ 32 chars
- Postgres / Redis / MinIO reachable
- Ollama reachable and `qwen3:8b` installed
- Optional: `ffmpeg` with libvmaf (VMAF), `c2patool` (C2PA)

### What `make bootstrap` does

1. Runs `make doctor` and aborts if required checks fail
2. `docker compose up -d` — starts Postgres, Redis, MinIO (+ minio-init for bucket/CORS)
3. Waits for all containers to be healthy (polls `docker inspect`, 60s timeout per service)
4. `npm install` — installs all workspaces
5. `prisma generate` + `prisma migrate deploy` — applies all 11 migrations
6. `turbo build` — builds every package, service, and app
7. Prints a "ready" banner with the next commands to run

Re-run `make bootstrap` any time — every step is idempotent.

---

## Optional external services

These are gracefully skipped if absent; the app still runs.

### Ollama (local LLM) — required for AI features

Install: <https://ollama.com/download>. Default model is `qwen3:8b`:

```bash
ollama pull qwen3:8b
# verify:
curl http://localhost:11434/api/tags
```

Without Ollama, AI chat and content generation return 502 at the endpoint level; the dashboard, CRUD, and publishing all still work.

#### Choosing the default model (D131)

The resolution order at every Ollama call site is:

1. Explicit `request.model` passed by the caller
2. `OLLAMA_DEFAULT_MODEL` env var (trimmed)
3. Seeded `AiService.capabilities.defaultModel` in the DB (registry paths only)
4. Compiled fallback: `qwen3:8b`

If you pull a larger tag (e.g. `qwen3.5:122b` on a 512 GB Mac Studio) and want it to be the default everywhere, set `OLLAMA_DEFAULT_MODEL=qwen3.5:122b` in `.env`. No DB edit required.

#### Thinking mode is off by default (D132)

Thinking-capable models (qwen3, deepseek-r1, etc.) default to non-thinking mode — every call passes `think: false` to ollama.chat() and any `<think>...</think>` blocks are stripped defensively (including across streaming chunk boundaries). Typical content-generation latency on qwen3:8b: ~1 minute (vs ~4 minutes with thinking on).

To opt a single call into reasoning mode, set `think: true` on the `TextRequest` / `ChatRequest`. Only do this for code paths that genuinely benefit from chain-of-thought (complex research synthesis, multi-step planning). The HICC content pipeline, caption generation, and thumbnail prompts do **not** need it.

### ComfyUI (image generation) — optional

Install: <https://github.com/comfyanonymous/ComfyUI>. Start on port 8188. Image jobs fail gracefully if ComfyUI is absent.

### ffmpeg + libvmaf (KI-069) — optional

For VMAF-based quality regression tests.

```bash
brew install ffmpeg        # Homebrew's default build now includes libvmaf
ffmpeg -filters 2>&1 | grep vmaf   # verify
```

### c2patool (KI-069) — optional

For embedding C2PA Content Credentials into media files.

```bash
brew install c2patool
# or download a release: https://github.com/contentauth/c2patool/releases
c2patool --version
```

---

## Platform publishing credentials (required only to actually publish)

The posting adapters are implemented for YouTube Data API v3, TikTok Content Posting, Instagram Graph, Facebook Graph, and Twitter OAuth 2.0, but none are tested against live endpoints (KI-007).

Set these in `.env` when you're ready to publish:

| Platform  | Env vars | Where to get them |
|-----------|----------|-------------------|
| YouTube   | `YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 + API key |
| TikTok    | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | <https://developers.tiktok.com> |
| Instagram | Meta Developer app — shared with Facebook | <https://developers.facebook.com> |
| Facebook  | Same Meta Developer app | <https://developers.facebook.com> |

OAuth flows are wired; you connect accounts through the Accounts page UI after setting the credentials.

## Signup automation (optional — seasoning pipeline only, KI-063)

- `CAPTCHA_SOLVER_API_KEY` — 2Captcha (<https://2captcha.com>)
- `SMS_VERIFIER_API_KEY` — sms-activate.org

Both default to HITL fallback when absent.

---

## Production deployment

1. Copy `.env.production.example` → `.env` on the production host; fill in every value.
2. `make docker-build` to build all five images.
3. Run with your orchestrator of choice (docker compose, k8s, ECS, …).

For regenerating production secrets:

```bash
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET
```

Set `CORS_ORIGINS` to your real frontend URL(s), comma-separated, no trailing slashes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `make bootstrap` aborts at "waiting for airevstream-postgres" | Docker Desktop not running, or port 5432 already taken by another Postgres | `make doctor` tells you which; start Docker or `brew services stop postgresql@14` |
| Services start but every API call 500s | `.env` secrets missing; services now fail fast with a clear message on stderr | Check the terminal — the error names exactly which secret is missing |
| `npm run dev` → "Invalid environment configuration" | Malformed URL in `.env` (usually `DATABASE_URL` or `OLLAMA_BASE_URL`) | Copy the default from `.env.example` |
| Dashboard loads but AI chat returns 502 | Ollama not installed or not running | `ollama serve` (or install from <https://ollama.com/download>) + `ollama pull qwen3:8b` |
| MinIO uploads fail with CORS errors | `minio-init` container didn't run or failed | `docker logs airevstream-minio-init`, or `docker compose restart minio-init` |
| "delegayt-dashboard" serving on :3000 instead of AiRevStream (KI-056) | Another Next.js app running on the same port | Kill it: `lsof -iTCP:3000 -sTCP:LISTEN` → `kill <PID>` |
| Content job appears stuck at `generating` for > 3 min | Thinking mode wasn't fully disabled before this version, OR the model is still being loaded into VRAM on first call | Confirm the real state — `redis-cli -p 6389 HGETALL bull:content:<id>` will show `finishedOn` and `returnvalue` if the job actually completed. First qwen3:8b call after `ollama serve` warms the model (~30-60s); subsequent calls are fast. |
| Workers process exits silently, jobs stuck in `active` with stale locks | Uncaught exception in a BullMQ processor (pre-session-49) | Already fixed — `workers/src/index.ts` now installs `uncaughtException` / `unhandledRejection` handlers that log full stacks via Pino before exit. If it happens again, the stack trace will be in the pino output. |

---

## Summary of what's blocked without external setup

| Feature | Blocked by | Severity |
|---------|-----------|----------|
| AI chat & content generation | Ollama not installed | Medium — install to use AI |
| Image generation | ComfyUI not installed | Low — optional |
| Video rendering (Remotion) | — | None — ready to use |
| Cross-platform publishing | Platform OAuth credentials | Medium — placeholders work for testing |
| VMAF quality regression | ffmpeg + libvmaf not installed | Low — graceful skip |
| C2PA content credentials | c2patool not installed | Low — graceful skip |
| CAPTCHA / SMS during signup | API keys not set | Low — HITL fallback |
