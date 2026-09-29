// ─── Phone helpers ────────────────────────────────────────────────────────────
// The directory is US-only, so lead phone numbers are plain 10-digit US
// numbers: stored as digits, displayed as (555) 123-4567.

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Exactly 10 digits, after dropping a leading 1 if the visitor typed one. */
export function normalizeUsPhone(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

export function isValidUsPhone(raw: string): boolean {
  return normalizeUsPhone(raw).length === 10;
}

/** Display / typing mask: (555) 123-4567, partial input included. */
export function formatUsPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = normalizeUsPhone(raw).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
