"use client";

import { useState, useEffect, use as usePromise } from "react";
import Link from "next/link";
import {
  DatabaseZap,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Building2,
  MapPin,
  CheckCircle2,
  Download,
  ExternalLink,
  Stethoscope,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminGet } from "@/lib/admin/client";

const BRAND = "#9b3a9b";

type ImportState = "imported" | "domain-match" | "new";
interface ImportedInfo {
  state: ImportState;
  clinicId: string | null;
  slug: string | null;
}
interface G99Service {
  service_id: string;
  name: string | null;
  category: string | null;
}
interface G99Clinic {
  clinic_id: string;
  name: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_number: string | null;
  about: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  yelp_url: string | null;
  appointment_url: string | null;
  clinic_url: string | null;
  services?: G99Service[];
}
interface G99BusinessDetail {
  business_id: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  is_test: boolean;
  is_internal: boolean;
  clinics: G99Clinic[];
  imported: Record<string, ImportedInfo>;
}

function DetailRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-words text-sm text-purple-600 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="break-words text-sm text-slate-700">{value}</span>
      )}
    </div>
  );
}

export default function G99BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [biz, setBiz] = useState<G99BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminGet<G99BusinessDetail>(`/g99/businesses/${id}`);
        if (!cancelled) setBiz(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load G99 business.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-16">
      <div className="flex items-center gap-3">
        <Link href="/admin/g99">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <DatabaseZap size={18} style={{ color: BRAND }} />
          G99 Business Detail
        </h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {biz && (
        <>
          {/* Business card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Building2 size={16} style={{ color: BRAND }} />
                {biz.name || `Business #${biz.business_id}`}
                {(biz.is_test || biz.is_internal) && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                    {biz.is_test ? "test" : "internal"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="G99 business id" value={biz.business_id} />
              <DetailRow label="Website" value={biz.website} href={biz.website ?? undefined} />
              <DetailRow label="Phone" value={biz.phone} />
              <DetailRow label="City" value={biz.city} />
              <DetailRow label="State" value={biz.state} />
              <DetailRow label="Country" value={biz.country} />
              <DetailRow label="Logo URL" value={biz.logo_url} href={biz.logo_url ?? undefined} />
              {biz.about && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <DetailRow label="About" value={biz.about} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinics */}
          {biz.clinics.map((c) => {
            const info = biz.imported[c.clinic_id] ?? { state: "new", clinicId: null, slug: null };
            return (
              <Card key={c.clinic_id} className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 pb-4">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-800">
                    <MapPin size={16} style={{ color: BRAND }} />
                    <span className="truncate">{c.name || `Clinic #${c.clinic_id}`}</span>
                    {info.state === "imported" && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={11} className="mr-1" /> Imported
                      </Badge>
                    )}
                    {info.state === "domain-match" && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        Domain match
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex shrink-0 items-center gap-2.5">
                    {info.state !== "new" && info.slug && (
                      <Link
                        href={`/clinics/${info.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                      >
                        <ExternalLink size={12} /> View
                      </Link>
                    )}
                    {info.state === "new" ? (
                      <Link href={`/admin/clinics/new?g99ClinicId=${c.clinic_id}`}>
                        <Button size="sm" variant="gradient" className="h-8">
                          <Download size={13} /> Import
                        </Button>
                      </Link>
                    ) : (
                      info.clinicId && (
                        <Link href={`/admin/clinics/${info.clinicId}/edit`}>
                          <Button size="sm" variant="outline" className="h-8">
                            <Pencil size={13} /> Edit
                          </Button>
                        </Link>
                      )
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailRow label="G99 clinic id" value={c.clinic_id} />
                    <DetailRow label="Website" value={c.website} href={c.website ? (c.website.startsWith("http") ? c.website : `https://${c.website}`) : undefined} />
                    <DetailRow label="Phone" value={c.contact_number} />
                    <DetailRow label="Address" value={c.address} />
                    <DetailRow label="City" value={c.city} />
                    <DetailRow label="State" value={c.state} />
                    <DetailRow label="Country" value={c.country} />
                    <DetailRow label="Google My Business" value={c.google_my_business} href={c.google_my_business ?? undefined} />
                    <DetailRow label="Google Place ID" value={c.google_place_id} />
                    <DetailRow label="Booking / Appointment URL" value={c.appointment_url} href={c.appointment_url ?? undefined} />
                    <DetailRow label="Instagram" value={c.instagram} href={c.instagram ?? undefined} />
                    <DetailRow label="Facebook" value={c.facebook} href={c.facebook ?? undefined} />
                    <DetailRow label="Twitter / X" value={c.twitter} href={c.twitter ?? undefined} />
                    <DetailRow label="TikTok" value={c.tiktok} href={c.tiktok ?? undefined} />
                    <DetailRow label="Yelp" value={c.yelp_url} href={c.yelp_url ?? undefined} />
                    {c.about && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <DetailRow label="About" value={c.about} />
                      </div>
                    )}
                  </div>

                  {/* G99 services (informational — actual treatments come from the site scrape) */}
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Stethoscope size={13} style={{ color: BRAND }} />
                      G99 services ({c.services?.length ?? 0})
                    </p>
                    {c.services && c.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {c.services.map((s) => (
                          <Badge
                            key={s.service_id}
                            variant="secondary"
                            className="bg-slate-100 font-normal text-slate-600"
                            title={s.category ?? undefined}
                          >
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        No G99 services. Treatments are scraped from the website on import.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
