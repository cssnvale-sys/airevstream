import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@airevstream/db';
import { success, error, authenticate } from '@/lib/api-server';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getDb();
    const user = await db.user.findUnique({
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
  } catch {
    return error('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
