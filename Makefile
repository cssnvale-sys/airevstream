.PHONY: dev build test audit lint clean docker-build docker-up docker-down db-migrate db-seed db-studio

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

docker-logs:
	docker compose logs -f

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
