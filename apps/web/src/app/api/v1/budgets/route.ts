import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, paginated, parseQuery, validationError } from '@/lib/api-server';
import type { Prisma } from '@prisma/client';

const createBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  budgetType: z.enum(['daily', 'weekly', 'monthly']),
  limitAmount: z.number().positive(),
  alertThreshold: z.number().min(0).max(1).optional().default(0.8),
  category: z.string().max(50).optional().nullable(),
});

/**
 * Calculate period start and end based on budget type.
 * periodStart is now, periodEnd is calculated based on budgetType.
 */
function calculatePeriodEnd(budgetType: string, periodStart: Date): Date {
  const end = new Date(periodStart);

  switch (budgetType) {
    case 'daily':
      end.setDate(end.getDate() + 1);
      break;
    case 'weekly':
      end.setDate(end.getDate() + 7);
      break;
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
  }

  return end;
}

/**
 * GET /api/v1/budgets
 * List cost budgets with optional status filter.
 *
 * Query params:
 *   - status: filter by status (active, paused, exceeded)
 *   - category: filter by category
 *   - budgetType: filter by budget type (daily, weekly, monthly)
 *   - page, limit: pagination
 *   - sort, order: sorting
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { page, limit, skip, sort, order, params } = parseQuery(req);

    const status = params.get('status') ?? undefined;
    const category = params.get('category') ?? undefined;
    const budgetType = params.get('budgetType') ?? undefined;

    const where: Prisma.CostBudgetWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (budgetType) {
      where.budgetType = budgetType;
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'limitAmount', 'currentSpend', 'periodEnd'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [budgets, total] = await Promise.all([
      ctx.db.costBudget.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      ctx.db.costBudget.count({ where }),
    ]);

    const converted = budgets.map(b => ({
      ...b,
      limitAmount: Number(b.limitAmount),
      currentSpend: Number(b.currentSpend),
      alertThreshold: b.alertThreshold != null ? Number(b.alertThreshold) : null,
    }));

    return paginated(converted, total, page, limit);
  } catch (err) {
    console.error('GET /api/v1/budgets error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch budgets', 500);
  }
}

/**
 * POST /api/v1/budgets
 * Create a new cost budget.
 * Auto-calculates periodStart (now) and periodEnd based on budgetType.
 *
 * Body: { name, budgetType, limitAmount, alertThreshold?, category? }
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createBudgetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { name, budgetType, limitAmount, alertThreshold, category } = parsed.data;

    const periodStart = new Date();
    const periodEnd = calculatePeriodEnd(budgetType, periodStart);

    const budget = await ctx.db.costBudget.create({
      data: {
        name,
        budgetType,
        limitAmount,
        alertThreshold: alertThreshold ?? 0.8,
        category: category ?? null,
        status: 'active',
        currentSpend: 0,
        periodStart,
        periodEnd,
      },
    });

    const converted = {
      ...budget,
      limitAmount: Number(budget.limitAmount),
      currentSpend: Number(budget.currentSpend),
      alertThreshold: budget.alertThreshold != null ? Number(budget.alertThreshold) : null,
    };

    return success(converted);
  } catch (err) {
    console.error('POST /api/v1/budgets error:', err);
    return error('INTERNAL_ERROR', 'Failed to create budget', 500);
  }
}
