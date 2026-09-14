import { prisma } from './src/config/db';

async function check() {
  const users = await prisma.user.findMany();
  console.log('--- ALL USERS IN TURSO ---');
  console.log(users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role })));

  const workers = await prisma.workerProfile.findMany({
    include: {
      user: true,
      skills: { include: { category: true } }
    }
  });
  console.log('--- ALL WORKER PROFILES IN TURSO ---');
  console.log(JSON.stringify(workers, null, 2));

  const bookings = await prisma.booking.findMany({
    include: {
      service: true,
      address: true,
      customer: true
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- ALL BOOKINGS IN TURSO ---');
  console.log(JSON.stringify(bookings, null, 2));
}

check()
  .catch(console.error)
  .finally(() => process.exit(0));
