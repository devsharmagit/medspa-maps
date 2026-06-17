import { Pool } from "pg";

// Singleton pool — reused across hot-reloads in dev via global cache
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __g99PgPool: Pool | undefined;
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

const pool: Pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (globalThis.__pgPool ??= createPool());

function createG99Pool(): Pool {
  if (!process.env.G99_DATABASE_URL) {
    throw new Error("G99_DATABASE_URL environment variable is not set");
  }
  
  return new Pool({
    connectionString: process.env.G99_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const g99Pool: Pool =
  process.env.NODE_ENV === "production"
    ? createG99Pool()
    : (globalThis.__g99PgPool ??= createG99Pool());

export default pool;

/** Convenience helper — runs a query and returns rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/** Convenience helper — returns the first row or null */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Convenience helper — runs a query on G99 DB and returns rows */
export async function queryG99<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await g99Pool.query(sql, params);
  return result.rows as T[];
}

/** Convenience helper — returns the first row or null on G99 DB */
export async function queryOneG99<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await queryG99<T>(sql, params);
  return rows[0] ?? null;
}
