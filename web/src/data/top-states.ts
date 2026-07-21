/**
 * Static top-12-states-by-clinic-count list for the homepage "Top States"
 * section. Snapshot from the `clinics` table (2026-07-21) — intentionally NOT
 * queried live; refresh the counts here by hand if they drift meaningfully.
 * Each state is represented by its best-known city for the background photo.
 * Images are downloaded into public/images/states/ (self-hosted, not
 * hotlinked from Unsplash) — originally sourced under the Unsplash License.
 */

export interface TopState {
  state: string; // full name, for alt text / a11y
  abbr: string; // 2-letter code, used as the /search?location= value
  city: string; // representative city shown as the card's implicit backdrop
  clinicCount: number;
  image: string;
}

export const TOP_STATES: TopState[] = [
  { state: "Texas", abbr: "TX", city: "Austin", clinicCount: 68, image: "/images/states/tx.jpg" },
  { state: "California", abbr: "CA", city: "Los Angeles", clinicCount: 64, image: "/images/states/ca.jpg" },
  { state: "Florida", abbr: "FL", city: "Miami", clinicCount: 57, image: "/images/states/fl.jpg" },
  { state: "New York", abbr: "NY", city: "New York City", clinicCount: 37, image: "/images/states/ny.jpg" },
  { state: "Utah", abbr: "UT", city: "Salt Lake City", clinicCount: 33, image: "/images/states/ut.jpg" },
  { state: "Arizona", abbr: "AZ", city: "Phoenix", clinicCount: 24, image: "/images/states/az.jpg" },
  { state: "Georgia", abbr: "GA", city: "Atlanta", clinicCount: 23, image: "/images/states/ga.jpg" },
  { state: "Pennsylvania", abbr: "PA", city: "Philadelphia", clinicCount: 23, image: "/images/states/pa.jpg" },
  { state: "Tennessee", abbr: "TN", city: "Nashville", clinicCount: 22, image: "/images/states/tn.jpg" },
  { state: "Washington", abbr: "WA", city: "Seattle", clinicCount: 22, image: "/images/states/wa.jpg" },
  { state: "North Carolina", abbr: "NC", city: "Charlotte", clinicCount: 20, image: "/images/states/nc.jpg" },
  { state: "Illinois", abbr: "IL", city: "Chicago", clinicCount: 19, image: "/images/states/il.jpg" },
];
