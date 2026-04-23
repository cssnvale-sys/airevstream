import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { success, error, validationError, formatZodErrors, getJwtSecret } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many login attempts. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(formatZodErrors(parsed.error.errors));
    }
    const { email, password } = parsed.data;

    const db = getDb();
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return error('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return error('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret());

    return success({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    logger.error('POST /api/v1/auth/login failed', err as Error);
    return error('INTERNAL_ERROR', 'Failed to log in', 500);
  }
}
