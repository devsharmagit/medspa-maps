/**
 * test-answer-stream.ts — unit tests for the chat answer stream's guard gating.
 *
 * No DB, no network, no API key: pure state-machine tests.
 *
 *   bun scripts/test-answer-stream.ts
 *
 * The machine decides, mid-stream, what the user is allowed to see. The cases
 * that matter are the ones that are invisible by inspection: identical output
 * at every chunk boundary (a delta can split a marker line or a Markdown link
 * in half), and never cutting inside `[Dr. Smith](/practices/x)` — that ". "
 * looks exactly like a sentence end, and splitting there would hide the
 * practice link from the grounding check.
 */
import { createAnswerStream } from "@/lib/chat/answer-stream";

function run(raw: string, chunk: number, opts: { suppressLists?: boolean; allowed?: string[] } = {}) {
  const out: string[] = [];
  const s = createAnswerStream({
    send: (o) => { if (o.type === "token") out.push(String(o.value)); },
    ungrounded: (u) => {
      const bad: string[] = [];
      for (const m of u.matchAll(/\]\(\/practices\/([a-z0-9-]+)\)/gi)) {
        if (!(opts.allowed ?? []).includes(m[1])) bad.push(m[1]);
      }
      return bad;
    },
    suppressLists: opts.suppressLists ?? false,
  });
  for (let i = 0; i < raw.length; i += chunk) s.push(raw.slice(i, i + chunk));
  const r = s.end();
  return { shown: out.join(""), ...r };
}

let fails = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
}

const WELL_FORMED = `ANSWER
A few good options came up near you. Details are on the cards below.
FOLLOWUPS
- Which has the best reviews?
- Do any offer fillers?
MEMORY_UPDATE
User looked for botox in SLC.`;

// 1 + 2: identical result at every chunk size, and no marker/chip leakage
for (const n of [1, 3, 7, 40, 5000]) {
  const r = run(WELL_FORMED, n);
  check(`chunk=${n} answer only`, r.shown.trim(),
    "A few good options came up near you. Details are on the cards below.");
  check(`chunk=${n} structured`, r.structured, true);
  check(`chunk=${n} no leak`, /FOLLOWUPS|MEMORY_UPDATE|best reviews/.test(r.shown), false);
}

// 3: model ignored the contract
const r3 = run("Sure thing. Here is what I found.", 4);
check("unmarked prose released", r3.shown.trim(), "Sure thing. Here is what I found.");
check("unmarked not structured", r3.structured, false);

// 4: a pricing sentence is dropped, its neighbours survive
const r4 = run("ANSWER\nBotox is popular. It costs about $12 per unit. A provider can advise.\n", 6);
check("pricing dropped", r4.shown.includes("$12"), false);
check("pricing neighbours kept", r4.shown.trim(), "Botox is popular. A provider can advise.");
check("pricing counted", r4.droppedPricing, 1);

// 5: ungrounded practice link dropped, grounded one kept
const r5 = run(
  "ANSWER\nTry [Real Spa](/practices/real-spa) today. Also [Fake Spa](/practices/fake-spa) nearby.\n",
  9, { allowed: ["real-spa"] });
check("grounded kept", r5.shown.includes("/practices/real-spa"), true);
check("ungrounded dropped", r5.shown.includes("fake-spa"), false);
check("ungrounded reported", r5.droppedUngrounded, ["fake-spa"]);

// 6: lists/headings suppressed on a cards turn
const r6 = run("ANSWER\n## Top matches\n- One Spa\n- Two Spa\nSee the cards below.\n", 5, { suppressLists: true });
check("lists suppressed", r6.shown.trim(), "See the cards below.");
check("lists counted", r6.droppedLists, 3);

// 6b: kept when no cards were sent
const r6b = run("ANSWER\n- One\n- Two\n", 5, { suppressLists: false });
check("lists kept without cards", r6b.shown.includes("- One"), true);

// 7: a cut must not land inside a markdown link containing ". "
const r7 = run("ANSWER\nAsk for [Dr. Smith](/practices/real-spa) there. Done.\n", 2, { allowed: ["real-spa"] });
check("link not split", r7.shown.includes("[Dr. Smith](/practices/real-spa)"), true);
check("link survived guard", r7.droppedUngrounded, []);

// 8: truncated mid-answer (max_tokens cut) still releases what arrived
const r8 = run("ANSWER\nThis is a complete sentence. And this one is cut off mid", 4);
check("truncated releases all", r8.shown.trim(), "This is a complete sentence. And this one is cut off mid");

// 9: everything dropped -> released empty so the caller can fall back
const r9 = run("ANSWER\nIt costs $50.\n", 4);
check("all dropped => empty", r9.released, "");

// 10: paragraph breaks are exactly two newlines, not three. A line end
// contributes one and a blank line wants two; emitting both blindly produced
// "\n\n\n", which is invisible in most renderers and so easy to ship.
for (const n of [1, 6, 999]) {
  const r = run("ANSWER\nOne. Two.\n\nSecond para.\nFOLLOWUPS\n- a\n", n);
  check(`chunk=${n} paragraph break`, r.released, "One. Two.\n\nSecond para.");
}

console.log(fails === 0 ? "\nALL STREAM TESTS PASSED" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
