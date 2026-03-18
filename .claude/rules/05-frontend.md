---
globs: apps/web/**
---

# Frontend Rules

## The #1 Bug Class: Data Shape Mismatches

Before writing or modifying any frontend code that consumes API data:
1. Open the API route handler file and read it
2. Check the Prisma `include` — what fields are actually returned?
3. Match the frontend destructured fields to the API response shape exactly
4. Check for nested objects (e.g., `item.channel.name` not `item.channelName`)

Common mismatches to watch for:
- Field renamed between Prisma model and API response
- Missing Prisma `include` for a relation the frontend destructures
- Prisma Decimal fields serialize as strings (see below)
- Paginated vs non-paginated response shape

## API Response Shapes

All API routes use helpers from `apps/web/src/lib/api-server.ts`:

```typescript
// Single item
success(data)           → { success: true, data: T }

// Paginated list
paginated(items, total, page, limit)
                        → { success: true, data: T[], total, page, limit, totalPages }

// Error
error(message, status)  → { success: false, error: string }
```

Always check which shape the route returns. `useApi<T>()` expects `{ data: T }`.

## Authentication Pattern

```typescript
import { authenticate } from '@/lib/api-server';
const ctx = await authenticate(req);
// ctx.userId, ctx.role, ctx.tenantId, ctx.db (tenant-scoped Prisma)
```

## Data Fetching (SWR)

All data fetching uses hooks from `apps/web/src/hooks/use-api.ts`:

```typescript
const { data, error, isLoading } = useApi<ResponseType>('/api/v1/endpoint');
```

Mutations:
```typescript
import { apiPost, apiPut, apiDelete } from '@/hooks/use-api';
await apiPost('/api/v1/endpoint', body);
```

After mutations, call `mutate()` to revalidate SWR cache.

## Prisma Decimal → Number Casting

These fields serialize as strings in JSON. Always cast with `Number()`:
- `qualityScore`
- `budget`, `spent`, `remaining`
- `revenue`, `cost`, `totalCost`
- `clickRate`, `conversionRate`
- Any field defined as `Decimal` in schema.prisma

```typescript
// Wrong: item.qualityScore (string "8.5")
// Right: Number(item.qualityScore) (number 8.5)
```

## Error Handling

- Never use silent catch blocks — always show feedback
- Use `sonner` toast for mutation errors: `toast.error(message)`
- Use inline error states for data loading failures
- Log errors to console in development
