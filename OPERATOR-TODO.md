# Operator TODO

Items that need your action before the system is fully operational.

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

## Summary of What's Blocked

| Feature | Blocked By | Severity |
|---------|------------|----------|
| AI Chat & Generation | Ollama not installed | Medium — install to use AI |
| Image Generation | ComfyUI not installed | Low — optional feature |
| Video Rendering | Remotion installed and configured | None — ready to use |
| Cross-Platform Publishing | Platform API keys needed | Medium — placeholder works |
| Audio/TTS | TTS engine not configured | Low — future feature |
