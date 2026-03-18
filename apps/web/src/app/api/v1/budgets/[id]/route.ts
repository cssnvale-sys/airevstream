import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, success, error, notFound, validationError } from '@/lib/api-server';

type RouteParams = { params: Promise<{ id: string }> };

const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  budgetType: z.enum(['daily', 'weekly', 'monthly']).optional(),
  limitAmount: z.number().positive().max(1000000).optional(),
  alertThreshold: z.number().min(0).max(1).optional(),
  category: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'paused', 'exceeded']).optional(),
  currentSpend: z.number().min(0).optional(),
});

/**
 * GET /api/v1/budgets/[id]
 * Get a single budget with spend percentage and alert status.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const budget = await ctx.db.costBudget.findUnique({
      where: { id },
    });

    if (!budget) {
      return notFound('Budget not found');
    }

    const limitAmount = Number(budget.limitAmount);
    const currentSpend = Number(budget.currentSpend);
    const alertThreshold = Number(budget.alertThreshold);

    const percentUsed = limitAmount > 0 ? currentSpend / limitAmount : 0;
    const isOverThreshold = percentUsed >= alertThreshold;
    const isExceeded = percentUsed >= 1;

    return success({
      ...budget,
      limitAmount: Number(budget.limitAmount),
      currentSpend: Number(budget.currentSpend),
      alertThreshold: budget.alertThreshold != null ? Number(budget.alertThreshold) : null,
      percentUsed: Math.round(percentUsed * 10000) / 100, // e.g. 85.50 for 85.50%
      isOverThreshold,
      isExceeded,
    });
  } catch (err) {
    console.error('GET /api/v1/budgets/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch budget', 500);
  }
}

/**
 * PATCH /api/v1/budgets/[id]
 * Update a cost budget.
 *
 * Body: { name?, budgetType?, limitAmount?, alertThreshold?, category?, status?, currentSpend? }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.costBudget.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Budget not found');
    }

    const body = await req.json();
    const parsed = updateBudgetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return validationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const fields = parsed.data;
    const data: Record<string, unknown> = {};

    if (fields.name !== undefined) data.name = fields.name;
    if (fields.budgetType !== undefined) data.budgetType = fields.budgetType;
    if (fields.limitAmount !== undefined) data.limitAmount = fields.limitAmount;
    if (fields.alertThreshold !== undefined) data.alertThreshold = fields.alertThreshold;
    if (fields.category !== undefined) data.category = fields.category;
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.currentSpend !== undefined) data.currentSpend = fields.currentSpend;

    // If budgetType changed, recalculate periodEnd from current periodStart
    if (fields.budgetType !== undefined && fields.budgetType !== existing.budgetType) {
      const periodStart = existing.periodStart;
      const periodEnd = new Date(periodStart);
      switch (fields.budgetType) {
        case 'daily':
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'weekly':
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'monthly':
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
      }
      data.periodEnd = periodEnd;
    }

    const updated = await ctx.db.costBudget.update({
      where: { id },
      data,
    });

    const converted = {
      ...updated,
      limitAmount: Number(updated.limitAmount),
      currentSpend: Number(updated.currentSpend),
      alertThreshold: updated.alertThreshold != null ? Number(updated.alertThreshold) : null,
    };

    return success(converted);
  } catch (err) {
    console.error('PATCH /api/v1/budgets/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update budget', 500);
  }
}

/**
 * DELETE /api/v1/budgets/[id]
 * Delete a cost budget.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  try {
    const existing = await ctx.db.costBudget.findUnique({ where: { id } });
    if (!existing) {
      return notFound('Budget not found');
    }

    await ctx.db.costBudget.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/v1/budgets/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete budget', 500);
  }
}
