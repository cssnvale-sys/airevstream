import { type FastifyInstance } from 'fastify';
import { getDb } from '@airevstream/db';
import { getPresignedUrl } from '@airevstream/storage';

export async function assetRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List storyboard shots (assets) for a content item
  app.get('/content/:contentId', async (request, reply) => {
    const { contentId } = request.params as { contentId: string };
    const db = getDb();

    const content = await db.contentItem.findUnique({ where: { id: contentId } });
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

    return reply.send({ success: true, data: storyboards });
  });

  // Get presigned download URL for a shot keyframe or scenery asset
  app.get('/download', async (request, reply) => {
    const { bucket, key } = request.query as { bucket: string; key: string };

    if (!bucket || !key) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'bucket and key query params required' },
      });
    }

    const url = await getPresignedUrl(bucket, key, 3600);
    return reply.send({ success: true, data: { url, expiresIn: 3600 } });
  });

  // List scenery assets
  app.get('/scenery', async (request, reply) => {
    const { category } = request.query as { category?: string };
    const db = getDb();

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const assets = await db.sceneryAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ success: true, data: assets });
  });
}
