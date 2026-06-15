/**
 * Shared DB helpers for the sync pipeline.
 * Uses two pools: `ourPool` (Neon/MedSpaMaps) and `g99Pool` (G99, read-only).
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

// Our Neon database
export const ourPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
});

// G99 database — read-only
export const g99Pool = new Pool({
  connectionString: process.env.G99_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30_000,
});

export async function ourQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await ourPool.query(sql, params);
  return result.rows as T[];
}

export async function ourQueryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await ourQuery<T>(sql, params);
  return rows[0] ?? null;
}

export async function g99Query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await g99Pool.query(sql, params);
  return result.rows as T[];
}

export async function g99QueryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await g99Query<T>(sql, params);
  return rows[0] ?? null;
}

/** JS-side slugify to match the SQL function */
export function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[®™©°]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Generate a unique slug — appends -2, -3 if conflicts exist */
export async function uniqueSlug(
  baseSlug: string,
  table: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let n = 2;
  while (true) {
    const row = await ourQueryOne(
      `SELECT id FROM ${table} WHERE slug = $1${excludeId ? " AND id != $2" : ""}`,
      excludeId ? [slug, excludeId] : [slug]
    );
    if (!row) return slug;
    slug = `${baseSlug}-${n++}`;
  }
}
