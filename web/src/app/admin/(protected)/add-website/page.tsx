"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Wand2, AlertTriangle, CheckCircle2, DatabaseZap, ExternalLink } from "lucide-react";
import { adminPost } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface ExistingClinicRef {
  id: string;
  name: string;
  slug: string;
  website: string | null;
}

interface IngestResult {
  status: "saved" | "skipped" | "failed";
  slug?: string;
  clinicId?: string;
  locations: number;
  images: number;
  providers?: number;
  beforeAfter?: number;
  modelUsed: string;
  escalated: boolean;
  note?: string;
}

interface TreatmentsConcernsResult {
  status: "saved" | "skipped" | "failed";
  treatmentsFound: number;
  servicesMatched: number;
  servicesAuto: number;
  servicesUnmatched: number;
  concernsSaved: number;
  mappingsSaved: number;
  note?: string;
}

interface G99Attach {
  g99_clinic_id: string | null;
  g99_business_id: string | null;
  g99_tenant_id: string | null;
  business_name: string | null;
  clinic_name: string | null;
}

type IngestResponse =
  | { outcome: "blocked"; domain: string; duplicate: ExistingClinicRef[] }
  | {
      outcome: "ingested";
      domain: string;
      result: IngestResult;
      treatmentsConcerns: TreatmentsConcernsResult;
      g99: G99Attach | null;
    };

export default function AddWebsitePage() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<IngestResponse | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      const data = await adminPost<IngestResponse>("/clinics/ingest", { url: value });
      setRes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-800">
          <Wand2 className="size-6 text-purple-600" />
          Add Website with AI
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Paste a medspa website URL. AI scrapes the site — clinic details, all
          locations, images (incl. before/after), providers, and treatments — and
          adds it to the directory with treatments and concerns. If the domain was harvested from G99, its
          clinic/business ids are linked automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website URL</CardTitle>
          <CardDescription>
            e.g. <code className="text-slate-600">ruma.com</code> — a duplicate domain
            is rejected, not overwritten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="url" className="sr-only">
                Website URL
              </Label>
              <Input
                id="url"
                type="text"
                inputMode="url"
                placeholder="https://example-medspa.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
            <Button type="submit" variant="gradient" disabled={busy || !url.trim()}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Ingesting…
                </>
              ) : (
                <>
                  <Wand2 /> Add with AI
                </>
              )}
            </Button>
          </form>
          {busy && (
            <p className="mt-3 text-xs text-slate-400">
              This runs the full AI pipeline (multi-page fetch + extraction + geocode)
              and can take 30–90 seconds. Keep this tab open.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Blocked — domain already in the directory */}
      {res?.outcome === "blocked" && (
        <Card className="mt-6 border-amber-300 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <AlertTriangle className="size-5" />
              Already in the directory
            </CardTitle>
            <CardDescription className="text-amber-700">
              <span className="font-medium">{res.domain}</span> matches{" "}
              {res.duplicate.length} existing clinic
              {res.duplicate.length === 1 ? "" : "s"} — nothing was added.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {res.duplicate.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clinics/${c.id}`}
                className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-amber-50"
              >
                <span className="font-medium text-slate-700">{c.name}</span>
                <span className="text-xs text-slate-400">{c.website}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ingested */}
      {res?.outcome === "ingested" && (
        <Card
          className={
            res.result.status === "saved"
              ? "mt-6 border-green-300 bg-green-50/60"
              : "mt-6 border-amber-300 bg-amber-50/60"
          }
        >
          <CardHeader>
            <CardTitle
              className={`flex items-center gap-2 text-base ${
                res.result.status === "saved" ? "text-green-800" : "text-amber-800"
              }`}
            >
              {res.result.status === "saved" ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <AlertTriangle className="size-5" />
              )}
              {res.result.status === "saved"
                ? "Added to the directory"
                : res.result.status === "skipped"
                  ? "Skipped"
                  : "Failed"}
            </CardTitle>
            <CardDescription>
              <span className="font-medium">{res.domain}</span>
              {res.result.note ? ` — ${res.result.note}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {res.result.status === "saved" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{res.result.locations} locations</Badge>
                  <Badge variant="secondary">{res.result.images} images</Badge>
                  <Badge variant="secondary">{res.result.providers ?? 0} providers</Badge>
                  <Badge variant="secondary">
                    {res.treatmentsConcerns.treatmentsFound} treatments
                  </Badge>
                  <Badge variant="secondary">
                    {res.treatmentsConcerns.concernsSaved} concerns
                  </Badge>
                  <Badge variant="secondary">
                    {res.treatmentsConcerns.mappingsSaved} treatment-concern pairs
                  </Badge>
                  <Badge variant="secondary">{res.result.beforeAfter ?? 0} before/after</Badge>
                  <Badge variant="outline">
                    {res.result.modelUsed}
                    {res.result.escalated ? " (escalated)" : ""}
                  </Badge>
                </div>

                {res.g99 && (res.g99.g99_clinic_id || res.g99.g99_business_id) ? (
                  <div className="flex items-start gap-2 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-800">
                    <DatabaseZap className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Linked to G99 — clinic <code>{res.g99.g99_clinic_id ?? "—"}</code>,
                      business <code>{res.g99.g99_business_id ?? "—"}</code>
                      {res.g99.business_name ? ` (${res.g99.business_name})` : ""}.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No G99 match for this domain — added as a standalone listing.
                  </p>
                )}

                {res.result.slug && (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/clinics/${res.result.clinicId}`}>
                      <Button variant="outline" size="sm">
                        Edit in admin
                      </Button>
                    </Link>
                    <Link href={`/clinics/${res.result.slug}`} target="_blank">
                      <Button variant="ghost" size="sm">
                        View public page <ExternalLink />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
