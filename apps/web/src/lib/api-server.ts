import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb } from '@airevstream/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');

export type ApiContext = {
  userId: string;
  role: string;
  tenantId: string | null;
  db: ReturnType<typeof getDb>;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function success(data: unknown, meta?: Record<string, unknown>) {
  return json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function paginated(data: unknown[], total: number, page: number, limit: number) {
  return json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

export function error(code: string, message: string, status = 400) {
  return json({ success: false, error: { code, message } }, status);
}

export function notFound(message = 'Not found') {
  return error('NOT_FOUND', message, 404);
}

export function validationError(message: string) {
  return error('VALIDATION_ERROR', message, 400);
}

export async function authenticate(req: NextRequest): Promise<ApiContext | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return error('UNAUTHORIZED', 'Missing or invalid token', 401);
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) {
      return error('UNAUTHORIZED', 'Invalid token', 401);
    }
    const role = (payload.role as string) ?? 'operator';
    const db = getDb();
    // Fetch tenantId from DB (not in JWT to keep it current)
    const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return { userId, role, tenantId: user?.tenantId ?? null, db };
  } catch {
    return error('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

/**
 * Authenticate for SSE endpoints.
 * EventSource does not support custom headers, so this also checks
 * for a `token` query parameter in addition to the Authorization header.
 */
export async function authenticateSSE(req: NextRequest): Promise<ApiContext | NextResponse> {
  // Try header first (for curl/testing)
  const authHeader = req.headers.get('authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    // Fall back to query parameter (for EventSource)
    const url = new URL(req.url);
    token = url.searchParams.get('token');
  }

  if (!token) {
    return error('UNAUTHORIZED', 'Missing or invalid token', 401);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;
    if (!userId) {
      return error('UNAUTHORIZED', 'Invalid token', 401);
    }
    const role = (payload.role as string) ?? 'operator';
    const db = getDb();
    const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return { userId, role, tenantId: user?.tenantId ?? null, db };
  } catch {
    return error('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}

export function forbidden(message = 'Insufficient permissions') {
  return error('FORBIDDEN', message, 403);
}

export function requireAdmin(ctx: ApiContext): NextResponse | null {
  if (ctx.role !== 'admin') {
    return forbidden('Admin access required');
  }
  return null;
}

export function parseQuery(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50')));
  const skip = (page - 1) * limit;
  const sort = url.searchParams.get('sort') ?? 'createdAt';
  const order = url.searchParams.get('order') ?? 'desc';
  const search = url.searchParams.get('search') ?? undefined;
  return { page, limit, skip, sort, order, search, params: url.searchParams };
}
