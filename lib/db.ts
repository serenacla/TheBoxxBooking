import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { settingsSchema } from "./model";
pg.types.setTypeParser(1082, (v) => v); // PostgreSQL DATE stays a date, never a timezone-shifted JS Date.
const globalDb = globalThis as unknown as { boxxPool?: pg.Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!globalDb.boxxPool)
    globalDb.boxxPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 15000,
    });
  return globalDb.boxxPool;
}
const context = new AsyncLocalStorage<PoolClient>();
export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) => (await (context.getStore() ?? pool()).query<T>(text, values)).rows;
export async function transaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const r = await context.run(c, () => fn(c));
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function getSettings() {
  const [row] = await query("SELECT data,version FROM app_settings WHERE id=1");
  if (!row) throw new Error("DATABASE_NOT_MIGRATED");
  return {
    data: settingsSchema.parse(row.data),
    version: row.version as number,
  };
}
export async function audit(
  actor: string | null,
  action: string,
  booking: string | null = null,
  details: unknown = {},
) {
  await query(
    "INSERT INTO audit_log(actor_id,action,booking_id,details) VALUES($1,$2,$3,$4)",
    [actor, action, booking, JSON.stringify(details)],
  );
}
