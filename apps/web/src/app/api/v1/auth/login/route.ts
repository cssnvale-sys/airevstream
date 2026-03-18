import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(hash, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

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
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
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
      .sign(JWT_SECRET);

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
    console.error('POST /api/v1/auth/login failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
