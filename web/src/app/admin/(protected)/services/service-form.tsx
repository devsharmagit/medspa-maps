"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, X, AlertCircle, Plus, Trash2, GripVertical } from "lucide-react";
import { adminGet, adminPost, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  aliases: string[] | null;
  summary: string | null;
  description: string | null;
  treatment_time: string | null;
  results_timeline: string | null;
  results_duration: string | null;
  recovery_time: string | null;
  faqs: unknown[] | null;
  review_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clinic_count: number;
}

interface FormState {
  name: string;
  slug: string;
  slugDirty: boolean;
  category: string;
  aliases: string[];
  summary: string;
  description: string;
  treatment_time: string;
  results_timeline: string;
  results_duration: string;
  recovery_time: string;
  faqs: { q: string; a: string }[];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    slugDirty: false,
    category: "",
    aliases: [],
    summary: "",
    description: "",
    treatment_time: "",
    results_timeline: "",
    results_duration: "",
    recovery_time: "",
    faqs: [],
  };
}

function formFromService(s: Service): FormState {
  return {
    name: s.name,
    slug: s.slug,
    slugDirty: true,
    category: s.category ?? "",
    aliases: s.aliases ?? [],
    summary: s.summary ?? "",
    description: s.description ?? "",
    treatment_time: s.treatment_time ?? "",
    results_timeline: s.results_timeline ?? "",
    results_duration: s.results_duration ?? "",
    recovery_time: s.recovery_time ?? "",
    faqs: parseFaqs(s.faqs),
  };
}

function parseFaqs(raw: unknown[] | null | undefined): { q: string; a: string }[] {
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
  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const LIST_PATH = "/admin/services";

// ----------------------------------------------------------------------------
// Form page (create + edit) — full page, no modal
// ----------------------------------------------------------------------------

export function ServiceForm({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(serviceId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [aliasInput, setAliasInput] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<DropdownOption[]>([]);

  // Category suggestions, derived from the existing catalog.
  useEffect(() => {
    adminGet<Service[]>("/services")
      .then((list) => {
        const set = new Set<string>();
        for (const s of list) if (s.category) set.add(s.category);
        setCategoryOptions(
          Array.from(set)
            .sort((a, b) => a.localeCompare(b))
            .map((c) => ({ label: c, value: c }))
        );
      })
      .catch(() => {
        /* non-fatal — free-text category still works */
      });
  }, []);

  // Load the target row for edit.
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    adminGet<Service>(`/services/${serviceId}`)
      .then((s) => {
        if (!cancelled) setForm(formFromService(s));
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load treatment");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slugDirty ? prev.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setForm((prev) => ({ ...prev, slug: value, slugDirty: true }));
  }

  function commitAlias() {
    const raw = aliasInput.trim();
    if (!raw) return;
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    setForm((prev) => {
      const merged = [...prev.aliases];
      for (const p of parts) if (!merged.includes(p)) merged.push(p);
      return { ...prev, aliases: merged };
    });
    setAliasInput("");
  }

  function removeAlias(alias: string) {
    update(
      "aliases",
      form.aliases.filter((a) => a !== alias)
    );
  }

  function handleAliasKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitAlias();
    } else if (e.key === "Backspace" && aliasInput === "" && form.aliases.length > 0) {
      removeAlias(form.aliases[form.aliases.length - 1]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Treatment name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const pendingAliases = [...form.aliases];
    const pending = aliasInput.trim();
    if (pending) {
      for (const p of pending.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!pendingAliases.includes(p)) pendingAliases.push(p);
      }
    }

    const faqsPayload = form.faqs
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q || f.a);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      category: form.category.trim() || null,
      aliases: pendingAliases,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      treatment_time: form.treatment_time.trim() || null,
      results_timeline: form.results_timeline.trim() || null,
      results_duration: form.results_duration.trim() || null,
      recovery_time: form.recovery_time.trim() || null,
      faqs: faqsPayload,
    };

    try {
      if (isEdit && serviceId) {
        await adminPatch<Service>(`/services/${serviceId}`, payload);
      } else {
        await adminPost<Service>("/services", payload);
      }
      router.push(LIST_PATH);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save treatment");
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={LIST_PATH}
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Back to treatments
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Edit treatment" : "New treatment"}
          </h2>
          <p className="text-sm text-slate-500">
            {isEdit
              ? "Update the catalog entry. Changes apply immediately."
              : "Add a treatment to the shared catalog."}
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading treatment…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Botox"
                  autoFocus
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-slug">Slug</Label>
                <Input
                  id="svc-slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="font-mono text-xs"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <div className="flex h-8 items-center rounded-lg border border-input bg-transparent px-2.5 py-1.5">
                  <SearchableDropdown
                    options={categoryOptions}
                    value={form.category}
                    onChange={(v) => update("category", v)}
                    placeholder="Select or type a category…"
                    allowFreeText
                    className="w-full"
                  />
                </div>
              </div>

              {/* Aliases */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-alias">Aliases</Label>
                <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  {form.aliases.map((alias) => (
                    <Badge
                      key={alias}
                      variant="secondary"
                      className="gap-1 border border-pink-100 bg-pink-50 pr-1 text-purple-700"
                    >
                      {alias}
                      <button
                        type="button"
                        onClick={() => removeAlias(alias)}
                        className="rounded-full p-0.5 hover:bg-purple-200/50"
                        aria-label={`Remove ${alias}`}
                      >
                        <X size={10} />
                      </button>
                    </Badge>
                  ))}
                  <input
                    id="svc-alias"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={handleAliasKeyDown}
                    onBlur={commitAlias}
                    placeholder={form.aliases.length === 0 ? "Type and press Enter…" : ""}
                    className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  Press Enter or comma to add. Backspace removes the last chip.
                </span>
              </div>

              {/* Summary */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-summary">Summary</Label>
                <Input
                  id="svc-summary"
                  value={form.summary}
                  onChange={(e) => update("summary", e.target.value)}
                  placeholder="Short one-line summary"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-description">Description</Label>
                <textarea
                  id="svc-description"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Full description of the treatment…"
                  rows={4}
                  className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              <Separator />

              {/* FAQs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>FAQs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-slate-200 px-2.5 text-xs"
                    onClick={() =>
                      update("faqs", [...form.faqs, { q: "", a: "" }])
                    }
                  >
                    <Plus size={12} /> Add FAQ
                  </Button>
                </div>
                {form.faqs.length === 0 ? (
                  <p className="text-xs text-slate-400">No FAQs yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {form.faqs.map((faq, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3"
                      >
                        <GripVertical size={14} className="mt-1.5 shrink-0 text-slate-300" />
                        <div className="flex flex-1 flex-col gap-2">
                          <Input
                            value={faq.q}
                            onChange={(e) => {
                              const next = [...form.faqs];
                              next[idx] = { ...next[idx], q: e.target.value };
                              update("faqs", next);
                            }}
                            placeholder="Question"
                            className="bg-white"
                          />
                          <textarea
                            value={faq.a}
                            onChange={(e) => {
                              const next = [...form.faqs];
                              next[idx] = { ...next[idx], a: e.target.value };
                              update("faqs", next);
                            }}
                            rows={2}
                            placeholder="Answer"
                            className={cn(TEXTAREA_CLASS, "bg-white")}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-slate-400 hover:text-red-600"
                          onClick={() =>
                            update(
                              "faqs",
                              form.faqs.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Timing fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-treatment">Treatment time</Label>
                  <Input
                    id="svc-treatment"
                    value={form.treatment_time}
                    onChange={(e) => update("treatment_time", e.target.value)}
                    placeholder="e.g. 15–30 min"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-recovery">Recovery time</Label>
                  <Input
                    id="svc-recovery"
                    value={form.recovery_time}
                    onChange={(e) => update("recovery_time", e.target.value)}
                    placeholder="e.g. None"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-results-timeline">Results timeline</Label>
                  <Input
                    id="svc-results-timeline"
                    value={form.results_timeline}
                    onChange={(e) => update("results_timeline", e.target.value)}
                    placeholder="e.g. 3–7 days"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-results-duration">Results duration</Label>
                  <Input
                    id="svc-results-duration"
                    value={form.results_duration}
                    onChange={(e) => update("results_duration", e.target.value)}
                    placeholder="e.g. 3–4 months"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button asChild type="button" variant="outline" disabled={saving}>
                  <Link href={LIST_PATH}>Cancel</Link>
                </Button>
                <Button type="submit" variant="gradient" disabled={saving} className="gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {isEdit ? "Save changes" : "Create treatment"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
