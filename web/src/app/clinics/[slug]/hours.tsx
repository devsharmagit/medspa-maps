import { Clock } from "lucide-react";

// Hours are stored as a jsonb map keyed by UPPERCASE full day name:
//   { "MONDAY": { open: "09:00", close: "17:00", is_open: true }, ... }
// (open/close are 24h "HH:MM" or null; is_open is boolean.)

const DAY_ORDER: [string, string][] = [
  ["MONDAY", "Monday"],
  ["TUESDAY", "Tuesday"],
  ["WEDNESDAY", "Wednesday"],
  ["THURSDAY", "Thursday"],
  ["FRIDAY", "Friday"],
  ["SATURDAY", "Saturday"],
  ["SUNDAY", "Sunday"],
];
const TODAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

type HoursMap = Record<
  string,
  { open: string | null; close: string | null; is_open: boolean }
>;

/** "17:00" → "5:00 PM"; passes through values that are already 12h. */
function to12h(t: string): string {
  if (/[ap]m/i.test(t)) return t.toUpperCase();
  const [hStr, m = "00"] = t.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const mer = h >= 12 ? "PM" : "AM";
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${m.padStart(2, "0")} ${mer}`;
}

export function hasWeeklyHours(hours: unknown): boolean {
  if (!hours || typeof hours !== "object") return false;
  const map = hours as HoursMap;
  return DAY_ORDER.some(([k]) => map[k]);
}

/**
 * Full Mon–Sun schedule; today's row is emphasized. Renders nothing when no
 * structured hours are present.
 */
export function WeeklyHours({
  hours,
  className = "",
}: {
  hours: unknown;
  className?: string;
}) {
  if (!hasWeeklyHours(hours)) return null;
  const map = hours as HoursMap;
  const todayKey = TODAY_KEYS[new Date().getDay()];

  return (
    <div className={`flex flex-col ${className}`}>
      {DAY_ORDER.map(([key, label]) => {
        const h = map[key];
        const open = h && h.is_open && h.open && h.close;
        const isToday = key === todayKey;
        return (
          <div
            key={key}
            className={`flex items-center justify-between gap-4 border-b border-[rgba(229,199,218,0.4)] py-[7px] last:border-0 ${
              isToday ? "font-semibold text-[#373634]" : "text-[#616161]"
            }`}
          >
            <span className="font-montserrat text-[13px] tracking-[0.02em]">
              {label}
              {isToday ? " · Today" : ""}
            </span>
            <span className="font-inter text-[13px] text-[#9A9A9A]">
              {open ? `${to12h(h!.open!)} – ${to12h(h!.close!)}` : "Closed"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Titled hours card for the clinic detail page (clinic-wide hours). */
export function HoursCard({ hours }: { hours: unknown }) {
  if (!hasWeeklyHours(hours)) return null;
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[14px] rounded-[16px] border border-[#DEDEDE] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      <div className="flex items-center gap-[8px]">
        <Clock className="h-[20px] w-[20px] text-[#EE97C6]" strokeWidth={1.5} />
        <h3 className="font-montserrat text-[16px] font-semibold tracking-[-0.02em] text-[#373634]">
          Hours
        </h3>
      </div>
      <WeeklyHours hours={hours} />
    </div>
  );
}
