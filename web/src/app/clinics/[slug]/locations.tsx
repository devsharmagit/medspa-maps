import { CalendarDays, Clock, MapPin, Phone } from "lucide-react";
import type { ClinicLocation } from "@/lib/clinics/queries";

const DAY_KEYS = [
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

function getTodayHours(hours: unknown): { open: string; close: string } | null {
  if (!hours || typeof hours !== "object") return null;
  const map = hours as HoursMap;
  const key = DAY_KEYS[new Date().getDay()];
  const h = map[key];
  if (!h || !h.is_open || !h.open || !h.close) return null;
  return { open: h.open, close: h.close };
}

function buildMapsUrl(parts: (string | null)[]): string {
  const q = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function locationTitle(loc: ClinicLocation, idx: number): string {
  if (loc.label && loc.label.trim()) return loc.label;
  const cityState = [loc.city, loc.state].filter(Boolean).join(", ");
  return cityState || `Location ${idx + 1}`;
}

function addressLine(loc: ClinicLocation): string | null {
  if (loc.address) return loc.address;
  const parts = [loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
  return parts || null;
}

/**
 * "Our Locations" — a card grid of every physical location a clinic runs.
 * Rendered only for multi-location clinics; the hero card already covers the
 * single-location case.
 */
export function ClinicLocationsSection({
  locations,
  fallbackBookUrl,
}: {
  locations: ClinicLocation[];
  fallbackBookUrl?: string | null;
}) {
  if (!locations || locations.length <= 1) return null;

  return (
    <section className="flex flex-col gap-[28px] px-[24px] pt-[12px] pb-[24px]">
      <div className="flex items-baseline gap-3">
        <h2 className="font-fraunces italic text-[28px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Our Locations
        </h2>
        <span className="font-montserrat text-[14px] font-medium text-[#A8698B]">
          {locations.length} locations
        </span>
      </div>

      <div className="grid gap-[20px] sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc, idx) => {
          const title = locationTitle(loc, idx);
          const addr = addressLine(loc);
          const mapsUrl =
            loc.google_maps_url ||
            buildMapsUrl([loc.address, loc.city, loc.state, loc.zip]);
          const today = getTodayHours(loc.hours);
          const book = loc.booking_url || fallbackBookUrl;

          return (
            <div
              key={loc.id}
              className="flex flex-col gap-[16px] rounded-[18px] border border-[#DEDEDE] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-montserrat text-[18px] font-semibold leading-[130%] tracking-[-0.02em] text-[#373634]">
                  {title}
                </h3>
                {loc.is_primary && (
                  <span className="shrink-0 rounded-[4px] bg-[rgba(168,105,139,0.12)] px-[8px] py-[3px] font-montserrat text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A8698B]">
                    Primary
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-[12px]">
                {addr && (
                  <div className="flex items-start gap-[8px]">
                    <MapPin
                      className="h-[20px] w-[20px] shrink-0 text-[#EE97C6]"
                      strokeWidth={1.5}
                    />
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-montserrat text-[13px] font-medium leading-[140%] tracking-[0.02em] text-[#616161] hover:underline"
                    >
                      {addr}
                    </a>
                  </div>
                )}

                {today && (
                  <div className="flex items-center gap-[8px]">
                    <Clock
                      className="h-[20px] w-[20px] shrink-0 text-[#EE97C6]"
                      strokeWidth={1.5}
                    />
                    <span className="font-montserrat text-[13px] font-medium leading-[130%] tracking-[0.02em] text-[#616161]">
                      Open Today{" "}
                      <span className="text-[#9A9A9A]">
                        {today.open} - {today.close}
                      </span>
                    </span>
                  </div>
                )}

                {loc.phone && (
                  <div className="flex items-center gap-[8px]">
                    <Phone
                      className="h-[18px] w-[18px] shrink-0 text-[#EE97C6]"
                      strokeWidth={1.5}
                    />
                    <a
                      href={`tel:${loc.phone}`}
                      className="font-montserrat text-[13px] font-medium leading-[130%] tracking-[0.02em] text-[#616161] hover:underline"
                    >
                      {loc.phone}
                    </a>
                  </div>
                )}
              </div>

              {book && (
                <a
                  href={book}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto flex h-[42px] items-center justify-center gap-[8px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[20px] transition-opacity hover:opacity-90"
                >
                  <span className="font-montserrat text-[13px] font-semibold leading-[17px] text-white">
                    Book Appointment
                  </span>
                  <CalendarDays
                    className="h-[18px] w-[18px] shrink-0 text-white"
                    strokeWidth={1.5}
                  />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
