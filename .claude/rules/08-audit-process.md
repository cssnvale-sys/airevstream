# Audit Process

## Bug Pattern Catalog

These 9 bug classes are verified recurring patterns. Check all of them during any audit.

| # | Pattern | Severity | Detection |
|---|---------|----------|-----------|
| 1 | `.strict()` Zod schemas rejecting valid payloads | Critical | Grep `.strict()`, trace frontend POST body vs schema fields |
| 2 | Frontend→API data shape mismatches | High | Compare component destructuring vs API `include` and response shape |
| 3 | Prisma Decimal not wrapped in `Number()` | Medium | Grep Decimal fields in schema, check API routes for `Number()` wrapping |
| 4 | `console.log` / `debugger` in production code | Low | Grep for `console.log` and `debugger` outside test files |
| 5 | Silent catch blocks (no logging) | Medium | Grep `catch` blocks without `console.error` or `logger` calls |
| 6 | Race conditions / stale closures in React | Medium | Check `useCallback`/`useEffect` deps, state updates in async flows |
| 7 | D088 tenant scoping violations | Critical | Grep conditional `ctx.tenantId ?`, missing 403 guards before `ctx.tenantId!` |
| 8 | Dead imports / stale code | Low | Build warnings, unused variables, imports with no references |
| 9 | Integration mismatches (A output != B input) | High | Trace data across service/component boundaries, verify type contracts |

Automated audit tests (`npm run audit`) catch patterns 1-5 and 7 as regressions. Patterns 6, 8, 9 require manual review.

## Wave Structure

Split the codebase into 6-8 waves by architectural layer. Process waves sequentially — each wave must pass verification before starting the next.

| Wave | Layer | Typical Files | Risk |
|------|-------|--------------|------|
| 1 | Auth & system routes | 10-15 | Critical — login, register, session, API keys |
| 2 | Content & cinema pages + routes | 30-40 | High — complex data shapes, Decimal fields |
| 3 | Domain pages (accounts, channels, storefronts, etc.) | 30-40 | High — tenant scoping, CRUD patterns |
| 4 | Remaining API routes + hooks + libs | 20-30 | Medium — utilities, shared code |
| 5 | Backend packages (shared, db, crypto, queue, etc.) | 40-60 | Medium — type exports, error classes |
| 6 | Services + workers | 30-40 | High — Fastify routes, BullMQ handlers |
| 7 | Remotion + ComfyUI + integration code | 20-30 | Medium — video compositions, workflow templates |
| 8 | Test infrastructure + config | 10-20 | Low — test helpers, vitest config |

Adjust wave count based on scope. A targeted audit (e.g., frontend-only) may need only 2-3 waves.

## Agent Rules

- **3-5 agents per wave** — more agents = more parallelism but harder to coordinate
- **Strict file ownership** — each agent owns a defined set of files with NO overlap
- **Fix-as-you-go** — agents read, flag, AND fix issues in a single pass (not 2-phase)
- **Bug catalog checklist** — every agent checks all 9 patterns against its file set
- **No shared file edits** — if two agents need the same file, assign it to one agent only
- Cross-reference `02-parallel-agents.md` for general parallel agent rules

## Verification

After each wave completes, run the full verification suite:

```
turbo build --force && turbo test && npm run audit
```

- `turbo build --force` — catches type errors, missing exports, compilation failures
- `turbo test` — catches regressions in unit tests
- `npm run audit` — catches regressions in the 9 automated bug pattern tests

If any check fails, fix before proceeding to the next wave.

## Exit Criteria

An audit is complete when ALL of the following are true:

1. All planned waves have been executed
2. `turbo build --force` passes with 0 errors
3. `turbo test` passes with 0 failures
4. `npm run audit` passes with 0 new violations
5. Tracking files updated (SESSION-LOG, CHANGELOG, KNOWN-ISSUES, DEV-STATUS, MEMORY)
6. Fixes committed using D017 4-commit structure (backend → frontend → docs → housekeeping)
