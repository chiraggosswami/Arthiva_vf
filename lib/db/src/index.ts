import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || "";

export let pool: any;
export let db: any;

try {
  if (!dbUrl) {
    throw new Error('DATABASE_URL not configured');
  }
  pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  db = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_, prop) => (prop === 'query' ? new Proxy({}, { get: () => noOp }) : async () => []),
  });
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
    end: async () => {},
  };
}

export function setTestDb(newDb: any, newPool?: any) {
  db = newDb;
  if (newPool) {
    pool = newPool;
  }
}

export * from "./schema";
export { eq, and, desc, asc, sql } from "drizzle-orm";
