/**
 * test-location-extraction.ts — what the chat thinks the user's location is.
 *
 *   bun scripts/test-location-extraction.ts
 *
 * Two failure modes here are silent and produce confidently wrong answers
 * rather than errors, which is why they get a test:
 *
 *  1. A back-reference ("in that city") captured as a NEW place name. It
 *     geocodes to nothing, the scope degrades to `city ILIKE '%that city%'`,
 *     zero clinics match, and the nearest-fallback then drops the location
 *     entirely — so "chemical peels in that city" answered with Atlanta.
 *  2. A city+state phrase that fails to parse and leaves a bare STATE behind.
 *     "i am in salt lake city utah" searched all of Utah; every result was a
 *     Utah city, so nothing looked wrong.
 */
import { extractLocation, updateSlots, type Slots } from "@/lib/chat/intent";
import { resolveTypedLocation } from "@/lib/search/location-scope";

let fails = 0;
function check(msg: string, wantLocation: string | null, wantGeocodable?: boolean) {
  const got = extractLocation(msg).location;
  const norm = (v: string | null) => (v === null ? null : v.toLowerCase());
  if (norm(got) !== norm(wantLocation)) {
    fails++;
    console.log(`FAIL ${JSON.stringify(msg)}\n  got ${JSON.stringify(got)} want ${JSON.stringify(wantLocation)}`);
    return;
  }
  if (wantGeocodable !== undefined && got !== null) {
    const geo = resolveTypedLocation(got) !== null;
    if (geo !== wantGeocodable) {
      fails++;
      console.log(`FAIL ${JSON.stringify(msg)} — ${JSON.stringify(got)} geocodable=${geo}, want ${wantGeocodable}`);
      return;
    }
  }
  console.log(`ok   ${JSON.stringify(msg)} -> ${JSON.stringify(got)}`);
}

// ── city + state, phrased freely. Each must resolve to real COORDINATES, not
//    to the bare state.
check("i am in salt lake city utah can you finx botox providers there?", "salt lake city utah", true);
check("botox in salt lake city utah", "salt lake city utah", true);
check("can you find me a medspa in kansas city missouri please", "kansas city missouri", true);
check("looking for fillers near provo utah", "provo utah", true);
check("anything in Austin, TX?", "austin, tx", true);
check("clinics in 84117", "84117", true);

// ── back-references: NO location, so the caller reuses slot memory.
check("can you find chemical peel provider in that city?", null);
check("any in that area?", null);
check("what about in this city", null);
check("find some in the same city", null);
check("what about near there", null);
check("chemical peels there", null);

// ── a bare state is still a state.
check("botox in utah", "utah");
check("medspas in texas", "texas");

// ── a treatment word after the preposition is not a place.
check("i am interested in microneedling", null);
check("tell me about botox in general", null);

// ── slot memory: an explicit widen must clear the remembered location on EVERY
//    route, not just the search one. "what about nationwide?" names no
//    treatment, so it routes to smalltalk — and the flag the caller reads is
//    only set on the search branch, so the old city survived and the next
//    search silently went back to it.
const EX = {
  treatments: [] as string[],
  concerns: [] as string[],
  location: null,
  nearMe: false,
  isComparison: false,
  wantsClinics: false,
} as unknown as Parameters<typeof updateSlots>[1];
const PAGE = { type: "home" } as Parameters<typeof updateSlots>[2];
const prior: Slots = {
  treatmentsDiscussed: [],
  lastLocation: "Provo, UT",
  lastLocationLabel: "Provo, UT",
} as Slots;

function checkSlots(msg: string, wantCleared: boolean) {
  // clearLocation intentionally left false — that is the caller's bug we are
  // guarding against.
  const next = updateSlots(prior, EX, PAGE, msg, "", false);
  const cleared = next.lastLocation === undefined && next.lastLocationLabel === undefined;
  if (cleared !== wantCleared) {
    fails++;
    console.log(`FAIL slots ${JSON.stringify(msg)} cleared=${cleared}, want ${wantCleared}`);
  } else console.log(`ok   slots ${JSON.stringify(msg)} cleared=${cleared}`);
}

checkSlots("what about nationwide?", true);
checkSlots("show me anywhere", true);
checkSlots("any state is fine", true);
checkSlots("are they all safe?", false);
checkSlots("what about fillers?", false);

console.log(fails === 0 ? "\nALL LOCATION TESTS PASSED" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
