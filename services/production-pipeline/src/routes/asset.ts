import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { getDb } from '@airevstream/db';
import { getPresignedUrl } from '@airevstream/storage';
import { createLogger, PRESIGNED_URL_TTL_SECONDS } from '@airevstream/shared';

const assetLogger = createLogger('production-pipeline:asset');

/** Resolve the tenantId for the authenticated user, or send 403. Returns null if 403 was sent. */
async function resolveTenantId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const userId = request.user?.sub;
  if (!userId) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'No tenant context' } });
    return null;
  }
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  if (!user?.tenantId) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'No tenant context' } });
    return null;
  }
  return user.tenantId;
}

export async function assetRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List storyboard shots (assets) for a content item
  app.get('/content/:contentId', async (request, reply) => {
    const tenantId = await resolveTenantId(request, reply);
    if (!tenantId) return;

    const { contentId } = request.params as { contentId: string };
    const db = getDb();

    // Verify the content belongs to this tenant via channel chain
    const content = await db.contentItem.findFirst({
      where: {
        id: contentId,
        channel: { socialAccount: { emailAccount: { tenantId } } },
      },
    });
    if (!content) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    const storyboards = await db.storyboard.findMany({
      where: { contentId },
      include: { shots: { orderBy: { shotNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    // Wrap Decimal fields for JSON serialization
    const serializedStoryboards = storyboards.map((sb) => ({
      ...sb,
      totalDurationSec: sb.totalDurationSec != null ? Number(sb.totalDurationSec) : null,
      shots: sb.shots.map((shot) => ({
        ...shot,
        startSec: Number(shot.startSec),
        endSec: Number(shot.endSec),
        qualityScore: shot.qualityScore != null ? Number(shot.qualityScore) : null,
        generationCost: shot.generationCost != null ? Number(shot.generationCost) : null,
      })),
    }));

    return reply.send({ success: true, data: serializedStoryboards });
  });

  // Get presigned download URL for a shot keyframe or scenery asset
  app.get('/download', async (request, reply) => {
    const tenantId = await resolveTenantId(request, reply);
    if (!tenantId) return;

    const { bucket, key } = request.query as { bucket: string; key: string };

    if (!bucket || !key) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'bucket and key query params required' },
      });
    }

    try {
      const url = await getPresignedUrl(bucket, key, PRESIGNED_URL_TTL_SECONDS);
      return reply.send({ success: true, data: { url, expiresIn: PRESIGNED_URL_TTL_SECONDS } });
    } catch (err) {
      assetLogger.error({ err, bucket, key }, 'Failed to generate presigned URL');
      return reply.status(500).send({
        success: false,
        error: { code: 'STORAGE_ERROR', message: 'Failed to generate download URL' },
      });
    }
  });

  // List scenery assets
  app.get('/scenery', async (request, reply) => {
    const tenantId = await resolveTenantId(request, reply);
    if (!tenantId) return;

    const { category } = request.query as { category?: string };
    const db = getDb();

    const where: Record<string, unknown> = { tenantId };
    if (category) where.category = category;

    const assets = await db.sceneryAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ success: true, data: assets });
  });
}
