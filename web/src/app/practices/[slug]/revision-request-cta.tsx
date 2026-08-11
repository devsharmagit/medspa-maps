"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

/**
 * Bottom CTA on a practice page: "Are you this practice?" → opens a form to
 * request a revision to the listing. The clinic is auto-attached from the page
 * (clinicId/name/slug props) — the visitor only types their email + what they
 * want corrected. Posts to /api/clinic-revision-requests (stored for admin
 * review; no email is sent).
 */
export function RevisionRequestCta({
  clinicId,
  clinicName,
  lastUpdatedLabel,
}: {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  /** Pre-formatted "August 5, 2026" (empty string hides the line). */
  lastUpdatedLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setOpen(false);
    // Reset after the modal closes so a reopen is clean.
    setTimeout(() => {
      setDone(false);
      setError(null);
      setEmail("");
      setName("");
      setMessage("");
    }, 200);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/clinic-revision-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, email, name, message, companyWebsiteHp: honeypot }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !payload.success) {
        setError(payload.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-0 sm:mx-[24px] mt-2">
      <div className="flex flex-col items-start justify-between gap-4 rounded-[16px] border border-[#E5D6E5] bg-[#FAF5FA] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div className="flex flex-col gap-1">
          <p className="font-montserrat text-[16px] font-semibold text-[#373634]">
            Are you this practice?
          </p>
          <p className="font-montserrat text-[13px] leading-[150%] text-[#6b6a68]">
            Spot something out of date or incorrect? Let us know and we&apos;ll review it.
          </p>
          {lastUpdatedLabel ? (
            <p className="mt-1 font-montserrat text-[12px] text-[#9a9a9a]">
              Last updated on {lastUpdatedLabel}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-6 font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Pencil className="size-4" strokeWidth={2} />
          Request a revision
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Request a revision"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-montserrat text-[20px] font-semibold text-[#373634]">
                Request a revision
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-lg text-[#6b6a68] transition-colors hover:bg-[#f3eef3]"
              >
                <X className="size-5" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="font-montserrat text-[16px] font-medium text-[#99597A]">
                  Thanks — we&apos;ll review this shortly.
                </p>
                <p className="font-montserrat text-[13px] leading-[150%] text-[#98889A]">
                  Your request for <span className="font-semibold">{clinicName}</span> has been sent to
                  our team for review.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 font-montserrat text-[14px] font-semibold text-[#CF5D9A] underline"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <p className="font-montserrat text-[13px] leading-[150%] text-[#6b6a68]">
                  Requesting a correction for{" "}
                  <span className="font-semibold text-[#373634]">{clinicName}</span>.
                </p>

                <input
                  type="email"
                  placeholder="Your email"
                  autoComplete="email"
                  required
                  disabled={submitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#373634] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  disabled={submitting}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#373634] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none disabled:opacity-60"
                />
                <textarea
                  placeholder="What would you like us to correct? (e.g. wrong phone number, hours, treatments…)"
                  required
                  rows={4}
                  disabled={submitting}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full resize-y rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm leading-[150%] text-[#373634] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none disabled:opacity-60"
                />

                {/* Honeypot — hidden from users, catches naive bots. */}
                <input
                  type="text"
                  name="company_website_hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="sr-only"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />

                {error && (
                  <p role="alert" className="font-montserrat text-[13px] text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 inline-flex h-[46px] items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-6 font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                >
                  {submitting ? "Sending…" : "Send request"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
