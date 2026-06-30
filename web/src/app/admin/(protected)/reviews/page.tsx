"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  ChevronRight,
  ArrowLeft,
  Star,
  Building2,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { adminGet, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClinicReviewsManager } from "@/components/admin/clinic-reviews-manager";

const BRAND = "#9b3a9b";

interface ClinicListItem {
  id: string;
  name: string;
  slug: string;
  business_name: string;
  city: string | null;
  state: string | null;
  review_count: number;
  is_active: boolean;
  location_cities: string | null;
}

// Subset of the full clinic record we need for the rating/count override editor.
interface ClinicAggregates {
  avg_rating: string | null;
  review_count: number;
  ext_rating: string | null;
  ext_review_count: number | null;
}

function clinicLocation(c: ClinicListItem): string {
  if (c.city && c.state) return `${c.city}, ${c.state}`;
  if (c.location_cities) return c.location_cities;
  return c.city ?? c.state ?? "—";
}

export default function ReviewsPage() {
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClinicListItem | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<ClinicListItem[]>("/clinics");
      setClinics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.business_name ?? "").toLowerCase().includes(q) ||
        clinicLocation(c).toLowerCase().includes(q)
    );
  }, [clinics, search]);

  // ── Detail view: a single clinic's reviews + rating/count override ──────────
  if (selected) {
    return (
      <ClinicReviewsDetail
        clinic={selected}
        onBack={() => {
          setSelected(null);
          // refresh counts in the list when returning
          loadClinics();
        }}
      />
    );
  }

  // ── List view: all clinics ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
        <p className="text-sm text-slate-500">
          Select a clinic to manage its reviews, rating, and review count.
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clinics…"
              className="h-9 pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={28} className="animate-spin opacity-50" />
              <p>Loading clinics…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Building2 size={36} className="opacity-30" />
              <p>No clinics found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {c.name}
                        {!c.is_active && (
                          <Badge
                            variant="secondary"
                            className="ml-2 bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-100"
                          >
                            Unpublished
                          </Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} className="shrink-0" />
                        {clinicLocation(c)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      >
                        <Star size={12} className="text-brand-star" />
                        {c.review_count}{" "}
                        {c.review_count === 1 ? "review" : "reviews"}
                      </Badge>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Per-clinic detail: rating/count override editor + the reviews manager ─────
function ClinicReviewsDetail({
  clinic,
  onBack,
}: {
  clinic: ClinicListItem;
  onBack: () => void;
}) {
  const [agg, setAgg] = useState<ClinicAggregates | null>(null);
  const [ratingInput, setRatingInput] = useState("");
  const [countInput, setCountInput] = useState("");
  const [loadingAgg, setLoadingAgg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aggError, setAggError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingAgg(true);
    setAggError(null);
    adminGet<ClinicAggregates>(`/clinics/${clinic.id}`)
      .then((c) => {
        if (!active) return;
        setAgg(c);
        setRatingInput(c.ext_rating ?? "");
        setCountInput(c.ext_review_count != null ? String(c.ext_review_count) : "");
      })
      .catch((e: Error) => {
        if (active) setAggError(e.message);
      })
      .finally(() => {
        if (active) setLoadingAgg(false);
      });
    return () => {
      active = false;
    };
  }, [clinic.id]);

  async function handleSaveAggregates(e: React.FormEvent) {
    e.preventDefault();
    setAggError(null);
    setSaved(false);

    const ratingStr = ratingInput.trim();
    const countStr = countInput.trim();

    let ext_rating: number | null = null;
    if (ratingStr !== "") {
      const n = Number(ratingStr);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        setAggError("Rating must be a number between 0 and 5.");
        return;
      }
      ext_rating = n;
    }

    let ext_review_count: number | null = null;
    if (countStr !== "") {
      const n = parseInt(countStr, 10);
      if (!Number.isInteger(n) || n < 0) {
        setAggError("Review count must be a whole number ≥ 0.");
        return;
      }
      ext_review_count = n;
    }

    setSaving(true);
    try {
      const updated = await adminPatch<ClinicAggregates>(`/clinics/${clinic.id}`, {
        ext_rating,
        ext_review_count,
      });
      setAgg(updated);
      setRatingInput(updated.ext_rating ?? "");
      setCountInput(
        updated.ext_review_count != null ? String(updated.ext_review_count) : ""
      );
      setSaved(true);
    } catch (err) {
      setAggError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-slate-900"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {clinic.name}
          </h2>
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <MapPin size={12} /> {clinicLocation(clinic)}
          </p>
        </div>
      </div>

      {/* Rating & review-count override editor */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Star size={16} style={{ color: BRAND }} />
            Displayed rating &amp; review count
          </CardTitle>
          <p className="text-xs text-slate-500">
            These override what shows on the public clinic page. Leave a field
            blank to fall back to the value auto-calculated from the reviews
            below.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {loadingAgg ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : (
            <form
              onSubmit={handleSaveAggregates}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-rating">Rating (0–5)</Label>
                  <Input
                    id="ext-rating"
                    inputMode="decimal"
                    value={ratingInput}
                    onChange={(e) => {
                      setRatingInput(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={
                      agg?.avg_rating
                        ? `Auto: ${agg.avg_rating}`
                        : "e.g. 4.8"
                    }
                    className="h-9"
                  />
                  <span className="text-xs text-slate-400">
                    Auto from reviews:{" "}
                    {agg?.avg_rating != null ? agg.avg_rating : "—"}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-count">Review count</Label>
                  <Input
                    id="ext-count"
                    inputMode="numeric"
                    value={countInput}
                    onChange={(e) => {
                      setCountInput(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={
                      agg ? `Auto: ${agg.review_count}` : "e.g. 312"
                    }
                    className="h-9"
                  />
                  <span className="text-xs text-slate-400">
                    Auto from reviews: {agg?.review_count ?? "—"}
                  </span>
                </div>
              </div>

              {aggError && (
                <p className="text-sm text-red-600">{aggError}</p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant="gradient"
                  className="h-9 px-6"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 size={14} /> Saved
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> Save rating &amp; count
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* The clinic's reviews — add / edit / approve / delete */}
      <ClinicReviewsManager clinicId={clinic.id} />
    </div>
  );
}
