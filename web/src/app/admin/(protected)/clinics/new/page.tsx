"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Globe,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  MapPin,
  ImageIcon,
  MessageSquareQuote,
  Stethoscope,
  HeartPulse,
  Building2,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { adminGet, adminPost } from "@/lib/admin/client";
import { computePriorityCoverage } from "@/lib/treatments/coverage";

// ── Types (mirror scrape-preview / clinic-save payload) ──────────────────────

interface PreviewDuplicate {
  exists: boolean;
  clinicIds: string[];
  byDomain: string;
}

interface SaveLocation {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  email?: string | null;
  about?: string | null;
  booking_url?: string | null;
  maps_url?: string | null;
  hours?: Record<string, unknown> | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  yelp_url?: string | null;
  google_my_business?: string | null;
  tagline?: string | null;
}

interface SaveServiceSuggestion {
  slug: string;
  confidence: number;
}

interface SaveService {
  raw_name: string;
  description?: string | null;
  scraped_from_url?: string | null;
  suggestion?: SaveServiceSuggestion | null;
  is_noise?: boolean;
  mapped_slug?: string | null;
  ignored?: boolean;
}

interface SaveImageRef {
  source_url: string;
  alt_text?: string | null;
}

interface SaveImages {
  logo?: SaveImageRef | null;
  gallery?: SaveImageRef[];
  before_after?: SaveImageRef[];
}

interface SaveReview {
  reviewer_name?: string | null;
  rating?: number | null;
  body: string;
  source_url?: string | null;
}

interface ClinicPreview {
  website: string;
  business: { name: string };
  locations: SaveLocation[];
  services: SaveService[];
  concerns: string[];
  images: SaveImages;
  reviews: SaveReview[];
  ext_rating: number | null;
  ext_review_count: number | null;
  duplicate: PreviewDuplicate;
}

interface AdminService {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

// UI-side service row: tracks the user's canonical mapping + ignore decision.
interface ServiceRow extends SaveService {
  /** canonical service slug the admin mapped this to (overrides suggestion) */
  mappedSlug: string;
  /** if true, this raw service is dropped from the save payload */
  ignored: boolean;
}

interface SaveResultClinic {
  id: string;
  slug: string;
  created: boolean;
}

interface SaveResult {
  businessId: string;
  businessCreated: boolean;
  clinics: SaveResultClinic[];
  servicesMatched: number;
  servicesAuto: number;
  servicesUnmatched: number;
  images: number;
  reviews: number;
  concernLinks: number;
}

interface DuplicateClinic {
  id: string;
  name: string;
  slug: string;
  website: string | null;
}

// Error thrown by adminPost carries the server message; we tag conflicts.
interface ConflictError extends Error {
  duplicate?: { exists: boolean; byDomain: string; clinics: DuplicateClinic[] };
}

const BRAND = "#9b3a9b";

// ── Small field helpers ──────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}

function emptyLocation(): SaveLocation {
  return {
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    booking_url: "",
    about: "",
    tagline: "",
    maps_url: "",
    lat: null,
    lng: null,
    hours: null,
  };
}

// hours is a free-form jsonb map; show/edit it as JSON text for fidelity.
function hoursToText(hours: Record<string, unknown> | null | undefined): string {
  if (!hours) return "";
  try {
    return JSON.stringify(hours, null, 2);
  } catch {
    return "";
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewClinicPage() {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ClinicPreview | null>(null);

  // editable state
  const [businessName, setBusinessName] = useState("");
  const [locations, setLocations] = useState<SaveLocation[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [logo, setLogo] = useState<SaveImageRef | null>(null);
  const [gallery, setGallery] = useState<SaveImageRef[]>([]);
  const [beforeAfter, setBeforeAfter] = useState<SaveImageRef[]>([]);
  const [reviews, setReviews] = useState<SaveReview[]>([]);
  const [hoursText, setHoursText] = useState<Record<number, string>>({});

  // canonical services for the mapping dropdowns
  const [canonicalServices, setCanonicalServices] = useState<AdminService[]>([]);
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);

  // Live Phase-0 priority-treatment coverage, recomputed as services are
  // mapped/ignored: how many of the 15 priority treatments this clinic offers,
  // and which priority concerns those treatments can treat.
  const coverage = useMemo(
    () =>
      computePriorityCoverage(
        services.filter((s) => !s.ignored && s.mappedSlug).map((s) => s.mappedSlug)
      ),
    [services]
  );

  // duplicate / overwrite
  const [overwrite, setOverwrite] = useState(false);
  const [duplicateClinics, setDuplicateClinics] = useState<DuplicateClinic[]>(
    []
  );

  // save flow
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateClinic[] | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);

  // ── fetch / scrape ────────────────────────────────────────────────────────
  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    setPreview(null);
    setResult(null);
    setConflict(null);
    setSaveError(null);

    try {
      const [data, svc] = await Promise.all([
        adminPost<ClinicPreview>("/clinics/scrape-preview", {
          url: url.trim(),
        }),
        adminGet<AdminService[]>("/services").catch(() => [] as AdminService[]),
      ]);

      setPreview(data);
      setBusinessName(data.business?.name ?? "");
      setLocations(
        data.locations.length > 0 ? data.locations : [emptyLocation()]
      );
      setServices(
        data.services.map((s) => ({
          ...s,
          mappedSlug: s.suggestion?.slug ?? "",
          ignored: Boolean(s.is_noise),
        }))
      );
      setLogo(data.images?.logo ?? null);
      setGallery(data.images?.gallery ?? []);
      setBeforeAfter(data.images?.before_after ?? []);
      setReviews(data.reviews ?? []);
      setCanonicalServices(svc);

      // hours -> editable JSON text per location
      const hmap: Record<number, string> = {};
      (data.locations.length > 0 ? data.locations : [emptyLocation()]).forEach(
        (l, i) => {
          hmap[i] = hoursToText(l.hours);
        }
      );
      setHoursText(hmap);

      // duplicate handling — preview only gives ids; surface a warning + flag
      if (data.duplicate?.exists) {
        setOverwrite(true);
        setDuplicateClinics(
          data.duplicate.clinicIds.map((id) => ({
            id,
            name: "Existing clinic",
            slug: "",
            website: data.website,
          }))
        );
      } else {
        setOverwrite(false);
        setDuplicateClinics([]);
      }
    } catch (err) {
      setFetchError(
        err instanceof Error
          ? err.message
          : "Could not scrape that URL. Check the address and try again."
      );
    } finally {
      setFetching(false);
    }
  }, [url]);

  // ── location editing ────────────────────────────────────────────────────────
  const updateLocation = (idx: number, patch: Partial<SaveLocation>) => {
    setLocations((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };
  const addLocation = () => {
    setLocations((prev) => [...prev, emptyLocation()]);
    setHoursText((prev) => ({ ...prev, [locations.length]: "" }));
  };
  const removeLocation = (idx: number) => {
    setLocations((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── service editing ─────────────────────────────────────────────────────────
  const updateService = (idx: number, patch: Partial<ServiceRow>) => {
    setServices((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  };

  // Create a brand-new canonical service from an unmatched scraped name
  // (e.g. "Neurotoxins"), add it to the dropdown, and map this row to it.
  const createServiceForRow = async (idx: number, rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setCreatingIdx(idx);
    setSaveError(null);
    try {
      const svc = await adminPost<AdminService>("/services", { name });
      setCanonicalServices((prev) =>
        prev.some((p) => p.slug === svc.slug)
          ? prev
          : [...prev, svc].sort((a, b) => a.name.localeCompare(b.name))
      );
      updateService(idx, { mappedSlug: svc.slug });
    } catch (err) {
      // Most likely the service already exists — refetch and map by name.
      try {
        const list = await adminGet<AdminService[]>("/services");
        setCanonicalServices(list);
        const match = list.find(
          (s) => s.name.toLowerCase() === name.toLowerCase()
        );
        if (match) updateService(idx, { mappedSlug: match.slug });
        else setSaveError((err as Error).message || "Could not create service");
      } catch {
        setSaveError((err as Error).message || "Could not create service");
      }
    } finally {
      setCreatingIdx(null);
    }
  };

  // ── image editing ─────────────────────────────────────────────────────────────
  const removeGallery = (idx: number) =>
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  const removeBeforeAfter = (idx: number) =>
    setBeforeAfter((prev) => prev.filter((_, i) => i !== idx));

  // ── review editing ────────────────────────────────────────────────────────────
  const updateReview = (idx: number, patch: Partial<SaveReview>) =>
    setReviews((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  const removeReview = (idx: number) =>
    setReviews((prev) => prev.filter((_, i) => i !== idx));

  // ── build the save payload from the user's edits ──────────────────────────────
  const buildPayload = useCallback(() => {
    if (!preview) return null;

    const outLocations: SaveLocation[] = locations.map((l, i) => {
      let hours: Record<string, unknown> | null = l.hours ?? null;
      const txt = hoursText[i];
      if (txt && txt.trim()) {
        try {
          hours = JSON.parse(txt) as Record<string, unknown>;
        } catch {
          // keep prior hours if the edited JSON is invalid
        }
      } else if (txt === "") {
        hours = null;
      }
      return {
        ...l,
        lat: l.lat != null && l.lat !== ("" as unknown) ? Number(l.lat) : null,
        lng: l.lng != null && l.lng !== ("" as unknown) ? Number(l.lng) : null,
        hours,
      };
    });

    const outServices: SaveService[] = services
      .filter((s) => !s.ignored && s.raw_name.trim())
      .map((s) => ({
        raw_name: s.raw_name.trim(),
        description: s.description ?? null,
        scraped_from_url: s.scraped_from_url ?? null,
        // mapped_slug is the authoritative mapping the save honors (dropdown
        // pick or a just-created service); fall back to the auto-suggestion.
        mapped_slug: s.mappedSlug || s.suggestion?.slug || null,
        suggestion: s.mappedSlug
          ? { slug: s.mappedSlug, confidence: s.suggestion?.confidence ?? 1 }
          : s.suggestion ?? null,
      }));

    const outReviews: SaveReview[] = reviews
      .filter((r) => r.body && r.body.trim())
      .map((r) => ({
        reviewer_name: r.reviewer_name ?? null,
        rating: r.rating ?? null,
        body: r.body.trim(),
        source_url: r.source_url ?? null,
      }));

    return {
      website: preview.website,
      business: { name: businessName.trim() || preview.business.name },
      locations: outLocations,
      services: outServices,
      images: {
        logo: logo ?? null,
        gallery,
        before_after: beforeAfter,
      },
      reviews: outReviews,
      ext_rating: preview.ext_rating,
      ext_review_count: preview.ext_review_count,
    };
  }, [
    preview,
    locations,
    hoursText,
    services,
    reviews,
    businessName,
    logo,
    gallery,
    beforeAfter,
  ]);

  // ── save ───────────────────────────────────────────────────────────────────────
  const doSave = useCallback(
    async (force: boolean) => {
      const payload = buildPayload();
      if (!payload) return;
      setSaving(true);
      setSaveError(null);
      setConflict(null);

      try {
        const res = await adminPost<SaveResult>("/clinics/save", {
          payload,
          overwrite: force || overwrite,
        });
        setResult(res);
        setConflict(null);
        // scroll to top to reveal the success card
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        const ce = err as ConflictError;
        if (ce.duplicate?.exists && ce.duplicate.clinics) {
          setConflict(ce.duplicate.clinics);
          setDuplicateClinics(ce.duplicate.clinics);
        } else {
          setSaveError(ce.message || "Save failed. Please try again.");
        }
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, overwrite]
  );

  const serviceOptions: DropdownOption[] = canonicalServices.map((s) => ({
    label: s.category ? `${s.name} · ${s.category}` : s.name,
    value: s.slug,
  }));

  const canonicalLabel = (slug: string): string =>
    canonicalServices.find((s) => s.slug === slug)?.name ?? slug;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/clinics">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Sparkles size={18} style={{ color: BRAND }} />
            Add Clinic by URL
          </h2>
          <p className="text-sm text-slate-500">
            Paste a clinic website. We&apos;ll scrape it into an editable draft
            you can review before saving.
          </p>
        </div>
      </div>

      {/* Step 1 — URL input */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-[#fdf2fb] to-[#faf5fc] pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Globe size={16} style={{ color: BRAND }} />
            Website URL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Clinic website">
                <Input
                  type="url"
                  placeholder="https://ruma.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !fetching) handleFetch();
                  }}
                  className="h-10"
                  disabled={fetching}
                />
              </Field>
            </div>
            <Button
              variant="gradient"
              className="h-10 px-6"
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
            >
              {fetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Fetching…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Fetch
                </>
              )}
            </Button>
          </div>

          {fetchError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success card */}
      {result && (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2.5 text-emerald-800">
              <CheckCircle2 size={20} />
              <span className="text-base font-semibold">
                Clinic saved successfully
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-emerald-900/70">
              <span>
                {result.servicesMatched + result.servicesAuto} services mapped
              </span>
              <span>·</span>
              <span>{result.servicesUnmatched} unmatched</span>
              <span>·</span>
              <span>{result.images} images</span>
              <span>·</span>
              <span>{result.reviews} reviews</span>
              <span>·</span>
              <span>{result.concernLinks} concern links</span>
            </div>
            <Separator className="bg-emerald-200" />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Public clinic page{result.clinics.length > 1 ? "s" : ""}
              </span>
              {result.clinics.map((c) => (
                <a
                  key={c.id}
                  href={`/clinics/${c.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
                >
                  <ExternalLink size={14} />
                  /clinics/{c.slug}
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-emerald-100 text-emerald-700"
                  >
                    {c.created ? "created" : "updated"}
                  </Badge>
                </a>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Link href="/admin/clinics">
                <Button variant="outline" size="sm">
                  Back to Clinics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate / overwrite warning */}
      {preview && (duplicateClinics.length > 0 || conflict) && !result && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2.5 text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                A clinic for this website already exists — saving will OVERWRITE
                it.
              </span>
              <span className="text-xs text-amber-700">
                Matched on domain{" "}
                <span className="font-mono">
                  {preview.duplicate.byDomain}
                </span>
                . Existing clinic
                {(conflict ?? duplicateClinics).length > 1 ? "s" : ""}:
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {(conflict ?? duplicateClinics).map((c) => (
                  <a
                    key={c.id}
                    href={c.slug ? `/clinics/${c.slug}` : `/admin/clinics/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white/60 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-white"
                  >
                    <ExternalLink size={12} />
                    {c.name && c.name !== "Existing clinic" ? c.name : c.slug || c.id.slice(0, 8)}
                  </a>
                ))}
              </div>
            </div>
          </div>
          {conflict && (
            <div className="flex items-center gap-3 border-t border-amber-200 pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => doSave(true)}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Overwriting…
                  </>
                ) : (
                  "Overwrite existing clinic"
                )}
              </Button>
              <span className="text-xs text-amber-700">
                This replaces the existing clinic&apos;s services and images.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Editable form */}
      {preview && !result && (
        <>
          {/* Business */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Building2 size={16} style={{ color: BRAND }} />
                Business
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Field label="Business name">
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-10"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Locations */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <MapPin size={16} style={{ color: BRAND }} />
                Locations
                <Badge variant="secondary" className="font-normal">
                  {locations.length}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addLocation}>
                <Plus size={14} /> Add location
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              {locations.map((loc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      Location {idx + 1}
                      {loc.city ? ` — ${loc.city}` : ""}
                    </span>
                    {locations.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => removeLocation(idx)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Location name (tagline)">
                      <Input
                        value={loc.tagline ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { tagline: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={loc.phone ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { phone: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Address">
                      <Input
                        value={loc.address ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { address: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="City">
                        <Input
                          value={loc.city ?? ""}
                          onChange={(e) =>
                            updateLocation(idx, { city: e.target.value })
                          }
                          className="h-9"
                        />
                      </Field>
                      <Field label="State">
                        <Input
                          value={loc.state ?? ""}
                          onChange={(e) =>
                            updateLocation(idx, { state: e.target.value })
                          }
                          className="h-9"
                        />
                      </Field>
                      <Field label="Zip">
                        <Input
                          value={loc.zip ?? ""}
                          onChange={(e) =>
                            updateLocation(idx, { zip: e.target.value })
                          }
                          className="h-9"
                        />
                      </Field>
                    </div>
                    <Field label="Booking URL">
                      <Input
                        value={loc.booking_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { booking_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Maps URL">
                      <Input
                        value={loc.maps_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { maps_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        value={loc.instagram_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { instagram_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Facebook">
                      <Input
                        value={loc.facebook_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { facebook_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="TikTok">
                      <Input
                        value={loc.tiktok_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { tiktok_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="X (Twitter)">
                      <Input
                        value={loc.x_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { x_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="YouTube">
                      <Input
                        value={loc.youtube_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { youtube_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Yelp">
                      <Input
                        value={loc.yelp_url ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, { yelp_url: e.target.value })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Latitude">
                      <Input
                        value={loc.lat ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, {
                            lat:
                              e.target.value === ""
                                ? null
                                : (e.target.value as unknown as number),
                          })
                        }
                        className="h-9"
                      />
                    </Field>
                    <Field label="Longitude">
                      <Input
                        value={loc.lng ?? ""}
                        onChange={(e) =>
                          updateLocation(idx, {
                            lng:
                              e.target.value === ""
                                ? null
                                : (e.target.value as unknown as number),
                          })
                        }
                        className="h-9"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Tagline (short pitch)">
                        <Input
                          value={loc.tagline ?? ""}
                          onChange={(e) =>
                            updateLocation(idx, { tagline: e.target.value })
                          }
                          className="h-9"
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="About">
                        <textarea
                          value={loc.about ?? ""}
                          onChange={(e) =>
                            updateLocation(idx, { about: e.target.value })
                          }
                          rows={4}
                          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Hours (JSON)">
                        <textarea
                          value={hoursText[idx] ?? ""}
                          onChange={(e) =>
                            setHoursText((prev) => ({
                              ...prev,
                              [idx]: e.target.value,
                            }))
                          }
                          rows={4}
                          placeholder='{ "MONDAY": { "open": "09:00", "close": "17:00", "is_open": true } }'
                          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Priority treatment coverage */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Sparkles size={16} style={{ color: BRAND }} />
                Priority treatment coverage
                <Badge
                  variant="secondary"
                  className="font-normal"
                  style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                >
                  {coverage.count} / {coverage.total}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                How many of the {coverage.total} priority treatments this clinic
                offers, and the concerns those treatments can treat. Updates as
                you map services below.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Offered ({coverage.present.length})
                </p>
                {coverage.present.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No priority treatments matched yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {coverage.present.map((t) => (
                      <span
                        key={t.slug}
                        className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                      >
                        <CheckCircle2 size={12} />
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {coverage.missing.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Not offered ({coverage.missing.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coverage.missing.map((t) => (
                      <span
                        key={t.slug}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Treats these concerns ({coverage.concerns.length})
                </p>
                {coverage.concerns.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No priority concerns covered yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {coverage.concerns.map((c) => (
                      <span
                        key={c.slug}
                        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                        style={{
                          borderColor: `${BRAND}4d`,
                          backgroundColor: `${BRAND}1a`,
                          color: BRAND,
                        }}
                      >
                        <HeartPulse size={12} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Stethoscope size={16} style={{ color: BRAND }} />
                Services
                <Badge variant="secondary" className="font-normal">
                  {services.filter((s) => !s.ignored).length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Matched services map automatically. For unmatched ones, pick a
                canonical service or mark them ignored.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {services.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No services scraped.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {services.map((s, idx) => {
                    const matched = Boolean(s.suggestion?.slug);
                    // a row the admin manually mapped or just created
                    const mappedNow = !matched && Boolean(s.mappedSlug);
                    const resolved = matched || mappedNow;
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                          s.ignored ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {resolved ? (
                            <CheckCircle2
                              size={16}
                              className="mt-0.5 shrink-0 text-emerald-500"
                            />
                          ) : (
                            <AlertTriangle
                              size={16}
                              className="mt-0.5 shrink-0 text-amber-500"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {s.raw_name}
                            </p>
                            {matched ? (
                              <p className="text-xs text-emerald-600">
                                → {canonicalLabel(s.suggestion!.slug)}
                                {s.suggestion!.confidence < 1 && (
                                  <span className="ml-1 text-slate-400">
                                    (auto)
                                  </span>
                                )}
                              </p>
                            ) : mappedNow ? (
                              <p className="text-xs text-emerald-600">
                                → {canonicalLabel(s.mappedSlug)}
                                <span className="ml-1 text-slate-400">(mapped)</span>
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600">
                                Unmatched — map to a canonical service
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:w-[340px] sm:shrink-0">
                          {matched ? (
                            <span className="flex-1 truncate rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                              {canonicalLabel(s.suggestion!.slug)}
                            </span>
                          ) : (
                            <div className="flex flex-1 flex-col gap-1.5">
                              <div className="rounded-lg border border-slate-200 px-3 py-1.5">
                                <SearchableDropdown
                                  options={serviceOptions}
                                  value={s.mappedSlug}
                                  onChange={(v) =>
                                    updateService(idx, { mappedSlug: v })
                                  }
                                  placeholder="Map to canonical…"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => createServiceForRow(idx, s.raw_name)}
                                disabled={creatingIdx === idx}
                                className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[#9b3a9b] hover:underline disabled:opacity-50"
                              >
                                <Plus size={13} />
                                {creatingIdx === idx
                                  ? "Creating…"
                                  : `Create “${s.raw_name}” as a new service`}
                              </button>
                            </div>
                          )}
                          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={s.ignored}
                              onChange={(e) =>
                                updateService(idx, {
                                  ignored: e.target.checked,
                                })
                              }
                              className="size-4 rounded border-slate-300 accent-[#9b3a9b]"
                            />
                            Ignore
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <ImageIcon size={16} style={{ color: BRAND }} />
                Images
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 p-6">
              {/* Logo */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Logo
                </p>
                {logo ? (
                  <div className="group relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.source_url}
                      alt={logo.alt_text || "Logo"}
                      className="size-24 rounded-lg border border-slate-200 bg-white object-contain p-2"
                    />
                    <button
                      type="button"
                      onClick={() => setLogo(null)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                      aria-label="Remove logo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No logo.</p>
                )}
              </div>

              {/* Gallery */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Gallery ({gallery.length})
                </p>
                {gallery.length === 0 ? (
                  <p className="text-sm text-slate-400">No gallery images.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {gallery.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.source_url}
                          alt={img.alt_text || "Gallery"}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeGallery(idx)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600"
                          aria-label="Remove image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Before / after */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Before / After ({beforeAfter.length})
                </p>
                {beforeAfter.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No before/after images.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {beforeAfter.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.source_url}
                          alt={img.alt_text || "Before/after"}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeBeforeAfter(idx)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600"
                          aria-label="Remove image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <MessageSquareQuote size={16} style={{ color: BRAND }} />
                Reviews
                <Badge variant="secondary" className="font-normal">
                  {reviews.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews scraped.</p>
              ) : (
                reviews.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <Input
                        value={r.reviewer_name ?? ""}
                        onChange={(e) =>
                          updateReview(idx, { reviewer_name: e.target.value })
                        }
                        placeholder="Reviewer name"
                        className="h-9 max-w-[240px]"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        step={1}
                        value={r.rating ?? ""}
                        onChange={(e) =>
                          updateReview(idx, {
                            rating:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        placeholder="★"
                        className="h-9 w-20"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => removeReview(idx)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    </div>
                    <textarea
                      value={r.body}
                      onChange={(e) =>
                        updateReview(idx, { body: e.target.value })
                      }
                      rows={3}
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Save bar */}
          <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
            {saveError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                {overwrite ? (
                  <span className="font-medium text-amber-600">
                    Overwrite mode — existing clinic will be replaced.
                  </span>
                ) : (
                  <span>Saving will create a new clinic.</span>
                )}
              </div>
              <Button
                variant="gradient"
                className="h-10 px-8"
                onClick={() => doSave(false)}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Save Clinic
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
