#!/usr/bin/env bash
# AiRevStream — environment doctor
# Verifies every prerequisite a fresh machine needs before `make bootstrap`.
# Prints PASS / FAIL / WARN for each check and an actionable summary.
#
# Exit codes:
#   0 — all required checks passed
#   1 — one or more required checks failed

set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# ── Colors (respect NO_COLOR / non-tty) ────────────────────────────────────
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  GREEN=""; YELLOW=""; RED=""; BLUE=""; BOLD=""; DIM=""; RESET=""
fi

FAIL_COUNT=0
WARN_COUNT=0
declare -a FIXES

pass() { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
fail() { printf "  ${RED}✗${RESET} %s\n" "$1"; FAIL_COUNT=$((FAIL_COUNT+1)); if [[ $# -ge 2 ]]; then FIXES+=("$2"); fi; }
warn() { printf "  ${YELLOW}!${RESET} %s\n" "$1"; WARN_COUNT=$((WARN_COUNT+1)); if [[ $# -ge 2 ]]; then FIXES+=("$2"); fi; }
info() { printf "  ${DIM}·${RESET} %s\n" "$1"; }
heading() { printf "\n${BOLD}${BLUE}%s${RESET}\n" "$1"; }

# ── 1. Tooling ─────────────────────────────────────────────────────────────
heading "Tooling"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    pass "node $(node --version)"
  else
    fail "node $(node --version) is too old (need ≥ 20)" "Install Node 20+: https://nodejs.org or \`brew install node\`"
  fi
else
  fail "node not found" "Install Node 20+: https://nodejs.org"
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm $(npm --version)"
else
  fail "npm not found" "Install Node (includes npm): https://nodejs.org"
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    pass "docker $(docker --version | awk '{print $3}' | tr -d ',') (daemon running)"
  else
    fail "docker installed but daemon not running" "Start Docker Desktop, then re-run \`make doctor\`"
  fi
else
  fail "docker not found" "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
fi

if command -v curl >/dev/null 2>&1; then
  pass "curl"
else
  warn "curl not found" "Install curl: \`brew install curl\`"
fi

if command -v openssl >/dev/null 2>&1; then
  pass "openssl"
else
  warn "openssl not found (needed to generate secrets)" "\`brew install openssl\`"
fi

# ── 2. Optional media tooling ──────────────────────────────────────────────
heading "Optional media tools (graceful-degrade if missing)"

if command -v ffmpeg >/dev/null 2>&1; then
  if ffmpeg -hide_banner -filters 2>&1 | grep -qi vmaf; then
    pass "ffmpeg with libvmaf (KI-069: VMAF quality regression enabled)"
  else
    warn "ffmpeg present but libvmaf not compiled in (VMAF tests will skip)" "\`brew uninstall ffmpeg && brew install ffmpeg\` — the default Homebrew build now includes libvmaf"
  fi
else
  warn "ffmpeg not found (VMAF quality regression disabled)" "\`brew install ffmpeg\`"
fi

if command -v c2patool >/dev/null 2>&1; then
  pass "c2patool $(c2patool --version 2>&1 | head -1)"
else
  warn "c2patool not found (C2PA provenance embedding disabled)" "\`brew install c2patool\`  (or download from https://github.com/contentauth/c2patool/releases)"
fi

# ── 3. Ports ───────────────────────────────────────────────────────────────
heading "Required ports"
check_port() {
  local port="$1" label="$2"
  if lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    local proc
    proc=$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR==2 {print $1}')
    warn "port $port ($label) already in use by: ${proc:-unknown}" "Stop the conflicting process or change the port in .env"
  else
    pass "port $port ($label) free"
  fi
}
for pair in "3000:web" "3011:workflow-engine" "3002:production-pipeline" "3003:ai-assistant" "5432:postgres" "6389:redis" "9000:minio-s3" "9001:minio-console" "11434:ollama"; do
  check_port "${pair%%:*}" "${pair##*:}"
done

# ── 4. .env file ───────────────────────────────────────────────────────────
heading ".env"
if [[ -f "$ROOT/.env" ]]; then
  pass ".env exists"

  # shellcheck disable=SC1090
  set -a; source "$ROOT/.env" 2>/dev/null || true; set +a

  check_secret() {
    local name="$1" min="$2" hint="$3"
    local val="${!name:-}"
    if [[ -z "$val" ]]; then
      fail "$name is missing" "$hint"
    elif [[ ${#val} -lt $min ]]; then
      fail "$name is too short (${#val} chars, need ≥ $min)" "$hint"
    else
      pass "$name present (${#val} chars)"
    fi
  }
  check_secret ENCRYPTION_KEY     32 "Generate with: openssl rand -hex 32 → put in .env"
  check_secret JWT_SECRET         32 "Generate with: openssl rand -hex 64 → put in .env"
  check_secret JWT_REFRESH_SECRET 32 "Generate with: openssl rand -hex 64 → put in .env"

  [[ -n "${DATABASE_URL:-}" ]] && pass "DATABASE_URL set" || fail "DATABASE_URL not set" "Copy the default from .env.example"
  [[ -n "${REDIS_URL:-}"    ]] && pass "REDIS_URL set"    || fail "REDIS_URL not set" "Copy the default from .env.example"
else
  fail ".env missing" "\`cp .env.example .env\`, then fill in ENCRYPTION_KEY / JWT_SECRET / JWT_REFRESH_SECRET"
fi

# ── 5. Infrastructure reachability ─────────────────────────────────────────
heading "Infrastructure (Docker containers)"
probe_tcp() {
  local host="$1" port="$2" label="$3"
  if (exec 3<>/dev/tcp/"$host"/"$port") 2>/dev/null; then
    exec 3<&- 3>&-
    pass "$label reachable on $host:$port"
  else
    warn "$label not reachable on $host:$port (expected if you haven't run \`make bootstrap\` yet)" "Start infra: \`docker compose up -d\` then wait ~15s for healthchecks"
  fi
}
# Redis uses host port 6389 → container 6379 to avoid clashing with a system-wide
# Homebrew redis on 6379. If you've overridden REDIS_URL in .env, we'll parse the
# port out of that instead.
REDIS_HOST_PORT=6389
if [[ -n "${REDIS_URL:-}" ]]; then
  parsed_port=$(printf '%s' "$REDIS_URL" | sed -n 's#.*:\([0-9][0-9]*\).*#\1#p' | tail -1)
  [[ -n "$parsed_port" ]] && REDIS_HOST_PORT="$parsed_port"
fi
probe_tcp 127.0.0.1 5432 "Postgres"
probe_tcp 127.0.0.1 "$REDIS_HOST_PORT" "Redis"
probe_tcp 127.0.0.1 9000 "MinIO"

# ── 6. Ollama ──────────────────────────────────────────────────────────────
heading "Ollama (local LLM)"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
REQUIRED_MODEL="${OLLAMA_DEFAULT_MODEL:-qwen3:8b}"
if command -v curl >/dev/null 2>&1 && curl -fsS -m 3 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  MODELS=$(curl -fsS -m 3 "$OLLAMA_URL/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | tr '\n' ',' | sed 's/,$//')
  pass "Ollama reachable at $OLLAMA_URL"
  if echo ",$MODELS," | grep -q ",$REQUIRED_MODEL,"; then
    pass "default model $REQUIRED_MODEL is installed"
  else
    warn "default model $REQUIRED_MODEL not installed (AI features will fail at first request)" "Either \`ollama pull $REQUIRED_MODEL\` OR set OLLAMA_DEFAULT_MODEL in .env to a tag you already have"
  fi
  info "models: ${MODELS:-<none>}"
else
  warn "Ollama not reachable at $OLLAMA_URL (AI chat + content generation will return 502)" "Install Ollama: https://ollama.com/download — then \`ollama pull $REQUIRED_MODEL\`"
fi

# ── 7. Summary ─────────────────────────────────────────────────────────────
heading "Summary"
if [[ $FAIL_COUNT -eq 0 ]] && [[ $WARN_COUNT -eq 0 ]]; then
  printf "  ${GREEN}${BOLD}✓ All checks passed.${RESET} You're ready for \`make bootstrap\`.\n\n"
  exit 0
fi

if [[ $FAIL_COUNT -gt 0 ]]; then
  printf "  ${RED}${BOLD}✗ %d required check(s) failed.${RESET}\n" "$FAIL_COUNT"
fi
if [[ $WARN_COUNT -gt 0 ]]; then
  printf "  ${YELLOW}${BOLD}! %d optional check(s) raised warnings.${RESET}\n" "$WARN_COUNT"
fi

if [[ ${#FIXES[@]} -gt 0 ]]; then
  printf "\n${BOLD}Suggested next steps${RESET}\n"
  # de-duplicate
  printf "%s\n" "${FIXES[@]}" | awk '!seen[$0]++' | while IFS= read -r line; do
    printf "  • %s\n" "$line"
  done
fi

printf "\n"
if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
