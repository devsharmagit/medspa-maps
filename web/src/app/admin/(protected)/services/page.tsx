"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  AlertCircle,
  Eye,
} from "lucide-react";
import { adminGet, adminDelete, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Service } from "./service-form";

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Service | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await adminGet<Service[]>("/services");
      setServices(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load treatments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q) ||
        (s.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [services, search]);

  function editHref(service: Service) {
    return `/admin/services/${service.id}/edit`;
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.id);
    setActionError(null);
    try {
      await adminDelete(`/services/${target.id}`);
      setServices((cur) => cur.filter((s) => s.id !== target.id));
      setPendingDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete treatment");
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    const target = pendingToggle;
    const next = !target.is_active;
    setTogglingId(target.id);
    setActionError(null);
    try {
      await adminPatch(`/services/${target.id}`, { is_active: next });
      setServices((cur) =>
        cur.map((s) => (s.id === target.id ? { ...s, is_active: next } : s))
      );
      setPendingToggle(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update treatment");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Treatments</h2>
          <p className="text-sm text-slate-500">
            Manage the catalog of treatments offered across clinics.
          </p>
        </div>
        <Button asChild variant="gradient" size="lg" className="gap-1.5">
          <Link href="/admin/services/new">
            <Plus size={16} />
            New Treatment
          </Link>
        </Button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex gap-2 max-w-sm relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, category, alias…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={28} className="animate-spin opacity-50" />
              <p>Loading treatments…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-red-600">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Sparkles size={36} className="opacity-30" />
              <p>{search ? "No treatments match your search." : "No treatments yet."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Treatment
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Category
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      Aliases
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[90px]">
                      Clinics
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[130px]">
                      Status
                    </TableHead>
                    <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[280px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors",
                        !item.is_active && "opacity-50"
                      )}
                      onClick={() => router.push(editHref(item))}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                            <Sparkles size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-400">{item.slug}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {item.category ? (
                          <span className="text-[13px] text-slate-600">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[13px] italic">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {item.aliases && item.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[260px]">
                            {item.aliases.slice(0, 4).map((alias) => (
                              <Badge
                                key={alias}
                                variant="secondary"
                                className="bg-pink-50 text-purple-700 border border-pink-100"
                              >
                                {alias}
                              </Badge>
                            ))}
                            {item.aliases.length > 4 && (
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 text-slate-500 border border-slate-200"
                              >
                                +{item.aliases.length - 4}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[13px] italic">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="text-[13px] font-medium text-slate-700 tabular-nums">
                          {item.clinic_count}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }
                        >
                          {item.is_active ? "Published" : "Unpublished"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <a
                              href={`/treatments/${item.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Eye size={12} />
                              View
                            </a>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <Link href={editHref(item)}>
                              <Pencil size={12} />
                              Edit
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingToggle(item)}
                            disabled={togglingId === item.id}
                            className={`h-7 px-2.5 text-xs gap-1 border ${
                              item.is_active
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {togglingId === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : item.is_active ? (
                              <ToggleRight size={12} />
                            ) : (
                              <ToggleLeft size={12} />
                            )}
                            {item.is_active ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingDelete(item)}
                            disabled={deletingId === item.id}
                            className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          >
                            {deletingId === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete treatment permanently?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name}
              </span>{" "}
              and removes it from every clinic, provider and concern it is linked
              to. This cannot be undone. To only hide it, use Unpublish instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="gap-1.5"
            >
              {deletingId !== null ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.is_active
                ? "Unpublish treatment?"
                : "Publish treatment?"}
            </DialogTitle>
            <DialogDescription>
              {pendingToggle?.is_active ? (
                <>
                  <span className="font-medium text-foreground">
                    {pendingToggle?.name}
                  </span>{" "}
                  will be hidden from the public site and treatment listings.
                  Nothing is deleted — you can re-publish anytime.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {pendingToggle?.name}
                  </span>{" "}
                  will become visible on the public site again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingToggle(null)}
              disabled={togglingId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmToggle}
              disabled={togglingId !== null}
              className={
                pendingToggle?.is_active
                  ? "gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                  : "gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {togglingId !== null ? (
                <Loader2 size={14} className="animate-spin" />
              ) : pendingToggle?.is_active ? (
                <ToggleLeft size={14} />
              ) : (
                <ToggleRight size={14} />
              )}
              {pendingToggle?.is_active ? "Unpublish" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
