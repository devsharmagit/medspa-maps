"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Trash2, Search, X, GripVertical } from "lucide-react";
import { adminGet, adminPost, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConcernDetail {
  id: string;
  name: string;
  slug: string;
  overview: string | null;
  details: Record<string, unknown> | null;
  faqs: unknown[] | null;
  aliases: string[] | null;
  is_published: boolean;
  is_active: boolean;
  service_ids: string[];
}

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  is_active: boolean;
}

interface Faq {
  q: string;
  a: string;
}

const DETAIL_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "signs", label: "Signs & Symptoms", placeholder: "What patients notice…" },
  { key: "causes", label: "Causes", placeholder: "Underlying causes…" },
  { key: "candidate", label: "Ideal Candidate", placeholder: "Who is a good candidate…" },
  { key: "results", label: "Results", placeholder: "What results to expect…" },
  { key: "treatment_areas", label: "Treatment Areas", placeholder: "Areas treated…" },
  { key: "injectables", label: "Injectables", placeholder: "Relevant injectables…" },
  { key: "benefits", label: "Benefits", placeholder: "Key benefits…" },
  { key: "prevention", label: "Prevention", placeholder: "Prevention guidance…" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detailToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n");
  return String(value);
}

function parseFaqs(raw: unknown[] | null): Faq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return {
          q: typeof obj.q === "string" ? obj.q : "",
          a: typeof obj.a === "string" ? obj.a : "",
        };
      }
      return { q: "", a: "" };
    })
    .filter((f) => f.q || f.a);
}

const TEXTAREA_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const LIST_PATH = "/admin/concerns";

// ---------------------------------------------------------------------------
// Form page (create + edit) — full page, no modal
// ---------------------------------------------------------------------------

export function ConcernForm({ concernId }: { concernId?: string }) {
  const router = useRouter();
  const isNew = !concernId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceRow[]>([]);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [overview, setOverview] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  const [serviceSearch, setServiceSearch] = useState("");

  // Load canonical services for the multi-select.
  useEffect(() => {
    adminGet<ServiceRow[]>("/services")
      .then((data) => setServices(data.filter((s) => s.is_active)))
      .catch(() => {
        /* non-fatal — editor shows empty list */
      });
  }, []);

  // Load existing concern for edit.
  useEffect(() => {
    if (!concernId) return;
    let cancelled = false;
    adminGet<ConcernDetail>(`/concerns/${concernId}`)
      .then((c) => {
        if (cancelled) return;
        setName(c.name);
        setSlug(c.slug);
        setSlugTouched(true);
        setOverview(c.overview ?? "");
        const d: Record<string, string> = {};
        for (const f of DETAIL_FIELDS) {
          d[f.key] = detailToString(c.details?.[f.key]);
        }
        setDetails(d);
        setFaqs(parseFaqs(c.faqs));
        setAliases(c.aliases ?? []);
        setServiceIds(c.service_ids ?? []);
        setIsPublished(c.is_published);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load concern");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [concernId]);

  // Auto-derive slug from name until the user edits the slug manually.
  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addAlias(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (aliases.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setAliasDraft("");
      return;
    }
    setAliases((prev) => [...prev, value]);
    setAliasDraft("");
  }

  function removeAlias(idx: number) {
    setAliases((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function updateFaq(idx: number, field: keyof Faq, value: string) {
    setFaqs((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  }

  function removeFaq(idx: number) {
    setFaqs((prev) => prev.filter((_, i) => i !== idx));
  }

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category?.toLowerCase().includes(q) ?? false)
    );
  }, [services, serviceSearch]);

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds]
  );

  async function handleSave() {
    if (!name.trim()) {
      setError("Concern name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const detailsPayload: Record<string, string> = {};
    for (const f of DETAIL_FIELDS) {
      const v = (details[f.key] ?? "").trim();
      if (v) detailsPayload[f.key] = v;
    }

    const faqsPayload = faqs
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q || f.a);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      overview: overview.trim() || null,
      details: detailsPayload,
      faqs: faqsPayload,
      aliases,
      is_published: isPublished,
      service_ids: serviceIds,
    };

    try {
      if (isNew) {
        await adminPost("/concerns", payload);
      } else {
        await adminPatch(`/concerns/${concernId}`, payload);
      }
      router.push(LIST_PATH);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save concern");
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={LIST_PATH}
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Back to concerns
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? "New concern" : "Edit concern"}
          </h2>
          <p className="text-sm text-slate-500">
            Editorial content and linked services for the concern page.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading concern…
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Basics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="concern-name">Name</Label>
                  <Input
                    id="concern-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Fine Lines & Wrinkles"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="concern-slug">Slug</Label>
                  <Input
                    id="concern-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="auto-generated"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <Label htmlFor="concern-overview">Overview</Label>
                <textarea
                  id="concern-overview"
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={3}
                  placeholder="A short introduction to this concern…"
                  className={TEXTAREA_CLASS}
                />
              </div>

              {/* Publish toggle */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">Published</span>
                  <span className="text-xs text-slate-500">
                    Visible on the public site when enabled.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublished}
                  onClick={() => setIsPublished((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    isPublished
                      ? "bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]"
                      : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      isPublished ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              <Separator className="my-6" />

              {/* Detail cards */}
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Detail Cards</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DETAIL_FIELDS.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`detail-${f.key}`} className="text-xs text-slate-600">
                      {f.label}
                    </Label>
                    <textarea
                      id={`detail-${f.key}`}
                      value={details[f.key] ?? ""}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      rows={3}
                      placeholder={f.placeholder}
                      className={TEXTAREA_CLASS}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              {/* FAQs */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">FAQs</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 border-slate-200 px-2.5 text-xs"
                  onClick={() => setFaqs((prev) => [...prev, { q: "", a: "" }])}
                >
                  <Plus size={12} /> Add FAQ
                </Button>
              </div>
              {faqs.length === 0 ? (
                <p className="text-xs text-slate-400">No FAQs yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3"
                    >
                      <GripVertical size={14} className="mt-1.5 shrink-0 text-slate-300" />
                      <div className="flex flex-1 flex-col gap-2">
                        <Input
                          value={faq.q}
                          onChange={(e) => updateFaq(idx, "q", e.target.value)}
                          placeholder="Question"
                          className="bg-white"
                        />
                        <textarea
                          value={faq.a}
                          onChange={(e) => updateFaq(idx, "a", e.target.value)}
                          rows={2}
                          placeholder="Answer"
                          className={cn(TEXTAREA_CLASS, "bg-white")}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-slate-400 hover:text-red-600"
                        onClick={() => removeFaq(idx)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-6" />

              {/* Aliases tag input */}
              <div className="flex flex-col gap-1.5">
                <Label>Aliases</Label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5">
                  {aliases.map((alias, idx) => (
                    <span
                      key={`${alias}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-brand-purple"
                    >
                      {alias}
                      <button
                        type="button"
                        onClick={() => removeAlias(idx)}
                        className="text-brand-purple/60 hover:text-brand-purple"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={aliasDraft}
                    onChange={(e) => setAliasDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addAlias(aliasDraft);
                      } else if (e.key === "Backspace" && !aliasDraft && aliases.length) {
                        removeAlias(aliases.length - 1);
                      }
                    }}
                    onBlur={() => addAlias(aliasDraft)}
                    placeholder={aliases.length ? "" : "Add an alias and press Enter…"}
                    className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Separator className="my-6" />

              {/* Linked services */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>Linked Services</Label>
                  <span className="text-xs text-slate-400">
                    {serviceIds.length} selected
                  </span>
                </div>

                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedServices.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-coral/10 px-2 py-0.5 text-xs font-medium text-brand-coral"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className="text-brand-coral/60 hover:text-brand-coral"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search services to link…"
                    className="h-9 pl-9"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                  {filteredServices.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-slate-400">
                      No services found.
                    </p>
                  ) : (
                    filteredServices.map((s) => {
                      const checked = serviceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(s.id)}
                            className="size-4 accent-brand-purple"
                          />
                          <span className="flex-1 text-slate-700">{s.name}</span>
                          {s.category && (
                            <span className="text-xs text-slate-400">{s.category}</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex justify-end gap-2">
                <Button asChild variant="outline" disabled={saving}>
                  <Link href={LIST_PATH}>Cancel</Link>
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {isNew ? "Create concern" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
