import { NextRequest, NextResponse } from 'next/server';
import { success, error, authenticate } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await auth.db.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return error('NOT_FOUND', 'User not found', 404);
    }

    return success(user);
  } catch (err) {
    console.error('GET /api/v1/auth/me failed:', err);
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
