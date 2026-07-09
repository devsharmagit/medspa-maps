import { MapPin, MapPinned, Phone } from "lucide-react";
import type { ClinicLocation } from "@/lib/clinics/queries";
import { toStateCode } from "@/lib/location/states";

/**
 * ONE query per location = clinic name + full address. Google resolves this to
 * the exact business pin, and driving BOTH the embed and the "Open in Google
 * Maps" link from the same query keeps them pointing at the identical place.
 *
 * We deliberately use neither the stored lat/lng (Nominatim geocode — observed
 * up to ~1km off the real pin) nor the scraped maps short link (accurate, but
 * `maps.app.goo.gl` links are frame-blocked, so they can't be embedded — and
 * using them for only the button is what made the two disagree).
 */
function locationQuery(loc: ClinicLocation, clinicName: string): string {
  const addr = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
  return [clinicName, addr].filter(Boolean).join(", ").trim() || (loc.label ?? clinicName);
}

function mapsEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function mapsOpenUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function locationTitle(loc: ClinicLocation, idx: number): string {
  if (loc.label && loc.label.trim()) return loc.label;
  const cityState = [loc.city, loc.state].filter(Boolean).join(", ");
  return cityState || `Location ${idx + 1}`;
}

/**
 * Full postal address as up to two display lines:
 *   line 1 — street ("541 Buttermilk Pike, Suite 100")
 *   line 2 — "City, ST ZIP" ("Crescent Springs, KY 41017")
 * If the street string already contains the city (some scrapes store the full
 * address in one field), the second line is skipped to avoid duplication.
 */
function addressLines(loc: ClinicLocation): string[] {
  const lines: string[] = [];
  const street = loc.address?.trim() || null;

  const stateAbbr = loc.state ? (toStateCode(loc.state) ?? loc.state) : null;
  const cityState = [loc.city, stateAbbr].filter(Boolean).join(", ");
  const cityLine = [cityState, loc.zip].filter(Boolean).join(" ").trim();

  if (street) lines.push(street);
  if (
    cityLine &&
    !(street && loc.city && street.toLowerCase().includes(loc.city.toLowerCase()))
  ) {
    lines.push(cityLine);
  }
  return lines;
}

/**
 * "Our Locations" — a card grid of every physical location a clinic runs.
 * Rendered only for multi-location clinics; the hero card already covers the
 * single-location case. Anchored ("locations") so the hero's "+N more
 * locations" link can jump straight here.
 */
export function ClinicLocationsSection({
  locations,
  clinicName,
}: {
  locations: ClinicLocation[];
  clinicName: string;
}) {
  if (!locations || locations.length <= 1) return null;

  return (
    <section
      id="locations"
      className="flex flex-col gap-[28px] px-0 sm:px-[24px] pt-[12px] pb-[24px] scroll-mt-[110px]"
    >
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
          const addrLines = addressLines(loc);
          // Same query for the embed, the address link, and the "Open" button →
          // all three land on the identical, correct location.
          const query = locationQuery(loc, clinicName);
          const embedUrl = mapsEmbedUrl(query);
          const mapsUrl = mapsOpenUrl(query);

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

              {/* Google Maps embed — no API key needed */}
              <div className="overflow-hidden rounded-[12px] border border-[#EDE3EA]">
                <iframe
                  src={embedUrl}
                  title={`Map for ${title}`}
                  width="100%"
                  height="160"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="flex flex-col gap-[12px]">
                {addrLines.length > 0 && (
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
                      {addrLines.map((line, i) => (
                        <span key={i} className="block">
                          {line}
                        </span>
                      ))}
                    </a>
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

              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto flex h-[42px] items-center justify-center gap-[8px] rounded-[8px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[20px] transition-opacity hover:opacity-90"
              >
                <span className="font-montserrat text-[13px] font-semibold leading-[17px] text-white">
                  Open in Google Maps
                </span>
                <MapPinned
                  className="h-[18px] w-[18px] shrink-0 text-white"
                  strokeWidth={1.5}
                />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
