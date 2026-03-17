import { type FastifyInstance } from 'fastify';
import { getDb } from '@airevstream/db';
import { getPresignedUrl } from '@airevstream/storage';

export async function assetRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // List assets for a content item
  app.get('/content/:contentId', async (request, reply) => {
    const { contentId } = request.params as { contentId: string };
    const db = getDb();

    // Verify user owns the content
    const content = await db.content.findFirst({
      where: { id: contentId, userId: request.user.sub },
    });
    if (!content) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Content not found' },
      });
    }

    const assets = await db.contentAsset.findMany({
      where: { contentId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ success: true, data: assets });
  });

  // Get presigned download URL for an asset
  app.get('/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const asset = await db.contentAsset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' },
      });
    }

    // Verify user owns the content
    const content = await db.content.findFirst({
      where: { id: asset.contentId, userId: request.user.sub },
    });
    if (!content) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Asset not found' },
      });
    }

    const url = await getPresignedUrl(asset.bucket, asset.key, 3600);
    return reply.send({ success: true, data: { url, expiresIn: 3600 } });
  });
}
