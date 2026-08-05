import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Renders a count as a rounded-down "N+" label (e.g. 68 -> "60+", 559 ->
 * "550+") instead of the exact number, so static snapshot counts (top
 * states, popular treatments) don't read as stale/wrong as real counts
 * grow past them — round down to the nearest 10 so the "+" is always true.
 */
export function formatCountPlus(count: number): string {
  const rounded = Math.floor(count / 10) * 10;
  return `${rounded}+`;
}

/**
 * Format a US phone number for display as "123-456-7890". Strips a leading
 * country code (1) and any non-digits; anything that isn't a clean 10-digit
 * number is returned unchanged so we never mangle odd/international values.
 */
export function formatPhoneUs(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) {
    return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  return phone;
}

/** Human date like "August 5, 2026". Returns "" for missing/invalid input. */
export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** UTM tag applied to outbound "Book appointment" links so we can attribute
 *  bookings we drive from a practice profile. */
const BOOKING_UTM = "utm_source=medspamaps&utm_medium=referral&utm_campaign=practice_profile";

/**
 * Append booking-attribution UTM params to an outbound booking URL. Preserves
 * an existing query string and hash, and leaves non-web links (tel:, mailto:,
 * "#", relative) untouched. Returns null for empty input.
 */
export function withBookingUtm(
  url: string | null | undefined,
  slug?: string | null,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  const utm = slug ? `${BOOKING_UTM}&utm_content=${encodeURIComponent(slug)}` : BOOKING_UTM;
  const [base, hash = ""] = trimmed.split("#");
  const joiner = base.includes("?") ? "&" : "?";
  const withParams = `${base}${joiner}${utm}`;
  return hash ? `${withParams}#${hash}` : withParams;
}
