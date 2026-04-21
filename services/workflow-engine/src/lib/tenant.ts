import { type FastifyRequest, type FastifyReply } from 'fastify';
import { getDb } from '@airevstream/db';

/** Resolve the tenantId for the authenticated user, or send 403. Returns null if 403 was sent. */
export async function resolveTenantId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
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

/** Get all channel IDs and email account IDs belonging to a tenant. */
export async function getTenantScope(tenantId: string): Promise<{ channelIds: string[]; emailAccountIds: string[] }> {
  const db = getDb();
  const emailAccounts = await db.emailAccount.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const emailAccountIds = emailAccounts.map((ea) => ea.id);

  const channels = emailAccountIds.length > 0
    ? await db.channel.findMany({
        where: { socialAccount: { emailAccountId: { in: emailAccountIds } } },
        select: { id: true },
      })
    : [];
  const channelIds = channels.map((c) => c.id);

  return { channelIds, emailAccountIds };
}
