import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { success, error, validationError, getJwtSecret } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/v1/auth/forgot-password
 * Generates a password reset token. In dev mode, logs the token to console.
 * In production, this would send an email with the reset link.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`forgot:${ip}`, RATE_LIMITS.forgotPassword);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const { email } = parsed.data;

    const db = getDb();
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return success({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    // Generate a short-lived JWT as the reset token (15 minutes)
    const resetToken = await new SignJWT({ sub: user.id, purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(getJwtSecret());

    // In dev mode, log the reset token/link to console
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Password Reset] Token for ${email}: ${resetToken}`);
      console.debug(`[Password Reset] Reset URL: ${resetUrl}`);
    }

    return success({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('POST /api/v1/auth/forgot-password failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
