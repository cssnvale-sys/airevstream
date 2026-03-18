import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, paginated, parseQuery } from '@/lib/api-server';

/**
 * GET /api/v1/users
 * List users (admin only), optional filter by tenantId, role
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  if (ctx.role !== 'admin') {
    return error('FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { page, limit, skip, sort, order, search, params } = parseQuery(req);
    const tenantId = params.get('tenantId') ?? undefined;
    const role = params.get('role') ?? undefined;

    const validRoles = ['admin', 'operator', 'viewer'];

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (role && validRoles.includes(role)) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSorts = ['email', 'name', 'createdAt', 'role'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';

    const [users, total] = await Promise.all([
      ctx.db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      ctx.db.user.count({ where }),
    ]);

    return paginated(users, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/users failed:', err);
    return error('INTERNAL_ERROR', 'Failed to list users', 500);
  }
}
