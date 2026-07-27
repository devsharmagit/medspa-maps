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
  Building2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { adminGet, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "rejected";

interface ClinicLead {
  id: string;
  full_name: string;
  business_email: string;
  business_name: string;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "rejected",
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-sky-100 text-sky-700 border border-sky-200",
  contacted: "bg-amber-100 text-amber-700 border border-amber-200",
  qualified: "bg-violet-100 text-violet-700 border border-violet-200",
  converted: "bg-emerald-100 text-emerald-700 border border-emerald-200",
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

export default function ClinicLeadsPage() {
  const [leads, setLeads] = useState<ClinicLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<ClinicLead[]>("/clinic-leads");
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinic leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUSES) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.full_name.toLowerCase().includes(q) ||
        l.business_email.toLowerCase().includes(q) ||
        l.business_name.toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const handleUpdated = useCallback((updated: ClinicLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  if (selected) {
    return (
      <ClinicLeadDetail
        lead={selected}
        onBack={() => setSelectedId(null)}
        onUpdated={handleUpdated}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Clinic Leads</h2>
        <p className="text-sm text-slate-500">
          Medspa owners who submitted the &ldquo;List your medspa&rdquo; form.
          They see a &ldquo;coming soon&rdquo; message — nothing is routed to
          sales automatically, so follow up from here.
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
            <span className="tabular-nums text-slate-400">
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
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
              placeholder="Search name, business, email…"
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
              <p>Loading clinic leads…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Inbox size={36} className="opacity-30" />
              <p>No clinic leads found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {l.business_name}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span className="truncate">{l.full_name}</span>
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="shrink-0" />
                          {l.business_email}
                        </span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        {formatDate(l.created_at)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          STATUS_STYLES[l.status]
                        )}
                      >
                        {STATUS_LABELS[l.status]}
                      </span>
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

function ClinicLeadDetail({
  lead,
  onBack,
  onUpdated,
}: {
  lead: ClinicLead;
  onBack: () => void;
  onUpdated: (lead: ClinicLead) => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = status !== lead.status || notes !== (lead.notes ?? "");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const updated = await adminPatch<ClinicLead>(
        `/clinic-leads/${lead.id}`,
        { status, notes: notes.trim() === "" ? null : notes }
      );
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
          <h2 className="text-lg font-semibold text-slate-900">
            {lead.business_name}
          </h2>
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <Calendar size={12} /> Submitted {formatDate(lead.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Submission details */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">
              Lead details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <dl className="flex flex-col gap-3 text-sm">
              <DetailRow icon={<User size={14} />} label="Full name">
                {lead.full_name}
              </DetailRow>
              <DetailRow icon={<Mail size={14} />} label="Business email">
                <a
                  href={`mailto:${lead.business_email}`}
                  className="text-purple-700 hover:underline"
                >
                  {lead.business_email}
                </a>
              </DetailRow>
              <DetailRow icon={<Building2 size={14} />} label="Business name">
                {lead.business_name}
              </DetailRow>
            </dl>
          </CardContent>
        </Card>

        {/* Processing controls */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">
              Process lead
            </CardTitle>
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
              <Label htmlFor="clinic-lead-notes">Notes</Label>
              <textarea
                id="clinic-lead-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSaved(false);
                }}
                placeholder="Internal notes about this lead…"
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

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex w-28 shrink-0 items-center gap-1.5 text-slate-400">
        {icon}
        {label}
      </span>
      <span className="min-w-0 break-words font-medium text-slate-800">
        {children}
      </span>
    </div>
  );
}
