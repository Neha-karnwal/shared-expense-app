import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

console.log('DATABASE_URL inside db.js:', process.env.DATABASE_URL);

let prismaInstance = null;

function createClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  if (dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql')) {
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } else {
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    return new PrismaClient({ adapter });
  }
}

function getPrisma() {
  if (process.env.NODE_ENV === 'production') {
    if (!prismaInstance) {
      prismaInstance = createClient();
    }
    return prismaInstance;
  } else {
    if (!global.prisma) {
      global.prisma = createClient();
    }
    return global.prisma;
  }
}

// Export a Proxy that forwards properties to the lazily-loaded Prisma Client instance
const prisma = new Proxy({}, {
  get(target, prop) {
    const instance = getPrisma();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});

export default prisma;
