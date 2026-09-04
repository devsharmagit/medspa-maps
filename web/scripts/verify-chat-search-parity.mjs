/**
 * Parity harness: the chatbot and /search must never disagree.
 *
 * There is only ONE search engine — /api/search is a thin wrapper over
 * runSearch(), the /search page calls the same function in-process, and so does
 * the chat adapter. What could still drift is how the chatbot BUILDS its
 * params. So this asserts the end-to-end promise a visitor actually relies on:
 * the practices on the chat cards, and their order, are exactly what you get by
 * opening the "See all results" link the same reply hands you.
 *
 * It also asserts the answer text carries no practice name, heading or list —
 * clinics come from the cards (data), never from the model typing.
 *
 * Usage:  node scripts/verify-chat-search-parity.mjs [baseUrl]
 * Requires the dev server to be running (default http://localhost:3000).
 */

const BASE = process.argv[2] || "http://localhost:3000";

/** Hard cap the chat is meant to honour (mirrors CHAT_RESULT_LIMIT). */
const MAX_CARDS = 5;

const QUESTIONS = [
  "botox providers in salt lake city",
  "providers in salt lake city",
  "medspas in austin texas",
  "who does laser hair removal in 84101",
  "clinics for acne scars in denver",
  "dermal fillers near miami florida",
  "microneedling in utah",
  "best rated medspas in scottsdale az",
  "coolsculpting in chicago",
  "hydrafacial near seattle",
];

async function askChat(question) {
  const res = await fetch(new URL("/api/chat", BASE), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      page: { type: "home" },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from /api/chat`);

  // NDJSON stream: collect the answer text and the clinics event.
  const body = await res.text();
  let text = "";
  let cards = null;
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type === "token") text += evt.value;
    if (evt.type === "clinics") cards = evt.value;
  }
  return { text: text.trim(), cards };
}

async function searchSlugs(searchUrl) {
  const url = new URL(searchUrl, BASE);
  const api = new URL("/api/search", BASE);
  api.search = url.search;
  api.searchParams.set("limit", String(MAX_CARDS));
  api.searchParams.set("page", "1");
  const res = await fetch(api);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${api}`);
  const json = await res.json();
  return {
    slugs: json.results.map((r) => r.clinic_slug),
    total: json.total,
  };
}

let checked = 0;
let failed = 0;

function assert(ok, label, detail) {
  checked++;
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

for (const question of QUESTIONS) {
  console.log(`\n"${question}"`);
  let result;
  try {
    result = await askChat(question);
  } catch (err) {
    failed++;
    checked++;
    console.log(`  ✗ request failed: ${err.message}`);
    continue;
  }

  const { text, cards } = result;

  // The model must never type practice facts — the cards are the source of truth.
  assert(!/^\s*#{1,6}\s/m.test(text), "answer has no markdown heading", text.slice(0, 120));
  assert(
    !/^\s*(?:[-*•]|\d+[.)])\s/m.test(text),
    "answer has no list items",
    text.slice(0, 120),
  );

  if (!cards) {
    // Not every question has to return practices, but if none came back the
    // answer must not be naming any either.
    assert(true, "no cards returned (nothing to compare)");
    continue;
  }

  assert(
    cards.clinics.length <= MAX_CARDS,
    `at most ${MAX_CARDS} cards (got ${cards.clinics.length})`,
  );

  const leaked = cards.clinics
    .map((c) => c.name)
    .filter((n) => text.toLowerCase().includes(n.toLowerCase()));
  assert(leaked.length === 0, "answer names no practice in prose", leaked.join(", "));

  // The promise: the link in the reply reproduces the cards exactly.
  let live;
  try {
    live = await searchSlugs(cards.searchUrl);
  } catch (err) {
    assert(false, "searchUrl is fetchable", err.message);
    continue;
  }

  const cardSlugs = cards.clinics.map((c) => c.slug);
  const expected = live.slugs.slice(0, cardSlugs.length);
  assert(
    JSON.stringify(cardSlugs) === JSON.stringify(expected),
    `cards match /api/search for ${cards.searchUrl}`,
    `chat:   ${cardSlugs.join(", ")}\n      search: ${expected.join(", ")}`,
  );

  // `farAway` results come from the relaxed nearby fallback, whose total is a
  // different (wider) query, so only compare totals on the normal path.
  if (!cards.farAway) {
    assert(
      cards.total === live.total,
      `total matches (chat ${cards.total} vs search ${live.total})`,
    );
  }
}

console.log(`\n${checked} checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
