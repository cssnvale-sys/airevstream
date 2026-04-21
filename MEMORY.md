# MEMORY

Cross-session patterns, conventions, and hard-won facts. Keep under 200 lines — move anything codified in `.claude/rules/*.md` out.

## Runtime verification shortcuts

### Prove a BullMQ job actually completed (the logs can lie)
The worker process may log nothing visible — pino flushes asynchronously and your `tail -n 200` may miss the "Processing content job" line. Redis is the source of truth:

```bash
redis-cli -p 6389 HGETALL bull:content:<jobId>
```

Fields to read:
- `finishedOn` — ms epoch, present only on terminal states (completed or failed)
- `progress` — last reported percent ("100" for completed)
- `returnvalue` — JSON string of the processor's return
- `failedReason` + `stacktrace` — failure diagnostic

TTL semantics for missing keys:
- `redis-cli TTL <key>` returns `-2` when the key does not exist, `-1` when it has no expiration. Don't confuse `-2` with "expired just now" — it means the key was never there.

### Queue key conventions (BullMQ)
- `bull:<queue>:<id>` — hash holding the job itself
- `bull:<queue>:<id>:lock` — string, ~30s TTL, held by the active worker
- `bull:<queue>:active` / `:wait` / `:completed` / `:failed` — list/zset indexes
- The `:lock` key disappearing while `finishedOn` is empty means the worker crashed mid-job.

## Ollama patterns

### `think` defaults to false; opt in per request (D132)
`packages/ai-client/src/providers/ollama.ts` passes `think: false` to `ollama.chat()` by default on all three methods (`generateText`, `generateChat`, `streamChat`). Callers opt in with `request.think = true` on `TextRequest`/`ChatRequest`.

Defensive tag stripping: even with `think: false`, some thinking-capable models still inline `<think>...</think>` blocks in `message.content`. Strip them before returning:

```typescript
content.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim()
```

In streaming mode the tags can straddle chunk boundaries — use a cross-chunk `insideThink` state machine, not per-chunk regex.

### Model resolution order (D131)
At every call site, resolved at *request time* (not module load, so PM2 per-worker env blocks work):
1. Explicit `request.model`
2. `process.env.OLLAMA_DEFAULT_MODEL?.trim()`
3. Seeded `AiService.capabilities.defaultModel` (registry paths only)
4. Compiled fallback: `'qwen3:8b'`

### First-call cold start is real
`qwen3:8b` takes ~30-60s to load into VRAM on first call after `ollama serve` starts. Don't diagnose a "hang" within the first minute of fresh boot.

## Node host-process hardening (workers)

### `setMaxListeners` must scale with worker count
Default is 10. Each BullMQ `Worker` registers SIGTERM/SIGINT listeners (internally, via graceful-shutdown), plus the `shutdown()` handler registers two more. 9 workers + 2 = 11, which triggers `MaxListenersExceededWarning` and hides real leaks behind a cosmetic one. Set `process.setMaxListeners(20)` in `workers/src/index.ts`.

### Silent worker death → always install handlers
An unhandled rejection or uncaught exception inside a BullMQ processor will terminate the host process with **no log output** and leave jobs stuck in `active` with stale locks. Fix:

```typescript
process.on('uncaughtException', (err) => {
  logger.fatal({ err, stack: err?.stack }, 'Uncaught exception — workers process will exit');
  setTimeout(() => process.exit(1), 100).unref(); // give pino a moment to flush
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err, stack: err.stack }, 'Unhandled promise rejection in workers');
  // don't exit — BullMQ job failures surface here and should be caught by the per-queue failed handler
});
```

## macOS shell gotchas

### zsh `INTERACTIVE_COMMENTS` is off by default
Pasting a script with `# comment` lines into an interactive zsh session fails with `parse error near \`)\`` when the comment happens to have unbalanced punctuation (like `# 1)` or `# B)`). Workarounds:
- Write the script to a file with heredoc (`cat > /tmp/foo.sh <<'EOF' ... EOF`), then `bash /tmp/foo.sh`
- Enable in the session: `setopt INTERACTIVE_COMMENTS` (ephemeral)

### Ports likely to collide on a developer's Mac
- `3000` — other Next.js projects (delegayt-dashboard)
- `3001` — openclaw / mission-control dashboards (we moved to 3011)
- `6379` — Homebrew redis (we moved to 6389 on the host)
- `11434` — another Ollama instance

`make doctor` checks all of these before bootstrap.

## HICC script structure (content pipeline)

Generated scripts use the Hook / Intro / Content / CTA framework with beat tags. A successful end-to-end run on 2026-04-21 produced:

> Stop sending your brain to the cloud. [TENSION] Picture this: an AI that lives inside your laptop, processing everything offline without ever phoning home. [INTIMATE] You get blazing speed, zero latency, and absolute privacy because your data never leaves the machine. [POWER] But here's the real game-changer: you own the model, not a corporation. [PSYCHOLOGICAL] Ready to take back control? Hit subscribe and dive in. [MOMENTUM]

Available beat tags: `[TENSION]` `[INTIMATE]` `[POWER]` `[PSYCHOLOGICAL]` `[MOMENTUM]` `[AWE]` `[EMOTIONAL]` `[CALM]`. Parsed by the storyboard generator into shot boundaries.

## Cross-session reminders

- `bull:` keys live in Redis DB 0 by default — no `-n` flag needed.
- Next.js API routes that need header reads (every route using `authenticate()`) need `export const dynamic = 'force-dynamic'` or they log a misleading `DynamicServerError` during `next build` (D129).
- Prisma `Decimal` fields serialize as strings — always wrap with `Number()` on the frontend (D013).
- Workers use `getDb()` (not `ctx.db`) because they run outside request context; scope by `tenantId` from job data.
- D017 four-commit split: backend → frontend → docs → housekeeping. `git add <path>` — never `git add .`.
