import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { authenticate, success, error, validationError, getJwtSecret } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { hashPassword, verifyPassword } from '@/lib/password';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required').max(256),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(256),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`change-pwd:${ip}:${ctx.userId}`, RATE_LIMITS.login);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many attempts. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
    if (!user) return error('NOT_FOUND', 'User not found', 404);

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return error('INVALID_CREDENTIALS', 'Current password is incorrect', 400);
    }

    await ctx.db.user.update({
      where: { id: ctx.userId },
      data: { passwordHash: hashPassword(newPassword) },
    });

    // Issue a fresh JWT so the client can replace the old one
    const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret());

    return success({ message: 'Password changed successfully', token });
  } catch (err) {
    console.error('[POST /auth/change-password]', err);
    return error('INTERNAL_ERROR', 'Failed to change password', 500);
  }
}
