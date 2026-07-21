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
