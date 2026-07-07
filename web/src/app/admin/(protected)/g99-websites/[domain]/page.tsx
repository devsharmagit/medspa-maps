"use client";

import { useState, useEffect, use, type ReactNode } from "react";
import {
  Globe,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Stethoscope,
  ExternalLink,
  CheckCircle2,
  Database,
  Archive,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { adminGet } from "@/lib/admin/client";

const BRAND = "#9b3a9b";

interface G99Service {
  name: string | null;
  category: string | null;
}
interface G99Clinic {
  clinic_id: string;
  tenant_id: string | null;
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
  google_profile_id: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  yelp_url: string | null;
  appointment_url: string | null;
  clinic_url: string | null;
  services: G99Service[];
}
interface G99Business {
  business_id: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
}
interface Detail {
  domain: string;
  source: "live" | "snapshot";
  note?: string;
  business: G99Business | null;
  clinics: G99Clinic[];
}

const cleanUrl = (w: string) => w.replace(/^https?:\/\//, "").replace(/\/$/, "");

function val(v: string | null | undefined, opts?: { url?: boolean }): ReactNode {
  const s = (v ?? "").toString().trim();
  if (!s) return <span className="text-slate-300">—</span>;
  if (opts?.url) {
    const href = s.startsWith("http") ? s : `https://${s}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 break-all text-purple-600 hover:underline"
      >
        {cleanUrl(s)} <ExternalLink size={11} className="shrink-0" />
      </a>
    );
  }
  return <span className="break-words">{s}</span>;
}

export default function G99WebsiteDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await adminGet<Detail>(`/g99-websites/${encodeURIComponent(domain)}`);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load G99 clinic detail.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const clinicFields = (c: G99Clinic): Array<[string, ReactNode]> => [
    ["G99 clinic id", <span key="id" className="font-mono text-xs">#{c.clinic_id}</span>],
    ["Name", val(c.name)],
    ["Website", val(c.website, { url: true })],
    ["Address", val(c.address)],
    ["City / State / Country", val([c.city, c.state, c.country].filter(Boolean).join(", "))],
    ["Phone", val(c.contact_number)],
    ["About", val(c.about)],
    ["Booking (appointment)", val(c.appointment_url, { url: true })],
    ["Clinic URL", val(c.clinic_url, { url: true })],
    ["Google My Business", val(c.google_my_business, { url: true })],
    ["Google Place ID", val(c.google_place_id)],
    ["Google Profile ID", val(c.google_profile_id)],
    ["Instagram", val(c.instagram, { url: true })],
    ["Facebook", val(c.facebook, { url: true })],
    ["Twitter / X", val(c.twitter, { url: true })],
    ["TikTok", val(c.tiktok, { url: true })],
    ["Yelp", val(c.yelp_url, { url: true })],
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-16">
      <Link
        href="/admin/g99-websites"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-purple-600"
      >
        <ArrowLeft size={15} /> Back to G99 Websites
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Globe size={18} style={{ color: BRAND }} />
            {domain}
          </h2>
          <p className="text-sm text-slate-500">Live clinic record(s) from the G99 database.</p>
        </div>
        {!loading && !error && data && (
          data.source === "live" ? (
            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              <Database size={12} className="mr-1" /> Live · G99 prod
            </Badge>
          ) : (
            <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
              <Archive size={12} className="mr-1" /> Snapshot
            </Badge>
          )
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Fetching from G99…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.note && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{data.note}</span>
            </div>
          )}

          {/* Business */}
          {data.business && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Building2 size={15} style={{ color: BRAND }} /> Business (tenant #{data.business.business_id})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {data.business.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.business.logo_url}
                    alt={data.business.name ?? "logo"}
                    className="h-20 w-auto max-w-[180px] rounded-md border border-slate-200 bg-slate-50 object-contain"
                  />
                )}
                <div className="flex-1">
                  <Table>
                    <TableBody>
                      {([
                        ["Name", val(data.business.name)],
                        ["Website", val(data.business.website, { url: true })],
                        ["City / State / Country", val([data.business.city, data.business.state, data.business.country].filter(Boolean).join(", "))],
                        ["Phone", val(data.business.phone)],
                        ["About", val(data.business.about)],
                      ] as Array<[string, ReactNode]>).map(([label, node]) => (
                        <TableRow key={label} className="border-slate-100">
                          <TableCell className="w-[200px] align-top text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-700">{node}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clinics */}
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {data.clinics.length} clinic{data.clinics.length === 1 ? "" : "s"} at this website
          </p>
          {data.clinics.map((c) => (
            <Card key={c.clinic_id} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Stethoscope size={15} style={{ color: BRAND }} />
                  {c.name || "Unnamed clinic"}
                  <span className="font-mono text-xs font-normal text-slate-400">#{c.clinic_id}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {clinicFields(c).map(([label, node]) => (
                      <TableRow key={label} className="border-slate-100">
                        <TableCell className="w-[200px] align-top text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {label}
                        </TableCell>
                        <TableCell className="align-top text-sm text-slate-700">{node}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-slate-100">
                      <TableCell className="w-[200px] align-top text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Services ({c.services.length})
                      </TableCell>
                      <TableCell className="align-top">
                        {c.services.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {c.services.map((s, i) => (
                              <Badge
                                key={`${s.name}-${i}`}
                                className="border border-slate-200 bg-slate-50 font-normal text-slate-600 hover:bg-slate-50"
                                title={s.category ?? undefined}
                              >
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {data.clinics.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-400">
              <CheckCircle2 size={28} className="opacity-30" />
              <p>No G99 clinic records found for this website.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
