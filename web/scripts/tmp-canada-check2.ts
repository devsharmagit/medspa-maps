import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const res = await pool.query(`
    select distinct c.id, c.name, c.slug, c.website, c.is_active
    from clinics c
    where c.id in (
      '3a828606-de7c-4fd0-bd00-73b76b34ad9b',
      '5f98f6bd-41a4-44d6-9a75-eeecbd773100',
      '603d7b4b-4d05-4668-aecf-2abeafd6bfb7',
      'e442b226-14ff-49f4-a947-2b7d64f294e3',
      '9f528b3b-8db9-4c21-96e5-de2626f8e022',
      'caa2c694-40ca-4778-bd3f-54e87b19f3a3',
      '46ad6deb-ecc8-4d7a-b3ca-3794e924ed84',
      '3666c950-5710-4864-b9ad-bd7bf8a56b10'
    )
    order by c.name
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
