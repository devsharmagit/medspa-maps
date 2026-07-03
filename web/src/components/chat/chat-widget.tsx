"use client";

/**
 * ChatWidget — floating AI assistant for the public site.
 *
 * Mounted once in the root layout. It hides itself on /admin routes, talks only
 * to our own /api/chat endpoint (the OpenRouter key never reaches the browser),
 * and streams replies as NDJSON events. Conversation is kept in component state
 * + sessionStorage (stateless v1 — nothing persisted server-side).
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X, ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";
interface ChatMsg {
  role: ChatRole;
  content: string;
}

// Session memory that round-trips through the client (server is stateless).
type PageType =
  | "home"
  | "search"
  | "treatment"
  | "concern"
  | "clinic"
  | "provider"
  | "other";
interface PageContext {
  type: PageType;
  slug?: string;
}
interface Slots {
  clinicInFocus?: string;
  lastLocation?: string;
  treatmentsDiscussed: string[];
}

const STORAGE_KEY = "medspa-chat-session";
const MAX_HISTORY = 20;
const SUGGESTIONS = [
  "Find Botox clinics near me",
  "What helps with acne scars?",
  "What treatments do you cover?",
];

const EMPTY_SLOTS: Slots = { treatmentsDiscussed: [] };

/** Map the current pathname to the page context the assistant is opened from. */
function derivePage(pathname: string | null): PageContext {
  if (!pathname || pathname === "/") return { type: "home" };
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "search") return { type: "search" };
  if (seg[0] === "treatments" && seg[1]) return { type: "treatment", slug: seg[1] };
  if (seg[0] === "conditions" && seg[1]) return { type: "concern", slug: seg[1] };
  if (seg[0] === "clinics" && seg[1]) return { type: "clinic", slug: seg[1] };
  if (seg[0] === "providers" && seg[2]) return { type: "provider", slug: seg[2] };
  return { type: "other" };
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);

  // Session memory (server is stateless — this travels with every request).
  const summaryRef = useRef<string>("");
  const slotsRef = useRef<Slots>(EMPTY_SLOTS);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore session (client-only to avoid hydration mismatch).
  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const b = JSON.parse(saved);
        if (Array.isArray(b?.messages)) setMessages(b.messages);
        if (typeof b?.summary === "string") summaryRef.current = b.summary;
        if (b?.slots && Array.isArray(b.slots.treatmentsDiscussed))
          slotsRef.current = b.slots;
        if (Array.isArray(b?.followups)) setFollowups(b.followups);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persist(nextMessages: ChatMsg[], nextFollowups: string[]) {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages: nextMessages,
          summary: summaryRef.current,
          slots: slotsRef.current,
          followups: nextFollowups,
        })
      );
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!mounted) return;
    persist(messages, followups);
  }, [messages, followups, mounted]);

  // Autoscroll to newest content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status, open]);

  // Focus input when opened.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Never render on admin pages or before mount.
  if (!mounted || pathname?.startsWith("/admin")) return null;

  function appendToLastAssistant(chunk: string) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = { ...next[i], content: next[i].content + chunk };
          break;
        }
      }
      return next;
    });
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setStatus(null);
    setFollowups([]);

    const payload = history
      .filter((m) => m.content.trim())
      .slice(-MAX_HISTORY);

    let gotToken = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payload,
          page: derivePage(pathname),
          memory: { summary: summaryRef.current, slots: slotsRef.current },
        }),
      });
      if (!res.ok) {
        // Surface the server's message (e.g. rate limit) instead of a generic error.
        let msg = "I couldn't reach the assistant. Please try again.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        appendToLastAssistant(`⚠️ ${msg}`);
        return;
      }
      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let evt: {
            type: string;
            value?: unknown;
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === "token" && typeof evt.value === "string") {
            gotToken = true;
            setStatus(null);
            appendToLastAssistant(evt.value);
          } else if (evt.type === "status" && typeof evt.value === "string") {
            setStatus(evt.value);
          } else if (evt.type === "followups" && Array.isArray(evt.value)) {
            setFollowups(evt.value.filter((v): v is string => typeof v === "string"));
          } else if (evt.type === "memory" && evt.value && typeof evt.value === "object") {
            const m = evt.value as { summary?: string; slots?: Slots };
            if (typeof m.summary === "string") summaryRef.current = m.summary;
            if (m.slots && Array.isArray(m.slots.treatmentsDiscussed))
              slotsRef.current = m.slots;
          } else if (evt.type === "error" && typeof evt.value === "string") {
            setStatus(null);
            appendToLastAssistant((gotToken ? "\n\n" : "") + `⚠️ ${evt.value}`);
            gotToken = true;
          }
        }
      }
    } catch {
      appendToLastAssistant(
        "⚠️ Sorry, I couldn't reach the assistant. Please try again."
      );
    } finally {
      setStreaming(false);
      setStatus(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Medspa Map assistant"
          className="fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-4 text-white shadow-[0_8px_24px_rgba(195,65,215,0.35)] transition hover:brightness-105 active:translate-y-px"
        >
          <MessageCircle className="size-5" />
          <span className="hidden text-sm font-semibold sm:inline">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Medspa Map assistant"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-border bg-background shadow-2xl",
            // mobile: bottom sheet
            "inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl",
            // desktop: bottom-right card
            "sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[80dvh] sm:w-[390px] sm:rounded-2xl"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">Medspa Map Assistant</p>
                <p className="text-[11px] text-white/80">
                  Find clinics &amp; treatments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setFollowups([]);
                    summaryRef.current = "";
                    slotsRef.current = EMPTY_SLOTS;
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-white/90 transition hover:bg-white/15"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-md p-1 transition hover:bg-white/15"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {isEmpty ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-muted px-3 py-2.5 text-sm text-foreground">
                  <p className="font-medium">Hi! 👋 I&apos;m your medspa concierge.</p>
                  <p className="mt-1 text-muted-foreground">
                    Ask me about treatments, skin concerns, or finding vetted
                    clinics near you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {m.role === "assistant" ? (
                      m.content ? (
                        <div className="space-y-2 leading-relaxed [overflow-wrap:anywhere]">
                          <MarkdownLite text={m.content} />
                        </div>
                      ) : (
                        <TypingDots />
                      )
                    ) : (
                      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {m.content}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Status indicator (text only — the typing dots are the loader) */}
            {status && (
              <div className="px-1 text-xs text-muted-foreground">{status}</div>
            )}

            {/* Suggested follow-up questions */}
            {!streaming && !isEmpty && followups.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="px-1 text-[11px] font-medium text-muted-foreground">
                  Suggested
                </p>
                <div className="flex flex-wrap gap-2">
                  {followups.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => sendMessage(f)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground transition hover:bg-muted"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="border-t border-border bg-background p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-ring">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onTextareaKeyDown}
                placeholder="Ask about treatments or clinics…"
                className="max-h-28 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                aria-label="Send message"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] text-white transition hover:brightness-105 disabled:opacity-40"
              >
                {streaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
            <p className="mt-2 px-1 text-center text-[10px] text-muted-foreground">
              AI assistant · general info, not medical advice
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Minimal, safe markdown renderer (links + bold + bullet lists). No raw HTML.
// ──────────────────────────────────────────────────────────────────────────
function MarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} />
      ))}
    </>
  );
}

function RenderBlock({ block }: { block: string }) {
  const lines = block.split("\n");
  const isList =
    lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));

  if (isList) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  return (
    <p>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderInline(l)}
        </Fragment>
      ))}
    </p>
  );
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // [label](href) internal(/...) or http(s) | **bold** | *italic* | _italic_
  // Bold is listed before single-* so "**x**" matches bold, not italic.
  const re =
    /\[([^\]]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined) {
      out.push(<ChatLink key={key++} href={m[2]} label={m[1]} />);
    } else if (m[3] !== undefined) {
      out.push(<strong key={key++}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={key++}>{m[4]}</em>);
    } else if (m[5] !== undefined) {
      out.push(<em key={key++}>{m[5]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ChatLink({ href, label }: { href: string; label: string }) {
  const cls =
    "font-medium text-primary underline underline-offset-2 hover:opacity-80";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label}
    </a>
  );
}
