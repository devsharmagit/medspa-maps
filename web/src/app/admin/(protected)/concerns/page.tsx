"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HeartPulse,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
} from "lucide-react";
import { adminGet, adminDelete } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConcernListRow {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  is_active: boolean;
  service_count: number;
}

export default function ConcernsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ConcernListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ConcernListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<ConcernListRow[]>("/concerns");
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load concerns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
    );
  }, [rows, search]);

  function editHref(row: ConcernListRow) {
    return `/admin/concerns/${row.id}/edit`;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDelete(`/concerns/${deleteTarget.id}`);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete concern");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Concerns</h2>
          <p className="text-sm text-slate-500">
            Manage editorial concern pages and their linked services.
          </p>
        </div>
        <Button asChild variant="gradient" size="sm" className="h-9 gap-1.5">
          <Link href="/admin/concerns/new">
            <Plus size={15} /> New Concern
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="shadow-sm ring-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="relative flex max-w-sm gap-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search concerns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-white pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading concerns…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <HeartPulse size={36} className="opacity-30" />
              <p>No concerns found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Concern
                  </TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Services
                  </TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/50",
                      !item.is_active && "opacity-50"
                    )}
                    onClick={() => router.push(editHref(item))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 text-brand-purple">
                          <HeartPulse size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-normal text-slate-400">
                            /{item.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {item.service_count}{" "}
                      <span className="text-slate-400">
                        {item.service_count === 1 ? "service" : "services"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.is_published
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-100 text-slate-500"
                        }
                      >
                        {item.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.is_published ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-600"
                          >
                            <a
                              href={`/conditions/${item.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Eye size={12} /> View
                            </a>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            title="Publish this concern to view its public page"
                            className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-400"
                          >
                            <Eye size={12} /> View
                          </Button>
                        )}
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-slate-200 px-2.5 text-xs text-slate-600"
                        >
                          <Link href={editHref(item)}>
                            <Pencil size={12} /> Edit
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={12} />
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

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete concern?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be archived (soft-deleted) and hidden from the public site. You can restore it later.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
