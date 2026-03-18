import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export { PrismaClient };
export type * from '@prisma/client';
