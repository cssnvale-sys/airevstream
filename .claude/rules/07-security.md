# Security Rules

## Error Sanitization

| Layer | Rule |
|-------|------|
| API routes | `error('CODE', 'Static message', status)` — never pass `err.message` |
| Frontend auth pages | Use `safeMessages` allowlist — never display `data.error.message` raw |
| Frontend mutations | Use `toast.error('Static message')` — never pass raw API messages |

## Tenant Scoping

Every API route that reads/writes data must scope by tenant:

| Model has tenantId? | Pattern |
|---------------------|---------|
| Yes | `where: { tenantId: ctx.tenantId }` |
| No (has channel/account chain) | `findFirst` with chain: `channel: { socialAccount: { emailAccount: { tenantId } } }` |
| Global (e.g. AiService) | Require admin role |

## URL & Redirect Validation

| Scenario | Rule |
|----------|------|
| Redirect from query param (login) | Must start with `/`, must not start with `//` |
| Redirect from DB field (affiliate) | Validate protocol is `http:` or `https:` |
| Fetching user-configured URLs | Block private IPs with `isPrivateUrl()` |

## Access Control Checklist

Every route handler:
1. Authenticate (JWT via `authenticate()` or API key via `authenticateApiKey()`)
2. Authorize (admin-only operations check `ctx.role`)
3. Scope (filter by `ctx.tenantId`, verify ownership of specific resources)

## Module-Level State

Never capture mutable config in closures shared across requests.
Store per-entry config (e.g., rate limiter `windowMs` per key, not once at module load).
