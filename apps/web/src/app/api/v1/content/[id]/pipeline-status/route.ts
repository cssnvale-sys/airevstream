import { NextRequest, NextResponse } from 'next/server';
import { authenticate, success, error, notFound, isUUID, validationError , type ApiContext } from '@/lib/api-server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type RouteParams = { params: { id: string } };

interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  durationMs?: number;
  progress?: number;
  detail?: string;
}

const PIPELINE_STEP_NAMES = [
  'Research', 'Script', 'Storyboard', 'Shot Generation',
  'QC Gate', 'Audio Mix', 'Video Render', 'Final Review',
];

/**
 * GET /api/v1/content/[id]/pipeline-status
 * Returns the cinema pipeline step statuses for a content item.
 * Derives step completion from content status and storyboard/shot states.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  let ctx: ApiContext | NextResponse | undefined = undefined;
  try {
    ctx = await authenticate(req);
    if (ctx instanceof NextResponse) return ctx;

    // Unconditional tenant guard (D076)
    if (!ctx.tenantId) return error('FORBIDDEN', 'No tenant context', 403);

    const ip = getClientIp(req);
    const rl = checkRateLimit(`content/pipeline-status:${ip}:${ctx.userId}`, RATE_LIMITS.contentGeneration);
    if (!rl.allowed) return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);

    const { id } = params;
    if (!isUUID(id)) return validationError('Invalid content ID format');

    const item = await ctx.db.contentItem.findFirst({
      where: {
        id,
        channel: { socialAccount: { emailAccount: { tenantId: ctx.tenantId } } },
      },
      select: {
        id: true,
        status: true,
        platformMetadata: true,
        storyboards: {
          select: {
            id: true,
            status: true,
            scriptJson: true,
            shots: {
              select: {
                id: true,
                status: true,
                qualityScore: true,
                plateVideoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!item) return notFound('Content item not found');

    const storyboard = item.storyboards[0] ?? null;
    const shots = storyboard?.shots ?? [];
    const metadata = item.platformMetadata as Record<string, unknown> | null;
    const contentStatus: string = item.status;

    // Derive step statuses from content and storyboard state
    const steps: PipelineStep[] = PIPELINE_STEP_NAMES.map((name) => {
      const step: PipelineStep = { name, status: 'pending' };

      switch (name) {
        case 'Research': {
          // Research is complete if we have a storyboard or content is past draft
          if (contentStatus === 'generating' && !storyboard) {
            step.status = 'running';
          } else if (storyboard || contentStatus !== 'draft') {
            step.status = 'complete';
          }
          break;
        }
        case 'Script': {
          const hasScript = storyboard?.scriptJson != null ||
            (metadata?.script != null);
          if (hasScript) {
            step.status = 'complete';
          } else if (storyboard && contentStatus !== 'draft') {
            step.status = 'running';
          }
          break;
        }
        case 'Storyboard': {
          if (storyboard && shots.length > 0) {
            step.status = 'complete';
          } else if (storyboard) {
            step.status = 'running';
          }
          break;
        }
        case 'Shot Generation': {
          const generatedCount = shots.filter((s) =>
            s.status === 'generated' || s.status === 'approved',
          ).length;
          const generatingCount = shots.filter((s) => s.status === 'generating').length;

          if (shots.length > 0 && generatedCount === shots.length) {
            step.status = 'complete';
          } else if (generatingCount > 0) {
            step.status = 'running';
            step.progress = shots.length > 0 ? Math.round((generatedCount / shots.length) * 100) : 0;
            step.detail = `${generatedCount}/${shots.length} shots`;
          } else if (generatedCount > 0) {
            step.status = 'running';
            step.progress = Math.round((generatedCount / shots.length) * 100);
          }
          break;
        }
        case 'QC Gate': {
          const scoredCount = shots.filter((s) => s.qualityScore != null).length;
          const allGenerated = shots.length > 0 && shots.every((s) =>
            s.status === 'generated' || s.status === 'approved',
          );
          if (allGenerated && scoredCount === shots.length) {
            step.status = 'complete';
          } else if (allGenerated) {
            step.status = 'running';
            step.progress = shots.length > 0 ? Math.round((scoredCount / shots.length) * 100) : 0;
          }
          break;
        }
        case 'Audio Mix': {
          const hasAudio = (metadata?.audioUrl as string) != null ||
            (metadata?.audioMixed as boolean) === true;
          const audioDoneByStatus = contentStatus === 'generated' ||
            contentStatus === 'pending_approval' ||
            contentStatus === 'approved' ||
            contentStatus === 'scheduled' ||
            contentStatus === 'posted' ||
            contentStatus === 'archived';
          const qcDone = shots.length > 0 && shots.every((s) => s.qualityScore != null);
          if (hasAudio || audioDoneByStatus) {
            step.status = 'complete';
          } else if (qcDone) {
            step.status = contentStatus === 'generating' ? 'running' : 'pending';
          }
          break;
        }
        case 'Video Render': {
          const hasVideo = shots.some((s) => s.plateVideoUrl != null);
          const renderDone = contentStatus === 'generated' ||
            contentStatus === 'pending_approval' ||
            contentStatus === 'approved' ||
            contentStatus === 'scheduled' ||
            contentStatus === 'posted' ||
            contentStatus === 'archived';
          if (renderDone) {
            step.status = 'complete';
          } else if (hasVideo || contentStatus === 'generating') {
            step.status = 'running';
          }
          break;
        }
        case 'Final Review': {
          if (contentStatus === 'approved' ||
            contentStatus === 'scheduled' ||
            contentStatus === 'posted' ||
            contentStatus === 'archived') {
            step.status = 'complete';
          } else if (contentStatus === 'pending_approval' || contentStatus === 'generated') {
            step.status = 'complete';
          } else if (contentStatus === 'failed') {
            step.status = 'failed';
          }
          break;
        }
      }

      return step;
    });

    return success({ steps });
  } catch (err) {
    logger.error('GET /api/v1/content/[id]/pipeline-status error', err as Error);
    return error('INTERNAL_ERROR', 'Failed to fetch pipeline status', 500);
  }
}
