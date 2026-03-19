---
globs: packages/**,services/**,workers/**
---

# Backend Rules

## Critical: Tenant-Scoped Database Access

In API routes (apps/web/src/app/api/), ALWAYS use `ctx.db` from `authenticate()`:

```typescript
const ctx = await authenticate(req);
const items = await ctx.db.contentItem.findMany({ where: { tenantId: ctx.tenantId } });
```

NEVER use `getDb()` in API routes — it bypasses tenant isolation (KI-009).

Exception: Workers (`workers/`) MAY use `getDb()` because they run outside
the request context and handle tenant scoping explicitly via job data.

## Error Handling

Never write silent catch blocks. Every catch MUST log the error:

```typescript
// Wrong
catch (error) {
  return error('Something went wrong', 500);
}

// Right
catch (err) {
  console.error('Failed to create content:', err);
  return error('Failed to create content', 500);
}
```

Include context in the log message (what operation failed, what entity).

## Package Conventions

- Package names: `@airevstream/<name>`
- All packages export from `src/index.ts` (barrel exports)
- All packages build to `dist/`
- Use Zod for runtime validation of inputs
- Use custom error classes extending `AppError` from `@airevstream/shared`
- Use Pino logger from `@airevstream/shared`

## API Route Pattern

Every API route handler follows this sequence:

```typescript
export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticate(req);          // 1. Auth
    const { searchParams } = new URL(req.url);    // 2. Parse params
    const page = Number(searchParams.get('page')) || 1;
    // 3. Validate with Zod if needed
    const items = await ctx.db.model.findMany();  // 4. Query with ctx.db
    return paginated(items, total, page, limit);   // 5. Respond
  } catch (err) {
    console.error('GET /api/v1/route failed:', err);
    return error('Failed to fetch', 500);
  }
}
```

## Entity Creation Completeness

When creating entities with required foreign keys:

| Check | Example |
|-------|---------|
| Required parents exist or are created atomically | Register: create Tenant + User in `$transaction` |
| Non-nullable FKs are set | `user.tenantId` must not be null after register |
| Response includes all fields the frontend expects | Include `tenantId` if login response includes it |

Never create a child entity without its required parent. Use `$transaction` for atomic multi-entity creation.

## Error Responses

Always use static message strings in `error()` calls — never `err.message`:

```typescript
// Wrong — leaks internals
return error('INTERNAL_ERROR', err.message, 500);

// Right — static string
return error('INTERNAL_ERROR', 'Failed to create content', 500);
```

The response shape is `{ success: false, error: { code, message } }`.
Frontend reads `data?.error?.message` and validates against an allowlist.
If you change an error message string, update the frontend allowlist in the same commit.

## Prisma Conventions

- JSON fields: cast Zod `Record<string, unknown>` as `as any` for `InputJsonValue`
- Always specify explicit `include` — don't rely on defaults
- Decimal fields serialize as strings — document this for frontend consumers
- Use `where: { tenantId: ctx.tenantId }` on all tenant-scoped queries
- Use transactions for multi-step writes: `ctx.db.$transaction([...])`

## Worker Conventions

- Workers use `getDb()` (not ctx.db) — they don't have request context
- Get tenantId from job data: `job.data.tenantId`
- Handle failures with retry: set `attempts` and `backoff` in job options
- Log job start, completion, and failure with job ID
- Use `@airevstream/queue` job type definitions for type safety
