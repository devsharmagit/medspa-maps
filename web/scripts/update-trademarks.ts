import { query } from '../src/lib/db';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const brands = {
    'botox': 'Botox®',
    'dysport': 'Dysport®',
    'xeomin': 'Xeomin®',
    'jeuveau': 'Jeuveau®',
    'sculptra': 'Sculptra®',
    'hydrafacial': 'HydraFacial®'
  };
  
  for (const [slug, name] of Object.entries(brands)) {
    const res = await query('UPDATE public.services SET name = $1 WHERE slug = $2 RETURNING id', [name, slug]);
    console.log(`Updated ${slug} -> ${name}, rows: ${res.length}`);
  }
  
  console.log("Done DB update");
}

main().catch(console.error).finally(() => process.exit(0));
