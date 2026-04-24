/**
 * Validation utilities for forms and API inputs
 * Uses Zod for runtime type validation
 */

import { z } from 'zod';

// Common validation schemas
export const EmailSchema = z.string().email('Invalid email address');

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const UUIDSchema = z.string().uuid('Invalid ID format');

export const URLSchema = z.string().url('Invalid URL');

export const NonEmptyStringSchema = z.string().min(1, 'This field is required');

// Form validation helpers
export type ValidationResult = 
  | { success: true; data: unknown }
  | { success: false; errors: string[] };

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(e => 
    e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message
  );
  
  return { success: false, errors };
}

/**
 * Validate partial data (for updates)
 */
export function validatePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>, 
  data: unknown
): ValidationResult {
  const partialSchema = schema.partial();
  return validate(partialSchema, data);
}

// API-specific validation schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const DateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['dateTo'],
  }
);

// Content validation schemas
export const ContentTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(200, 'Title must be less than 200 characters');

export const ContentDescriptionSchema = z
  .string()
  .max(2000, 'Description must be less than 2000 characters')
  .optional();

// Channel validation schemas
export const ChannelNameSchema = z
  .string()
  .min(1, 'Channel name is required')
  .max(200, 'Channel name must be less than 200 characters');

// User validation schemas
export const UserNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters');

// Export all schemas
export const Schemas = {
  email: EmailSchema,
  password: PasswordSchema,
  uuid: UUIDSchema,
  url: URLSchema,
  nonEmptyString: NonEmptyStringSchema,
  pagination: PaginationSchema,
  dateRange: DateRangeSchema,
  contentTitle: ContentTitleSchema,
  contentDescription: ContentDescriptionSchema,
  channelName: ChannelNameSchema,
  userName: UserNameSchema,
} as const;
