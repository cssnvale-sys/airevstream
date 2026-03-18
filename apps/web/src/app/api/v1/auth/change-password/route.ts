import { NextRequest, NextResponse } from 'next/server';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { authenticate, success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

function verifyPassword(password: string, hash: string): boolean {
  const parts = hash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

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
      return validationError(parsed.error.errors.map(e => e.message).join('; '));
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
      .sign(JWT_SECRET);

    return success({ message: 'Password changed successfully', token });
  } catch (err) {
    console.error('[POST /auth/change-password]', err);
    return error('INTERNAL_ERROR', 'Failed to change password', 500);
  }
}
