// Deactivate catalog concerns that no ACTIVE clinic links.
// Keeps the row (no delete) so clinic_concerns links and history survive.
// Usage: node scripts/deactivate-orphan-concerns.mjs [--apply]   (run from web/)
import { config } from 'dotenv'; config();
import pg from 'pg';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const ORPHANS = `
  select c2.id, c2.name, c2.slug, c2.origin
  from concerns c2
  where c2.is_active
    and not exists (
      select 1 from clinic_concerns cc
      join clinics cl on cl.id = cc.clinic_id
      where cc.concern_id = c2.id and cl.is_active
    )`;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`${ORPHANS} order by c2.name`);
console.log(`${rows.length} active concerns have zero active clinics`);
console.log(rows.map(r => `${r.name} (${r.origin})`).join('\n'));
if (rows.length) {
  const csv = 'id,name,slug,origin\n' + rows.map(r => `${r.id},"${r.name.replace(/"/g, '""')}",${r.slug},${r.origin}`).join('\n');
  fs.writeFileSync('reports/orphan-concerns-deactivated.csv', csv);
}
if (!APPLY) { console.log('dry run — pass --apply to deactivate'); await c.end(); process.exit(0); }
const res = await c.query(`update concerns set is_active = false where id = any($1::uuid[])`, [rows.map(r => r.id)]);
console.log(`deactivated ${res.rowCount}`);
await c.end();
