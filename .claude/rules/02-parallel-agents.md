# Parallel Agent Rules

## When to Use Parallel Agents

Use parallel agents when:
- Auditing 3+ independent areas of the codebase
- Fixing independent bugs that don't share files
- Read-only analysis or research across multiple packages
- Building independent packages/features that don't import each other

Do NOT use when:
- Changes touch shared files (merge conflicts)
- Tasks are interdependent (one depends on another's output)
- Fewer than 3 independent units of work

## Recommended Agent Counts

| Task Type | Agents | Notes |
|-----------|--------|-------|
| Full codebase audit | 5 | Split by page group or package group |
| Bug batch fix | 3–5 | One agent per independent bug |
| New feature (small) | 1 | Single agent, sequential build |
| New feature (large) | 2 | Backend + frontend if schema is stable |
| Read-only research | 3–5 | Split by topic area |

## Agent Ownership Rules

- Each agent must own a defined set of files with NO overlap
- Define file ownership explicitly in the agent prompt
- If two agents need the same file, make one go first or merge manually

## Proven Pattern: 2-Phase Audit + Fix

This pattern was validated across 4 audit rounds (60+ fixes):

**Phase 1 — Audit (5 agents, read-only)**
- Each agent reads frontend components + their API routes
- Flags mismatches: field names, missing includes, type differences
- Returns a list of issues, does not write code

**Phase 2 — Fix (5 agents, write)**
- Each agent takes its audit list and applies fixes
- Verify with `turbo build` after all agents complete

For the full audit methodology including bug pattern catalog and wave structure, see `08-audit-process.md`.

## After Parallel Work

Use the 4-commit structure (D017):
1. Backend packages/services changes
2. Frontend pages/components/API routes
3. Docs and config updates
4. Build artifacts / .gitignore
