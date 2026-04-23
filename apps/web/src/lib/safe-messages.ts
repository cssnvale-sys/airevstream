/**
 * Safe-message helper for auth-page error display.
 *
 * API routes use `formatZodErrors` (see lib/api-server.ts) which prefixes every
 * Zod validation message with the field path, e.g.
 *   "password: Password must be at least 8 characters"
 *
 * Auth pages maintain a `safeMessages` allowlist of known-safe strings (per
 * .claude/rules/05-frontend.md — error message contracts). Comparing the raw
 * API message with `includes()` therefore never matched the Zod-prefixed
 * variants and users saw a generic "Registration failed" / "Password reset
 * failed" even for known, actionable errors.
 *
 * `pickSafeMessage` tolerates that prefix: it returns the raw message if it is
 * on the allowlist, otherwise it strips a leading `"field: "` prefix and
 * checks again. Anything that still doesn't match falls back to the supplied
 * default so we never display internal/untrusted strings to the user.
 */
export function pickSafeMessage(
  raw: string | undefined | null,
  safeMessages: readonly string[],
  fallback: string,
): string {
  if (!raw) return fallback;
  if (safeMessages.includes(raw)) return raw;
  const colonIdx = raw.indexOf(': ');
  if (colonIdx > 0) {
    const suffix = raw.slice(colonIdx + 2);
    if (safeMessages.includes(suffix)) return suffix;
  }
  return fallback;
}
