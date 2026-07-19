"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  DatabaseZap,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  ToggleLeft,
  ToggleRight,
  Trash2,
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

interface ClinicListItem {
  id: string;
  name: string;
  slug: string;
  review_count: number;
  is_active: boolean;
  featured: boolean;
  created_at: string;
  location_count: number;
  location_cities: string | null;
  g99_clinic_id: string | null;
}

export default function ClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ClinicListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<ClinicListItem | null>(null);
  const [toggling, setToggling] = useState(false);
  const [featuringId, setFeaturingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminGet<ClinicListItem[]>("/clinics")
      .then((data) => {
        if (active) {
          setClinics(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location_cities ?? "").toLowerCase().includes(q)
    );
  }, [clinics, search]);

  async function toggleFeatured(item: ClinicListItem) {
    setFeaturingId(item.id);
    try {
      await adminPatch(`/clinics/${item.id}`, { featured: !item.featured });
      setClinics((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, featured: !c.featured } : c
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFeaturingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminDelete(`/clinics/${pendingDelete.id}`);
      setClinics((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    const next = !pendingToggle.is_active;
    setToggling(true);
    try {
      await adminPatch(`/clinics/${pendingToggle.id}`, { is_active: next });
      setClinics((prev) =>
        prev.map((c) => (c.id === pendingToggle.id ? { ...c, is_active: next } : c))
      );
      setPendingToggle(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Clinics</h2>
          <p className="text-sm text-slate-500">
            Manage all registered clinics and locations.
          </p>
        </div>
        <Button
          asChild
          className="shrink-0 bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] text-white hover:opacity-95"
        >
          <Link href="/admin/clinics/new">
            <Plus className="mr-1.5 h-4 w-4" /> Add Clinic
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, business, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading clinics...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-red-500 text-sm">
              <p>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Building2 size={36} className="opacity-30" />
              <p>No clinics found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Clinic Name
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Locations
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[150px]">
                    G99 ID
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[120px]">
                    Featured
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[320px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`border-slate-100 ${
                      !item.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                          <Building2 size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {item.id.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-[13px] text-slate-600">
                        {item.location_cities
                          ? item.location_cities
                          : item.location_count > 0
                            ? `${item.location_count} location${item.location_count > 1 ? "s" : ""}`
                            : "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      {item.g99_clinic_id ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 font-mono text-xs font-medium text-purple-700"
                          title={`Imported from Growth99 (clinic id ${item.g99_clinic_id})`}
                        >
                          <DatabaseZap size={11} />
                          #{item.g99_clinic_id}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={item.is_active ? "default" : "secondary"}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFeatured(item)}
                        disabled={featuringId === item.id}
                        className={`h-7 px-2.5 text-xs gap-1 border ${
                          item.featured
                            ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {featuringId === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Star
                            size={12}
                            className={item.featured ? "fill-amber-400 text-amber-500" : ""}
                          />
                        )}
                        {item.featured ? "Featured" : "Feature"}
                      </Button>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Link href={`/admin/clinics/${item.id}/edit`}>
                            <Pencil size={12} /> Edit
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Link
                            href={`/clinics/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={12} /> View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingToggle(item)}
                          className={`h-7 px-2.5 text-xs gap-1 border ${
                            item.is_active
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {item.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          {item.is_active ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingDelete(item)}
                          className="h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
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

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete clinic permanently?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name}
              </span>{" "}
              along with its providers, reviews, locations and treatment links.
              This cannot be undone. To only hide it, use Unpublish instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
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
              {pendingToggle?.is_active ? "Unpublish clinic?" : "Publish clinic?"}
            </DialogTitle>
            <DialogDescription>
              {pendingToggle?.is_active ? (
                <>
                  <span className="font-medium text-foreground">
                    {pendingToggle?.name}
                  </span>{" "}
                  will be hidden from the public site (its page, search and
                  listings). Nothing is deleted — you can re-publish anytime.
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
              disabled={toggling}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmToggle}
              disabled={toggling}
              className={
                pendingToggle?.is_active
                  ? "gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                  : "gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {toggling ? (
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
