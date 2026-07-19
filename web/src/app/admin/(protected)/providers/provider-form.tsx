"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Trash2,
  AlertCircle,
  BadgeCheck,
  Search,
  Check,
} from "lucide-react";
import { adminGet, adminPost, adminPut, adminDelete } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClinicService {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ConcernOption {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
}

interface ProviderData {
  id: string;
  name: string;
  title: string | null;
  card_tagline: string | null;
  image_url: string | null;
  is_verified: boolean;
  service_ids: string[];
  concern_ids: string[];
}

interface FormState {
  name: string;
  title: string;
  card_tagline: string;
  image_url: string;
  is_verified: boolean;
  selected_service_ids: string[];
  selected_concern_ids: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEXTAREA =
  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function emptyForm(): FormState {
  return {
    name: "",
    title: "",
    card_tagline: "",
    image_url: "",
    is_verified: false,
    selected_service_ids: [],
    selected_concern_ids: [],
  };
}

function formFromData(d: ProviderData): FormState {
  return {
    name: d.name,
    title: d.title ?? "",
    card_tagline: d.card_tagline ?? "",
    image_url: d.image_url ?? "",
    is_verified: d.is_verified,
    selected_service_ids: d.service_ids ?? [],
    selected_concern_ids: d.concern_ids ?? [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProviderForm({
  clinicId,
  providerId,
  backUrl,
}: {
  clinicId: string;
  providerId?: string;
  backUrl?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(providerId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([]);
  const [concerns, setConcerns] = useState<ConcernOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [treatmentSearch, setTreatmentSearch] = useState("");

  const backPath = backUrl || `/admin/clinics/${clinicId}`;

  // Load canonical treatments for the treatment selector
  useEffect(() => {
    adminGet<ClinicService[]>(`/services`)
      .then((all) => setClinicServices(all.filter((s) => s.is_active !== false)))
      .catch(() => {/* non-fatal */});
  }, []);

  // Load concerns for the concern selector
  useEffect(() => {
    adminGet<ConcernOption[]>(`/concerns`)
      .then((all) => setConcerns(all.filter((c) => c.is_active !== false)))
      .catch(() => {/* non-fatal */});
  }, []);

  // Load provider data when editing
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    adminGet<ProviderData>(`/providers/${providerId}`)
      .then((d) => { if (!cancelled) setForm(formFromData(d)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load provider"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [providerId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Services multi-select ─────────────────────────────────────────────────
  function toggleService(id: string) {
    const selected = form.selected_service_ids;
    update(
      "selected_service_ids",
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  }

  // ── Concerns multi-select ─────────────────────────────────────────────────
  function toggleConcern(id: string) {
    const selected = form.selected_concern_ids;
    update(
      "selected_concern_ids",
      selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Provider name is required."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      title: form.title.trim() || null,
      card_tagline: form.card_tagline.trim() || null,
      image_url: form.image_url.trim() || null,
      is_verified: form.is_verified,
      service_ids: form.selected_service_ids,
      concern_ids: form.selected_concern_ids,
    };

    try {
      if (isEdit && providerId) {
        await adminPut(`/providers/${providerId}`, payload);
      } else {
        await adminPost(`/clinics/${clinicId}/providers`, payload);
      }
      router.push(backPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save provider");
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!providerId || !confirm("Delete this provider? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await adminDelete(`/providers/${providerId}`);
      router.push(backPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete provider");
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          href={backPath}
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={14} /> {backUrl ? "Back" : "Back to clinic"}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? "Edit provider" : "Add new provider"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Update the provider's profile. Changes apply immediately."
                : "Add a provider profile linked to this clinic."}
            </p>
          </div>
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading provider…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* ── Basic Info ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="prov-name">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="prov-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Dr. Larissa Joe"
                    autoFocus
                  />
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="prov-title">Title / Role</Label>
                  <Input
                    id="prov-title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="e.g. Injectable Specialist"
                  />
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="prov-tagline">Card Tagline</Label>
                  <textarea
                    id="prov-tagline"
                    value={form.card_tagline}
                    onChange={(e) => update("card_tagline", e.target.value)}
                    rows={2}
                    placeholder="e.g. Expert in Botox, fillers and laser treatments. Provides soft and natural looking results."
                    className={TEXTAREA}
                  />
                  <span className="text-xs text-slate-400">
                    Short one/two-line pitch shown on the provider card.
                  </span>
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="prov-image">Profile Photo URL</Label>
                  <Input
                    id="prov-image"
                    type="url"
                    value={form.image_url}
                    onChange={(e) => update("image_url", e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                  <span className="text-xs text-slate-400">
                    Paste an image URL. S3/CDN upload will be added later.
                  </span>
                  {form.image_url && (
                    <div className="mt-1 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="h-16 w-16 rounded-full object-cover border border-slate-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="text-xs text-slate-400">Preview</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Verified badge toggle ──────────────────────────────────── */}
              <button
                type="button"
                onClick={() => update("is_verified", !form.is_verified)}
                className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <BadgeCheck size={16} className={form.is_verified ? "text-blue-600" : "text-slate-300"} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">Verified Provider</span>
                    <span className="text-xs text-slate-400">Shows a blue verified badge on the public profile.</span>
                  </div>
                </div>
                <span className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                  form.is_verified ? "bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]" : "bg-slate-200"
                )}>
                  <span className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    form.is_verified ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </span>
              </button>

              {/* ── Treatments offered ────────────────────────────────────── */}
              {clinicServices.length > 0 && (() => {
                const q = treatmentSearch.trim().toLowerCase();
                const filtered = q
                  ? clinicServices.filter((s) => s.name.toLowerCase().includes(q))
                  : clinicServices;
                const selectedCount = form.selected_service_ids.length;

                return (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label>Treatments Offered</Label>
                          <p className="text-xs text-slate-400 mt-0.5">Select treatments this provider performs.</p>
                        </div>
                        {selectedCount > 0 && (
                          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            {selectedCount} selected
                          </Badge>
                        )}
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          value={treatmentSearch}
                          onChange={(e) => setTreatmentSearch(e.target.value)}
                          placeholder="Search treatments…"
                          className="pl-9 bg-white"
                        />
                      </div>

                      {/* Treatment list */}
                      {filtered.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No treatments match &ldquo;{treatmentSearch}&rdquo;
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {filtered.map((svc) => {
                            const selected = form.selected_service_ids.includes(svc.id);
                            return (
                              <button
                                key={svc.id}
                                type="button"
                                onClick={() => toggleService(svc.id)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all",
                                  selected
                                    ? "border-purple-300 bg-purple-50 text-purple-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                {selected && <Check size={13} strokeWidth={3} className="text-purple-600" />}
                                {svc.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* ── Concerns treated ──────────────────────────────────────── */}
              {concerns.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label>Concerns Treated</Label>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Select the concerns this provider treats. They&rsquo;ll appear under
                          &ldquo;Doctors &amp; Providers&rdquo; on those concern pages.
                        </p>
                      </div>
                      {form.selected_concern_ids.length > 0 && (
                        <Badge className="bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          {form.selected_concern_ids.length} selected
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {concerns.map((c) => {
                        const selected = form.selected_concern_ids.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleConcern(c.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all",
                              selected
                                ? "border-purple-300 bg-purple-50 text-purple-800"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {selected && <Check size={13} strokeWidth={3} className="text-purple-600" />}
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── Error ────────────────────────────────────────────────── */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* ── Actions ───────────────────────────────────────────────── */}
              <div className="flex justify-end gap-2 pt-1">
                <Button asChild type="button" variant="outline" disabled={saving}>
                  <Link href={backPath}>Cancel</Link>
                </Button>
                <Button type="submit" variant="gradient" disabled={saving} className="gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {isEdit ? "Save changes" : "Add provider"}
                </Button>
              </div>

            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
