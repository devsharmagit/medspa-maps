import { MapPin, MapPinned, Phone } from "lucide-react";
import type { ClinicLocation } from "@/lib/clinics/queries";
import { toStateCode } from "@/lib/location/states";

function addressQuery(loc: ClinicLocation, clinicName: string): string {
  const addr = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
  return addr || (loc.label ? `${loc.label}, ${clinicName}` : clinicName);
}

// Optional Google Maps Embed API key (server-side env). When set, EVERY clinic
// with a place_id (816 of them) renders the exact place with its real
// business-name label — full parity with a clinic's own website map. The key
// ends up in the iframe src (every map embed does), so in Google Cloud restrict
// it to the Maps Embed API + your domain(s); the Embed API itself is free.
const EMBED_KEY = process.env.GOOGLE_MAPS_EMBED_KEY;

/**
 * Embedded map URL. Ordered by reliability so it works for EVERY clinic:
 *   1. Embed API by place_id — exact pin + business-name label (needs a key).
 *   2. Keyless by lat/lng — exact-coordinate pin, works for everyone with
 *      coordinates (our coords match Google's own place coords). The marker
 *      label is generic (Google can't name a raw point), but the pin is exact.
 *   3. Keyless by name+address — only when there are no coordinates. Geocoded,
 *      so both pin and label are best-effort.
 *
 * Note: the keyless `output=embed` endpoint does NOT support `q=place_id:…`
 * (it renders a blank world map) — the Embed API in (1) is the only way to pin
 * a place_id.
 */
function mapsEmbedUrl(loc: ClinicLocation, clinicName: string): string {
  if (EMBED_KEY && loc.google_place_id)
    return `https://www.google.com/maps/embed/v1/place?key=${EMBED_KEY}&q=place_id:${encodeURIComponent(loc.google_place_id)}`;

  if (loc.lat != null && loc.lng != null)
    return `https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=16&output=embed`;

  // No coordinates — geocode name + address. `loc.address` may already contain
  // city/state/zip, so only append parts not already present (avoids
  // "…Miami, FL 33134, Miami, FL, 33134"). Leading with the name + `iwloc=near`
  // gives the marker the business name when the geocode matches.
  const street = loc.address ?? "";
  const has = (v: string | null) => !!v && street.toLowerCase().includes(v.toLowerCase());
  const addr = [loc.address, has(loc.city) ? null : loc.city, has(loc.state) ? null : loc.state, has(loc.zip) ? null : loc.zip]
    .filter(Boolean).join(", ");
  const name = clinicName.trim();
  const q = addr ? (name ? `${name}. ${addr}` : addr) : (name || loc.label || "");
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=m&z=15&output=embed&iwloc=near`;
}

function mapsOpenUrl(loc: ClinicLocation, query: string): string {
  if (loc.google_maps_url) return loc.google_maps_url;
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
 * Rendered whenever the clinic has at least one location (even a single one, so
 * every clinic page gets the map embed + "Open in Google Maps"). Anchored
 * ("locations") so the hero's "+N more locations" link can jump straight here.
 */
export function ClinicLocationsSection({
  locations,
  clinicName,
}: {
  locations: ClinicLocation[];
  clinicName: string;
}) {
  if (!locations || locations.length === 0) return null;

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
          {locations.length} location{locations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-[20px] sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc, idx) => {
          const title = locationTitle(loc, idx);
          const addrLines = addressLines(loc);
          const query = addressQuery(loc, clinicName);
          const embedUrl = mapsEmbedUrl(loc, clinicName);
          const mapsUrl = mapsOpenUrl(loc, query);

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

              {/* Google Maps embed — shown only once GOOGLE_MAPS_EMBED_KEY is
                  set, so it renders exact place_id maps. Hidden until then (the
                  address + "Open in Google Maps" link below still work). */}
              {EMBED_KEY && (
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
              )}

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
