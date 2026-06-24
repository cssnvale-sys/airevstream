import { authenticate, error } from '@/lib/api-server';
import { logger } from '@/lib/logger';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/accounts/[id]/oauth/[provider]
 * Proxies OAuth initiation to the workflow engine.
 * Provider must be 'google', 'youtube', 'tiktok', 'instagram', or 'facebook'.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; provider: string  }> },
) {
  const ctx = await authenticate(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id, provider } = await params;
  if (!['google', 'youtube', 'tiktok', 'instagram', 'facebook'].includes(provider)) {
    return error('BAD_REQUEST', "Provider must be 'google', 'youtube', 'tiktok', 'instagram' or 'facebook'", 400);
  }

  // Normalize youtube to google for upstream routing
  const upstreamProvider = provider === 'youtube' ? 'google' : provider;

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return error('UNAUTHORIZED', 'Missing authorization token', 401);
  }

  const baseUrl = process.env.NEXT_PUBLIC_WORKFLOW_API_URL ?? 'http://localhost:3011';
  const upstreamUrl = `${baseUrl}/api/accounts/${id}/oauth/${upstreamProvider}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      redirect: 'manual',
    });

    // Pass through any redirect response from the workflow engine
    if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
      const location = upstreamRes.headers.get('location');
      if (location) {
        return NextResponse.redirect(location, upstreamRes.status as 302);
      }
    }

    // Pass through JSON errors
    if (!upstreamRes.ok) {
      try {
        const errBody = await upstreamRes.json();
        return NextResponse.json(errBody, { status: upstreamRes.status });
      } catch (err) {
        const errForLog = err instanceof Error ? err : new Error('Unknown parse failure');
        logger.error('OAuth upstream JSON parse failed', errForLog, { provider, upstreamStatus: upstreamRes.status });
        return error('INTERNAL_ERROR', 'OAuth initiation failed', upstreamRes.status);
      }
    }

    // If somehow we got a 200 without a redirect, that's unexpected
    return error('INTERNAL_ERROR', 'Unexpected response from OAuth service', 500);
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to connect to OAuth service', 502);
  }
}
