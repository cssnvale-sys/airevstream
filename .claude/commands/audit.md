Run a codebase audit using the proven multi-wave, parallel-agent methodology.

Scope: $ARGUMENTS (empty = full codebase, "frontend" = apps/web/ only, "backend" = packages/ + services/ + workers/ only, or a specific path/pattern)

## Step 1: Assess Scope

Count source files in the audit scope:

```bash
find apps/web/src packages/ services/ workers/ remotion/src -name '*.ts' -o -name '*.tsx' | wc -l
```

For scoped audits, adjust the find path:
- `frontend`: `find apps/web/src -name '*.ts' -o -name '*.tsx'`
- `backend`: `find packages/ services/ workers/ -name '*.ts' -o -name '*.tsx'`

Identify highest-risk areas by checking:
- `KNOWN-ISSUES.md` for open issues
- Recent git commits (`git log --oneline -20`) for recently changed areas
- `npm run audit` for any existing violations

Report: total file count, estimated LOC, top risk areas.

## Step 2: Build Wave Plan

Split the scoped files into 6-8 waves following the layer ordering in `08-audit-process.md`:
1. Auth & system routes
2. Content & cinema pages + routes
3. Domain pages (accounts, channels, storefronts, etc.)
4. Remaining API routes + hooks + libs
5. Backend packages
6. Services + workers
7. Remotion + integration code
8. Test infrastructure + config

For each wave, assign 3-5 parallel agents with explicit file ownership lists. No file may appear in more than one agent's list.

Present the wave plan as a table for user review:

| Wave | Layer | Agent Count | Files | Risk |
|------|-------|-------------|-------|------|
| 1 | Auth & system | 3 | list... | Critical |
| ... | ... | ... | ... | ... |

**Wait for user approval before executing.**

## Step 3: Execute Waves

For each wave, sequentially:

1. **Launch parallel agents** — each agent:
   - Reads all files in its ownership set
   - Checks all 9 bug patterns from the catalog in `08-audit-process.md`
   - Fixes issues in-place (fix-as-you-go, not 2-phase)
   - Returns a summary: files audited, issues found by category, issues fixed

2. **Verify** — after all agents in the wave complete:
   ```bash
   turbo build --force && turbo test && npm run audit
   ```
   Fix any failures before proceeding to the next wave.

3. **Report wave summary**:
   - Files audited: N
   - Issues found: N (by category)
   - Issues fixed: N
   - Verification: PASS/FAIL

## Step 4: Commit Fixes

Use D017 4-commit structure:

1. `fix: backend — audit fixes across packages, services, workers`
2. `fix: frontend — audit fixes across API routes, pages, components`
3. `docs: update tracking files for audit session`
4. `chore: housekeeping — .gitignore, build artifacts, cleanup`

Stage files explicitly by name — never use `git add .` or `git add -A`.

## Step 5: Update Tracking Files

Update ALL tracking files per `01-planning.md` mandatory file maintenance:
- `SESSION-LOG.md` — append audit session entry
- `CHANGELOG.md` — add entries under `[Unreleased]`
- `KNOWN-ISSUES.md` — add new issues, mark fixed ones
- `DECISIONS.md` — document any new decisions
- `DEV-STATUS.md` — update test counts, build status
- `MEMORY.md` — update audit methodology notes if process evolved

## Step 6: Final Report

Present a summary:

| Category | Issues Found | Issues Fixed |
|----------|-------------|-------------|
| Zod .strict() | N | N |
| Data shape mismatches | N | N |
| Decimal wrapping | N | N |
| console.log/debugger | N | N |
| Silent catches | N | N |
| Race conditions | N | N |
| Tenant scoping | N | N |
| Dead code | N | N |
| Integration mismatches | N | N |
| **Total** | **N** | **N** |

Verification: `turbo build` PASS | `turbo test` PASS (N tests) | `npm run audit` PASS (N tests)
Regressions: 0
