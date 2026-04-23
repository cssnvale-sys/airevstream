/**
 * Form validation utilities with Zod
 */

import { z } from 'zod';
import { toast } from './toast';

// ============================================================================
// Common Validation Schemas
// ============================================================================

/** Email validation with proper regex */
export const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email is too long');

/** Password validation with strength requirements */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/** URL validation with protocol check */
export const urlSchema = z.string()
  .url('Please enter a valid URL')
  .regex(/^https?:\/\//, 'URL must start with http:// or https://');

/** UUID validation */
export const uuidSchema = z.string()
  .uuid('Invalid ID format');

/** Name validation for content, channels, etc */
export const nameSchema = z.string()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[\w\s\-_.]+$/, 'Name can only contain letters, numbers, spaces, hyphens, underscores, and periods');

/** Description validation */
export const descriptionSchema = z.string()
  .max(2000, 'Description must be less than 2000 characters')
  .optional();

/** Tags validation */
export const tagsSchema = z.array(z.string().max(50))
  .max(20, 'Maximum 20 tags allowed');

// ============================================================================
// Content Creation Schemas
// ============================================================================

export const contentCreateSchema = z.object({
  title: nameSchema,
  description: descriptionSchema,
  channelId: uuidSchema,
  seriesId: z.string().uuid().optional().nullable(),
  tags: tagsSchema.default([]),
  scheduledFor: z.string().datetime().optional().nullable(),
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin']),
  contentType: z.enum(['video', 'short', 'image', 'carousel', 'text']),
});

export const channelCreateSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  platform: z.enum(['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin']),
  niche: z.string().min(1).max(50).optional(),
  targetAudience: z.string().max(200).optional(),
});

// ============================================================================
// Settings Schemas
// ============================================================================

export const apiKeySchema = z.object({
  name: z.string().min(1).max(50),
  key: z.string().min(10).max(500),
  service: z.enum(['openai', 'anthropic', 'elevenlabs', 'replicate', 'stability', 'custom']),
});

export const userProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.union([z.literal(''), urlSchema]).optional(),
});

// ============================================================================
// Validation Helpers
// ============================================================================

export type ValidationResult<T> = 
  | { success: true; data: T; errors: null }
  | { success: false; data: null; errors: Record<string, string> };

/**
 * Validate data against a Zod schema
 * Returns structured result with typed errors
 */
export function validateData<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data, errors: null };
  }
  
  // Convert Zod errors to flat object
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
  
  return { success: false, data: null, errors };
}

/**
 * Validate form data and show toast on error
 */
export function validateForm<T>(
  schema: z.ZodType<T>,
  data: unknown,
  options: { showToast?: boolean; formName?: string } = {}
): ValidationResult<T> {
  const result = validateData(schema, data);
  
  if (!result.success && options.showToast !== false) {
    const errorCount = Object.keys(result.errors).length;
    const formName = options.formName ? `${options.formName} ` : '';
    toast.error(
      `Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} in the ${formName}form`,
      { duration: 5000 }
    );
  }
  
  return result;
}

/**
 * Get the first error message from a validation result
 */
export function getFirstError(result: ValidationResult<unknown>): string | null {
  if (result.success || !result.errors) return null;
  return Object.values(result.errors)[0] || null;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if a file is a valid image
 */
export function isValidImage(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

/**
 * Check if a file is a valid video
 */
export function isValidVideo(file: File): boolean {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
  const maxSize = 500 * 1024 * 1024; // 500MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

/**
 * Check if a file is valid audio
 */
export function isValidAudio(file: File): boolean {
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

// ============================================================================
// Export types
// ============================================================================

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ChannelCreateInput = z.infer<typeof channelCreateSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
