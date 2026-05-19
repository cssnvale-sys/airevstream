/**
 * Type-safe helpers for Prisma JSONB fields.
 * Eliminates `as any` casts when persisting validated data to Json columns.
 *
 * Usage:
 *   data: { metadata: safeJson(parsed.data.metadata) }
 *
 * This replaces:
 *   data: { metadata: (parsed.data.metadata ?? {}) as any }
 */

import type { Prisma } from '@airevstream/db';

/**
 * Wrap a plain-object value for Prisma's Json / JsonB columns.
 * Returns Prisma.InputJsonValue which accepts any JSON-serializable value.
 * If value is undefined, returns `{}` as safe default.
 */
export function safeJson<T>(
  value: T | null | undefined,
): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

/**
 * Wrap an array value for Prisma's Json / JsonB columns.
 * Returns Prisma.InputJsonValue for array-typed JSON fields.
 */
export function safeJsonArray<T>(
  value: T[] | null | undefined,
): Prisma.InputJsonValue {
  return (value ?? []) as Prisma.InputJsonValue;
}

/**
 * Conditionally include a JSON field only when it is defined.
 * Used in Prisma spread patterns where optional fields are merged.
 */
export function safeJsonOptional<T>(
  value: T | null | undefined,
): { [key: string]: Prisma.InputJsonValue } | {} {
  if (value === null || value === undefined) return {};
  return { value: value as Prisma.InputJsonValue };
}

/**
 * Wrap value specifically for metadata JSONB fields.
 * Common pattern across AIRevStream models.
 */
export function asMetadata(data: unknown): Prisma.InputJsonValue {
  return (data ?? {}) as Prisma.InputJsonValue;
}
