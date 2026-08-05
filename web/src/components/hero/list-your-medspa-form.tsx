"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";

// ─── ListYourMedspaForm ───────────────────────────────────────────────────────
// Native replacement for the old Growth99 iframe widget. Collects contact info
// only (name / business email / business name) and shows a "coming soon"
// message — nothing is routed to a sales team yet. Submissions land in
// clinic_leads for review at /admin/clinic-leads.

const INPUT_CLASS =
  "w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none disabled:opacity-60";

const EMPTY_FORM = {
  fullName: "",
  businessEmail: "",
  businessName: "",
};

export function ListYourMedspaForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function field(key: keyof typeof EMPTY_FORM) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/clinic-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyWebsiteHp: honeypot }),
      });
      const payload = (await res.json()) as { success: boolean; error?: string };

      if (!res.ok || !payload.success) {
        setError(payload.error || "Something went wrong. Please try again.");
        return;
      }

      setForm(EMPTY_FORM);
      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex w-full max-w-[432px] flex-col items-center gap-3 rounded-lg border border-[#DEC6DF] bg-white/70 px-6 py-10 text-center">
        <Clock className="h-10 w-10 text-[#CF5D9A]" strokeWidth={1.5} />
        <p className="font-montserrat text-[20px] font-medium text-[#99597A]">
          Coming soon!
        </p>
        <p className="font-montserrat text-[14px] leading-[140%] text-[#98889A]">
          Med spa listings aren&apos;t open just yet. We&apos;ve saved your
          details and will let you know the moment they are.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-2 font-montserrat text-[14px] font-medium text-[#CF5D9A] underline"
        >
          Submit another med spa
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-[432px] flex-col gap-3">
      <input
        type="text"
        name="fullName"
        placeholder="Full name"
        autoComplete="name"
        required
        disabled={submitting}
        className={INPUT_CLASS}
        {...field("fullName")}
      />
      <input
        type="email"
        name="businessEmail"
        placeholder="Business email"
        autoComplete="email"
        required
        disabled={submitting}
        className={INPUT_CLASS}
        {...field("businessEmail")}
      />
      <input
        type="text"
        name="businessName"
        placeholder="Business name"
        autoComplete="organization"
        required
        disabled={submitting}
        className={INPUT_CLASS}
        {...field("businessName")}
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
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] py-3 font-montserrat text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Submitting…" : "List my med spa"}
      </button>
    </form>
  );
}
