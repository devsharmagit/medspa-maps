/**
 * import-postal-codes.mjs — create + seed the postal_codes table from a
 * GeoNames postal-code dump (tab-separated). US now; the same file format
 * works for IN (India) and 90+ countries later.
 *
 * Usage:  node scripts/import-postal-codes.mjs <path-to-US.txt>
 * Idempotent: ON CONFLICT (country_code, postal_code, place_name) DO UPDATE.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config();

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-postal-codes.mjs <US.txt>");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DDL = `
CREATE TABLE IF NOT EXISTS postal_codes (
  id           bigserial PRIMARY KEY,
  country_code text NOT NULL DEFAULT 'US',
  postal_code  text NOT NULL,
  place_name   text NOT NULL,          -- city / locality
  state_name   text,
  state_code   text,
  county       text,
  lat          numeric(9,6),
  lng          numeric(9,6),
  source       text NOT NULL DEFAULT 'geonames',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, postal_code, place_name)
);
-- prefix search on zip ("372" -> 37201, 37203...)
CREATE INDEX IF NOT EXISTS postal_codes_zip_prefix_idx
  ON postal_codes (country_code, postal_code text_pattern_ops);
-- fuzzy/prefix search on city name (pg_trgm already installed for clinic search)
CREATE INDEX IF NOT EXISTS postal_codes_place_trgm_idx
  ON postal_codes USING gin (lower(place_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS postal_codes_state_idx
  ON postal_codes (state_code);
`;

async function main() {
  const client = await pool.connect();
  try {
    console.log("Creating table + indexes…");
    await client.query(DDL);

    const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean);
    console.log(`Importing ${lines.length} rows…`);

    await client.query("BEGIN");
    const BATCH = 1000;
    let inserted = 0;
    for (let i = 0; i < lines.length; i += BATCH) {
      const chunk = lines.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let p = 1;
      for (const line of chunk) {
        // GeoNames TSV: country, postal, place, admin1 name, admin1 code,
        // admin2 name, admin2 code, admin3 name, admin3 code, lat, lng, accuracy
        const c = line.split("\t");
        if (c.length < 11) continue;
        const lat = parseFloat(c[9]);
        const lng = parseFloat(c[10]);
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(
          c[0] || "US",
          c[1].trim(),
          c[2].trim(),
          c[3].trim() || null,
          c[4].trim() || null,
          c[5].trim() || null,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
        );
      }
      if (!values.length) continue;
      const res = await client.query(
        `INSERT INTO postal_codes
           (country_code, postal_code, place_name, state_name, state_code, county, lat, lng)
         VALUES ${values.join(",")}
         ON CONFLICT (country_code, postal_code, place_name) DO UPDATE
           SET lat = EXCLUDED.lat, lng = EXCLUDED.lng,
               state_name = EXCLUDED.state_name, state_code = EXCLUDED.state_code`,
        params,
      );
      inserted += res.rowCount ?? 0;
      if ((i / BATCH) % 10 === 0) process.stdout.write(`\r  ${i + chunk.length}/${lines.length}`);
    }
    await client.query("COMMIT");
    console.log(`\nDone. Upserted ${inserted} rows.`);

    const { rows } = await client.query(
      "SELECT count(*) n, count(DISTINCT postal_code) zips, count(DISTINCT state_code) states FROM postal_codes WHERE country_code='US'",
    );
    console.log("Table now:", rows[0]);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
