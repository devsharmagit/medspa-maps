import { Pool } from "pg";
import { readFileSync } from "node:fs";

const CSV = "/Users/devsharma/Downloads/clinics_opening_hours_FINAL.csv";
const APPLY = process.argv.includes("--apply");
const pool = new Pool({ connectionString: "postgres://postgres:CVCfdRRFd354DFfR@127.0.0.1:15432/medspa", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DL: Record<string, string> = { mon:"MONDAY",monday:"MONDAY",tue:"TUESDAY",tues:"TUESDAY",tuesday:"TUESDAY",wed:"WEDNESDAY",weds:"WEDNESDAY",wednesday:"WEDNESDAY",thu:"THURSDAY",thur:"THURSDAY",thurs:"THURSDAY",thursday:"THURSDAY",fri:"FRIDAY",friday:"FRIDAY",sat:"SATURDAY",saturday:"SATURDAY",sun:"SUNDAY",sunday:"SUNDAY" };
const to24 = (r: string): string | null => { const m = r.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if (!m) return null; let h=+m[1]; const mn=m[2]??"00"; const me=m[3]?.toLowerCase(); if(me==="pm"&&h!==12)h+=12; if(me==="am"&&h===12)h=0; if(h>23)return null; return `${String(h).padStart(2,"0")}:${mn}`; };

function parseHours(input: string): Record<string, {open:string|null;close:string|null;is_open:boolean}> | null {
  if (!input || /^(no hour|n\/a|none|unknown|not listed|not mentioned)/i.test(input.trim())) return null;
  const out: any = {};
  const pre = input.replace(/([\d)]|[ap]\.?m\.?|closed|appt|appointment)\s*(?=(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b)/gi, "$1\n");
  for (const seg of pre.split(/[;|\n•·]+/).map(s=>s.trim()).filter(Boolean)) {
    const days = [...seg.matchAll(/\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b/gi)].map(m=>DL[m[0].toLowerCase()]).filter(Boolean);
    if (!days.length) continue;
    const isR = days.length>=2 && /\b\w+\s*[-–—]\s*\w+/.test(seg);
    const tg = isR ? (()=>{const a=DAYS.indexOf(days[0]),b=DAYS.indexOf(days[1]);return a<=b?DAYS.slice(a,b+1):[...DAYS.slice(a),...DAYS.slice(0,b+1)];})() : days;
    const rg = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const closed = /\b(closed|by appt|by appointment|appointment only|strictly by)\b/i.test(seg);
    for (const d of tg) {
      if (out[d]) continue;
      if (rg && !closed) {
        const me = rg[2].match(/am|pm/i)?.[0] ?? "";
        const open = to24(/am|pm/i.test(rg[1]) ? rg[1] : rg[1]+" "+me); const close = to24(rg[2]);
        out[d] = open && close && open < close ? {open,close,is_open:true} : {open:null,close:null,is_open:false};
      } else if (closed) out[d] = {open:null,close:null,is_open:false};
    }
  }
  // fill missing days closed
  let openN = 0; for (const d of DAYS) { if (!out[d]) out[d]={open:null,close:null,is_open:false}; if(out[d].is_open)openN++; }
  return openN>0 ? out : null;
}

// minimal quoted-CSV row parser
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i=0;i<text.length;i++){ const c=text[i];
    if (q) { if (c === '"') { if (text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if (c==='"') q=true; else if (c===',') {row.push(cur);cur="";} else if (c==='\n'||c==='\r') { if(c==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=""; if(row.length>1||row[0]!=="")rows.push(row); row=[]; } else cur+=c; } }
  if (cur!==""||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
const slugFromUrl = (u: string) => (u.match(/\/practices\/([^/?#]+)/)?.[1] ?? "").trim();
const norm = (s: string) => (s??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

async function main() {
  const rows = parseCsv(readFileSync(CSV, "utf8"));
  const header = rows[0].map(h=>h.trim());
  const idx = (n:string) => header.indexOf(n);
  const iSlug = idx("Practice Page URL"), iCity = idx("City"), iLabel = idx("Location"), iHours = idx("Hours");
  const tally = { rows:0, parsed:0, noHours:0, matched:0, updated:0, nomatch:0, ambiguous:0 };
  const problems: string[] = [];

  for (const r of rows.slice(1)) {
    if (r.length < header.length) continue;
    tally.rows++;
    const slug = slugFromUrl(r[iSlug]);
    const hoursText = r[iHours]?.trim() ?? "";
    const parsed = parseHours(hoursText);
    if (!parsed) { tally.noHours++; continue; }
    tally.parsed++;

    // resolve clinic + location
    const locs = await pool.query<{id:string;city:string|null;label:string|null;is_primary:boolean}>(
      `SELECT l.id, l.city, l.label, l.is_primary FROM clinic_locations l
         JOIN clinics c ON c.id=l.clinic_id
        WHERE c.slug=$1 AND l.is_active=true`, [slug]);
    if (locs.rows.length === 0) { tally.nomatch++; problems.push(`NOMATCH ${slug} (${r[iCity]})`); continue; }
    let target = locs.rows;
    if (locs.rows.length > 1) {
      const byLabel = locs.rows.filter(l => norm(l.label||"")===norm(r[iLabel]));
      const byCity = locs.rows.filter(l => norm(l.city||"")===norm(r[iCity]));
      // Prefer an exact single label match; else all same-city branches (they
      // share the row's hours); else fall back to label matches.
      target = byLabel.length===1 ? byLabel : byCity.length>=1 ? byCity : byLabel;
    }
    if (target.length === 0) { tally.nomatch++; problems.push(`NOMATCH-LOC ${slug} city="${r[iCity]}" label="${r[iLabel]}"`); continue; }
    if (target.length > 1) { tally.ambiguous++; problems.push(`MULTI ${slug} city="${r[iCity]}" -> ${target.length} locs (same hours applied)`); }
    tally.matched++;
    if (APPLY) {
      for (const t of target) { await pool.query(`UPDATE clinic_locations SET hours=$2::jsonb, updated_at=now() WHERE id=$1`, [t.id, JSON.stringify(parsed)]); tally.updated++; }
    }
  }
  console.log(APPLY?"APPLIED":"DRY", JSON.stringify(tally));
  if (problems.length) console.log("PROBLEMS(", problems.length, "):\n"+problems.slice(0,40).join("\n"));
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
