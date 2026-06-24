"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { adminGet, adminPost } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---- Types mirrored from the Phase-2 endpoints -----------------------------

interface UnmatchedSuggestion {
  slug: string;
  confidence: number;
}

interface UnmatchedItem {
  raw_name: string;
  clinic_count: number;
  suggestion: UnmatchedSuggestion | null;
  is_noise: boolean;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

const PROMOTE_CATEGORIES = [
  "Injectables",
  "Skin",
  "Laser",
  "Body",
  "Wellness",
  "Hair",
  "Other",
] as const;

// ---- Toast -----------------------------------------------------------------

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

let toastSeq = 0;

// ---- Page ------------------------------------------------------------------

export default function UnmatchedPage() {
  const [items, setItems] = useState<UnmatchedItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"review" | "noise">("review");

  // per-row in-flight tracking, keyed by raw_name
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  // promote modal state
  const [promoteFor, setPromoteFor] = useState<UnmatchedItem | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queue, svc] = await Promise.all([
        adminGet<UnmatchedItem[]>("/unmatched"),
        adminGet<Service[]>("/services"),
      ]);
      setItems(queue);
      setServices(svc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useMemo(() => items.filter((i) => !i.is_noise), [items]);
  const noise = useMemo(() => items.filter((i) => i.is_noise), [items]);
  const rows = tab === "review" ? review : noise;

  const serviceOptions = useMemo<DropdownOption[]>(
    () => services.map((s) => ({ label: s.name, value: s.id })),
    [services]
  );

  const slugToServiceId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.slug, s.id);
    return m;
  }, [services]);

  function removeRow(rawName: string) {
    setItems((prev) => prev.filter((i) => i.raw_name !== rawName));
  }

  function setRowBusy(rawName: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [rawName]: value }));
  }

  // ---- Actions -------------------------------------------------------------

  async function handleMap(item: UnmatchedItem, serviceId: string) {
    if (!serviceId) return;
    setRowBusy(item.raw_name, true);
    try {
      await adminPost("/unmatched/map", {
        rawName: item.raw_name,
        serviceId,
        addAlias: true,
      });
      const svc = services.find((s) => s.id === serviceId);
      removeRow(item.raw_name);
      pushToast(
        "success",
        `Mapped "${item.raw_name}" → ${svc?.name ?? "service"}`
      );
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Map failed");
      setRowBusy(item.raw_name, false);
    }
  }

  async function handleIgnore(item: UnmatchedItem) {
    setRowBusy(item.raw_name, true);
    try {
      await adminPost("/unmatched/ignore", { rawName: item.raw_name });
      removeRow(item.raw_name);
      pushToast("success", `Ignored "${item.raw_name}"`);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Ignore failed");
      setRowBusy(item.raw_name, false);
    }
  }

  async function handleIgnoreAllNoise() {
    if (noise.length === 0) return;
    if (
      !confirm(
        `Ignore all ${noise.length} entries in "Likely noise"? This removes them from the queue.`
      )
    )
      return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const item of noise) {
      try {
        await adminPost("/unmatched/ignore", { rawName: item.raw_name });
        removeRow(item.raw_name);
        ok++;
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    if (failed === 0) pushToast("success", `Ignored ${ok} noise entries`);
    else pushToast("error", `Ignored ${ok}, ${failed} failed`);
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
            Unmatched review queue
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Resolve scraped service names into canonical services — map,
            promote, or ignore.
          </p>
        </div>
        {!loading && (
          <Badge
            variant="outline"
            className="shrink-0 bg-pink-50 text-pink-700 border-pink-200 font-medium"
          >
            {items.length} remaining
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("review")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
            tab === "review"
              ? "bg-[linear-gradient(90deg,rgba(222,127,76,0.12)_0%,rgba(195,65,215,0.12)_100%)] text-purple-700"
              : "text-slate-600 hover:bg-pink-50/70 hover:text-purple-700"
          }`}
        >
          Needs review
          <Badge
            variant="secondary"
            className="bg-white/70 text-slate-600 border border-slate-200 tabular-nums"
          >
            {review.length}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setTab("noise")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
            tab === "noise"
              ? "bg-[linear-gradient(90deg,rgba(222,127,76,0.12)_0%,rgba(195,65,215,0.12)_100%)] text-purple-700"
              : "text-slate-600 hover:bg-pink-50/70 hover:text-purple-700"
          }`}
        >
          Likely noise
          <Badge
            variant="secondary"
            className="bg-white/70 text-slate-600 border border-slate-200 tabular-nums"
          >
            {noise.length}
          </Badge>
        </button>

        {tab === "noise" && noise.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleIgnoreAllNoise}
            disabled={bulkBusy}
            className="ml-auto h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
          >
            {bulkBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Ignore all in Likely-noise
          </Button>
        )}
      </div>

      {/* Body */}
      <Card className="border-pink-100/80 shadow-sm">
        <CardHeader className="p-0" />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-400 text-sm">
              <Loader2 size={18} className="animate-spin" />
              Loading queue…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Inbox size={36} className="opacity-30" />
              <p>
                {tab === "review"
                  ? "Nothing left to review. Nice work!"
                  : "No likely-noise entries."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-pink-100 bg-pink-50/40 hover:bg-pink-50/40">
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Raw name
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Clinics
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[180px]">
                    Suggestion
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[360px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <UnmatchedRow
                    key={item.raw_name}
                    item={item}
                    services={services}
                    serviceOptions={serviceOptions}
                    suggestedServiceId={
                      item.suggestion
                        ? slugToServiceId.get(item.suggestion.slug) ?? ""
                        : ""
                    }
                    busy={!!busy[item.raw_name]}
                    onMap={handleMap}
                    onIgnore={handleIgnore}
                    onPromote={() => setPromoteFor(item)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Promote modal */}
      <PromoteDialog
        item={promoteFor}
        onClose={() => setPromoteFor(null)}
        onPromoted={(rawName, name) => {
          removeRow(rawName);
          setPromoteFor(null);
          pushToast("success", `Promoted "${rawName}" → new service "${name}"`);
          // pull in the freshly created service for future mapping
          void adminGet<Service[]>("/services").then(setServices).catch(() => {});
        }}
        onError={(msg) => pushToast("error", msg)}
      />

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-[0_12px_40px_rgba(170,78,179,0.18)] ring-1 ${
              t.kind === "success"
                ? "bg-white text-emerald-700 ring-emerald-200"
                : "bg-white text-red-700 ring-red-200"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-500 shrink-0" />
            )}
            <span className="max-w-xs">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="ml-1 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Row -------------------------------------------------------------------

function UnmatchedRow({
  item,
  services,
  serviceOptions,
  suggestedServiceId,
  busy,
  onMap,
  onIgnore,
  onPromote,
}: {
  item: UnmatchedItem;
  services: Service[];
  serviceOptions: DropdownOption[];
  suggestedServiceId: string;
  busy: boolean;
  onMap: (item: UnmatchedItem, serviceId: string) => void;
  onIgnore: (item: UnmatchedItem) => void;
  onPromote: () => void;
}) {
  const [selected, setSelected] = useState(suggestedServiceId);

  const suggestionService = item.suggestion
    ? services.find((s) => s.slug === item.suggestion?.slug)
    : undefined;

  return (
    <TableRow className="border-pink-50 hover:bg-pink-50/30 transition-colors align-top">
      <TableCell className="font-medium text-slate-800 text-sm py-3">
        {item.raw_name}
      </TableCell>

      <TableCell className="py-3">
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-600 border-slate-200 tabular-nums"
        >
          {item.clinic_count}
        </Badge>
      </TableCell>

      <TableCell className="py-3">
        {item.suggestion ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-purple-700 font-medium flex items-center gap-1">
              <Sparkles size={12} className="text-purple-400" />
              {suggestionService?.name ?? item.suggestion.slug}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {Math.round(item.suggestion.confidence * 100)}% match
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </TableCell>

      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          {/* MAP */}
          <div className="flex items-center gap-1.5">
            <div className="w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <SearchableDropdown
                options={serviceOptions}
                value={selected}
                onChange={setSelected}
                placeholder="Map to service…"
              />
            </div>
            <Button
              variant="gradient"
              size="sm"
              disabled={busy || !selected}
              onClick={() => onMap(item, selected)}
              className="h-8 gap-1"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Wand2 size={13} />
              )}
              Map
            </Button>
          </div>

          {/* PROMOTE */}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onPromote}
            className="h-8 gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles size={13} />
            Promote
          </Button>

          {/* IGNORE */}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onIgnore(item)}
            className="h-8 gap-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} />
            Ignore
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---- Promote dialog --------------------------------------------------------

function PromoteDialog({
  item,
  onClose,
  onPromoted,
  onError,
}: {
  item: UnmatchedItem | null;
  onClose: () => void;
  onPromoted: (rawName: string, name: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // reset fields whenever a new item is opened
  useEffect(() => {
    if (item) {
      setName(item.raw_name);
      setCategory("");
    }
  }, [item]);

  const categoryOptions = useMemo<DropdownOption[]>(
    () => PROMOTE_CATEGORIES.map((c) => ({ label: c, value: c })),
    []
  );

  async function submit() {
    if (!item || !name.trim()) return;
    setSubmitting(true);
    try {
      await adminPost("/unmatched/promote", {
        rawName: item.raw_name,
        name: name.trim(),
        ...(category ? { category } : {}),
      });
      onPromoted(item.raw_name, name.trim());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to a new service</DialogTitle>
          <DialogDescription>
            Creates a pending (unpublished) canonical service and maps every
            clinic using{" "}
            <span className="font-medium text-foreground">
              {item?.raw_name}
            </span>{" "}
            onto it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promote-name">Service name</Label>
            <Input
              id="promote-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Microneedling"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promote-category">Category (optional)</Label>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <SearchableDropdown
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                placeholder="Choose a category…"
              />
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            Promote service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
