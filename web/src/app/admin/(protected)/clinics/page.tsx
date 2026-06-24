"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { adminGet, adminDelete } from "@/lib/admin/client";
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
  business_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  review_count: number;
  is_active: boolean;
  created_at: string;
}

export default function ClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ClinicListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        c.business_name.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.state ?? "").toLowerCase().includes(q)
    );
  }, [clinics, search]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminDelete(`/clinics/${pendingDelete.id}`);
      setClinics((prev) =>
        prev.map((c) =>
          c.id === pendingDelete.id ? { ...c, is_active: false } : c
        )
      );
      setPendingDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
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
                    Business
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Location
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Reviews
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[200px]">
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
                      <Link
                        href={`/admin/businesses/${item.business_id}`}
                        className="text-[13px] text-slate-600 hover:text-brand-purple transition-colors"
                      >
                        {item.business_name}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin size={12} className="text-slate-400" />
                        {item.city && item.state
                          ? `${item.city}, ${item.state}`
                          : "No location"}
                      </div>
                    </TableCell>

                    <TableCell className="text-[13px] text-slate-600">
                      {item.review_count ?? 0}
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
                          onClick={() => setPendingDelete(item)}
                          disabled={!item.is_active}
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
            <DialogTitle>Unpublish clinic?</DialogTitle>
            <DialogDescription>
              This will soft-delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name}
              </span>{" "}
              by setting it inactive. It will no longer appear publicly. You can
              re-publish it later from the edit page.
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
              Unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
