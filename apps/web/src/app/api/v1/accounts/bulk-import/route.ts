import { authenticate, success, error, validationError } from '@/lib/api-server';
import { encrypt } from '@airevstream/crypto';
import { getConfig } from '@airevstream/shared';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/accounts/bulk-import
 * Bulk import email accounts from a JSON array
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    let accounts: { email: string; password: string; tier?: string; notes?: string }[];

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      // Parse CSV: expected format "email,password[,tier][,notes]"
      const text = await req.text();
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const hasHeader = lines[0]?.toLowerCase().startsWith('email');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      accounts = dataLines.map((line) => {
        const [email, password, tier, notes] = line.split(',').map((f) => f.trim());
        return { email, password, tier: tier || undefined, notes: notes || undefined };
      });
    } else {
      const body = await req.json();
      accounts = body.accounts ?? body;
      if (!Array.isArray(accounts)) {
        accounts = body.accounts;
      }
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return validationError('Request must include a non-empty "accounts" array');
    }

    if (accounts.length > 500) {
      return validationError('Cannot import more than 500 accounts at once');
    }

    const config = getConfig();
    if (!config.ENCRYPTION_KEY) {
      return error('CONFIG_ERROR', 'Encryption key not configured', 500);
    }

    const validTiers = ['tier1', 'tier2', 'tier3'];
    const results: { email: string; status: 'created' | 'skipped'; reason?: string }[] = [];
    const errors: { email: string; error: string }[] = [];

    // Validate all entries first
    for (let i = 0; i < accounts.length; i++) {
      const entry = accounts[i];
      if (!entry.email || !entry.password) {
        errors.push({
          email: entry.email ?? `entry[${i}]`,
          error: 'Email and password are required',
        });
      }
      if (entry.tier && !validTiers.includes(entry.tier)) {
        errors.push({
          email: entry.email ?? `entry[${i}]`,
          error: `Invalid tier: ${entry.tier}`,
        });
      }
    }

    if (errors.length > 0) {
      return success({
        imported: 0,
        skipped: 0,
        errors,
        results: [],
      });
    }

    // Fetch existing emails to skip duplicates
    const emails = accounts.map((a: { email: string }) => a.email);
    const existingAccounts = await ctx.db.emailAccount.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingEmails = new Set(existingAccounts.map((a) => a.email));

    // Prepare records to create
    const toCreate: { email: string; passwordEnc: string; tier: string; notes: string | null }[] = [];

    for (const entry of accounts) {
      if (existingEmails.has(entry.email)) {
        results.push({ email: entry.email, status: 'skipped', reason: 'Already exists' });
        continue;
      }

      // Deduplicate within the batch itself
      if (toCreate.some((r) => r.email === entry.email)) {
        results.push({ email: entry.email, status: 'skipped', reason: 'Duplicate in batch' });
        continue;
      }

      toCreate.push({
        email: entry.email,
        passwordEnc: encrypt(entry.password, config.ENCRYPTION_KEY!),
        tier: entry.tier ?? 'tier2',
        notes: entry.notes ?? null,
      });

      results.push({ email: entry.email, status: 'created' });
    }

    if (toCreate.length > 0) {
      await ctx.db.emailAccount.createMany({ data: toCreate });
    }

    const imported = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return success({
      imported,
      skipped,
      errors,
      results,
    });
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to bulk import accounts', 500);
  }
}
