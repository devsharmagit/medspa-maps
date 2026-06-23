"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HeartPulse,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  GripVertical,
  Eye,
} from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConcernListRow {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  is_active: boolean;
  service_count: number;
}

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

// The detail cards are individual textareas keyed into the `details` JSON.
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

// Shared textarea styling that matches the Input primitive aesthetic.
const TEXTAREA_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConcernsPage() {
  const [rows, setRows] = useState<ConcernListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [services, setServices] = useState<ServiceRow[]>([]);

  // Editor state: null = closed, "new" = create, otherwise the concern id.
  const [editorId, setEditorId] = useState<string | "new" | null>(null);

  // Delete confirmation target.
  const [deleteTarget, setDeleteTarget] = useState<ConcernListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<ConcernListRow[]>("/concerns");
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load concerns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    // Load canonical services once for the multi-select.
    adminGet<ServiceRow[]>("/services")
      .then((data) => setServices(data.filter((s) => s.is_active)))
      .catch(() => {
        /* non-fatal — editor shows empty list */
      });
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDelete(`/concerns/${deleteTarget.id}`);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete concern");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Concerns</h2>
          <p className="text-sm text-slate-500">
            Manage editorial concern pages and their linked services.
          </p>
        </div>
        <Button
          variant="gradient"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setEditorId("new")}
        >
          <Plus size={15} /> New Concern
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="shadow-sm ring-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="relative flex max-w-sm gap-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search concerns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-white pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading concerns…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <HeartPulse size={36} className="opacity-30" />
              <p>No concerns found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Concern
                  </TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Services
                  </TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/50",
                      !item.is_active && "opacity-50"
                    )}
                    onClick={() => setEditorId(item.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 text-brand-purple">
                          <HeartPulse size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-normal text-slate-400">
                            /{item.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {item.service_count}{" "}
                      <span className="text-slate-400">
                        {item.service_count === 1 ? "service" : "services"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.is_published
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-100 text-slate-500"
                        }
                      >
                        {item.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.is_published ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-600"
                          >
                            <a
                              href={`/conditions/${item.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Eye size={12} /> View
                            </a>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            title="Publish this concern to view its public page"
                            className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-400"
                          >
                            <Eye size={12} /> View
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-600"
                          onClick={() => setEditorId(item.id)}
                        >
                          <Pencil size={12} /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editorId !== null && (
        <ConcernEditor
          concernId={editorId}
          services={services}
          onClose={() => setEditorId(null)}
          onSaved={() => {
            setEditorId(null);
            void loadList();
          }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete concern?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be archived (soft-deleted) and hidden from the public site. You can restore it later.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

interface EditorProps {
  concernId: string | "new";
  services: ServiceRow[];
  onClose: () => void;
  onSaved: () => void;
}

function ConcernEditor({ concernId, services, onClose, onSaved }: EditorProps) {
  const isNew = concernId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Load existing concern for edit.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
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
  }, [concernId, isNew]);

  // Auto-derive slug from name until the user edits it manually.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

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
    setFaqs((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f))
    );
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

    // Build details JSON, dropping empty fields.
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
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save concern");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {isNew ? "New Concern" : "Edit Concern"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Editorial content and linked services for the concern page.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5">
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fine Lines & Wrinkles"
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

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
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
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isNew ? "Create Concern" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
