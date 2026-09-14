import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

console.log('TURSO URL:', process.env.TURSO_DATABASE_URL ? 'PRESENT' : 'MISSING');

async function test() {
  try {
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    const prisma = new PrismaClient({ adapter } as any);
    const categories = await prisma.serviceCategory.findMany();
    console.log('✅ Successfully connected to Turso! Found categories:', categories.length);
    categories.forEach(c => console.log(` - ${c.name} (${c.slug})`));
    const bookings = await prisma.booking.findMany({ take: 5 });
    console.log('✅ Found bookings in Turso:', bookings.length);
  } catch (e) {
    console.error('❌ Turso connection error:', e);
  }
}

test();
