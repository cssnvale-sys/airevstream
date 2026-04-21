.PHONY: help bootstrap doctor dev build test audit lint clean reset \
	docker-build docker-up docker-down docker-logs logs logs-web logs-workers \
	db-migrate db-seed db-studio db-generate

help:
	@printf "\n\033[1mAiRevStream — Makefile targets\033[0m\n\n"
	@printf "  \033[1mFirst-time setup\033[0m\n"
	@printf "    make doctor           Diagnose environment (Docker, ports, .env secrets, Ollama)\n"
	@printf "    make bootstrap        One-shot: infra + install + migrate + build (idempotent)\n"
	@printf "\n  \033[1mDaily development\033[0m\n"
	@printf "    make dev              Start all services via turbo (foreground)\n"
	@printf "    make build            Build all workspaces\n"
	@printf "    make test             Run all unit tests\n"
	@printf "    make audit            Run codebase audit tests\n"
	@printf "    make logs             Tail all docker compose logs\n"
	@printf "    make logs-web         Tail apps/web logs via PM2 (if running)\n"
	@printf "    make logs-workers     Tail workers logs via PM2 (if running)\n"
	@printf "\n  \033[1mDatabase\033[0m\n"
	@printf "    make db-migrate       Apply pending Prisma migrations\n"
	@printf "    make db-generate      Regenerate Prisma client\n"
	@printf "    make db-studio        Open Prisma Studio\n"
	@printf "    make db-seed          Run Prisma seed (no-op if none defined)\n"
	@printf "\n  \033[1mInfrastructure\033[0m\n"
	@printf "    make docker-up        docker compose up -d\n"
	@printf "    make docker-down      docker compose down (keeps volumes)\n"
	@printf "    make reset            ⚠  Nuke containers + volumes + build artifacts, re-bootstrap\n"
	@printf "    make clean            Remove build artifacts only (keeps DB)\n"
	@printf "\n  \033[1mDocker images (production)\033[0m\n"
	@printf "    make docker-build     Build all production images\n\n"

# ── First-time setup ──
bootstrap:
	@bash scripts/bootstrap.sh

doctor:
	@bash scripts/doctor.sh

# ── Development ──
dev:
	npx turbo dev

build:
	npx turbo build

test:
	npx turbo test

audit:
	npx turbo audit

# ── Database ──
db-migrate:
	npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

db-seed:
	npx prisma db seed --schema=packages/db/prisma/schema.prisma

db-studio:
	npx prisma studio --schema=packages/db/prisma/schema.prisma

db-generate:
	npx prisma generate --schema=packages/db/prisma/schema.prisma

# ── Docker (infrastructure only) ──
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs logs:
	docker compose logs -f

logs-web:
	@npx pm2 logs airevstream-web 2>/dev/null || printf "PM2 not running — use \`npx turbo dev\` logs instead.\n"

logs-workers:
	@npx pm2 logs airevstream-workers 2>/dev/null || printf "PM2 not running — use \`npx turbo dev\` logs instead.\n"

# ── Docker (full app) ──
docker-build:
	docker build -f Dockerfile.web -t airevstream-web .
	docker build -f Dockerfile.services --build-arg SERVICE=workflow-engine -t airevstream-workflow-engine .
	docker build -f Dockerfile.services --build-arg SERVICE=ai-assistant -t airevstream-ai-assistant .
	docker build -f Dockerfile.services --build-arg SERVICE=production-pipeline -t airevstream-production-pipeline .
	docker build -f Dockerfile.workers -t airevstream-workers .

# ── Cleanup ──
clean:
	rm -rf node_modules/.cache
	rm -rf apps/web/.next
	rm -rf packages/*/dist services/*/dist workers/dist
	rm -rf .turbo

reset:
	@printf "\033[33m! This will nuke containers AND volumes (your local DB data will be lost).\033[0m\n"
	@printf "Press Ctrl-C to abort, or Enter to continue… "
	@read _
	docker compose down -v || true
	$(MAKE) clean
	$(MAKE) bootstrap
