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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
}

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
    for (const r of rows) {
      clinics += r.clinic_count;
      if (r.clinic_count > 1) multi++;
    }
    return { websites: rows.length, clinics, multi };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.domain.toLowerCase().includes(q) ||
        (r.business_name ?? "").toLowerCase().includes(q) ||
        (r.clinic_name ?? "").toLowerCase().includes(q) ||
        (r.specialization ?? "").toLowerCase().includes(q) ||
        r.g99_business_ids.some((t) => t.includes(q)) ||
        r.g99_clinic_ids.some((c) => c.includes(q))
    );
  }, [rows, search]);

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
            to valid, non-test businesses (dental & other specialties excluded). Click a row for
            the live G99 record.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex flex-wrap gap-2">
            <StatChip label="unique websites" value={stats.websites} color="#334155" />
            <StatChip label="G99 clinics" value={stats.clinics} color="#059669" />
            <StatChip label="multi-location" value={stats.multi} color="#0369a1" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by website, business, specialization, or G99 ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-200 bg-white pl-9"
            />
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
                      Business
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Specialization
                    </TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Locations
                    </TableHead>
                    <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                      G99 business(es)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
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
                        <span className="truncate text-sm text-slate-700">
                          {r.business_name || r.clinic_name || (
                            <span className="italic text-slate-400">Unknown</span>
                          )}
                        </span>
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

                      <TableCell>
                        <span className="font-mono text-xs text-slate-500">
                          {r.g99_business_ids.length === 0
                            ? "—"
                            : r.g99_business_ids.length <= 2
                              ? r.g99_business_ids.map((t) => `#${t}`).join(", ")
                              : `#${r.g99_business_ids[0]} +${r.g99_business_ids.length - 1}`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          Showing {filtered.length.toLocaleString()} of {stats.websites.toLocaleString()} unique
          medspa websites
        </p>
      )}
    </div>
  );
}
