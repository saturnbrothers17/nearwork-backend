import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import { ENV } from './environment';

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url = ENV.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = ENV.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is not set');
  }

  console.log('🚀 Connecting NearWork to Turso (libSQL)...');

  const adapter = new PrismaLibSql({
    url,
    authToken,
  });

  return new PrismaClient({ adapter } as any);
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
