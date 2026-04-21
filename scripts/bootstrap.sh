#!/usr/bin/env bash
# AiRevStream — one-shot fresh-machine bootstrap
# Safe to re-run; each step is idempotent.
#
# Steps:
#   1. Sanity-check .env and required secrets
#   2. Start infrastructure (docker compose up -d)
#   3. Wait for Postgres / Redis / MinIO to be healthy
#   4. npm install (root-level workspaces)
#   5. Generate Prisma client
#   6. Apply Prisma migrations
#   7. Build all packages (turbo build)
#   8. Print "ready" message with next steps
#
# Exit 0 on success, nonzero on any failure.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  GREEN=""; YELLOW=""; RED=""; BLUE=""; BOLD=""; DIM=""; RESET=""
fi

step()   { printf "\n${BOLD}${BLUE}▶ %s${RESET}\n" "$1"; }
ok()     { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
fail()   { printf "  ${RED}✗${RESET} %s\n" "$1" 1>&2; exit 1; }
info()   { printf "  ${DIM}· %s${RESET}\n" "$1"; }

trap 'fail "bootstrap aborted. Run \`make doctor\` to diagnose."' ERR

# ── 0. Preflight: ensure doctor passes (required checks) ──────────────────
step "0/7 Running doctor checks"
if ! bash "$ROOT/scripts/doctor.sh"; then
  fail "Doctor reported failures. Fix them, then re-run \`make bootstrap\`."
fi

# ── 1. .env sanity ─────────────────────────────────────────────────────────
step "1/7 Verifying .env"
if [[ ! -f "$ROOT/.env" ]]; then
  fail ".env missing. Run: cp .env.example .env — then fill ENCRYPTION_KEY / JWT_SECRET / JWT_REFRESH_SECRET."
fi
ok ".env present"

# ── 2. Infrastructure ──────────────────────────────────────────────────────
step "2/7 Starting Docker infrastructure"
if ! command -v docker >/dev/null 2>&1; then
  fail "docker not found. Install Docker Desktop first."
fi
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon not running. Start Docker Desktop, then re-run."
fi

docker compose up -d
ok "docker compose up -d issued"

# ── 3. Wait for infra health ───────────────────────────────────────────────
step "3/7 Waiting for Postgres / Redis / MinIO to be healthy"
wait_healthy() {
  local name="$1" timeout=60 elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "starting")
    if [[ "$status" == "healthy" ]]; then
      ok "$name healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed+2))
    printf "  ${DIM}· waiting for %s (%s) %ds…${RESET}\r" "$name" "$status" "$elapsed"
  done
  printf "\n"
  fail "$name did not become healthy within ${timeout}s. Inspect: docker logs $name"
}
wait_healthy airevstream-postgres
wait_healthy airevstream-redis
wait_healthy airevstream-minio

# minio-init is a one-shot container; wait for it to exit 0
info "waiting for minio-init (bucket + CORS)"
for i in $(seq 1 30); do
  state=$(docker inspect --format='{{.State.Status}}' airevstream-minio-init 2>/dev/null || echo "missing")
  exit_code=$(docker inspect --format='{{.State.ExitCode}}' airevstream-minio-init 2>/dev/null || echo "999")
  if [[ "$state" == "exited" ]] && [[ "$exit_code" == "0" ]]; then
    ok "minio-init completed"
    break
  fi
  if [[ "$state" == "exited" ]] && [[ "$exit_code" != "0" ]]; then
    fail "minio-init exited with code $exit_code — inspect: docker logs airevstream-minio-init"
  fi
  sleep 1
done

# ── 4. Install dependencies ────────────────────────────────────────────────
step "4/7 Installing npm workspaces"
npm install
ok "npm install completed"

# ── 5. Prisma generate ─────────────────────────────────────────────────────
step "5/7 Generating Prisma client"
npx prisma generate --schema=packages/db/prisma/schema.prisma
ok "prisma client generated"

# ── 6. Prisma migrate ──────────────────────────────────────────────────────
step "6/7 Applying Prisma migrations"
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
ok "migrations applied"

# ── 7. Build ───────────────────────────────────────────────────────────────
step "7/7 Building workspaces"
npx turbo build
ok "build complete"

# ── Ready ──────────────────────────────────────────────────────────────────
printf "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${RESET}\n"
printf "${GREEN}${BOLD} ✓ AiRevStream is ready${RESET}\n"
printf "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${RESET}\n\n"
printf "Next steps:\n"
printf "  1. Start the dev stack:  ${BOLD}npm run dev${RESET}\n"
printf "  2. Open the dashboard:   ${BOLD}http://localhost:3000${RESET}\n"
printf "  3. Register a new user — you'll become the admin for a new tenant.\n\n"
printf "Helpful commands:\n"
printf "  ${DIM}make doctor${RESET}   — verify your environment\n"
printf "  ${DIM}make logs${RESET}     — tail all docker compose logs\n"
printf "  ${DIM}make reset${RESET}    — nuke containers + volumes, rebuild from scratch\n\n"
