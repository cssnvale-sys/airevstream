# Operator TODO

Items that need your action before the system is fully operational.

---

## Audit Cleanup — Dependency Housekeeping (Session 27)

### Unused Dependencies (remove to reduce bundle/install size)
```bash
# Remove unused class-variance-authority from web
cd apps/web && npm uninstall class-variance-authority && cd ../..

# Remove unused @fastify/websocket from ai-assistant
cd services/ai-assistant && npm uninstall @fastify/websocket && cd ../..

# Remove unused stealth libraries from browser-automation
cd packages/browser-automation && npm uninstall playwright-extra puppeteer-extra-plugin-stealth && cd ../..
```

### Version Update
```bash
# Update bcrypt types to match v6
cd apps/web && npm install @types/bcrypt@^6.0.0 && cd ../..
```

### Database Migration (Tenant isolation — DONE in Session 30, migration pending apply)
Migration `0004_add_tenant_scoping` adds tenantId to Alert (nullable), Conversation, KnowledgeBaseEntry, PromptTemplate, CostBudget (required). Apply when database is available:
```bash
npx prisma migrate deploy
```

---

## Seasoning Pipeline Setup (Session 25)

### Required: Database Migration
```bash
npx prisma migrate dev --name add_seasoning_models
```
Run this to create the `seasoning_cohorts` and `seasoning_enrollments` tables.

### Optional: CAPTCHA Solving Service
Set `CAPTCHA_SOLVER_API_KEY` in `.env` with a [2Captcha](https://2captcha.com/) API key. This enables automated CAPTCHA solving during account signup. Without it, all CAPTCHAs will fall back to human-in-the-loop resolution.

### Optional: SMS Verification Service
Set `SMS_VERIFIER_API_KEY` in `.env` with an [sms-activate.org](https://sms-activate.org/) API key. This provides disposable phone numbers for platform SMS verification during signup. Without it, SMS verification steps will require manual intervention.

---

## 1. Start Infrastructure (if not already running)

```bash
# From the project root:
docker compose up -d
```

This starts PostgreSQL, Redis, and MinIO.

---

## 2. Install All Dependencies

```bash
npm install
```

---

## 3. Run Database Migrations

```bash
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

This applies the two migrations (init + GIN fulltext indexes) to create all 36 tables. For development, you can also use `npx prisma migrate dev --schema=packages/db/prisma/schema.prisma`.

---

## 4. Set Up Ollama (Required for AI Features)

1. Install Ollama: https://ollama.com/download
2. Pull a model (The system defaults to `qwen3:8b`):
   ```bash
   ollama pull qwen3:8b
   ```
3. Verify it's running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

**Note**: Since you already have `qwen3:8b` installed, you can skip Step 4.2.

Without Ollama, the AI chat and content generation features will return 502 errors. Everything else works fine.

---

## 5. Set Up ComfyUI (Optional — for Image Generation)

1. Install ComfyUI: https://github.com/comfyanonymous/ComfyUI
2. Start it on port 8188 (default)
3. The production-pipeline service will connect automatically

This is optional — the system works without it. Image generation jobs will fail gracefully.

---

## 6. Platform API Keys (Required for Publishing)

The posting worker currently uses **placeholders** for platform APIs. To actually publish content, you need to:

1. **YouTube**: Create OAuth2 credentials in Google Cloud Console
2. **TikTok**: Register a TikTok Developer app
3. **Instagram**: Set up a Meta Developer app (Instagram Graph API)
4. **Twitter**: Create a Twitter Developer app (OAuth 2.0)
5. **Facebook**: Use the same Meta Developer app as Instagram

Add API keys/OAuth credentials to `.env` and implement the platform-specific publishing logic in `workers/src/posting.worker.ts`.

---

## 7. Generate Encryption Keys (Already Done in .env)

Your `.env` already has generated keys for:
- `ENCRYPTION_KEY` — used for encrypting stored API tokens
- `JWT_SECRET` — used for JWT authentication
- `JWT_REFRESH_SECRET` — used for refresh tokens

**For production**: Regenerate these with:
```bash
openssl rand -hex 32  # for ENCRYPTION_KEY
openssl rand -hex 64  # for JWT_SECRET and JWT_REFRESH_SECRET
```

---

## 8. Start the Services

### Development mode (all at once):
```bash
npm run dev
```

### Or individually:
```bash
# Terminal 1: Web dashboard
cd apps/web && npm run dev

# Terminal 2: Workflow engine API
cd services/workflow-engine && npm run dev

# Terminal 3: AI assistant
cd services/ai-assistant && npm run dev

# Terminal 4: Production pipeline
cd services/production-pipeline && npm run dev

# Terminal 5: Workers
cd workers && npm run dev
```

### Production mode:
```bash
npm run build
npx pm2 start ecosystem.config.js
```

---

## 9. Access the Dashboard

Open http://localhost:3000 in your browser and register a new account.

---

## 10. Remotion (Already Set Up)

Remotion is installed and configured with 3 compositions in `remotion/`:
- **ShortFormVideo** (9:16) — vertical short-form with H.I.C.C. beat timing
- **LongFormVideo** (16:9) — horizontal long-form
- **ThumbnailRenderer** — still image thumbnails

The production worker renders via Remotion CLI. No additional setup needed.

---

## 11. CORS Origins (Session 17)

All 3 Fastify services now restrict CORS to the origins listed in `CORS_ORIGINS`. Default: `http://localhost:3000`.

For production, set this in your `.env`:
```bash
CORS_ORIGINS=https://dashboard.yourdomain.com,https://staging.yourdomain.com
```

Comma-separated list, no trailing slashes.

---

## 11. Docker Deployment (Optional)

Build and run the full app via Docker:

```bash
# Build all images
make docker-build

# Or individually:
docker build -f Dockerfile.web -t airevstream-web .
docker build -f Dockerfile.services --build-arg SERVICE=workflow-engine -t airevstream-workflow-engine .
docker build -f Dockerfile.services --build-arg SERVICE=ai-assistant -t airevstream-ai-assistant .
docker build -f Dockerfile.services --build-arg SERVICE=production-pipeline -t airevstream-production-pipeline .
docker build -f Dockerfile.workers -t airevstream-workers .
```

Copy `.env.production.example` to `.env` and fill in all values before running.

---

## Summary of What's Blocked

| Feature | Blocked By | Severity |
|---------|------------|----------|
| AI Chat & Generation | Ollama not installed | Medium — install to use AI |
| Image Generation | ComfyUI not installed | Low — optional feature |
| Video Rendering | Remotion installed and configured | None — ready to use |
| Cross-Platform Publishing | Platform API keys needed | Medium — placeholder works |
| Audio/TTS | TTS engine not configured | Low — future feature |
