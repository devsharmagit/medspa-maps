"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, DatabaseZap, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { adminPost } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const BRAND = "#9b3a9b";

interface SaveResult {
  domain: string | null;
  status: "saved" | "skipped" | "failed";
  note?: string;
  slug?: string;
  clinicId?: string;
  treatments?: number;
  matched?: number;
  concernsSaved?: number;
  providers?: number;
  cover?: string;
  rating?: string | null;
  g99?: string | null;
  imagesDropped?: string[];
}

interface SaveResponse {
  saved: number;
  skipped: number;
  failed: number;
  results: SaveResult[];
}

const PLACEHOLDER = `Paste one clinic JSON object, or an array of them:

{
  "website": "https://example.com/",
  "clinic_type": "medspa",
  "name": "Example Med Spa",
  "phone": "...",
  "locations": [{ "address": "...", "city": "...", "state": "TX", "zip": "..." }],
  "treatments": [{ "raw_name": "Botox", "general_name": "Botox®" }],
  "concerns": ["Wrinkles"],
  "images": { "cover": "...", "gallery": ["..."], "before_after": ["..."] }
}`;

export default function AddJsonPage() {
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SaveResponse | null>(null);

  async function handleSave() {
    setError(null);
    setResponse(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : e}`);
      return;
    }
    const payloads = Array.isArray(parsed) ? parsed : [parsed];
    if (payloads.length === 0) {
      setError("No clinic objects found in the JSON.");
      return;
    }

    setSaving(true);
    try {
      const res = await adminPost<SaveResponse>("/clinics/save-json", { payloads, overwrite });
      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add clinic from JSON</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste a pre-extracted clinic payload (single object or an array). Runs the no-AI save
          engine: canonical treatment matching, geocoding, external rating, G99-id linking, and
          concern resolution — the same path as the batch <code>save-clinic-json</code> script.
          Existing domains are skipped unless &ldquo;overwrite&rdquo; is checked.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseZap size={18} style={{ color: BRAND }} />
            Clinic payload
          </CardTitle>
          <CardDescription>JSON only. No OpenAI is called.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={16}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[12.5px] leading-5 text-slate-800 outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="size-4"
            />
            Overwrite if the domain already exists
          </label>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" variant="gradient" className="h-10 px-6" onClick={handleSave} disabled={saving || !text.trim()}>
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving…</>
              ) : (
                <><DatabaseZap size={16} /> Save to database</>
              )}
            </Button>
            {response && (
              <span className="text-sm text-slate-500">
                {response.saved} saved · {response.skipped} skipped · {response.failed} failed
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {response.results.map((r, i) => (
              <div key={`${r.domain}-${i}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      r.status === "saved"
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : r.status === "skipped"
                          ? "border border-amber-200 bg-amber-50 text-amber-700"
                          : "border border-red-200 bg-red-50 text-red-700"
                    }
                  >
                    {r.status === "saved" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {r.status}
                  </Badge>
                  <span className="text-sm font-medium text-slate-800">{r.domain ?? "—"}</span>
                  {r.slug && (
                    <Link
                      href={`/practices/${r.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-brand-magenta hover:underline"
                    >
                      /practices/{r.slug} <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
                {r.note && <p className="mt-1 text-xs text-slate-500">{r.note}</p>}
                {r.status === "saved" && (
                  <p className="mt-1 text-xs text-slate-500">
                    treatments {r.matched}/{r.treatments} · concerns {r.concernsSaved} · providers {r.providers} ·
                    cover {r.cover} · rating {r.rating ?? "—"} · g99 {r.g99 ?? "none"}
                  </p>
                )}
                {r.imagesDropped && r.imagesDropped.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600">dropped {r.imagesDropped.length} dead image URL(s)</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
