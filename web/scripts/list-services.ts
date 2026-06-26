import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const res = await pool.query("SELECT slug, name, faqs FROM services");
  console.log(JSON.stringify(res.rows.map(r => ({ slug: r.slug, name: r.name, hasFaqs: r.faqs && r.faqs.length > 0 })), null, 2));
  await pool.end();
}

main().catch(console.error);
