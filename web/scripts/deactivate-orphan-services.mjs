// Deactivate catalog services that no ACTIVE clinic offers.
// Keeps the row (no delete) so clinic_services links and history survive.
// Usage: node scripts/deactivate-orphan-services.mjs [--apply]   (run from web/)
import { config } from 'dotenv'; config();
import pg from 'pg';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const ORPHANS = `
  select s.id, s.name, s.slug, s.origin
  from services s
  where s.is_active
    and not exists (
      select 1 from clinic_services cs
      join clinics cl on cl.id = cs.clinic_id
      where cs.service_id = s.id and cl.is_active
    )`;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`${ORPHANS} order by s.name`);
console.log(`${rows.length} active services have zero active clinics`);
if (rows.length) {
  const csv = 'id,name,slug,origin\n' + rows.map(r => `${r.id},"${r.name.replace(/"/g, '""')}",${r.slug},${r.origin}`).join('\n');
  fs.writeFileSync('reports/orphan-services-deactivated.csv', csv);
}
if (!APPLY) { console.log('dry run — pass --apply to deactivate'); await c.end(); process.exit(0); }
const res = await c.query(`update services set is_active = false where id = any($1::uuid[])`, [rows.map(r => r.id)]);
console.log(`deactivated ${res.rowCount}`);
await c.end();
