#!/usr/bin/env bash
# Session 49 — D017 4-commit split
#
# Applies the four commits (backend → frontend → docs → housekeeping) for all
# Session 49 work: fresh-machine bringup infra (scripts/, Makefile, docker
# compose fixes, fail-fast config), E2E runtime verification + fixes (Ollama
# think:false, worker host-process hardening), plus the smaller feature edits
# and tracking-file updates. The sandbox cannot delete .git/index.lock so the
# commits are performed on the host. Re-runnable: each `git add` + `git diff
# --cached --quiet` guard is a no-op after the first successful commit.
#
# Run from anywhere inside the repo:
#   bash scripts/session-49-commit.sh

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Clear any stale lock left by an interrupted sandbox process.
if [[ -f .git/index.lock ]]; then
  echo "Removing stale .git/index.lock"
  rm -f .git/index.lock
fi

# Sanity: make sure we're on the right repo. Prefer remote URL, fall back to
# the root folder name (new repos often have no remote configured yet).
repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"
remote_url="$(git remote -v 2>/dev/null | awk 'NR==1{print $2}')"
if [[ "$remote_url" != *airevstream* && "$repo_name" != *airevstream* ]]; then
  echo "WARNING: this doesn't look like the airevstream repo (root=$repo_root). Aborting." >&2
  exit 1
fi

# ──────────────────────────────────────────────────────────────────────────
# Commit 1: Backend — packages/, services/, workers/
# ──────────────────────────────────────────────────────────────────────────
echo "→ Staging backend changes"
git add \
  packages/ai-client/src/index.ts \
  packages/ai-client/src/providers/ollama.ts \
  packages/ai-client/src/registry.ts \
  packages/ai-client/src/types.ts \
  packages/shared/src/config.ts \
  packages/shared/src/constants.ts \
  services/ai-assistant/src/app.ts \
  services/ai-assistant/src/index.ts \
  services/production-pipeline/src/app.ts \
  services/production-pipeline/src/index.ts \
  services/workflow-engine/src/app.ts \
  services/workflow-engine/src/index.ts \
  services/workflow-engine/src/routes/account.ts \
  services/workflow-engine/src/routes/content.ts \
  services/workflow-engine/src/routes/workflow.ts \
  services/workflow-engine/src/lib/tenant.ts \
  workers/src/index.ts \
  workers/src/__tests__/account.worker.test.ts \
  workers/src/__tests__/content.worker.test.ts \
  workers/src/__tests__/posting.worker.test.ts

if ! git diff --cached --quiet; then
  git commit -F - <<'COMMIT_MSG_1'
fix: backend — fail-fast env, Ollama think:false, worker host hardening

Session 49 backend work across packages/, services/, workers/:

- packages/shared: strict Zod validation of process.env at startup (D130) —
  every process that loads @airevstream/shared/config now refuses to boot
  with a complete list of missing/placeholder secrets instead of silently
  falling back to demo values. New constants for the Redis (6389) and
  workflow-engine (3011) port reassignments that avoid Homebrew redis +
  openclaw collisions on developer Macs.
- packages/ai-client: env override resolution at request time so
  OLLAMA_DEFAULT_MODEL actually wins over the seeded DB capability on the
  main ServiceRegistry path (D131). Default think=false on all three
  Ollama chat methods with defensive <think></think> stripping, including
  cross-chunk streaming boundaries (D132). Typical content-gen latency on
  qwen3:8b drops from ~4 min to ~1 min. TextRequest/ChatRequest gain
  optional think?: boolean for explicit opt-in.
- services/*: Fastify app factories split from entry points for startup
  testability; workflow-engine tenant-scoping helper extracted to src/lib.
- workers: process.setMaxListeners(20) (9 BullMQ workers + shutdown
  handlers exceeded Node's default 10), plus uncaughtException /
  unhandledRejection handlers that log full stacks via Pino before exit.
  Eliminates the silent worker deaths that previously left jobs stuck in
  `active` with stale locks (KI-091, KI-092).
- workers/__tests__: new unit tests for account, content, posting workers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
COMMIT_MSG_1
else
  echo "  (nothing to commit for backend)"
fi

# ──────────────────────────────────────────────────────────────────────────
# Commit 2: Frontend — apps/web/
# ──────────────────────────────────────────────────────────────────────────
echo "→ Staging frontend changes"
git add \
  apps/web/src/app/api/v1/content/generate-storyboard/route.ts \
  apps/web/src/app/api/v1/pipeline/simple-plan/route.ts \
  apps/web/src/app/calendar/page.tsx \
  apps/web/src/app/system/page.tsx \
  apps/web/src/components/cinema/bible-editor.tsx \
  apps/web/src/components/cinema/simple-create-wizard.tsx \
  apps/web/src/lib/api-server.ts

if ! git diff --cached --quiet; then
  git commit -F - <<'COMMIT_MSG_2'
feat: frontend — simple-plan API, calendar/storyboard/bible editor polish

Session 49 frontend work under apps/web/:

- New POST /api/v1/pipeline/simple-plan route that drives the simple-mode
  cinema wizard end-to-end (tenant-scoped, Zod-validated body).
- generate-storyboard route hardening (error paths, input validation).
- calendar page gains additional filters and drag-rescheduling polish.
- bible-editor receives ~200-line editor rewrite for inline section editing
  and validation feedback.
- simple-create-wizard wires the new simple-plan endpoint + constraint
  validation surfaces.
- system page copy + minor label fixes against updated service ports.
- lib/api-server tightens authenticate() edge cases (deleted-user handling).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
COMMIT_MSG_2
else
  echo "  (nothing to commit for frontend)"
fi

# ──────────────────────────────────────────────────────────────────────────
# Commit 3: Docs — tracking files and CLAUDE rules
# ──────────────────────────────────────────────────────────────────────────
echo "→ Staging docs changes"
git add \
  CLAUDE.md \
  .claude/rules/03-monorepo-map.md \
  CHANGELOG.md \
  DECISIONS.md \
  DEV-STATUS.md \
  KNOWN-ISSUES.md \
  OPERATOR-TODO.md \
  SESSION-LOG.md \
  MEMORY.md

if ! git diff --cached --quiet; then
  git commit -F - <<'COMMIT_MSG_3'
docs: session 49 — bringup, E2E verification, tracking files

Updates all tracking files for Session 49 work:

- SESSION-LOG: fresh-machine bootstrap + end-to-end runtime verification
  (2026-04-21). Documents the baseline checks, 7-step real-user-flow, the
  three surfaced caveats (thinking-mode latency, silent worker death,
  MaxListenersExceededWarning), and the three fixes applied.
- CHANGELOG: Session 49 Fixed entries for Ollama think:false default,
  workers uncaughtException handler, MaxListeners bump.
- KNOWN-ISSUES: KI-090 (thinking-mode latency — FIXED), KI-091 (silent
  worker crash — FIXED), KI-092 (MaxListenersExceededWarning — FIXED).
- DECISIONS: D130 (fail-fast env validation + scripted bootstrap), D131
  (OLLAMA_DEFAULT_MODEL env trumps code + DB defaults), D132 (Ollama
  think defaults off; opt-in per request).
- DEV-STATUS: Phase 30 rows BM-9/10/11 (content pipeline E2E verified,
  think:false default, worker host hardening).
- OPERATOR-TODO: full rewrite around the `make doctor` / `make bootstrap`
  two-step bringup with concrete port + secret guidance. Adds guidance on
  OLLAMA_DEFAULT_MODEL resolution order (D131) and per-call think=true
  opt-in (D132). Two new troubleshooting rows for stuck content jobs and
  silent worker deaths.
- MEMORY.md (new): runtime verification shortcuts (Redis as source of
  truth for BullMQ job state, TTL=-2 semantics, queue key conventions),
  Ollama think patterns, Node worker hardening, macOS shell gotchas,
  HICC beat tags.
- CLAUDE.md + .claude/rules: minor cross-reference updates.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
COMMIT_MSG_3
else
  echo "  (nothing to commit for docs)"
fi

# ──────────────────────────────────────────────────────────────────────────
# Commit 4: Housekeeping — env, compose, Makefile, scripts/, ecosystem
# ──────────────────────────────────────────────────────────────────────────
echo "→ Staging housekeeping changes"
git add \
  .env.example \
  docker-compose.yml \
  ecosystem.config.js \
  Makefile \
  remotion/package.json \
  scripts/bootstrap.sh \
  scripts/doctor.sh

if ! git diff --cached --quiet; then
  git commit -F - <<'COMMIT_MSG_4'
chore: fresh-machine bringup scripts, compose + env + Makefile fixes

Housekeeping for Session 49 bringup infra (D130, KI-087):

- scripts/doctor.sh: preflight — Docker running, required CLI versions,
  optional CLI (ffmpeg/c2patool) with brew hints, host port collision
  check (3000/3011/3002/3003/6389/5432/9000/11434), .env present with
  non-empty secrets, Ollama reachable with qwen3:8b installed.
- scripts/bootstrap.sh: idempotent bringup — docker compose up → wait
  healthy → prisma migrate deploy → turbo build → ready banner. Stops
  short of admin creation / dev servers by design.
- Makefile: `make doctor`, `make bootstrap`, `make reset` targets wire
  the scripts into the standard project workflow.
- docker-compose.yml: minio-init entrypoint replaced with single-line
  echo so the CORS JSON survives YAML folding (KI-087 fixed). Redis
  host port remapped to 6389:6379 to avoid Homebrew redis collision.
- .env.example: documents OLLAMA_DEFAULT_MODEL, the new port defaults,
  and the three required secrets (ENCRYPTION_KEY, JWT_SECRET,
  JWT_REFRESH_SECRET) with generation one-liners.
- ecosystem.config.js: Session 49 port reassignments for consistency
  with docker-compose and .env.example.
- remotion/package.json: `dev` = silent `tsc --watch`; opt-in `studio`
  = `remotion studio src/Root.tsx`. Stops auto-launching :3004 studio
  on every `turbo dev`.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
COMMIT_MSG_4
else
  echo "  (nothing to commit for housekeeping)"
fi

echo ""
echo "======================================================"
echo "All four commits applied."
echo "Review:   git log --oneline -4"
echo "Push:     git push        (only when you are ready)"
echo "======================================================"
