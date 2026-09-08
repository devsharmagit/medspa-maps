import { Pool, PoolClient } from "pg";

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
    connectionTimeoutMillis: 20_000,
  });
}

// The primary pool is created LAZILY — never at module load — so `next build`
// (which imports every route module with NODE_ENV=production) succeeds without
// DATABASE_URL. The real URL is injected at runtime; creation is deferred to the
// first actual query. Same rationale as getG99Pool below.
let poolSingleton: Pool | undefined;

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return (poolSingleton ??= createPool());
  }
  return (globalThis.__pgPool ??= createPool());
}

// Preserve the `import pool from "@/lib/db"` interface without eager creation:
// the real pool is instantiated on first property access (always request-time,
// never at import/build).
const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

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

// The G99 pool is created LAZILY (see getG99Pool) — never at module load.
let g99PoolSingleton: Pool | undefined;

/**
 * Lazily create/reuse the G99 read-replica pool. Unlike the primary `pool`,
 * the G99 DB is an OPTIONAL, tunnel-gated dependency used only by the admin
 * G99-import feature. Creating it eagerly meant a missing G99_DATABASE_URL
 * threw at `@/lib/db` import time and took down EVERY DB-backed route (public
 * site, search, all of admin). Deferring creation to first use means that
 * throw can only ever surface inside an actual G99 query — nothing else.
 */
export function getG99Pool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return (g99PoolSingleton ??= createG99Pool());
  }
  return (globalThis.__g99PgPool ??= createG99Pool());
}

export default pool;

/** Convenience helper — runs a query and returns rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
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

/**
 * Run `fn` inside a single transaction on a dedicated pooled client.
 * Commits on success, rolls back on any thrown error, and always releases
 * the client. Use for multi-statement writes that must be atomic.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Convenience helper — runs a query on G99 DB and returns rows */
export async function queryG99<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getG99Pool().query(sql, params);
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
