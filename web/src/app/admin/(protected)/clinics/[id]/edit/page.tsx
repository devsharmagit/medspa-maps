"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { adminGet, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Day = (typeof DAYS)[number];

interface DayHours {
  is_open: boolean;
  open: string;
  close: string;
}

type HoursState = Record<Day, DayHours>;

interface ImageRef {
  id: string;
  source_url: string;
  cdn_url: string | null;
  role: string;
  sort_order: number;
  alt_text: string | null;
}

interface TreatmentRef {
  id: string;
  service_id: string | null;
  raw_name: string;
  description: string | null;
  match_status: string | null;
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
  youtube_url: string | null;
  ext_rating: string | null;
  ext_review_count: number | null;
  is_active: boolean;
  images: ImageRef[];
  treatments: TreatmentRef[];
}

// Form state — everything is a string for controlled inputs; converted on save.
interface FormState {
  name: string;
  slug: string;
  website: string;
  booking_url: string;
  google_maps_url: string;
  about: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: string;
  lng: string;
  phone: string;
  email: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  ext_rating: string;
  ext_review_count: string;
}

function emptyHours(): HoursState {
  return DAYS.reduce((acc, d) => {
    acc[d] = { is_open: false, open: "09:00", close: "17:00" };
    return acc;
  }, {} as HoursState);
}

function parseHours(raw: Record<string, unknown> | null): HoursState {
  const state = emptyHours();
  if (!raw) return state;
  for (const day of DAYS) {
    const v = raw[day];
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      state[day] = {
        is_open:
          typeof o.is_open === "boolean"
            ? o.is_open
            : o.open != null || o.close != null,
        open: typeof o.open === "string" ? o.open : "09:00",
        close: typeof o.close === "string" ? o.close : "17:00",
      };
    }
  }
  return state;
}

function s(v: string | null | undefined): string {
  return v ?? "";
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

  const [clinicName, setClinicName] = useState("");
  const [images, setImages] = useState<ImageRef[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRef[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [hours, setHours] = useState<HoursState>(emptyHours());
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    website: "",
    booking_url: "",
    google_maps_url: "",
    about: "",
    tagline: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    lat: "",
    lng: "",
    phone: "",
    email: "",
    instagram_url: "",
    facebook_url: "",
    youtube_url: "",
    ext_rating: "",
    ext_review_count: "",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminGet<ClinicFull>(`/clinics/${id}`)
      .then((c) => {
        if (!active) return;
        setClinicName(c.name);
        setImages(c.images ?? []);
        setTreatments(c.treatments ?? []);
        setIsActive(c.is_active);
        setHours(parseHours(c.hours));
        setForm({
          name: s(c.name),
          slug: s(c.slug),
          website: s(c.website),
          booking_url: s(c.booking_url),
          google_maps_url: s(c.google_maps_url),
          about: s(c.about),
          tagline: s(c.tagline),
          address: s(c.address),
          city: s(c.city),
          state: s(c.state),
          zip: s(c.zip),
          lat: s(c.lat),
          lng: s(c.lng),
          phone: s(c.phone),
          email: s(c.email),
          instagram_url: s(c.instagram_url),
          facebook_url: s(c.facebook_url),
          youtube_url: s(c.youtube_url),
          ext_rating: c.ext_rating != null ? String(c.ext_rating) : "",
          ext_review_count:
            c.ext_review_count != null ? String(c.ext_review_count) : "",
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

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateDay(day: Day, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    setSaved(false);
  }

  function nullable(v: string): string | null {
    const t = v.trim();
    return t === "" ? null : t;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // hours JSONB: keep every day; persist is_open + open/close.
    const hoursPayload: Record<string, DayHours> = {};
    for (const day of DAYS) hoursPayload[day] = hours[day];

    const ratingStr = form.ext_rating.trim();
    const reviewStr = form.ext_review_count.trim();

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      slug: nullable(form.slug),
      website: form.website.trim(),
      booking_url: nullable(form.booking_url),
      google_maps_url: nullable(form.google_maps_url),
      about: nullable(form.about),
      tagline: nullable(form.tagline),
      address: nullable(form.address),
      city: nullable(form.city),
      state: nullable(form.state),
      zip: nullable(form.zip),
      lat: nullable(form.lat),
      lng: nullable(form.lng),
      phone: nullable(form.phone),
      email: nullable(form.email),
      instagram_url: nullable(form.instagram_url),
      facebook_url: nullable(form.facebook_url),
      youtube_url: nullable(form.youtube_url),
      hours: hoursPayload,
      ext_rating: ratingStr === "" ? null : Number(ratingStr),
      ext_review_count: reviewStr === "" ? null : parseInt(reviewStr, 10),
      is_active: isActive,
    };

    setSaving(true);
    try {
      await adminPatch(`/clinics/${id}`, payload);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading clinic...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
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
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              Edit {clinicName}
            </h2>
            <p className="text-xs text-slate-500 font-mono">{id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
          <Button
            type="submit"
            disabled={saving}
            className="bg-brand-purple hover:bg-brand-magenta text-white gap-2"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={14} />
            ) : (
              <Save size={14} />
            )}
            {saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Basics */}
          <Section title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={form.slug}
                  onChange={(e) => update("slug", e.target.value)}
                />
              </Field>
              <Field label="Website">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </Field>
              <Field label="Booking URL">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form.booking_url}
                  onChange={(e) => update("booking_url", e.target.value)}
                />
              </Field>
              <Field label="Google Maps URL">
                <Input
                  type="url"
                  placeholder="https://maps.app.goo.gl/..."
                  value={form.google_maps_url}
                  onChange={(e) => update("google_maps_url", e.target.value)}
                />
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <Input
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                />
              </Field>
              <Field label="About" className="sm:col-span-2">
                <textarea
                  value={form.about}
                  onChange={(e) => update("about", e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            </div>
          </Section>

          {/* Location */}
          <Section title="Location">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Address" className="sm:col-span-2">
                <Input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </Field>
              <Field label="City">
                <Input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </Field>
              <Field label="State">
                <Input
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </Field>
              <Field label="ZIP">
                <Input
                  value={form.zip}
                  onChange={(e) => update("zip", e.target.value)}
                />
              </Field>
              <div />
              <Field label="Latitude">
                <Input
                  inputMode="decimal"
                  value={form.lat}
                  onChange={(e) => update("lat", e.target.value)}
                />
              </Field>
              <Field label="Longitude">
                <Input
                  inputMode="decimal"
                  value={form.lng}
                  onChange={(e) => update("lng", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Contact / Social */}
          <Section title="Contact & Social">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>
              <Field label="Instagram URL">
                <Input
                  value={form.instagram_url}
                  onChange={(e) => update("instagram_url", e.target.value)}
                />
              </Field>
              <Field label="Facebook URL">
                <Input
                  value={form.facebook_url}
                  onChange={(e) => update("facebook_url", e.target.value)}
                />
              </Field>
              <Field label="YouTube URL" className="sm:col-span-2">
                <Input
                  value={form.youtube_url}
                  onChange={(e) => update("youtube_url", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Hours */}
          <Section title="Hours">
            <div className="flex flex-col divide-y divide-slate-100">
              {DAYS.map((day) => {
                const h = hours[day];
                return (
                  <div
                    key={day}
                    className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={h.is_open}
                        onChange={(e) =>
                          updateDay(day, { is_open: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-purple accent-brand-purple"
                      />
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {day}
                      </span>
                    </label>
                    {h.is_open ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={h.open}
                          onChange={(e) =>
                            updateDay(day, { open: e.target.value })
                          }
                          className="w-32"
                        />
                        <span className="text-slate-400 text-sm">to</span>
                        <Input
                          type="time"
                          value={h.close}
                          onChange={(e) =>
                            updateDay(day, { close: e.target.value })
                          }
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Publish */}
          <Section title="Publishing">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-slate-700">Published</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => {
                  setIsActive(e.target.checked);
                  setSaved(false);
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-purple accent-brand-purple"
              />
            </label>
            <p className="text-xs text-slate-400 mt-2">
              Unpublished clinics are hidden from the public site.
            </p>
          </Section>

          {/* Rating */}
          <Section title="Rating">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ext. Rating">
                <Input
                  inputMode="decimal"
                  placeholder="0–5"
                  value={form.ext_rating}
                  onChange={(e) => update("ext_rating", e.target.value)}
                />
              </Field>
              <Field label="Ext. Reviews">
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={form.ext_review_count}
                  onChange={(e) => update("ext_review_count", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Treatments offered (read-only) */}
          <Section
            title={
              <span className="flex items-center gap-2">
                <Sparkles size={15} className="text-brand-purple" />
                Treatments Offered
                <Badge variant="secondary" className="font-normal">
                  {treatments.length}
                </Badge>
              </span>
            }
          >
            {treatments.length === 0 ? (
              <p className="text-sm text-slate-400">No treatments listed.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {treatments.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {t.raw_name}
                    </p>
                    {t.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                        {t.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Gallery (read-only) */}
          <Section
            title={
              <span className="flex items-center gap-2">
                <ImageIcon size={15} className="text-brand-purple" />
                Gallery
                <Badge variant="secondary" className="font-normal">
                  {images.length}
                </Badge>
              </span>
            }
          >
            {images.length === 0 ? (
              <p className="text-sm text-slate-400">No images available.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-md overflow-hidden bg-slate-100 border border-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.cdn_url || img.source_url}
                      alt={img.alt_text || "Clinic image"}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 text-[9px] text-white truncate">
                      {img.role}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
        <CardTitle className="text-base font-semibold text-slate-800">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
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
      <Label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
