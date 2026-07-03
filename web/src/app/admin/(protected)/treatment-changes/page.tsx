"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  History,
  Loader2,
  AlertCircle,
  Search,
  PlusCircle,
  MinusCircle,
  ArrowUpRight,
} from "lucide-react";
import { adminGet } from "@/lib/admin/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TreatmentChange {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  service_id: string | null;
  service_slug: string;
  service_name: string;
  change_type: "added" | "removed";
  raw_name: string | null;
  match_confidence: string | null;
  detected_at: string;
}

type TypeFilter = "all" | "added" | "removed";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TreatmentChangesPage() {
  const [rows, setRows] = useState<TreatmentChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = typeFilter === "all" ? "" : `?type=${typeFilter}`;
      const data = await adminGet<TreatmentChange[]>(`/treatment-changes${qs}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load treatment changes");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.clinic_name.toLowerCase().includes(q) ||
        r.service_name.toLowerCase().includes(q) ||
        (r.raw_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const r of rows) {
      if (r.change_type === "added") added++;
      else removed++;
    }
    return { added, removed, total: rows.length };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <History size={20} className="text-brand-purple" />
            Treatment Changes
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Daily re-scrape detects when clinics start or stop offering the tracked treatments.
          </p>
        </div>
      </div>

      {/* Summary + filters */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {(["all", "added", "removed"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
                  typeFilter === t
                    ? "bg-brand-purple text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {t}
                {t === "added" && <span className="ml-1.5 opacity-70">{counts.added}</span>}
                {t === "removed" && <span className="ml-1.5 opacity-70">{counts.removed}</span>}
                {t === "all" && <span className="ml-1.5 opacity-70">{counts.total}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clinic or treatment…"
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading…
            </div>
          ) : error ? (
            <div className="p-12 flex flex-col items-center justify-center text-red-500 gap-2">
              <AlertCircle size={24} />
              <p className="text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <History size={28} className="opacity-30" />
              <p className="text-sm">No treatment changes recorded yet.</p>
              <p className="text-xs text-slate-400">
                They appear here after the daily re-scrape detects a difference.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Detected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/clinics/${r.clinic_slug}`}
                        className="font-medium text-slate-800 hover:text-brand-purple inline-flex items-center gap-1"
                        target="_blank"
                      >
                        {r.clinic_name}
                        <ArrowUpRight size={12} className="opacity-50" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-800">{r.service_name}</span>
                      {r.raw_name && r.raw_name !== r.service_name && (
                        <span className="block text-xs text-slate-400 truncate max-w-[220px]">
                          “{r.raw_name}”
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.change_type === "added" ? (
                        <Badge className="bg-green-50 text-green-700 hover:bg-green-50 gap-1 border-green-200">
                          <PlusCircle size={12} /> Added
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700 hover:bg-red-50 gap-1 border-red-200">
                          <MinusCircle size={12} /> Removed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {fmtDate(r.detected_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
