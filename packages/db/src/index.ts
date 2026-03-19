import { PrismaClient } from '@prisma/client';

// Use globalThis to prevent connection pool exhaustion in Next.js dev mode.
// Hot module reloading re-evaluates modules, creating orphaned PrismaClient
// instances whose connections never close. Storing on globalThis survives HMR.
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.__prisma;
}

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.__prisma) {
    await globalForPrisma.__prisma.$disconnect();
    globalForPrisma.__prisma = undefined;
  }
}

export { PrismaClient };
export type * from '@prisma/client';
