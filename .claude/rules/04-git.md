# Git Conventions

## Commit Messages

Use conventional commits format:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `chore:` — maintenance, dependency updates, config changes
- `docs:` — documentation only
- `refactor:` — code restructure without behavior change
- `test:` — adding or updating tests

Keep the subject line under 72 characters. Use the body for details.

## 4-Commit Structure for Large Changesets (D017)

When a changeset touches many files across the stack, split into 4 commits:

1. **Backend** — packages/, services/, workers/ changes
2. **Frontend** — apps/web/ pages, components, API routes
3. **Docs** — tracking files, configs, README updates
4. **Housekeeping** — .gitignore, build artifacts, cleanup

This makes `git log` and `git blame` useful for understanding what changed.

## Branch Naming

- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `audit/<scope>` — audit and fix rounds

## Pre-Commit Checklist

Before committing:
1. Run `turbo build` — all packages must compile
2. Run `turbo test` — all tests must pass
3. Review staged changes — no secrets, no debug code
4. Stage specific files by name — never use `git add .` or `git add -A`

## Staging Rules

- Always stage files explicitly by path
- Never commit `.env` files (only `.env.example`)
- Never commit `node_modules/`, `dist/`, or `.next/`
- Check `git diff --staged` before committing
