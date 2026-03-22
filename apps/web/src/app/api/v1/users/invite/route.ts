import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { authenticate, success, error, validationError, requireAdmin } from '@/lib/api-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/password';

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['admin', 'operator', 'viewer']).default('viewer'),
  tenantId: z.string().uuid().optional(),
}).strict();

/**
 * POST /api/v1/users/invite
 * Invite a user by creating an account with a temporary password
 * In production this would send an invite email
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`invite:${ip}`, { maxAttempts: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many invites. Please try again later.', 429);
    }

    const adminCheck = requireAdmin(ctx);
    if (adminCheck) return adminCheck;

    const body = await req.json();
    const parsed = inviteUserSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { email, name, role, tenantId } = parsed.data;

    // Check for duplicate email
    const existing = await ctx.db.user.findUnique({ where: { email } });
    if (existing) {
      return error('CONFLICT', 'A user with this email already exists', 409);
    }

    // Validate tenant exists if tenantId is provided
    if (tenantId) {
      const tenant = await ctx.db.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return validationError('Tenant not found');
      }
    }

    // Generate a random temporary password
    const temporaryPassword = randomBytes(16).toString('base64url');
    const passwordHash = hashPassword(temporaryPassword);

    const user = await ctx.db.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        role,
        tenantId: tenantId ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    // In production, this would send an invite email with a magic link.
    // The temporary password is NOT exposed in the response for security.
    // Instead, the admin should use a password reset flow.
    return success({
      user,
      message: 'User invited successfully. A password reset should be initiated for first login.',
    });
  } catch (err) {
    console.error('POST /api/v1/users/invite failed:', err);
    return error('INTERNAL_ERROR', 'Failed to invite user', 500);
  }
}
