import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { success, error, validationError, getJwtSecret } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(2048),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(256),
});

/**
 * POST /api/v1/auth/reset-password
 * Validates the reset token and updates the user's password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`reset:${ip}`, RATE_LIMITS.resetPassword);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many attempts. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const { token, newPassword } = parsed.data;

    // Verify the reset token
    let userId: string;
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      if (payload.purpose !== 'password-reset') {
        return error('INVALID_TOKEN', 'Invalid reset token', 400);
      }
      userId = payload.sub as string;
      if (!userId) {
        return error('INVALID_TOKEN', 'Invalid reset token', 400);
      }
    } catch {
      return error('INVALID_TOKEN', 'Invalid or expired reset token', 400);
    }

    const db = getDb();
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });

    if (!user) {
      return error('INVALID_TOKEN', 'Invalid reset token', 400);
    }

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword), passwordChangedAt: new Date() },
    });

    return success({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('POST /api/v1/auth/reset-password failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
