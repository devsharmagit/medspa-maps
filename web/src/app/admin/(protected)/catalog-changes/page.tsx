"use client";

/**
 * /admin/catalog-changes — refresh history, as website → runs → changes.
 *
 * Three levels, collapsed by default, because that is how the data is actually
 * shaped and because the middle level grows without bound (every clinic gains a
 * run per cron cycle). Runs are fetched per clinic when its row is opened rather
 * than up front, so opening one website never means loading the whole history.
 *
 * Changes stay grouped by RUN rather than flattened into a feed: a `skipped` run
 * has no change rows but is the most actionable thing on the page (a clinic whose
 * crawl keeps failing reads as "stable" otherwise), and an add + remove inside one
 * run is usually the catalog re-bucketing a row, not two real changes — only side
 * by side does that read correctly.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Loader2,
  Minus,
  Plus,
  Search,
  SkipForward,
} from "lucide-react";
import { adminGet } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CatalogChange {
  entity_type: "service" | "concern";
  change_type: "added" | "removed";
  name: string;
  slug: string | null;
}

interface RefreshRun {
  id: string;
  trigger: string;
  status: string;
  crawl_health: number | null;
  pages_fetched: number | null;
  pages_requested: number | null;
  services_before: number | null;
  services_after: number | null;
  concerns_before: number | null;
  concerns_after: number | null;
  note: string | null;
  started_at: string;
  changes: CatalogChange[];
}

interface ClinicSummary {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  website: string | null;
  last_run_at: string;
  last_status: string;
  last_trigger: string;
  run_count: number;
  skipped_count: number;
  added_total: number;
  removed_total: number;
  services_now: number | null;
  concerns_now: number | null;
}

interface PendingClinic {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  website: string | null;
  last_scraped_at: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  admin_import: "Add Website (AI)",
  g99_import: "G99 Import",
  cron_refresh: "Scheduled",
  cli: "CLI",
};

const STATUS_STYLES: Record<string, string> = {
  saved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  saved: CheckCircle2,
  skipped: SkipForward,
  failed: AlertTriangle,
};

/** Strip scheme and trailing slash — the host is the identifying part. */
function hostOf(website: string | null): string {
  if (!website) return "—";
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function formatDate(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(value: string | null): string {
  if (!value) return "never refreshed";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? CheckCircle2;
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", STATUS_STYLES[status])}>
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

function DeltaCount({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) {
    return <span className="text-xs text-slate-400">no changes</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
      {added > 0 && <span className="text-emerald-600">+{added}</span>}
      {removed > 0 && <span className="text-rose-600">−{removed}</span>}
    </span>
  );
}

/** Level 3 — the added/removed rows for one run, side by side. */
function ChangeColumns({ changes }: { changes: CatalogChange[] }) {
  const added = changes.filter((c) => c.change_type === "added");
  const removed = changes.filter((c) => c.change_type === "removed");

  const column = (rows: CatalogChange[], kind: "added" | "removed") => {
    const isAdd = kind === "added";
    const Icon = isAdd ? Plus : Minus;
    return (
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "mb-2 flex items-center gap-1.5 text-xs font-semibold",
            isAdd ? "text-emerald-700" : "text-rose-700"
          )}
        >
          <Icon className="size-3.5" />
          {isAdd ? "Added" : "Removed"} ({rows.length})
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">none</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {rows.map((c, i) => (
              <li
                key={`${c.entity_type}-${c.name}-${i}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  isAdd
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                    : "border-rose-200 bg-rose-50/60 text-rose-900"
                )}
              >
                <span
                  className={cn(
                    "rounded px-1 text-[9px] font-semibold uppercase tracking-wide",
                    c.entity_type === "service"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-sky-100 text-sky-700"
                  )}
                >
                  {c.entity_type === "service" ? "Tx" : "Cx"}
                </span>
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      {column(added, "added")}
      <div className="hidden w-px shrink-0 bg-slate-200 sm:block" />
      {column(removed, "removed")}
    </div>
  );
}

/** Level 2 — one run row, expandable into its changes. */
function RunRow({ run }: { run: RefreshRun }) {
  const [open, setOpen] = useState(false);
  const added = run.changes.filter((c) => c.change_type === "added").length;
  const removed = run.changes.filter((c) => c.change_type === "removed").length;
  const hasDetail = run.changes.length > 0;

  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        disabled={!hasDetail}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2.5 text-left",
          hasDetail ? "hover:bg-slate-50" : "cursor-default"
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-slate-400 transition-transform",
            open && "rotate-90",
            !hasDetail && "invisible"
          )}
        />
        <span className="w-32 shrink-0 text-xs text-slate-500">{formatDate(run.started_at)}</span>
        <Badge variant="outline" className="shrink-0 text-xs">
          {TRIGGER_LABELS[run.trigger] ?? run.trigger}
        </Badge>
        <StatusBadge status={run.status} />
        <span className="hidden shrink-0 text-xs text-slate-500 md:inline">
          {run.services_after ?? "—"} tx · {run.concerns_after ?? "—"} cx
          {run.pages_fetched !== null && ` · ${run.pages_fetched} pages`}
        </span>
        <span className="ml-auto shrink-0">
          <DeltaCount added={added} removed={removed} />
        </span>
      </button>

      {run.note && (
        <p className="mx-4 mb-2.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {run.note}
        </p>
      )}

      {open && hasDetail && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 pl-11">
          <ChangeColumns changes={run.changes} />
        </div>
      )}
    </li>
  );
}

/** Level 1 — one website, expandable into its runs. */
function ClinicRow({ clinic }: { clinic: ClinicSummary }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RefreshRun[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || runs) return;
    setLoading(true);
    setError(null);
    try {
      setRuns(await adminGet<RefreshRun[]>(`/catalog-changes?clinicId=${clinic.clinic_id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load runs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden py-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <ChevronRight
          className={cn("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-900">{hostOf(clinic.website)}</span>
            <Link
              href={`/clinics/${clinic.clinic_slug}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-slate-400 hover:text-violet-600"
              title="Open public page"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
          <p className="truncate text-xs text-slate-500">{clinic.clinic_name}</p>
        </div>

        <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">
          <div className="flex items-center justify-end gap-1">
            <Clock className="size-3" />
            {relative(clinic.last_run_at)}
          </div>
          <div className="tabular-nums">
            {clinic.services_now ?? "—"} tx · {clinic.concerns_now ?? "—"} cx
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DeltaCount added={clinic.added_total} removed={clinic.removed_total} />
          <Badge variant="outline" className="text-xs tabular-nums">
            {clinic.run_count} {clinic.run_count === 1 ? "run" : "runs"}
          </Badge>
          <StatusBadge status={clinic.last_status} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-white">
          {loading && (
            <p className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <Loader2 className="size-3.5 animate-spin" /> Loading runs…
            </p>
          )}
          {error && <p className="px-4 py-3 text-xs text-rose-600">{error}</p>}
          {runs && runs.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-400">No runs recorded.</p>
          )}
          {runs && runs.length > 0 && (
            <ul>
              {runs.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

type Tab = "refreshed" | "pending";

export default function CatalogChangesPage() {
  const [tab, setTab] = useState<Tab>("refreshed");
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [pending, setPending] = useState<PendingClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  /**
   * Sets no state SYNCHRONOUSLY — every setState here happens after an await, so
   * calling this from the mount effect doesn't trip react-hooks/set-state-in-effect.
   * `loading` starts true; the handlers that re-trigger a load (tab switch,
   * Refresh) set it back themselves.
   */
  const load = useCallback(async () => {
    try {
      if (tab === "refreshed") {
        setClinics(await adminGet<ClinicSummary[]>("/catalog-changes"));
      } else {
        setPending(await adminGet<PendingClinic[]>("/catalog-changes?view=pending"));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load refresh history");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    // `load` only setStates after an await, so this cannot cascade renders — but
    // the rule can't see through the async boundary. Same targeted disable the
    // rest of the admin pages need.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  const needle = filter.trim().toLowerCase();
  const shownClinics = needle
    ? clinics.filter(
        (c) =>
          hostOf(c.website).toLowerCase().includes(needle) ||
          c.clinic_name.toLowerCase().includes(needle)
      )
    : clinics;
  const shownPending = needle
    ? pending.filter(
        (c) =>
          hostOf(c.website).toLowerCase().includes(needle) ||
          c.clinic_name.toLowerCase().includes(needle)
      )
    : pending;

  const totalAdded = clinics.reduce((n, c) => n + c.added_total, 0);
  const totalRemoved = clinics.reduce((n, c) => n + c.removed_total, 0);
  const withSkips = clinics.filter((c) => c.skipped_count > 0).length;

  return (
    <div className="max-w-5xl p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <History className="size-6 text-violet-500" />
            Catalog Changes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every treatments &amp; concerns refresh, by website. Open a site to see its
            runs, then a run to see what changed. A first import records the run but no
            changes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {tab === "refreshed" && clinics.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-6 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
          <span>
            <strong className="tabular-nums">{clinics.length}</strong>{" "}
            <span className="text-slate-500">websites refreshed</span>
          </span>
          <span className="text-emerald-700">
            <strong className="tabular-nums">+{totalAdded}</strong>{" "}
            <span className="text-slate-500">added</span>
          </span>
          <span className="text-rose-700">
            <strong className="tabular-nums">−{totalRemoved}</strong>{" "}
            <span className="text-slate-500">removed</span>
          </span>
          {withSkips > 0 && (
            <span className="text-amber-700">
              <strong className="tabular-nums">{withSkips}</strong>{" "}
              <span className="text-slate-500">with a skipped run</span>
            </span>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["refreshed", "Refreshed"],
            ["pending", "Never refreshed"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => {
              if (key === tab) return;
              setLoading(true);
              setTab(key);
            }}
          >
            {label}
          </Button>
        ))}
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by website or name…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && tab === "refreshed" && (
        <div className="flex flex-col gap-2">
          {shownClinics.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                {clinics.length === 0
                  ? "No refresh runs recorded yet."
                  : "No websites match that filter."}
              </CardContent>
            </Card>
          ) : (
            shownClinics.map((c) => <ClinicRow key={c.clinic_id} clinic={c} />)
          )}
        </div>
      )}

      {!loading && tab === "pending" && (
        <Card className="overflow-hidden py-0">
          {shownPending.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-slate-500">
              {pending.length === 0
                ? "Every active clinic with a website has been refreshed."
                : "No websites match that filter."}
            </CardContent>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shownPending.map((c) => (
                <li key={c.clinic_id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-slate-800">
                        {hostOf(c.website)}
                      </span>
                      <Link
                        href={`/clinics/${c.clinic_slug}`}
                        target="_blank"
                        className="shrink-0 text-slate-400 hover:text-violet-600"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                    <p className="truncate text-xs text-slate-500">{c.clinic_name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    last scraped {relative(c.last_scraped_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
