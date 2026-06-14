import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  if (dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql')) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  } else {
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const Database = require('better-sqlite3');
    const dbFile = dbUrl.replace('file:', '');
    const sqlite = new Database(dbFile);
    const adapter = new PrismaBetterSqlite3(sqlite);
    prisma = new PrismaClient({ adapter });
  }
} else {
  if (!global.prisma) {
    const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
    if (dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql')) {
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: dbUrl });
      const adapter = new PrismaPg(pool);
      global.prisma = new PrismaClient({ adapter });
    } else {
      const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
      const Database = require('better-sqlite3');
      const dbFile = dbUrl.replace('file:', '');
      const sqlite = new Database(dbFile);
      const adapter = new PrismaBetterSqlite3(sqlite);
      global.prisma = new PrismaClient({ adapter });
    }
  }
  prisma = global.prisma;
}

export default prisma;
