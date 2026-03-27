import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { getDb } from '@airevstream/db';
import { success, error, validationError, getJwtSecret } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
  name: z.string().max(200).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    // Guard open registration — disable in production when not wanted
    if (process.env.REGISTRATION_DISABLED === 'true') {
      return error('FORBIDDEN', 'Registration is currently closed', 403);
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!rl.allowed) {
      return error('RATE_LIMITED', 'Too many registration attempts. Please try again later.', 429);
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const { email, password, name } = parsed.data;

    const db = getDb();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return error('CONFLICT', 'A user with this email already exists', 409);
    }

    const passwordHash = hashPassword(password);

    // Create tenant + user in a transaction so neither is orphaned
    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100)
      + '-' + Date.now().toString(36);
    const displayName = name ?? email.split('@')[0];

    const user = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${displayName}'s Workspace`,
          slug,
        },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          name: name ?? null,
          tenantId: tenant.id,
        },
      });
    });

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
    console.error('POST /api/v1/auth/register failed:', err);
    return error('INTERNAL_ERROR', 'Failed to register', 500);
  }
}
