"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  BadgeCheck,
  Search,
  Check,
  Square,
  CheckSquare,
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

interface ProviderCredential {
  title: string;
  institution: string;
}

interface ProviderSpecialty {
  title: string;
  description: string;
}

interface ClinicService {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  is_active: boolean;
}

interface ProviderData {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  image_url: string | null;
  years_experience: number | null;
  is_verified: boolean;
  highlights: string[];
  credentials: ProviderCredential[];
  specialties: ProviderSpecialty[];
  service_ids: string[];
}

interface FormState {
  name: string;
  title: string;
  bio: string;
  image_url: string;
  years_experience: string;
  is_verified: boolean;
  highlights: string[];
  credentials: ProviderCredential[];
  specialties: ProviderSpecialty[];
  selected_service_ids: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEXTAREA =
  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function emptyForm(): FormState {
  return {
    name: "",
    title: "",
    bio: "",
    image_url: "",
    years_experience: "",
    is_verified: false,
    highlights: [],
    credentials: [],
    specialties: [],
    selected_service_ids: [],
  };
}

function formFromData(d: ProviderData): FormState {
  return {
    name: d.name,
    title: d.title ?? "",
    bio: d.bio ?? "",
    image_url: d.image_url ?? "",
    years_experience: d.years_experience ? String(d.years_experience) : "",
    is_verified: d.is_verified,
    highlights: d.highlights ?? [],
    credentials: d.credentials ?? [],
    specialties: d.specialties ?? [],
    selected_service_ids: d.service_ids ?? [],
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
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightInput, setHighlightInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [treatmentSearch, setTreatmentSearch] = useState("");

  const backPath = backUrl || `/admin/clinics/${clinicId}`;

  // Load canonical treatments for the treatment selector
  useEffect(() => {
    adminGet<ClinicService[]>(`/services`)
      .then((all) => setClinicServices(all.filter((s) => s.is_active !== false)))
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

  // ── Highlights ────────────────────────────────────────────────────────────
  function commitHighlight() {
    const val = highlightInput.trim();
    if (!val) return;
    update("highlights", [...form.highlights, val]);
    setHighlightInput("");
  }

  function removeHighlight(idx: number) {
    update("highlights", form.highlights.filter((_, i) => i !== idx));
  }

  // ── Credentials ───────────────────────────────────────────────────────────
  function addCredential() {
    update("credentials", [...form.credentials, { title: "", institution: "" }]);
  }

  function updateCredential(idx: number, field: keyof ProviderCredential, value: string) {
    const next = [...form.credentials];
    next[idx] = { ...next[idx], [field]: value };
    update("credentials", next);
  }

  function removeCredential(idx: number) {
    update("credentials", form.credentials.filter((_, i) => i !== idx));
  }

  // ── Specialties ───────────────────────────────────────────────────────────
  function addSpecialty() {
    update("specialties", [...form.specialties, { title: "", description: "" }]);
  }

  function updateSpecialty(idx: number, field: keyof ProviderSpecialty, value: string) {
    const next = [...form.specialties];
    next[idx] = { ...next[idx], [field]: value };
    update("specialties", next);
  }

  function removeSpecialty(idx: number) {
    update("specialties", form.specialties.filter((_, i) => i !== idx));
  }

  // ── Services multi-select ─────────────────────────────────────────────────
  function toggleService(id: string) {
    const selected = form.selected_service_ids;
    update(
      "selected_service_ids",
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
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
      bio: form.bio.trim() || null,
      image_url: form.image_url.trim() || null,
      years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
      is_verified: form.is_verified,
      highlights: form.highlights.filter(Boolean),
      credentials: form.credentials.filter((c) => c.title || c.institution),
      specialties: form.specialties.filter((s) => s.title || s.description),
      service_ids: form.selected_service_ids,
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="prov-title">Title / Role</Label>
                  <Input
                    id="prov-title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="e.g. Injectable Specialist"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="prov-exp">Years of Experience</Label>
                  <Input
                    id="prov-exp"
                    type="number"
                    min={0}
                    value={form.years_experience}
                    onChange={(e) => update("years_experience", e.target.value)}
                    placeholder="e.g. 10"
                  />
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

                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="prov-bio">Bio</Label>
                  <textarea
                    id="prov-bio"
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value)}
                    rows={4}
                    placeholder="Short professional biography…"
                    className={TEXTAREA}
                  />
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

              <Separator />

              {/* ── Highlights ─────────────────────────────────────────────── */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Highlights</Label>
                    <p className="text-xs text-slate-400 mt-0.5">Short badge-style strengths shown on the profile card.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.highlights.map((h, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 border border-pink-100 bg-pink-50 pr-1 text-purple-700"
                    >
                      {h}
                      <button
                        type="button"
                        onClick={() => removeHighlight(i)}
                        className="ml-1 rounded-full hover:text-red-600"
                        aria-label={`Remove ${h}`}
                      >×</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitHighlight(); } }}
                    placeholder='e.g. "Board Certified Nurse Practitioner"'
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={commitHighlight}>
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>

              <Separator />

              {/* ── Credentials & Education ────────────────────────────────── */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Credentials & Education</Label>
                    <p className="text-xs text-slate-400 mt-0.5">Degrees, certifications, and memberships.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs border-slate-200" onClick={addCredential}>
                    <Plus size={12} /> Add
                  </Button>
                </div>
                {form.credentials.length === 0 ? (
                  <p className="text-xs text-slate-400">No credentials yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {form.credentials.map((c, idx) => (
                      <div key={idx} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                        <div className="flex flex-1 flex-col gap-2">
                          <Input
                            value={c.title}
                            onChange={(e) => updateCredential(idx, "title", e.target.value)}
                            placeholder="e.g. Board-Certified Nurse Practitioner"
                            className="bg-white"
                          />
                          <Input
                            value={c.institution}
                            onChange={(e) => updateCredential(idx, "institution", e.target.value)}
                            placeholder="e.g. American Nurses Credentialing Center (ANCC)"
                            className="bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 self-start text-slate-400 hover:text-red-600"
                          onClick={() => removeCredential(idx)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Specialties ───────────────────────────────────────────── */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Specialties</Label>
                    <p className="text-xs text-slate-400 mt-0.5">Treatment specialty areas with descriptions.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs border-slate-200" onClick={addSpecialty}>
                    <Plus size={12} /> Add
                  </Button>
                </div>
                {form.specialties.length === 0 ? (
                  <p className="text-xs text-slate-400">No specialties yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {form.specialties.map((s, idx) => (
                      <div key={idx} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                        <div className="flex flex-1 flex-col gap-2">
                          <Input
                            value={s.title}
                            onChange={(e) => updateSpecialty(idx, "title", e.target.value)}
                            placeholder="e.g. Injectables"
                            className="bg-white"
                          />
                          <textarea
                            value={s.description}
                            onChange={(e) => updateSpecialty(idx, "description", e.target.value)}
                            rows={2}
                            placeholder="Botox, Dysport, Xeomin, and dermal fillers for natural-looking results."
                            className={cn(TEXTAREA, "bg-white")}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 self-start text-slate-400 hover:text-red-600"
                          onClick={() => removeSpecialty(idx)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Treatments offered ────────────────────────────────────── */}
              {clinicServices.length > 0 && (() => {
                const q = treatmentSearch.trim().toLowerCase();
                const filtered = q
                  ? clinicServices.filter((s) => s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q))
                  : clinicServices;

                // Group by category
                const grouped: Record<string, ClinicService[]> = {};
                for (const svc of filtered) {
                  const cat = svc.category || "Other";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(svc);
                }
                const categoryNames = Object.keys(grouped).sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));

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

                      {/* Category groups */}
                      {filtered.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No treatments match &ldquo;{treatmentSearch}&rdquo;
                        </p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {categoryNames.map((cat) => {
                            const items = grouped[cat];
                            const allSelected = items.every((s) => form.selected_service_ids.includes(s.id));
                            const someSelected = items.some((s) => form.selected_service_ids.includes(s.id));

                            function toggleCategory() {
                              if (allSelected) {
                                // Deselect all in this category
                                const catIds = new Set(items.map((s) => s.id));
                                update("selected_service_ids", form.selected_service_ids.filter((id) => !catIds.has(id)));
                              } else {
                                // Select all in this category
                                const catIds = items.map((s) => s.id);
                                const merged = new Set([...form.selected_service_ids, ...catIds]);
                                update("selected_service_ids", Array.from(merged));
                              }
                            }

                            return (
                              <div key={cat} className="rounded-lg border border-slate-200 overflow-hidden">
                                {/* Category header */}
                                <button
                                  type="button"
                                  onClick={toggleCategory}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 bg-slate-50/80 border-b border-slate-100 text-left transition-colors hover:bg-slate-100/80"
                                >
                                  {allSelected ? (
                                    <CheckSquare size={15} className="text-purple-600 shrink-0" />
                                  ) : someSelected ? (
                                    <CheckSquare size={15} className="text-purple-400 shrink-0 opacity-60" />
                                  ) : (
                                    <Square size={15} className="text-slate-300 shrink-0" />
                                  )}
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cat}</span>
                                  <span className="ml-auto text-[11px] text-slate-400">
                                    {items.filter((s) => form.selected_service_ids.includes(s.id)).length}/{items.length}
                                  </span>
                                </button>
                                {/* Treatment list */}
                                <div className="divide-y divide-slate-100">
                                  {items.map((svc) => {
                                    const selected = form.selected_service_ids.includes(svc.id);
                                    return (
                                      <button
                                        key={svc.id}
                                        type="button"
                                        onClick={() => toggleService(svc.id)}
                                        className={cn(
                                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-all",
                                          selected
                                            ? "bg-purple-50/60 text-purple-800"
                                            : "bg-white text-slate-600 hover:bg-slate-50"
                                        )}
                                      >
                                        {selected ? (
                                          <span className="flex h-4.5 w-4.5 items-center justify-center rounded bg-gradient-to-br from-[#DE7F4C] to-[#C341D7] shrink-0">
                                            <Check size={12} className="text-white" strokeWidth={3} />
                                          </span>
                                        ) : (
                                          <span className="flex h-4.5 w-4.5 items-center justify-center rounded border border-slate-300 bg-white shrink-0" />
                                        )}
                                        <span className={cn("font-medium text-[13px]", selected && "text-purple-800")}>
                                          {svc.name}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

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
