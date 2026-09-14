import { query } from '../src/lib/db';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const rows = await query('SELECT slug, name FROM public.services WHERE slug = $1', ['botox']);
  console.log(rows);
}

main().catch(console.error).finally(() => process.exit(0));
