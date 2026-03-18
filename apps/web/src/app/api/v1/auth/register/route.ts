import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { randomBytes, scryptSync } from 'node:crypto';
import { getDb } from '@airevstream/db';
import { success, error, validationError } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many registration attempts. Please try again later.', 429);
    }

    const body = await req.json();
    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return validationError('Email and password are required');
    }

    if (password.length < 8) {
      return validationError('Password must be at least 8 characters');
    }

    const db = getDb();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return error('CONFLICT', 'A user with this email already exists', 409);
    }

    const passwordHash = hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
      },
    });

    const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    return success(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    );
  } catch (err) {
    console.error('POST /api/v1/auth/register failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
