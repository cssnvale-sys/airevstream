import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from '@airevstream/db';
import { success, error, validationError } from '@/lib/api-server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(hash, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return validationError('Email and password are required');
    }

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
