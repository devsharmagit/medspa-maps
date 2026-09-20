"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Users,
  BadgeCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { adminGet, adminPost, adminPut, adminPatch, adminDelete } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProviderForm } from "@/app/admin/(protected)/providers/provider-form";

const BRAND = "#9b3a9b";

/** Imperative handle so the parent can flush staged edits on "Save Clinic". */
export interface ClinicManagerHandle {
  flush: () => Promise<void>;
}

interface ProviderSummary {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

/** Working row: a provider plus staging flags used in deferred mode. */
interface Row {
  id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  /** Only populated once the row is created/edited in the dialog. */
  expertise_summary?: string;
  is_verified: boolean;
  is_active: boolean;
  _new?: boolean;
  _dirty?: boolean;
}

interface EditedFields {
  name: string;
  title: string | null;
  image_url: string | null;
  expertise_summary: string;
}

/**
 * Providers CRUD widget for the clinic edit page.
 *
 * - Default (immediate) mode: add/edit/delete/toggle hit the provider APIs at once.
 * - `deferred` mode: all actions mutate local state only; the parent calls
 *   `flush()` (via ref) on "Save Clinic" to persist the diff.
 */
export const ClinicProvidersManager = forwardRef<ClinicManagerHandle, {
  clinicId: string;
  deferred?: boolean;
  onDirtyChange?: () => void;
}>(function ClinicProvidersManager({ clinicId, deferred = false, onDirtyChange }, ref) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Snapshot of the loaded state, for computing the flush diff in deferred mode.
  const initialIdsRef = useRef<Set<string>>(new Set());
  const initialActiveRef = useRef<Map<string, boolean>>(new Map());
  const rowsRef = useRef<Row[]>([]);
  const tempIdRef = useRef(0);

  rowsRef.current = rows;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<ProviderSummary[]>(`/clinics/${clinicId}/providers`);
      const mapped: Row[] = data.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        image_url: p.image_url,
        is_verified: p.is_verified,
        is_active: p.is_active,
      }));
      setRows(mapped);
      initialIdsRef.current = new Set(mapped.map((r) => r.id));
      initialActiveRef.current = new Map(mapped.map((r) => [r.id, r.is_active]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  function markDirty() {
    onDirtyChange?.();
  }

  function openAdd() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
  }

  // ── Deferred (staged) handlers ──────────────────────────────────────────────
  function stageEdited(data: EditedFields) {
    if (editingId) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? { ...r, ...data, _dirty: r._new ? r._dirty : true }
            : r
        )
      );
    } else {
      const tempId = `new-${tempIdRef.current++}`;
      setRows((prev) => [
        ...prev,
        { id: tempId, ...data, is_verified: false, is_active: true, _new: true },
      ]);
    }
    markDirty();
    closeDialog();
  }

  function stageToggleActive(row: Row) {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    );
    markDirty();
  }

  function stageDelete(row: Row) {
    if (!confirm(`Delete provider "${row.name}"? This will apply when you save the clinic.`)) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    markDirty();
  }

  // ── Immediate handlers (standalone / non-deferred) ─────────────────────────
  async function handleSavedImmediate() {
    closeDialog();
    await load();
  }

  async function toggleActiveImmediate(row: Row) {
    setTogglingId(row.id);
    try {
      await adminPatch(`/providers/${row.id}`, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update provider");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteImmediate(row: Row) {
    if (!confirm(`Delete provider "${row.name}"? This cannot be undone.`)) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await adminDelete(`/providers/${row.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete provider");
    } finally {
      setDeletingId(null);
    }
  }

  // ── flush(): persist the staged diff (deferred mode) ───────────────────────
  useImperativeHandle(ref, () => ({
    async flush() {
      if (!deferred) return;
      const current = rowsRef.current;

      // Deletions: initial ids no longer present.
      for (const id of initialIdsRef.current) {
        if (!current.some((r) => r.id === id)) {
          await adminDelete(`/providers/${id}`);
        }
      }

      // Creates + updates.
      for (const r of current) {
        const payload = {
          name: r.name,
          title: r.title,
          image_url: r.image_url,
          expertise_summary: r.expertise_summary ?? "",
        };
        if (r._new) {
          const created = await adminPost<{ id: string }>(
            `/clinics/${clinicId}/providers`,
            payload
          );
          if (r.is_active === false && created?.id) {
            await adminPatch(`/providers/${created.id}`, { is_active: false });
          }
        } else {
          if (r._dirty) {
            await adminPut(`/providers/${r.id}`, payload);
          }
          const initActive = initialActiveRef.current.get(r.id);
          if (initActive !== undefined && initActive !== r.is_active) {
            await adminPatch(`/providers/${r.id}`, { is_active: r.is_active });
          }
        }
      }

      await load();
    },
  }), [deferred, clinicId, load]);

  const onToggle = deferred ? stageToggleActive : toggleActiveImmediate;
  const onDelete = deferred ? stageDelete : handleDeleteImmediate;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users size={18} style={{ color: BRAND }} />
          Providers
          {rows.length > 0 && (
            <span className="text-sm font-normal text-slate-400">({rows.length})</span>
          )}
        </CardTitle>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={openAdd}>
          <Plus size={14} /> Add provider
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {deferred && (
          <p className="mb-3 text-xs text-slate-400">
            Provider changes are saved when you click <strong>Save Clinic</strong>.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" /> Loading providers…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No providers yet. Add one to show it on the public clinic page.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Users size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
                    {p.is_verified && <BadgeCheck size={14} className="shrink-0 text-blue-600" />}
                    {p._new && (
                      <Badge className="border border-amber-200 bg-amber-50 text-amber-700">New</Badge>
                    )}
                  </div>
                  {p.title && <p className="truncate text-xs text-slate-500">{p.title}</p>}
                </div>
                <Badge
                  className={
                    p.is_active
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : "border border-slate-200 bg-slate-50 text-slate-500"
                  }
                >
                  {p.is_active ? "Active" : "Hidden"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onToggle(p)}
                  disabled={togglingId === p.id}
                  title={p.is_active ? "Hide from public page" : "Show on public page"}
                >
                  {togglingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : p.is_active ? (
                    <XCircle size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => openEdit(p.id)}
                >
                  <Pencil size={14} /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(p)}
                  disabled={deletingId === p.id}
                  title="Delete provider"
                >
                  {deletingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit provider" : "Add provider"}</DialogTitle>
          </DialogHeader>
          {dialogOpen && (() => {
            const editingRow = editingId ? rows.find((r) => r.id === editingId) : undefined;
            // In deferred mode, seed staged values for new/edited rows so unsaved
            // edits survive re-opening; fetch by id only for pristine existing rows.
            const useStaged = deferred && editingRow && (editingRow._new || editingRow._dirty);
            const providerId =
              editingId && !editingId.startsWith("new-") && !useStaged ? editingId : undefined;
            return (
              <ProviderForm
                key={editingId ?? "new"}
                clinicId={clinicId}
                providerId={providerId}
                embedded
                {...(useStaged && editingRow
                  ? {
                      initialData: {
                        name: editingRow.name,
                        title: editingRow.title,
                        image_url: editingRow.image_url,
                        expertise_summary: editingRow.expertise_summary ?? "",
                      },
                    }
                  : {})}
                {...(deferred
                  ? { onSubmitData: stageEdited, onCancel: closeDialog }
                  : { onSaved: handleSavedImmediate, onCancel: closeDialog, onDeleted: handleSavedImmediate })}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
});
