const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/lib/hash');

function createClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  if (dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql')) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } else {
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    return new PrismaClient({ adapter });
  }
}

const prisma = createClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clear database
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.importAnomaly.deleteMany({});
  await prisma.importReport.deleteMany({});

  console.log('Database cleared.');

  // 2. Create the default group
  const group = await prisma.group.create({
    data: {
      name: 'Cozy Flat 404',
    },
  });
  console.log(`Group created: ${group.name} (${group.id})`);

  // 3. Create the users and their membership periods
  const usersData = [
    { name: 'Aisha', password: 'aisha123', joined: '2026-02-01T00:00:00.000Z', left: null },
    { name: 'Rohan', password: 'rohan123', joined: '2026-02-01T00:00:00.000Z', left: null },
    { name: 'Priya', password: 'priya123', joined: '2026-02-01T00:00:00.000Z', left: null },
    { name: 'Meera', password: 'meera123', joined: '2026-02-01T00:00:00.000Z', left: '2026-03-31T23:59:59.999Z' },
    { name: 'Sam', password: 'sam123', joined: '2026-04-15T00:00:00.000Z', left: null },
    { name: 'Dev', password: 'dev123', joined: '2026-02-01T00:00:00.000Z', left: '2026-03-31T23:59:59.999Z' }, // visitor for weekend & trip
  ];

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        passwordHash: hashPassword(u.password),
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        joinedAt: new Date(u.joined),
        leftAt: u.left ? new Date(u.left) : null,
      },
    });

    console.log(`User seeded: ${user.name} (Password: ${u.password}, Joined: ${u.joined.split('T')[0]}, Left: ${u.left ? u.left.split('T')[0] : 'Active'})`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
