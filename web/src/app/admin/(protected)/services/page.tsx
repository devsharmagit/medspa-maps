"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  AlertCircle,
  Eye,
} from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Service {
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
  is_published: boolean;
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
  is_published: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function slugify(value: string): string {
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
    is_published: false,
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
    is_published: s.is_published,
  };
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await adminGet<Service[]>("/services");
      setServices(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load treatments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Distinct, sorted category options derived from existing data.
  const categoryOptions = useMemo<DropdownOption[]>(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ label: c, value: c }));
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q) ||
        (s.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [services, search]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    setDialogOpen(true);
  }

  // Optimistic create / update: merge the server-returned row into local state.
  function applyUpserted(row: Service) {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === row.id);
      if (idx === -1) {
        return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
      }
      const next = [...prev];
      // Preserve clinic_count from the existing row if the endpoint doesn't return it.
      next[idx] = { ...next[idx], ...row };
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function handleDelete(service: Service) {
    if (
      !confirm(
        `Delete "${service.name}"? This soft-deletes the treatment (it can be restored later).`
      )
    ) {
      return;
    }
    setDeletingId(service.id);
    // Optimistic: mark inactive immediately.
    const prev = services;
    setServices((cur) =>
      cur.map((s) => (s.id === service.id ? { ...s, is_active: false } : s))
    );
    try {
      await adminDelete(`/services/${service.id}`);
      // Re-sync to reflect canonical state.
      await load();
    } catch (err) {
      // Roll back on failure.
      setServices(prev);
      alert(err instanceof Error ? err.message : "Failed to delete treatment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Treatments</h2>
          <p className="text-sm text-slate-500">
            Manage the catalog of treatments offered across clinics.
          </p>
        </div>
        <Button variant="gradient" size="lg" onClick={openCreate} className="gap-1.5">
          <Plus size={16} />
          New Treatment
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex gap-2 max-w-sm relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, category, alias…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={28} className="animate-spin opacity-50" />
              <p>Loading treatments…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-red-600">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Sparkles size={36} className="opacity-30" />
              <p>{search ? "No treatments match your search." : "No treatments yet."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Treatment
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Category
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Aliases
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[90px]">
                      Clinics
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[150px]">
                      Status
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[120px]">
                      Review
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors",
                        !item.is_active && "opacity-50"
                      )}
                      onClick={() => openEdit(item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                            <Sparkles size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-400">{item.slug}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {item.category ? (
                          <span className="text-[13px] text-slate-600">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[13px] italic">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {item.aliases && item.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[260px]">
                            {item.aliases.slice(0, 4).map((alias) => (
                              <Badge
                                key={alias}
                                variant="secondary"
                                className="bg-pink-50 text-purple-700 border border-pink-100"
                              >
                                {alias}
                              </Badge>
                            ))}
                            {item.aliases.length > 4 && (
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 text-slate-500 border border-slate-200"
                              >
                                +{item.aliases.length - 4}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[13px] italic">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-[13px] font-medium text-slate-700 tabular-nums">
                          {item.clinic_count}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={
                              item.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }
                          >
                            {item.is_active ? "Active" : "Disabled"}
                          </Badge>
                          <Badge
                            className={
                              item.is_published
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }
                          >
                            {item.is_published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        {item.review_status ? (
                          <span className="text-[13px] text-slate-600 capitalize">
                            {item.review_status.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[13px] italic">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <a
                              href={`/treatments/${item.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Eye size={12} />
                              View
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(item)}
                            className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil size={12} />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          >
                            {deletingId === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categoryOptions={categoryOptions}
        onSaved={(row) => {
          applyUpserted(row);
          setDialogOpen(false);
          // Re-sync to pick up server-derived fields (e.g. clinic_count) cleanly.
          void load();
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Form dialog (create + edit)
// ----------------------------------------------------------------------------

function ServiceFormDialog({
  open,
  onOpenChange,
  editing,
  categoryOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Service | null;
  categoryOptions: DropdownOption[];
  onSaved: (row: Service) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens or the target row changes.
  useEffect(() => {
    if (open) {
      setForm(editing ? formFromService(editing) : emptyForm());
      setAliasInput("");
      setError(null);
    }
  }, [open, editing]);

  const isEdit = editing !== null;

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
    // Support comma-separated paste.
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    setForm((prev) => {
      const merged = [...prev.aliases];
      for (const p of parts) {
        if (!merged.includes(p)) merged.push(p);
      }
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

    // Fold any pending alias text into the payload.
    const pendingAliases = [...form.aliases];
    const pending = aliasInput.trim();
    if (pending) {
      for (const p of pending.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!pendingAliases.includes(p)) pendingAliases.push(p);
      }
    }

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
      is_published: form.is_published,
    };

    try {
      let row: Service;
      if (isEdit && editing) {
        row = await adminPatch<Service>(`/services/${editing.id}`, payload);
      } else {
        row = await adminPost<Service>("/services", payload);
      }
      onSaved(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save treatment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Treatment" : "New Treatment"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the catalog entry. Changes apply immediately."
              : "Add a treatment to the shared catalog."}
          </DialogDescription>
        </DialogHeader>

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
            <div className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 h-8 flex items-center">
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
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 min-h-8 focus-within:ring-3 focus-within:ring-ring/50 focus-within:border-ring transition-colors">
              {form.aliases.map((alias) => (
                <Badge
                  key={alias}
                  variant="secondary"
                  className="bg-pink-50 text-purple-700 border border-pink-100 gap-1 pr-1"
                >
                  {alias}
                  <button
                    type="button"
                    onClick={() => removeAlias(alias)}
                    className="rounded-full hover:bg-purple-200/50 p-0.5"
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
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
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

          <Separator />

          {/* Published toggle */}
          <button
            type="button"
            onClick={() => update("is_published", !form.is_published)}
            className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-800">Published</span>
              <span className="text-xs text-slate-400">
                Visible to the public site when on.
              </span>
            </div>
            <span
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                form.is_published
                  ? "bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]"
                  : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                  form.is_published ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </span>
          </button>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving} className="gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Save changes" : "Create treatment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
