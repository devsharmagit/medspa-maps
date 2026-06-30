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
  Star,
  Stethoscope,
  HeartPulse,
  Building2,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { computeEditableCoverage } from "@/lib/treatments/coverage";
import { concernsTreatedBy } from "@/lib/taxonomy/canonical";

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
    maps_url: "",
    lat: null,
    lng: null,
    hours: null,
  };
}

type DayKey = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
interface DayHours { open: string; close: string; is_open: boolean; }
type LocationHoursMap = Partial<Record<DayKey, DayHours>>;
const DAYS: DayKey[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABELS: Record<DayKey, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
};

function parseHoursToState(hours: Record<string, unknown> | null | undefined): LocationHoursMap {
  if (!hours) return {};
  const result: LocationHoursMap = {};
  for (const day of DAYS) {
    const d = hours[day] as { open?: string; close?: string; is_open?: boolean } | undefined;
    if (d) result[day] = { open: d.open ?? '09:00', close: d.close ?? '17:00', is_open: d.is_open ?? true };
  }
  return result;
}

function hoursStateToJson(map: LocationHoursMap): Record<string, unknown> | null {
  const entries = Object.entries(map);
  if (!entries.length) return null;
  return Object.fromEntries(entries.map(([day, dh]) => [day, dh]));
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
  // Displayed rating / review-count override (→ clinics.ext_rating / ext_review_count).
  const [extRating, setExtRating] = useState<string>("");
  const [extReviewCount, setExtReviewCount] = useState<string>("");
  const [hoursState, setHoursState] = useState<Record<number, LocationHoursMap>>({});

  // business-level fields (sourced from locations[0] on scrape)
  const [businessTagline, setBusinessTagline] = useState('');
  const [businessAbout, setBusinessAbout] = useState('');
  const [businessSocials, setBusinessSocials] = useState({
    instagram_url: '', facebook_url: '', tiktok_url: '',
    youtube_url: '', x_url: '', linkedin_url: '', yelp_url: '', google_my_business: '',
  });

  // canonical services for the mapping dropdowns
  const [canonicalServices, setCanonicalServices] = useState<AdminService[]>([]);
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);

  // image UI state — cover tracked by URL so index shifts don't break it
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [galleryUrlInput, setGalleryUrlInput] = useState('');

  // treatments list collapse
  const [showAllTreatments, setShowAllTreatments] = useState(false);

  // Explicit, editable priority-treatment + concern selections for the coverage
  // card. Seeded from the scraped service mappings (and the concerns those
  // treatments derive) on fetch, then edited independently of the service rows.
  const [selectedTreatmentSlugs, setSelectedTreatmentSlugs] = useState<string[]>([]);
  const [selectedConcernSlugs, setSelectedConcernSlugs] = useState<string[]>([]);

  // create-treatment dialog
  const [createPrompt, setCreatePrompt] = useState<{ idx: number; name: string } | null>(null);

  // Live Phase-0 priority coverage from the admin's explicit selections.
  const coverage = useMemo(
    () => computeEditableCoverage(selectedTreatmentSlugs, selectedConcernSlugs),
    [selectedTreatmentSlugs, selectedConcernSlugs]
  );

  function addTreatment(slug: string) {
    setSelectedTreatmentSlugs((prev) =>
      prev.includes(slug) ? prev : [...prev, slug]
    );
  }

  function removeTreatment(slug: string) {
    setSelectedTreatmentSlugs((prev) => prev.filter((item) => item !== slug));
  }

  function addConcern(slug: string) {
    setSelectedConcernSlugs((prev) =>
      prev.includes(slug) ? prev : [...prev, slug]
    );
  }

  function removeConcern(slug: string) {
    setSelectedConcernSlugs((prev) => prev.filter((item) => item !== slug));
  }

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
      const initialServices = data.services.map((s) => ({
        ...s,
        mappedSlug: s.suggestion?.slug ?? "",
        ignored: Boolean(s.is_noise),
      }));
      setServices(initialServices);

      // Seed the editable coverage card from the scraped mappings: the priority
      // treatments those services resolve to, plus the concerns they derive.
      const seededTreatments = Array.from(
        new Set(
          initialServices
            .filter((s) => !s.ignored && s.mappedSlug)
            .map((s) => s.mappedSlug)
        )
      );
      setSelectedTreatmentSlugs(seededTreatments);
      setSelectedConcernSlugs(concernsTreatedBy(seededTreatments));
      const scrapedGallery = data.images?.gallery ?? [];
      setLogo(data.images?.logo ?? null);
      setGallery(scrapedGallery);
      setCoverUrl(scrapedGallery[0]?.source_url ?? null);
      setBeforeAfter([]); // before/after fetching disabled
      setReviews(data.reviews ?? []);
      setExtRating(data.ext_rating != null ? String(data.ext_rating) : "");
      setExtReviewCount(
        data.ext_review_count != null ? String(data.ext_review_count) : ""
      );
      setCanonicalServices(svc);

      // business-level socials / about / tagline from first location
      const firstLoc = (data.locations.length > 0 ? data.locations : [emptyLocation()])[0];
      setBusinessTagline(firstLoc.tagline ?? '');
      setBusinessAbout(firstLoc.about ?? '');
      setBusinessSocials({
        instagram_url: firstLoc.instagram_url ?? '',
        facebook_url: firstLoc.facebook_url ?? '',
        tiktok_url: firstLoc.tiktok_url ?? '',
        youtube_url: firstLoc.youtube_url ?? '',
        x_url: firstLoc.x_url ?? '',
        linkedin_url: firstLoc.linkedin_url ?? '',
        yelp_url: firstLoc.yelp_url ?? '',
        google_my_business: firstLoc.google_my_business ?? '',
      });

      // hours -> structured day map per location
      const hmap: Record<number, LocationHoursMap> = {};
      (data.locations.length > 0 ? data.locations : [emptyLocation()]).forEach(
        (l, i) => { hmap[i] = parseHoursToState(l.hours); }
      );
      setHoursState(hmap);

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
    setHoursState((prev) => ({ ...prev, [locations.length]: {} }));
  };
  const removeLocation = (idx: number) => {
    setLocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateHours = (locIdx: number, day: string, patch: Partial<DayHours>) => {
    setHoursState((prev) => ({
      ...prev,
      [locIdx]: {
        ...prev[locIdx],
        [day]: { open: '09:00', close: '17:00', is_open: true, ...prev[locIdx]?.[day as DayKey], ...patch },
      },
    }));
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
  const removeGallery = (idx: number) => {
    setGallery((prev) => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      if (removed?.source_url === coverUrl) {
        setCoverUrl(next[0]?.source_url ?? null);
      }
      return next;
    });
  };
  const removeBeforeAfter = (idx: number) =>
    setBeforeAfter((prev) => prev.filter((_, i) => i !== idx));

  // ── review editing ────────────────────────────────────────────────────────────
  const updateReview = (idx: number, patch: Partial<SaveReview>) =>
    setReviews((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  const removeReview = (idx: number) =>
    setReviews((prev) => prev.filter((_, i) => i !== idx));
  const addReview = () =>
    setReviews((prev) => [
      ...prev,
      { reviewer_name: "", rating: 5, body: "", source_url: null },
    ]);

  // ── build the save payload from the user's edits ──────────────────────────────
  const buildPayload = useCallback(() => {
    if (!preview) return null;

    const outLocations: SaveLocation[] = locations.map((l, i) => {
      const hmap = hoursState[i];
      const hours = hmap && Object.keys(hmap).length > 0 ? hoursStateToJson(hmap) : l.hours ?? null;
      return {
        ...l,
        ...businessSocials,
        about: businessAbout || l.about,
        tagline: businessTagline || l.tagline,
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

    // Reorder gallery so the selected cover (tracked by URL) is first
    const reorderedGallery = coverUrl
      ? [...gallery.filter((g) => g.source_url === coverUrl), ...gallery.filter((g) => g.source_url !== coverUrl)]
      : gallery;

    return {
      website: preview.website,
      business: { name: businessName.trim() || preview.business.name },
      locations: outLocations,
      services: outServices,
      images: {
        logo: logo ?? null,
        gallery: reorderedGallery,
        before_after: [],  // disabled
      },
      reviews: outReviews,
      ext_rating: extRating.trim() === "" ? null : Number(extRating),
      ext_review_count:
        extReviewCount.trim() === "" ? null : parseInt(extReviewCount, 10),
      treatment_slugs: selectedTreatmentSlugs,
      concern_slugs: selectedConcernSlugs,
    };
  }, [
    preview,
    locations,
    hoursState,
    services,
    reviews,
    extRating,
    extReviewCount,
    businessName,
    businessTagline,
    businessAbout,
    businessSocials,
    logo,
    gallery,
    coverUrl,
    beforeAfter,
    selectedTreatmentSlugs,
    selectedConcernSlugs,
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
                {result.servicesMatched + result.servicesAuto} treatments mapped
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

      {/* Create-treatment dialog */}
      {createPrompt && (
        <Dialog open onOpenChange={(open) => { if (!open) setCreatePrompt(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create new treatment</DialogTitle>
              <DialogDescription>
                This will add a new canonical treatment to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <Field label="Treatment name">
                <Input
                  value={createPrompt.name}
                  onChange={(e) => setCreatePrompt((p) => p ? { ...p, name: e.target.value } : null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && createPrompt.name.trim()) {
                      createServiceForRow(createPrompt.idx, createPrompt.name);
                      setCreatePrompt(null);
                    }
                  }}
                  autoFocus
                  className="h-9"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreatePrompt(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="gradient"
                disabled={!createPrompt.name.trim() || creatingIdx !== null}
                onClick={() => {
                  createServiceForRow(createPrompt.idx, createPrompt.name);
                  setCreatePrompt(null);
                }}
              >
                {creatingIdx !== null ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Create Treatment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <CardContent className="flex flex-col gap-5 p-6">
              <Field label="Business name">
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-10" />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Tagline">
                    <Input
                      value={businessTagline}
                      onChange={(e) => setBusinessTagline(e.target.value)}
                      placeholder="Short pitch shown on clinic page"
                      className="h-9"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="About">
                    <textarea
                      value={businessAbout}
                      onChange={(e) => setBusinessAbout(e.target.value)}
                      rows={4}
                      placeholder="Clinic description…"
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </Field>
                </div>

                <Field label="Instagram">
                  <Input value={businessSocials.instagram_url} onChange={(e) => setBusinessSocials(p => ({ ...p, instagram_url: e.target.value }))} className="h-9" placeholder="https://instagram.com/…" />
                </Field>
                <Field label="Facebook">
                  <Input value={businessSocials.facebook_url} onChange={(e) => setBusinessSocials(p => ({ ...p, facebook_url: e.target.value }))} className="h-9" placeholder="https://facebook.com/…" />
                </Field>
                <Field label="TikTok">
                  <Input value={businessSocials.tiktok_url} onChange={(e) => setBusinessSocials(p => ({ ...p, tiktok_url: e.target.value }))} className="h-9" placeholder="https://tiktok.com/@…" />
                </Field>
                <Field label="YouTube">
                  <Input value={businessSocials.youtube_url} onChange={(e) => setBusinessSocials(p => ({ ...p, youtube_url: e.target.value }))} className="h-9" placeholder="https://youtube.com/…" />
                </Field>
                <Field label="X (Twitter)">
                  <Input value={businessSocials.x_url} onChange={(e) => setBusinessSocials(p => ({ ...p, x_url: e.target.value }))} className="h-9" placeholder="https://x.com/…" />
                </Field>
                <Field label="LinkedIn">
                  <Input value={businessSocials.linkedin_url} onChange={(e) => setBusinessSocials(p => ({ ...p, linkedin_url: e.target.value }))} className="h-9" placeholder="https://linkedin.com/…" />
                </Field>
                <Field label="Yelp">
                  <Input value={businessSocials.yelp_url} onChange={(e) => setBusinessSocials(p => ({ ...p, yelp_url: e.target.value }))} className="h-9" placeholder="https://yelp.com/biz/…" />
                </Field>
                <Field label="Google My Business">
                  <Input value={businessSocials.google_my_business} onChange={(e) => setBusinessSocials(p => ({ ...p, google_my_business: e.target.value }))} className="h-9" placeholder="https://maps.google.com/…" />
                </Field>
              </div>
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
                      <Field label="Hours">
                        <div className="mt-1 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                          {DAYS.map((day) => {
                            const dh = hoursState[idx]?.[day];
                            return (
                              <div key={day} className="flex items-center gap-3">
                                <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={dh?.is_open ?? false}
                                    onChange={(e) => updateHours(idx, day, { is_open: e.target.checked })}
                                    className="size-3.5 rounded border-slate-300 accent-[#9b3a9b]"
                                  />
                                  <span className="text-xs font-medium text-slate-700">{DAY_LABELS[day]}</span>
                                </label>
                                {dh?.is_open ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="time"
                                      value={dh.open}
                                      onChange={(e) => updateHours(idx, day, { open: e.target.value })}
                                      className="h-7 w-28 text-xs"
                                    />
                                    <span className="text-xs text-slate-400">to</span>
                                    <Input
                                      type="time"
                                      value={dh.close}
                                      onChange={(e) => updateHours(idx, day, { close: e.target.value })}
                                      className="h-7 w-28 text-xs"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs italic text-slate-400">Closed</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
                  {coverage.treatmentCount} / {coverage.treatmentTotal}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Which of the {coverage.treatmentTotal} priority treatments this
                clinic offers, and the concerns it treats. Seeded from the
                scraped mappings — click a chip to add or remove.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 p-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Offered ({coverage.presentTreatments.length})
                </p>
                {coverage.presentTreatments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No priority treatments selected yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {coverage.presentTreatments.map((t) => (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => removeTreatment(t.slug)}
                        className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        title="Remove treatment"
                      >
                        <CheckCircle2 size={12} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {coverage.missingTreatments.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Not offered ({coverage.missingTreatments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coverage.missingTreatments.map((t) => (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => addTreatment(t.slug)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        title="Add treatment"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Treats these concerns ({coverage.presentConcerns.length})
                </p>
                {coverage.presentConcerns.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No priority concerns selected yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {coverage.presentConcerns.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => removeConcern(c.slug)}
                        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        style={{
                          borderColor: `${BRAND}4d`,
                          backgroundColor: `${BRAND}1a`,
                          color: BRAND,
                        }}
                        title="Remove concern"
                      >
                        <HeartPulse size={12} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {coverage.missingConcerns.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Add a concern ({coverage.missingConcerns.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coverage.missingConcerns.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => addConcern(c.slug)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-[#9b3a9b]/40 hover:bg-[#9b3a9b]/10 hover:text-[#9b3a9b]"
                        title="Add concern"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Treatments */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Stethoscope size={16} style={{ color: BRAND }} />
                Treatments
                <Badge variant="secondary" className="font-normal">
                  {services.filter((s) => !s.ignored).length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Matched treatments map automatically. For unmatched ones, pick a
                canonical treatment or mark them ignored.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {services.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No services scraped.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {(() => {
                    const sortedServices = [...services].map((s, i) => ({ ...s, originalIdx: i })).sort((a, b) => {
                      const aResolved = Boolean(a.suggestion?.slug) || Boolean(a.mappedSlug);
                      const bResolved = Boolean(b.suggestion?.slug) || Boolean(b.mappedSlug);
                      if (aResolved !== bResolved) return aResolved ? -1 : 1;
                      return 0;
                    });
                    const visibleServices = services.length > 10 && !showAllTreatments
                      ? sortedServices.slice(0, 10)
                      : sortedServices;
                    return (
                      <>
                        {visibleServices.map((item) => {
                          const s = item;
                          const idx = item.originalIdx;
                          const matched = Boolean(s.suggestion?.slug);
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
                                      Unmatched — map to a canonical treatment
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
                                        placeholder="Map to treatment…"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setCreatePrompt({ idx, name: s.raw_name })}
                                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[#9b3a9b] hover:underline"
                                    >
                                      <Plus size={13} />
                                      Create a new treatment for this
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
                        {services.length > 10 && (
                          <div className="flex justify-center p-3">
                            <button
                              type="button"
                              onClick={() => setShowAllTreatments((v) => !v)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                            >
                              {showAllTreatments ? (
                                <><ChevronUp size={14} /> Show less</>
                              ) : (
                                <><ChevronDown size={14} /> Show all {services.length} treatments</>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                <div className="mt-3 flex gap-2">
                  <Input
                    type="url"
                    placeholder="Or paste logo URL…"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && logoUrlInput.trim()) {
                        setLogo({ source_url: logoUrlInput.trim(), alt_text: null });
                        setLogoUrlInput('');
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs"
                    onClick={() => { if (logoUrlInput.trim()) { setLogo({ source_url: logoUrlInput.trim(), alt_text: null }); setLogoUrlInput(''); }}}
                  >
                    Set Logo
                  </Button>
                </div>
              </div>

              {/* Gallery */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Gallery ({gallery.length})
                </p>
                <p className="mb-2 text-xs text-slate-400">
                  The cover image (★) appears first on search results.
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
                        <button
                          type="button"
                          onClick={() => setCoverUrl(img.source_url)}
                          className={`absolute left-1.5 bottom-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${
                            coverUrl === img.source_url
                              ? 'bg-amber-400 text-white'
                              : 'bg-black/40 text-white hover:bg-black/60'
                          }`}
                          title={coverUrl === img.source_url ? 'Cover image' : 'Set as cover'}
                        >
                          {coverUrl === img.source_url ? '★ Cover' : 'Set cover'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Input
                    type="url"
                    placeholder="Add image by URL…"
                    value={galleryUrlInput}
                    onChange={(e) => setGalleryUrlInput(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && galleryUrlInput.trim()) {
                        setGallery((prev) => [...prev, { source_url: galleryUrlInput.trim(), alt_text: null }]);
                        setGalleryUrlInput('');
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs"
                    onClick={() => { if (galleryUrlInput.trim()) { setGallery(prev => [...prev, { source_url: galleryUrlInput.trim(), alt_text: null }]); setGalleryUrlInput(''); }}}
                  >
                    Add Image
                  </Button>
                </div>
              </div>

              {/* Before / after */}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Before / After
                </p>
                <p className="text-xs text-slate-400 italic">
                  Before/after image fetching is currently disabled. This section can be enabled in a future update.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <MessageSquareQuote size={16} style={{ color: BRAND }} />
                Reviews
                <Badge variant="secondary" className="font-normal">
                  {reviews.length}
                </Badge>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addReview}
              >
                <Plus size={14} /> Add review
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              {/* Displayed rating & review-count override */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Star size={14} style={{ color: BRAND }} />
                  Displayed rating &amp; review count
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Shown on the public clinic page. Prefilled from the scrape —
                  edit as needed. Leave blank to use the value computed from the
                  reviews below.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ext-rating">Rating (0–5)</Label>
                    <Input
                      id="ext-rating"
                      inputMode="decimal"
                      value={extRating}
                      onChange={(e) => setExtRating(e.target.value)}
                      placeholder="e.g. 4.8"
                      className="h-9"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ext-count">Review count</Label>
                    <Input
                      id="ext-count"
                      inputMode="numeric"
                      value={extReviewCount}
                      onChange={(e) => setExtReviewCount(e.target.value)}
                      placeholder="e.g. 312"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {reviews.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No reviews yet. Click “Add review” to create one.
                </p>
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
