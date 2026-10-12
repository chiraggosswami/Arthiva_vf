import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '@workspace/db/schema';
import { pool, db } from '@workspace/db';

export async function setupMemoryDb() {
  const client = new PGlite();

  const migrationsDir = path.resolve(__dirname, '../../../lib/db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    if (fs.existsSync(fullPath)) {
      const sqlContent = fs.readFileSync(fullPath, 'utf-8');
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await client.exec(stmt);
        } catch (e: any) {
          console.error(`Migration error in ${file} on stmt: ${stmt.slice(0, 60)}... Error: ${e.message}`);
        }
      }
    }
  }

  // Mock pool methods for health probes and direct pool queries
  pool.query = async (text: any, params?: any) => {
    if (typeof text === 'string') {
      const res = await client.query(text, params);
      return { rows: res.rows, rowCount: res.rows.length };
    }
    const res = await client.query(text.text, text.values);
    return { rows: res.rows, rowCount: res.rows.length };
  };

  pool.connect = async () => {
    return {
      query: pool.query,
      release: () => {},
    } as any;
  };

  const pgliteDrizzle = drizzle(client, { schema });
  const { setTestDb } = await import('@workspace/db');
  setTestDb(pgliteDrizzle, pool);

  return { client, pgliteDrizzle };
}
