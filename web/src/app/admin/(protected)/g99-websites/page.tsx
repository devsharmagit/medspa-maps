"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  AlertTriangle,
  Search,
  ExternalLink,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  XCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPost } from "@/lib/admin/client";

const BRAND = "#9b3a9b";
const PAGE_SIZE_OPTIONS = [25, 50, 100];

// One row per unique medspa website.
interface G99Website {
  domain: string;
  website: string;
  clinic_count: number;
  business_count: number;
  g99_clinic_ids: string[];
  g99_business_ids: string[];
  business_name: string | null;
  clinic_name: string | null;
  specialization: string | null;
  imported: boolean;
  imported_clinic_id: string | null;
}

type ImportFilter = "all" | "imported" | "not-imported";

type ImportResponse =
  | {
      outcome: "blocked";
      domain: string;
      duplicate: Array<{ id: string; name: string; slug: string; website: string | null }>;
    }
  | {
      outcome: "ingested";
      domain: string;
      result: { status: "saved" | "skipped" | "failed"; clinicId?: string | null };
    };

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
      <span className="text-sm font-semibold" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

const cleanUrl = (w: string) => w.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function G99WebsitesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<G99Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [importFilter, setImportFilter] = useState<ImportFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [importing, setImporting] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminGet<G99Website[]>("/g99-websites");
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load G99 websites.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    let clinics = 0;
    let multi = 0;
    let imported = 0;
    for (const r of rows) {
      clinics += r.clinic_count;
      if (r.clinic_count > 1) multi++;
      if (r.imported) imported++;
    }
    return { websites: rows.length, clinics, multi, imported };
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;

    // Import filter
    if (importFilter === "imported") {
      result = result.filter((r) => r.imported);
    } else if (importFilter === "not-imported") {
      result = result.filter((r) => !r.imported);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.domain.toLowerCase().includes(q) ||
          (r.business_name ?? "").toLowerCase().includes(q) ||
          (r.clinic_name ?? "").toLowerCase().includes(q) ||
          (r.specialization ?? "").toLowerCase().includes(q) ||
          r.g99_business_ids.some((t) => t.includes(q)) ||
          r.g99_clinic_ids.some((c) => c.includes(q))
      );
    }

    return result;
  }, [rows, search, importFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, importFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const startItem = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, filtered.length);

  const importWebsite = async (row: G99Website) => {
    if (row.imported || importing) return;
    setImporting(row.domain);
    setError(null);
    setImportMessage(null);
    try {
      const data = await adminPost<ImportResponse>("/g99-websites", { domain: row.domain });
      if (data.outcome === "ingested" && data.result.status === "saved") {
        setRows((prev) =>
          prev.map((r) =>
            r.domain === row.domain
              ? { ...r, imported: true, imported_clinic_id: data.result.clinicId ?? null }
              : r
          )
        );
        setImportMessage(`Imported ${row.domain}.`);
      } else if (data.outcome === "blocked") {
        setRows((prev) =>
          prev.map((r) =>
            r.domain === row.domain
              ? { ...r, imported: true, imported_clinic_id: data.duplicate[0]?.id ?? null }
              : r
          )
        );
        setImportMessage(`${row.domain} is already in the directory.`);
      } else {
        setImportMessage(`${row.domain} was not imported (${data.result.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Globe size={18} style={{ color: BRAND }} />
            G99 Websites
          </h2>
          <p className="text-sm text-slate-500">
            Unique <strong>medspa</strong> clinic websites from the Growth99 database — filtered
            to valid, non-test businesses (dental &amp; other specialties excluded). Click a row for
            the live G99 record.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex flex-wrap gap-2">
            <StatChip label="unique websites" value={stats.websites} color="#334155" />
            <StatChip label="G99 clinics" value={stats.clinics} color="#059669" />
            <StatChip label="multi-location" value={stats.multi} color="#0369a1" />
            <StatChip label="imported" value={stats.imported} color="#7c3aed" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by website, clinic, specialization, or G99 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-200 bg-white pl-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "imported", label: "Imported" },
                  { value: "not-imported", label: "Not Imported" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setImportFilter(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    importFilter === opt.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading G99 websites…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importMessage && !error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{importMessage}</span>
        </div>
      )}

      {!loading && !error && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Building2 size={34} className="opacity-30" />
                <p>No websites match your search.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Website
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Specialization
                    </TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Locations
                    </TableHead>
                    <TableHead className="w-[110px] text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Import
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((r) => (
                    <TableRow
                      key={r.domain}
                      onClick={() => router.push(`/admin/g99-websites/${encodeURIComponent(r.domain)}`)}
                      className="cursor-pointer border-slate-100 hover:bg-slate-50/60"
                    >
                      <TableCell>
                        <a
                          href={r.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex max-w-[260px] items-center gap-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:text-purple-600"
                        >
                          <Globe size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{cleanUrl(r.website)}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      </TableCell>

                      <TableCell>
                        {r.specialization ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                            <Sparkles size={11} className="text-slate-400" />
                            {r.specialization}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {r.imported ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: "#dcfce7", color: "#15803d" }}
                          >
                            <CheckCircle2 size={11} />
                            Imported
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: "#fef3c7", color: "#92400e" }}
                          >
                            <XCircle size={11} />
                            Not imported
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: r.clinic_count > 1 ? "#e0f2fe" : "#f1f5f9",
                            color: r.clinic_count > 1 ? "#0369a1" : "#64748b",
                          }}
                        >
                          <MapPin size={11} />
                          {r.clinic_count} {r.clinic_count === 1 ? "clinic" : "clinics"}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={r.imported ? "outline" : "gradient"}
                          disabled={r.imported || importing === r.domain || !!importing}
                          onClick={(e) => {
                            e.stopPropagation();
                            void importWebsite(r);
                          }}
                        >
                          {importing === r.domain ? (
                            <>
                              <Loader2 className="animate-spin" /> Importing
                            </>
                          ) : r.imported ? (
                            <>
                              <CheckCircle2 /> Done
                            </>
                          ) : (
                            <>
                              <Download /> Import
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of{" "}
              {filtered.length.toLocaleString()}{" "}
              {filtered.length !== stats.websites && (
                <span className="text-slate-400">
                  (filtered from {stats.websites.toLocaleString()})
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              title="First page"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="px-2.5 text-xs font-medium text-slate-600">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next page"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Last page"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
