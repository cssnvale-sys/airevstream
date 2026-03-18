# Planning & Investigation Rules

## Investigation-First Workflow

Before writing any code:
1. Read the source files you plan to modify — never propose changes to unread code
2. Check tracking files for relevant context:
   - `DEV-STATUS.md` — current build progress, what's done
   - `KNOWN-ISSUES.md` — existing bugs that may relate
   - `DECISIONS.md` — past architectural decisions (avoid contradicting them)
3. Search for similar patterns in the codebase before inventing new ones

## Bug Fixing

1. Read the full code path end-to-end (frontend component → API route → Prisma query)
2. Grep for similar patterns — the same bug class likely exists elsewhere
3. Fix all instances, not just the reported one
4. Check KNOWN-ISSUES.md — the bug may already be tracked

## Feature Implementation

1. Find a structurally similar existing feature as a template
2. List all files that need to change before writing any code
3. Build bottom-up: types/schema → package logic → API route → frontend component
4. Verify the full data path compiles before moving to the next layer

## Mandatory File Maintenance

These files MUST be updated before any session ends. They are the project's
cross-session memory — stale docs cause repeated mistakes.

| File | What to Update |
|------|----------------|
| `SESSION-LOG.md` | Append a new session entry: what was done, decisions made, issues found |
| `CHANGELOG.md` | Add entries under `[Unreleased]` for features, fixes, changes |
| `KNOWN-ISSUES.md` | Add new issues, update resolved ones, remove fixed items |
| `DECISIONS.md` | Document new architectural/design decisions with date and rationale |
| `DEV-STATUS.md` | Update phase/epic/feature status, test counts, build status |
| `MEMORY.md` | Update with new patterns, conventions, or references learned |
| `OPERATOR-TODO.md` | Add new operator actions needed, mark completed items done |

If you forget, update them when reminded. No exceptions.
