"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  HeartPulse,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  adminPut,
} from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeEditableCoverage } from "@/lib/treatments/coverage";
import { ClinicReviewsManager } from "@/components/admin/clinic-reviews-manager";

const BRAND = "#9b3a9b";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABELS: Record<Day, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

type Day = (typeof DAYS)[number];

interface DayHours {
  is_open: boolean;
  open: string;
  close: string;
}

type HoursState = Record<Day, DayHours>;

interface ImageRef {
  id?: string;
  source_url: string;
  cdn_url?: string | null;
  role?: string;
  sort_order?: number;
  alt_text?: string | null;
}

interface TreatmentRef {
  id: string;
  service_id: string | null;
  service_slug: string | null;
  service_name: string | null;
  raw_name: string;
  description: string | null;
  match_status: string | null;
}

interface LocationRef {
  id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  hours: Record<string, unknown> | null;
  is_primary: boolean;
  sort_order: number;
}

interface ClinicFull {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  website: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  email: string | null;
  hours: Record<string, unknown> | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  yelp_url: string | null;
  google_my_business: string | null;
  ext_rating: string | null;
  ext_review_count: number | null;
  founded_year: number | null;
  is_active: boolean;
  images: ImageRef[];
  treatments: TreatmentRef[];
  locations: LocationRef[];
  service_slugs?: string[];
  effective_concern_slugs?: string[];
}

interface FormState {
  name: string;
  slug: string;
  website: string;
  about: string;
  tagline: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  x_url: string;
  linkedin_url: string;
  yelp_url: string;
  google_my_business: string;
  ext_rating: string;
  ext_review_count: string;
  founded_year: string;
}

interface LocationForm {
  id?: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: string;
  lng: string;
  phone: string;
  email: string;
  booking_url: string;
  google_maps_url: string;
  hours: HoursState;
  is_primary: boolean;
  sort_order: number;
}

function emptyHours(): HoursState {
  return DAYS.reduce((acc, d) => {
    acc[d] = { is_open: false, open: "09:00", close: "17:00" };
    return acc;
  }, {} as HoursState);
}

function parseHours(raw: Record<string, unknown> | null | undefined): HoursState {
  const state = emptyHours();
  if (!raw) return state;
  for (const day of DAYS) {
    const value = raw[day] ?? raw[day.toLowerCase()];
    if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      state[day] = {
        is_open:
          typeof o.is_open === "boolean"
            ? o.is_open
            : o.open != null || o.close != null,
        open: typeof o.open === "string" && o.open ? o.open : "09:00",
        close: typeof o.close === "string" && o.close ? o.close : "17:00",
      };
    }
  }
  return state;
}

function hoursPayload(hours: HoursState): Record<string, DayHours> {
  return DAYS.reduce((acc, day) => {
    acc[day] = hours[day];
    return acc;
  }, {} as Record<string, DayHours>);
}

function s(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

function nullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function numberOrNull(v: string): number | null {
  const t = v.trim();
  return t === "" ? null : Number(t);
}

function emptyLocation(sortOrder: number): LocationForm {
  return {
    label: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    lat: "",
    lng: "",
    phone: "",
    email: "",
    booking_url: "",
    google_maps_url: "",
    hours: emptyHours(),
    is_primary: sortOrder === 0,
    sort_order: sortOrder,
  };
}

function fromLocationRef(loc: LocationRef, sortOrder: number): LocationForm {
  return {
    id: loc.id,
    label: s(loc.label),
    address: s(loc.address),
    city: s(loc.city),
    state: s(loc.state),
    zip: s(loc.zip),
    country: s(loc.country) || "US",
    lat: s(loc.lat),
    lng: s(loc.lng),
    phone: s(loc.phone),
    email: s(loc.email),
    booking_url: s(loc.booking_url),
    google_maps_url: s(loc.google_maps_url),
    hours: parseHours(loc.hours),
    is_primary: loc.is_primary,
    sort_order: loc.sort_order ?? sortOrder,
  };
}

function fromClinicFallback(c: ClinicFull): LocationForm {
  return {
    ...emptyLocation(0),
    address: s(c.address),
    city: s(c.city),
    state: s(c.state),
    zip: s(c.zip),
    country: s(c.country) || "US",
    lat: s(c.lat),
    lng: s(c.lng),
    phone: s(c.phone),
    email: s(c.email),
    booking_url: s(c.booking_url),
    google_maps_url: s(c.google_maps_url),
    hours: parseHours(c.hours),
    is_primary: true,
  };
}

export default function EditClinicPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [selectedTreatmentSlugs, setSelectedTreatmentSlugs] = useState<string[]>([]);
  const [selectedConcernSlugs, setSelectedConcernSlugs] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [locations, setLocations] = useState<LocationForm[]>([]);
  const [deletedLocationIds, setDeletedLocationIds] = useState<string[]>([]);
  const [logo, setLogo] = useState<ImageRef | null>(null);
  const [gallery, setGallery] = useState<ImageRef[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    website: "",
    about: "",
    tagline: "",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
    youtube_url: "",
    x_url: "",
    linkedin_url: "",
    yelp_url: "",
    google_my_business: "",
    ext_rating: "",
    ext_review_count: "",
    founded_year: "",
  });

  useEffect(() => {
    let active = true;
    adminGet<ClinicFull>(`/clinics/${id}`)
      .then((c) => {
        if (!active) return;
        const loadedLocations =
          c.locations && c.locations.length > 0
            ? c.locations.map(fromLocationRef)
            : [fromClinicFallback(c)];
        if (!loadedLocations.some((loc) => loc.is_primary)) {
          loadedLocations[0].is_primary = true;
        }

        const logoImage = (c.images ?? []).find((img) => img.role === "logo") ?? null;
        const galleryImages = (c.images ?? [])
          .filter((img) => img.role === "cover" || img.role === "gallery")
          .sort((a, b) => {
            if (a.role !== b.role) return a.role === "cover" ? -1 : 1;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
          });

        setSelectedTreatmentSlugs(
          Array.from(
            new Set(
              (c.treatments ?? [])
                .map((t) => t.service_slug)
                .filter((slug): slug is string => Boolean(slug))
            )
          )
        );
        setSelectedConcernSlugs(
          Array.from(new Set(c.effective_concern_slugs ?? []))
        );
        setIsActive(c.is_active);
        setLocations(loadedLocations);
        setDeletedLocationIds([]);
        setLogo(logoImage);
        setGallery(galleryImages);
        setCoverUrl(galleryImages[0]?.source_url ?? null);
        setLogoUrlInput("");
        setGalleryUrlInput("");
        setForm({
          name: s(c.name),
          slug: s(c.slug),
          website: s(c.website),
          about: s(c.about),
          tagline: s(c.tagline),
          instagram_url: s(c.instagram_url),
          facebook_url: s(c.facebook_url),
          tiktok_url: s(c.tiktok_url),
          youtube_url: s(c.youtube_url),
          x_url: s(c.x_url),
          linkedin_url: s(c.linkedin_url),
          yelp_url: s(c.yelp_url),
          google_my_business: s(c.google_my_business),
          ext_rating: s(c.ext_rating),
          ext_review_count: s(c.ext_review_count),
          founded_year: s(c.founded_year),
        });
        setError(null);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const primaryLocation = useMemo(
    () => locations.find((loc) => loc.is_primary) ?? locations[0],
    [locations]
  );

  const coverage = useMemo(
    () => computeEditableCoverage(selectedTreatmentSlugs, selectedConcernSlugs),
    [selectedTreatmentSlugs, selectedConcernSlugs]
  );

  function markDirty() {
    setSaved(false);
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  function updateLocation(idx: number, patch: Partial<LocationForm>) {
    setLocations((prev) =>
      prev.map((loc, i) => (i === idx ? { ...loc, ...patch } : loc))
    );
    markDirty();
  }

  function updateLocationDay(idx: number, day: Day, patch: Partial<DayHours>) {
    setLocations((prev) =>
      prev.map((loc, i) =>
        i === idx
          ? {
              ...loc,
              hours: {
                ...loc.hours,
                [day]: { ...loc.hours[day], ...patch },
              },
            }
          : loc
      )
    );
    markDirty();
  }

  function addLocation() {
    setLocations((prev) => [...prev, emptyLocation(prev.length)]);
    markDirty();
  }

  function removeLocation(idx: number) {
    setLocations((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[idx];
      if (removed?.id) {
        setDeletedLocationIds((ids) => [...ids, removed.id!]);
      }
      const next = prev.filter((_, i) => i !== idx);
      if (!next.some((loc) => loc.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next.map((loc, i) => ({ ...loc, sort_order: i }));
    });
    markDirty();
  }

  function makePrimary(idx: number) {
    setLocations((prev) =>
      prev.map((loc, i) => ({ ...loc, is_primary: i === idx }))
    );
    markDirty();
  }

  function addLogoFromInput() {
    const url = logoUrlInput.trim();
    if (!url) return;
    setLogo({ source_url: url, alt_text: null, role: "logo", sort_order: 0 });
    setLogoUrlInput("");
    markDirty();
  }

  function addGalleryFromInput() {
    const url = galleryUrlInput.trim();
    if (!url) return;
    setGallery((prev) => {
      const next = [...prev, { source_url: url, alt_text: null, role: "gallery", sort_order: prev.length }];
      if (!coverUrl) setCoverUrl(url);
      return next;
    });
    setGalleryUrlInput("");
    markDirty();
  }

  function removeGallery(idx: number) {
    setGallery((prev) => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      if (removed?.source_url === coverUrl) {
        setCoverUrl(next[0]?.source_url ?? null);
      }
      return next;
    });
    markDirty();
  }

  function addTreatment(slug: string) {
    setSelectedTreatmentSlugs((prev) =>
      prev.includes(slug) ? prev : [...prev, slug]
    );
    markDirty();
  }

  function removeTreatment(slug: string) {
    setSelectedTreatmentSlugs((prev) => prev.filter((item) => item !== slug));
    markDirty();
  }

  function addConcern(slug: string) {
    setSelectedConcernSlugs((prev) =>
      prev.includes(slug) ? prev : [...prev, slug]
    );
    markDirty();
  }

  function removeConcern(slug: string) {
    setSelectedConcernSlugs((prev) => prev.filter((item) => item !== slug));
    markDirty();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (locations.length === 0 || !primaryLocation) {
      setError("At least one location is required.");
      return;
    }

    const normalizedLocations = locations.map((loc, idx) => ({
      ...loc,
      is_primary: locations.length === 1 ? idx === 0 : loc.is_primary,
      sort_order: idx,
    }));
    const primary =
      normalizedLocations.find((loc) => loc.is_primary) ?? normalizedLocations[0];
    const ratingStr = form.ext_rating.trim();
    const reviewStr = form.ext_review_count.trim();
    const foundedStr = form.founded_year.trim();

    const clinicPayload: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      website: form.website.trim(),
      booking_url: nullable(primary.booking_url),
      google_maps_url: nullable(primary.google_maps_url),
      about: nullable(form.about),
      tagline: nullable(form.tagline),
      address: nullable(primary.address),
      city: nullable(primary.city),
      state: nullable(primary.state),
      zip: nullable(primary.zip),
      country: nullable(primary.country) ?? "US",
      lat: numberOrNull(primary.lat),
      lng: numberOrNull(primary.lng),
      phone: nullable(primary.phone),
      email: nullable(primary.email),
      instagram_url: nullable(form.instagram_url),
      facebook_url: nullable(form.facebook_url),
      tiktok_url: nullable(form.tiktok_url),
      youtube_url: nullable(form.youtube_url),
      x_url: nullable(form.x_url),
      linkedin_url: nullable(form.linkedin_url),
      yelp_url: nullable(form.yelp_url),
      google_my_business: nullable(form.google_my_business),
      hours: hoursPayload(primary.hours),
      ext_rating: ratingStr === "" ? null : Number(ratingStr),
      ext_review_count: reviewStr === "" ? null : parseInt(reviewStr, 10),
      founded_year: foundedStr === "" ? null : parseInt(foundedStr, 10),
      is_active: isActive,
    };

    const imageGallery = coverUrl
      ? [
          ...gallery.filter((img) => img.source_url === coverUrl),
          ...gallery.filter((img) => img.source_url !== coverUrl),
        ]
      : gallery;

    setSaving(true);
    try {
      await adminPatch(`/clinics/${id}`, clinicPayload);

      for (const loc of normalizedLocations) {
        const payload = {
          label: nullable(loc.label),
          address: nullable(loc.address),
          city: nullable(loc.city),
          state: nullable(loc.state),
          zip: nullable(loc.zip),
          country: nullable(loc.country) ?? "US",
          lat: numberOrNull(loc.lat),
          lng: numberOrNull(loc.lng),
          phone: nullable(loc.phone),
          email: nullable(loc.email),
          booking_url: nullable(loc.booking_url),
          google_maps_url: nullable(loc.google_maps_url),
          hours: hoursPayload(loc.hours),
          is_primary: loc.is_primary,
        };
        if (loc.id) {
          await adminPatch(`/clinics/${id}/locations/${loc.id}`, payload);
        } else {
          await adminPost(`/clinics/${id}/locations`, payload);
        }
      }

      for (const locId of deletedLocationIds) {
        await adminDelete(`/clinics/${id}/locations/${locId}`);
      }

      await adminPatch(`/clinics/${id}/images`, {
        logo: logo
          ? { source_url: logo.source_url, alt_text: logo.alt_text ?? null }
          : null,
        gallery: imageGallery.map((img) => ({
          source_url: img.source_url,
          alt_text: img.alt_text ?? null,
        })),
      });

      await adminPut<TreatmentRef[]>(`/clinics/${id}/services`, {
        service_slugs: selectedTreatmentSlugs,
      });

      await adminPut(`/clinics/${id}/concerns`, {
        concern_slugs: selectedConcernSlugs,
      });

      setSaved(true);
      setDeletedLocationIds([]);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
        <Loader2 size={18} className="animate-spin" /> Loading clinic...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="mx-auto flex max-w-5xl flex-col gap-6 pb-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/clinics">
            <Button
              type="button"
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
              Edit Clinic
            </h2>
            <p className="text-sm text-slate-500">
              Update the same clinic draft fields used by the add clinic flow.
            </p>
          </div>
        </div>
        {form.slug && (
          <Button
            asChild
            type="button"
            variant="outline"
            className="gap-1.5 border-slate-200 text-slate-700"
          >
            <Link
              href={`/clinics/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> View public
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Building2 size={16} style={{ color: BRAND }} />
            Business
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-6">
          <Field label="Business name">
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="h-10"
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
                className="h-9"
              />
            </Field>
            <Field label="Website">
              <Input
                type="url"
                placeholder="https://..."
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                className="h-9"
              />
            </Field>
            <Field label="Founded Year">
              <Input
                inputMode="numeric"
                placeholder="e.g. 2018"
                value={form.founded_year}
                onChange={(e) => update("founded_year", e.target.value)}
                className="h-9"
              />
            </Field>
            <Field label="Published">
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => {
                    setIsActive(e.target.checked);
                    markDirty();
                  }}
                  className="size-4 rounded border-slate-300 accent-[#9b3a9b]"
                />
                Visible on public site
              </label>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tagline">
                <Input
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  placeholder="Short pitch shown on clinic page"
                  className="h-9"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="About">
                <textarea
                  value={form.about}
                  onChange={(e) => update("about", e.target.value)}
                  rows={4}
                  placeholder="Clinic description..."
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            </div>

            <Field label="Instagram">
              <Input value={form.instagram_url} onChange={(e) => update("instagram_url", e.target.value)} className="h-9" placeholder="https://instagram.com/..." />
            </Field>
            <Field label="Facebook">
              <Input value={form.facebook_url} onChange={(e) => update("facebook_url", e.target.value)} className="h-9" placeholder="https://facebook.com/..." />
            </Field>
            <Field label="TikTok">
              <Input value={form.tiktok_url} onChange={(e) => update("tiktok_url", e.target.value)} className="h-9" placeholder="https://tiktok.com/@..." />
            </Field>
            <Field label="YouTube">
              <Input value={form.youtube_url} onChange={(e) => update("youtube_url", e.target.value)} className="h-9" placeholder="https://youtube.com/..." />
            </Field>
            <Field label="X (Twitter)">
              <Input value={form.x_url} onChange={(e) => update("x_url", e.target.value)} className="h-9" placeholder="https://x.com/..." />
            </Field>
            <Field label="LinkedIn">
              <Input value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} className="h-9" placeholder="https://linkedin.com/..." />
            </Field>
            <Field label="Yelp">
              <Input value={form.yelp_url} onChange={(e) => update("yelp_url", e.target.value)} className="h-9" placeholder="https://yelp.com/biz/..." />
            </Field>
            <Field label="Google My Business">
              <Input value={form.google_my_business} onChange={(e) => update("google_my_business", e.target.value)} className="h-9" placeholder="https://maps.google.com/..." />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <MapPin size={16} style={{ color: BRAND }} />
            Locations
            <Badge variant="secondary" className="font-normal">
              {locations.length}
            </Badge>
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLocation}>
            <Plus size={14} /> Add location
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-6">
          {locations.map((loc, idx) => (
            <div
              key={loc.id ?? `new-${idx}`}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Location {idx + 1}
                    {loc.city ? ` - ${loc.city}` : ""}
                  </span>
                  {loc.is_primary && (
                    <Badge
                      variant="secondary"
                      className="font-normal"
                      style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                    >
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!loc.is_primary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      onClick={() => makePrimary(idx)}
                    >
                      Set primary
                    </Button>
                  )}
                  {locations.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeLocation(idx)}
                    >
                      <Trash2 size={14} /> Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone">
                  <Input value={loc.phone} onChange={(e) => updateLocation(idx, { phone: e.target.value })} className="h-9" />
                </Field>
                <Field label="Address">
                  <Input value={loc.address} onChange={(e) => updateLocation(idx, { address: e.target.value })} className="h-9" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="City">
                    <Input value={loc.city} onChange={(e) => updateLocation(idx, { city: e.target.value })} className="h-9" />
                  </Field>
                  <Field label="State">
                    <Input value={loc.state} onChange={(e) => updateLocation(idx, { state: e.target.value })} className="h-9" />
                  </Field>
                  <Field label="Zip">
                    <Input value={loc.zip} onChange={(e) => updateLocation(idx, { zip: e.target.value })} className="h-9" />
                  </Field>
                </div>
                <Field label="Booking URL">
                  <Input value={loc.booking_url} onChange={(e) => updateLocation(idx, { booking_url: e.target.value })} className="h-9" />
                </Field>
                <Field label="Maps URL">
                  <Input value={loc.google_maps_url} onChange={(e) => updateLocation(idx, { google_maps_url: e.target.value })} className="h-9" />
                </Field>
                <Field label="Latitude">
                  <Input value={loc.lat} onChange={(e) => updateLocation(idx, { lat: e.target.value })} className="h-9" />
                </Field>
                <Field label="Longitude">
                  <Input value={loc.lng} onChange={(e) => updateLocation(idx, { lng: e.target.value })} className="h-9" />
                </Field>
                <div className="sm:col-span-2">
                  <HoursEditor hours={loc.hours} onChange={(day, patch) => updateLocationDay(idx, day, patch)} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <ImageIcon size={16} style={{ color: BRAND }} />
            Images
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 p-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Logo
            </p>
            {logo ? (
              <div className="group relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.cdn_url || logo.source_url} alt={logo.alt_text || "Logo"} className="size-24 rounded-lg border border-slate-200 bg-white object-contain p-2" />
                <button type="button" onClick={() => { setLogo(null); markDirty(); }} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600" aria-label="Remove logo">
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No logo.</p>
            )}
            <div className="mt-3 flex gap-2">
              <Input type="url" placeholder="Or paste logo URL..." value={logoUrlInput} onChange={(e) => setLogoUrlInput(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter" && logoUrlInput.trim()) { e.preventDefault(); addLogoFromInput(); } }} />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={addLogoFromInput}>Set Logo</Button>
            </div>
          </div>

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
                  <div key={`${img.source_url}-${idx}`} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.cdn_url || img.source_url} alt={img.alt_text || "Gallery"} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeGallery(idx)} className="absolute right-1.5 top-1.5 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600" aria-label="Remove image">
                      <Trash2 size={12} />
                    </button>
                    <button type="button" onClick={() => { setCoverUrl(img.source_url); markDirty(); }} className={`absolute left-1.5 bottom-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${coverUrl === img.source_url ? "bg-amber-400 text-white" : "bg-black/40 text-white hover:bg-black/60"}`} title={coverUrl === img.source_url ? "Cover image" : "Set as cover"}>
                      {coverUrl === img.source_url ? "★ Cover" : "Set cover"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Input type="url" placeholder="Add image by URL..." value={galleryUrlInput} onChange={(e) => setGalleryUrlInput(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter" && galleryUrlInput.trim()) { e.preventDefault(); addGalleryFromInput(); } }} />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={addGalleryFromInput}>Add Image</Button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Before / After
            </p>
            <p className="text-xs italic text-slate-400">
              Before/after image fetching is currently disabled. This section can be enabled in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

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
          <p className="text-xs text-slate-500">
            Which of the {coverage.treatmentTotal} priority treatments this clinic offers, and the concerns it treats. Click a chip to add or remove.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Offered ({coverage.presentTreatments.length})
            </p>
            {coverage.presentTreatments.length === 0 ? (
              <p className="text-sm text-slate-500">No priority treatments selected yet.</p>
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
              <p className="text-sm text-slate-500">No priority concerns selected yet.</p>
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

      <ClinicReviewsManager clinicId={id} />

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            <span>Saving will update this clinic and its locations.</span>
          </div>
          <Button type="submit" variant="gradient" className="h-10 px-8" disabled={saving}>
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 size={16} /> Saved</>
            ) : (
              <><CheckCircle2 size={16} /> Save Clinic</>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
function HoursEditor({
  hours,
  onChange,
}: {
  hours: HoursState;
  onChange: (day: Day, patch: Partial<DayHours>) => void;
}) {
  return (
    <Field label="Hours">
      <div className="mt-1 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        {DAYS.map((day) => {
          const h = hours[day];
          return (
            <div key={day} className="flex items-center gap-3">
              <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={h.is_open}
                  onChange={(e) => onChange(day, { is_open: e.target.checked })}
                  className="size-3.5 rounded border-slate-300 accent-brand-purple"
                />
                <span className="text-xs font-medium text-slate-700">
                  {DAY_LABELS[day]}
                </span>
              </label>
              {h.is_open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h.open}
                    onChange={(e) => onChange(day, { open: e.target.value })}
                    className="h-7 w-28 text-xs"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <Input
                    type="time"
                    value={h.close}
                    onChange={(e) => onChange(day, { close: e.target.value })}
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
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
