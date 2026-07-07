/**
 * g99/prod.ts — LIVE read access to the G99 PROD Aurora reader (server-only).
 *
 * This is the database our clinic websites were harvested from, so the
 * `g99_clinic_id`/`g99_tenant_id` we stored resolve here. Reached via
 * `G99_PROD_DATABASE_URL` (an SSH tunnel — see scripts/g99/prod_tunnel.py).
 * Separate from `getG99Pool()` (G99_DATABASE_URL), which points at a different
 * G99 DB whose ids do NOT match our harvest.
 */

import { Pool } from "pg";

const g = globalThis as unknown as { __g99ProdPool?: Pool };

function prodPool(): Pool {
  if (!process.env.G99_PROD_DATABASE_URL) {
    throw new Error("G99_PROD_DATABASE_URL is not set (start scripts/g99/prod_tunnel.py)");
  }
  if (!g.__g99ProdPool) {
    g.__g99ProdPool = new Pool({
      connectionString: process.env.G99_PROD_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return g.__g99ProdPool;
}

async function q<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const res = await prodPool().query(sql, params as unknown[]);
  return res.rows as T[];
}

export interface ProdG99Service {
  name: string | null;
  category: string | null;
}

export interface ProdG99Clinic {
  clinic_id: string;
  tenant_id: string | null;
  name: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_number: string | null;
  about: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  google_profile_id: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  yelp_url: string | null;
  appointment_url: string | null;
  clinic_url: string | null;
  services: ProdG99Service[];
}

export interface ProdG99Business {
  business_id: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
}

const onlyBigints = (ids: Array<string | number>): string[] =>
  ids.map((x) => String(x)).filter((x) => /^\d+$/.test(x));

/** Full live G99 clinic records (by id) incl. their service list. */
export async function getProdClinicsByIds(
  ids: Array<string | number>
): Promise<ProdG99Clinic[]> {
  const bigints = onlyBigints(ids);
  if (bigints.length === 0) return [];

  const clinics = await q<Omit<ProdG99Clinic, "services">>(
    `SELECT id::text AS clinic_id, tenant_id::text AS tenant_id, name, website, address,
            city, state, country, contact_number, about, google_my_business,
            google_place_id, google_profile_id, instagram, facebook, twitter, tiktok,
            yelp_url, appointment_url, clinic_url
       FROM clinics
      WHERE id = ANY($1::bigint[])`,
    [bigints]
  );

  // Services are secondary — never let a schema hiccup here break the detail view.
  const byClinic = new Map<string, ProdG99Service[]>();
  try {
    const svc = await q<{ clinic_id: string; name: string | null; category: string | null }>(
      `SELECT scl.clinic_id::text AS clinic_id, s.name AS name, sc.name AS category
         FROM service_clinic scl
         JOIN services s ON s.id = scl.service_id AND s.deleted IS NOT TRUE
         LEFT JOIN service_categories sc ON sc.id = s.service_category_id
        WHERE scl.clinic_id = ANY($1::bigint[])
        ORDER BY sc.name NULLS LAST, s.name`,
      [bigints]
    );
    for (const r of svc) {
      const arr = byClinic.get(r.clinic_id) ?? [];
      arr.push({ name: r.name, category: r.category });
      byClinic.set(r.clinic_id, arr);
    }
  } catch {
    /* leave services empty */
  }

  const order = new Map(bigints.map((id, i) => [id, i]));
  return clinics
    .map((c) => ({ ...c, services: byClinic.get(c.clinic_id) ?? [] }))
    .sort((a, b) => (order.get(a.clinic_id) ?? 0) - (order.get(b.clinic_id) ?? 0));
}

/** Live G99 business (tenant) record. */
export async function getProdBusiness(
  tenantId: string | number | null
): Promise<ProdG99Business | null> {
  if (tenantId == null || !/^\d+$/.test(String(tenantId))) return null;
  const rows = await q<ProdG99Business>(
    `SELECT id::text AS business_id, name, website, logo_url, about, city, state, country, phone
       FROM businesses WHERE id = $1::bigint LIMIT 1`,
    [String(tenantId)]
  );
  return rows[0] ?? null;
}
