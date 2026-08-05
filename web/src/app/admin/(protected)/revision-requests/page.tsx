"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  ChevronRight,
  ArrowLeft,
  Inbox,
  Mail,
  User,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { adminGet, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Status = "new" | "reviewing" | "resolved" | "rejected";

interface RevisionRequest {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  requester_name: string | null;
  requester_email: string;
  message: string;
  status: Status;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUSES: Status[] = ["new", "reviewing", "resolved", "rejected"];
const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
  rejected: "Rejected",
};
const STATUS_STYLES: Record<Status, string> = {
  new: "bg-sky-100 text-sky-700 border border-sky-200",
  reviewing: "bg-amber-100 text-amber-700 border border-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  rejected: "bg-slate-100 text-slate-500 border border-slate-200",
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RevisionRequestsPage() {
  const [items, setItems] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<RevisionRequest[]>("/revision-requests");
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revision requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STATUSES) c[s] = 0;
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (!q) return true;
      return (
        it.clinic_name.toLowerCase().includes(q) ||
        it.requester_email.toLowerCase().includes(q) ||
        (it.requester_name?.toLowerCase().includes(q) ?? false) ||
        it.message.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  // Group by clinic (list already ordered by clinic name from the API).
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { clinicId: string; clinicName: string; clinicSlug: string; items: RevisionRequest[] }
    >();
    for (const it of filtered) {
      const g = map.get(it.clinic_id);
      if (g) g.items.push(it);
      else
        map.set(it.clinic_id, {
          clinicId: it.clinic_id,
          clinicName: it.clinic_name,
          clinicSlug: it.clinic_slug,
          items: [it],
        });
    }
    return [...map.values()];
  }, [filtered]);

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? null,
    [items, selectedId]
  );

  const handleUpdated = useCallback((updated: RevisionRequest) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }, []);

  if (selected) {
    return (
      <RevisionDetail
        item={selected}
        onBack={() => setSelectedId(null)}
        onUpdated={handleUpdated}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Revision Requests</h2>
        <p className="text-sm text-slate-500">
          Practices asking us to correct their listing, grouped by practice. Nothing is emailed
          automatically — follow up from here.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              statusFilter === s
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            )}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
            <span className="tabular-nums text-slate-400">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search practice, email, message…"
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
              <p>Loading revision requests…</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Inbox size={36} className="opacity-30" />
              <p>No revision requests found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groups.map((g) => (
                <div key={g.clinicId}>
                  {/* Clinic group header */}
                  <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-4 py-2">
                    <a
                      href={`/practices/${g.clinicSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 hover:text-purple-700"
                    >
                      {g.clinicName}
                      <ExternalLink size={12} className="text-slate-400" />
                    </a>
                    <span className="text-xs tabular-nums text-slate-400">
                      {g.items.length} request{g.items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {g.items.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(it.id)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/70"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm text-slate-800">{it.message}</span>
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Mail size={12} className="shrink-0" />
                                {it.requester_email}
                              </span>
                              {it.requester_name ? <span className="truncate">{it.requester_name}</span> : null}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="hidden text-xs text-slate-400 sm:inline">
                              {formatDate(it.created_at)}
                            </span>
                            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[it.status])}>
                              {STATUS_LABELS[it.status]}
                            </span>
                            <ChevronRight size={16} className="text-slate-400" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RevisionDetail({
  item,
  onBack,
  onUpdated,
}: {
  item: RevisionRequest;
  onBack: () => void;
  onUpdated: (item: RevisionRequest) => void;
}) {
  const [status, setStatus] = useState<Status>(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = status !== item.status || notes !== (item.notes ?? "");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const updated = await adminPatch<RevisionRequest>(`/revision-requests/${item.id}`, {
        status,
        notes: notes.trim() === "" ? null : notes,
      });
      onUpdated(updated);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
        <div className="flex-1">
          <a
            href={`/practices/${item.clinic_slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 hover:text-purple-700"
          >
            {item.clinic_name}
            <ExternalLink size={14} className="text-slate-400" />
          </a>
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <Calendar size={12} /> Submitted {formatDate(item.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Request details */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">Request details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-6 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex w-28 shrink-0 items-center gap-1.5 text-slate-400">
                <Mail size={14} /> Email
              </span>
              <a href={`mailto:${item.requester_email}`} className="text-purple-700 hover:underline break-words">
                {item.requester_email}
              </a>
            </div>
            {item.requester_name ? (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex w-28 shrink-0 items-center gap-1.5 text-slate-400">
                  <User size={14} /> Name
                </span>
                <span className="min-w-0 break-words font-medium text-slate-800">{item.requester_name}</span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-slate-400">
                <MessageSquare size={14} /> What they want corrected
              </span>
              <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-slate-800">
                {item.message}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Processing controls */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">Process request</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      setSaved(false);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      status === s
                        ? STATUS_STYLES[s]
                        : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="revision-notes">Internal notes</Label>
              <textarea
                id="revision-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSaved(false);
                }}
                placeholder="Internal notes about this request…"
                className="min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
                maxLength={5000}
              />
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <div>
              <Button
                type="button"
                variant="gradient"
                className="h-9 px-6"
                disabled={saving || (!dirty && !saved)}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : saved && !dirty ? (
                  <>
                    <CheckCircle2 size={14} /> Saved
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Save changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
