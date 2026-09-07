/**
 * answer-stream.ts — release a streaming model answer one guarded unit at a
 * time.
 *
 * WHY THIS EXISTS
 *
 * The chat route used to await one complete, non-streaming completion and then
 * replay the finished text word-by-word over ~800 ms. The replay looked like
 * streaming but wasn't: the whole wait (context fetch, then the model) happened
 * before the first character, and then the answer landed all at once.
 *
 * Streaming for real collides with the answer guards, because every one of them
 * was written to operate on the FINISHED text, and one of them threw the whole
 * answer away and replaced it (an answer linking a practice we never retrieved
 * hands the user a 404, which is worse than no answer). You cannot retract text
 * that is already on screen.
 *
 * So nothing is released until it is a COMPLETE, GUARDED unit — a finished
 * sentence, or a finished line. Every guard still runs before the user sees a
 * character; the only behaviour change is the remedy. A unit that fails is
 * DROPPED, where previously the entire answer was discarded. That keeps the
 * good 90% of an answer whose last sentence overreached, and if nothing at all
 * survives the caller still has `released === ""` and can fall back to the
 * templated answer, since by then nothing has been shown.
 *
 * It also has to solve two problems the old code got for free:
 *
 *  - FOLLOWUPS and MEMORY_UPDATE arrive in the SAME completion as the answer.
 *    Naive streaming would type the literal marker lines and the chip text into
 *    the user's message. So this tracks the marker contract as it streams and
 *    stops releasing at FOLLOWUPS, handing the raw text back for parseReply.
 *  - A cut must never land inside a Markdown link. `[Dr. Smith](/practices/x)`
 *    contains ". " — splitting there would hide the practice link from the
 *    grounding check and emit a broken link. Link spans are therefore skipped,
 *    and an unclosed link holds the release.
 *
 * SERVER-SIDE ONLY.
 */
import {
  containsPricing,
  isListOrHeadingLine,
  normalizeSiteLinks,
} from "@/lib/chat/format";

/** The three literal marker lines the model is asked to emit. */
const MARKERS = ["ANSWER", "FOLLOWUPS", "MEMORY_UPDATE"] as const;

/**
 * How much of an unfinished line to accumulate before deciding what it is.
 *
 * Long enough to recognise the longest marker ("MEMORY_UPDATE", 13) and any
 * list/heading prefix ("- ", "1. ", "### "). Below this a line start is
 * genuinely ambiguous: a buffer holding just "-" could become "- item" (a
 * bullet to suppress) or "-5 degrees" (prose to release).
 */
const LINE_LOOKAHEAD = 16;

export interface AnswerStreamOptions {
  /** Emit one NDJSON event to the client. */
  send: (obj: Record<string, unknown>) => void;
  /**
   * Practice slugs in this unit that we did NOT retrieve. Non-empty ⇒ drop the
   * unit. Wraps format.ts `ungroundedPractices` with the turn's context.
   */
  ungrounded: (unit: string) => string[];
  /**
   * True on a turn that rendered clinic cards. The model has no practice data
   * on those turns, so it has nothing legitimate to list or head, and both are
   * suppressed outright — same rule as `stripLists`.
   */
  suppressLists: boolean;
}

export interface AnswerStreamResult {
  /** The full completion, markers included — for parseReply. */
  raw: string;
  /** Exactly what the user was shown. Empty ⇒ caller should fall back. */
  released: string;
  /** Whether the model followed the marker contract (emitted ANSWER). */
  structured: boolean;
  droppedPricing: number;
  droppedUngrounded: string[];
  droppedLists: number;
}

/**
 * Index up to which `text` can be released, or -1 to wait for more.
 *
 * A release point is a sentence terminator followed by whitespace, outside any
 * Markdown link. When `flush` is set (the line is complete, or the stream
 * ended) the whole of `text` is releasable.
 */
function releasableUpTo(text: string, flush: boolean): number {
  // Spans of `[label](target)` that a cut must not fall inside.
  const links: Array<[number, number]> = [];
  for (const m of text.matchAll(/\[[^\]]*\]\([^)\s]*\)/g)) {
    links.push([m.index, m.index + m[0].length]);
  }
  const insideLink = (i: number) => links.some(([a, b]) => i > a && i < b);

  // An unfinished link at the tail: hold, or the target would be split off and
  // the grounding check would never see the practice slug.
  const tail = text.slice(links.length ? links[links.length - 1][1] : 0);
  const open = /\[[^\]]*$|\]\([^)]*$/.test(tail);
  if (open && !flush) return -1;

  let cut = -1;
  for (const m of text.matchAll(/[.!?]["')\]]*\s+/g)) {
    const end = m.index + m[0].length;
    if (!insideLink(m.index)) cut = end;
  }
  if (flush) return text.length;
  return cut;
}

export function createAnswerStream(opts: AnswerStreamOptions) {
  let raw = "";
  let buf = "";
  let released = "";
  let phase: "await-answer" | "answer" | "after-answer" = "await-answer";
  let structured = false;
  let atLineStart = true;
  let suppressingLine = false;

  let droppedPricing = 0;
  let droppedLists = 0;
  const droppedUngrounded: string[] = [];

  /** Guard one unit. Returns the text to show, or null to drop it. */
  function guard(unit: string): string | null {
    // Normalize first: a domain-prefixed link must be pulled back to a relative
    // path BEFORE the grounding check, or it reads as a fabrication.
    const text = normalizeSiteLinks(unit);
    const bad = opts.ungrounded(text);
    if (bad.length) {
      droppedUngrounded.push(...bad);
      return null;
    }
    if (containsPricing(text)) {
      droppedPricing++;
      return null;
    }
    return text;
  }

  /**
   * Emit only the newlines needed to reach `want` trailing ones.
   *
   * A line end contributes one and a blank line wants two, so emitting both
   * blindly produced "\n\n\n" between paragraphs.
   */
  function emitBreak(want: number) {
    if (!released.trim()) return; // never lead with blank lines
    const have = released.length - released.replace(/\n+$/, "").length;
    emit("\n".repeat(Math.max(0, want - have)));
  }

  function emit(text: string) {
    if (!text) return;
    released += text;
    // Word-sized events rather than one per unit: the client appends each and
    // re-renders, so a long sentence still paints progressively. No artificial
    // delay — the model's own pace is the pace.
    for (const piece of text.match(/\S+\s*/g) ?? [text]) {
      opts.send({ type: "token", value: piece });
    }
  }

  function drain(flush: boolean) {
    for (;;) {
      if (phase === "after-answer") return;

      if (suppressingLine) {
        const nl = buf.indexOf("\n");
        if (nl === -1) {
          if (flush) buf = "";
          return;
        }
        buf = buf.slice(nl + 1);
        suppressingLine = false;
        atLineStart = true;
        continue;
      }

      if (!buf) return;

      const nl = buf.indexOf("\n");
      const lineComplete = nl !== -1;
      const line = lineComplete ? buf.slice(0, nl) : buf;

      if (atLineStart) {
        // Hold an unfinished line start until it can be classified.
        if (!lineComplete && !flush && buf.length < LINE_LOOKAHEAD) return;

        const trimmed = line.trim();

        // A marker is always alone on its own line.
        if ((lineComplete || flush) && MARKERS.includes(trimmed.toUpperCase() as never)) {
          if (trimmed.toUpperCase() === "ANSWER") {
            phase = "answer";
            structured = true;
          } else {
            // FOLLOWUPS / MEMORY_UPDATE — the answer is over. Everything from
            // here stays in `raw` for parseReply and is never shown.
            phase = "after-answer";
          }
          buf = lineComplete ? buf.slice(nl + 1) : "";
          atLineStart = true;
          continue;
        }

        // First complete line and it wasn't ANSWER: the model ignored the
        // contract. Treat the whole completion as prose — this is the same
        // degradation the non-streaming path had ("markers missing but we got
        // prose — keep it").
        if (phase === "await-answer") {
          if (!lineComplete && !flush) return;
          phase = "answer";
        }

        if (!trimmed) {
          if (!lineComplete) {
            if (flush) buf = "";
            return;
          }
          // Preserve the paragraph break.
          emitBreak(2);
          buf = buf.slice(nl + 1);
          continue;
        }

        if (opts.suppressLists && isListOrHeadingLine(line)) {
          droppedLists++;
          suppressingLine = true;
          continue;
        }
      }

      const cut = releasableUpTo(line, lineComplete || flush);
      if (cut <= 0) {
        if (!(lineComplete || flush)) return;
        // Nothing releasable even at flush (e.g. a lone unfinished link).
        if (cut < 0) {
          buf = lineComplete ? buf.slice(nl + 1) : "";
          atLineStart = true;
          continue;
        }
        return;
      }

      const unit = line.slice(0, cut);
      const shown = guard(unit);
      if (shown !== null) emit(shown);

      const consumedWholeLine = cut >= line.length;
      buf = buf.slice(cut);
      if (consumedWholeLine && lineComplete) {
        buf = buf.slice(1); // the newline
        atLineStart = true;
        if (shown !== null) emitBreak(1);
      } else {
        atLineStart = false;
      }
    }
  }

  return {
    /** Feed one delta from the provider. */
    push(delta: string) {
      if (!delta) return;
      raw += delta;
      if (phase === "after-answer") return; // still accumulating raw, nothing to show
      buf += delta;
      drain(false);
    },

    /** True once any text has reached the user — the point of no retraction. */
    get hasReleased() {
      return released.length > 0;
    },

    /** Flush whatever is left and report what happened. */
    end(): AnswerStreamResult {
      drain(true);
      return {
        raw,
        released: released.trim(),
        structured,
        droppedPricing,
        droppedLists,
        droppedUngrounded: [...new Set(droppedUngrounded)],
      };
    },
  };
}
