import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { scryptSync, randomBytes } from 'node:crypto';
import { getDb } from '@airevstream/db';
import { success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

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
    const { token, newPassword } = body as { token?: string; newPassword?: string };

    if (!token || !newPassword) {
      return validationError('Token and newPassword are required');
    }

    if (newPassword.length < 8) {
      return validationError('Password must be at least 8 characters');
    }

    // Verify the reset token
    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
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
      data: { passwordHash: hashPassword(newPassword) },
    });

    return success({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('POST /api/v1/auth/reset-password failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
