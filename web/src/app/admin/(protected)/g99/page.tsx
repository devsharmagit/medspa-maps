"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseZap,
  Loader2,
  AlertTriangle,
  Search,
  Globe,
  ExternalLink,
  CheckCircle2,
  CircleDashed,
  Link2,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet } from "@/lib/admin/client";

const BRAND = "#9b3a9b";

type ImportState = "imported" | "domain-match" | "new";
interface ImportedInfo {
  state: ImportState;
  clinicId: string | null;
  slug: string | null;
}
interface G99Clinic {
  clinic_id: string;
  name: string | null;
  website: string | null;
  address: string | null;
}
interface G99BusinessListItem {
  business_id: string;
  name: string | null;
  is_test: boolean;
  is_internal: boolean;
  clinics: G99Clinic[];
  imported: Record<string, ImportedInfo>;
}

// Flat clinic row — one per G99 website-clinic.
interface ClinicRow {
  clinicId: string;
  name: string | null;
  website: string | null;
  businessId: string;
  businessName: string | null;
  isTest: boolean;
  info: ImportedInfo;
}

function StatusBadge({ state }: { state: ImportState }) {
  if (state === "imported")
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        <CheckCircle2 size={11} className="mr-1" /> Imported
      </Badge>
    );
  if (state === "domain-match")
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
        <Link2 size={11} className="mr-1" /> Domain match
      </Badge>
    );
  return (
    <Badge className="border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-50">
      <CircleDashed size={11} className="mr-1" /> Not imported
    </Badge>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

export default function G99ImportPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<G99BusinessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [hideImported, setHideImported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminGet<G99BusinessListItem[]>("/g99/businesses");
        if (!cancelled) setBusinesses(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load G99 businesses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // flatten businesses -> clinic rows
  const allRows = useMemo<ClinicRow[]>(() => {
    const rows: ClinicRow[] = [];
    for (const b of businesses) {
      for (const c of b.clinics) {
        rows.push({
          clinicId: c.clinic_id,
          name: c.name,
          website: c.website,
          businessId: b.business_id,
          businessName: b.name,
          isTest: b.is_test || b.is_internal,
          info: b.imported[c.clinic_id] ?? { state: "new", clinicId: null, slug: null },
        });
      }
    }
    return rows;
  }, [businesses]);

  const stats = useMemo(() => {
    let imported = 0, domain = 0, neu = 0;
    for (const r of allRows) {
      if (r.info.state === "imported") imported++;
      else if (r.info.state === "domain-match") domain++;
      else neu++;
    }
    return { total: allRows.length, imported, domain, neu };
  }, [allRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (!showTest && r.isTest) return false;
      if (hideImported && r.info.state !== "new") return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.website ?? "").toLowerCase().includes(q) ||
        (r.businessName ?? "").toLowerCase().includes(q) ||
        r.clinicId.includes(q)
      );
    });
  }, [allRows, search, showTest, hideImported]);

  const cleanUrl = (w: string) => w.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <DatabaseZap size={18} style={{ color: BRAND }} />
            G99 Import
          </h2>
          <p className="text-sm text-slate-500">
            Clinics from the Growth99 database. Open a clinic&apos;s details to import it —
            we scrape its website into an editable draft.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex flex-wrap gap-2">
            <StatChip label="clinics" value={stats.total} color="#334155" />
            <StatChip label="imported" value={stats.imported} color="#059669" />
            <StatChip label="domain match" value={stats.domain} color="#d97706" />
            <StatChip label="not imported" value={stats.neu} color={BRAND} />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by clinic, business, website, or G99 ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-200 bg-white pl-9"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTest((v) => !v)}
              aria-pressed={showTest}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showTest
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {showTest ? "✓ " : ""}Show test businesses
            </button>
            <button
              type="button"
              onClick={() => setHideImported((v) => !v)}
              aria-pressed={hideImported}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                hideImported
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {hideImported ? "✓ " : ""}Hide already in DB
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading G99 clinics…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Building2 size={34} className="opacity-30" />
                <p>No clinics match your filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Clinic
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Website
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      G99 ID
                    </TableHead>
                    <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      In our DB?
                    </TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.clinicId}
                      className="cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/60"
                      onClick={() => router.push(`/admin/g99/${r.businessId}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-8 shrink-0 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${BRAND}14`, color: BRAND }}
                          >
                            <Building2 size={14} />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-slate-900">
                              {r.name || "Unnamed clinic"}
                            </span>
                            <span className="truncate text-xs text-slate-400">
                              {r.businessName || `Business #${r.businessId}`}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {r.website ? (
                          <a
                            href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex max-w-[240px] items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-purple-600"
                          >
                            <Globe size={12} className="shrink-0" />
                            <span className="truncate">{cleanUrl(r.website)}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[13px] italic text-slate-400">No website</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                          #{r.clinicId}
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge state={r.info.state} />
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.info.state !== "new" && r.info.slug && (
                            <a
                              href={`/clinics/${r.info.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700"
                              title="View public clinic page"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2.5 text-xs"
                            onClick={() => router.push(`/admin/g99/${r.businessId}`)}
                          >
                            Details <ArrowRight size={12} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <p className="text-xs text-slate-400">
          Showing {rows.length} of {stats.total} clinics
          {!showTest ? " · test businesses hidden" : ""}
          {hideImported ? " · already-in-DB hidden" : ""}
        </p>
      )}
    </div>
  );
}
