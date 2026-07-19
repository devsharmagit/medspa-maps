"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  UserCircle2,
  Building2,
  ArrowRight,
  ExternalLink,
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
import { Label } from "@/components/ui/label";

interface ProviderListItem {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  card_tagline: string | null;
  is_active: boolean;
  created_at: string;
  clinic_name: string;
}

interface ClinicListItem {
  id: string;
  name: string;
  is_active: boolean;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Clinic selection modal for adding a provider
  const [showAddModal, setShowAddModal] = useState(false);
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState("");

  // Delete modal states
  const [pendingDelete, setPendingDelete] = useState<ProviderListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Enable/disable modal states
  const [pendingToggle, setPendingToggle] = useState<ProviderListItem | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminGet<ProviderListItem[]>("/providers")
      .then((data) => {
        if (active) {
          setProviders(data);
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
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.title ?? "").toLowerCase().includes(q) ||
        p.clinic_name.toLowerCase().includes(q)
    );
  }, [providers, search]);

  // Load clinics list when showing the selection modal
  async function openAddModal() {
    setShowAddModal(true);
    if (clinics.length > 0) return;
    setLoadingClinics(true);
    try {
      const data = await adminGet<ClinicListItem[]>("/clinics");
      // Published clinics first, then alphabetical — easier to pick a live one.
      data.sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)
      );
      setClinics(data);
    } catch (err) {
      console.error("Failed to load clinics", err);
    } finally {
      setLoadingClinics(false);
    }
  }

  function handleAddContinue() {
    if (!selectedClinicId) return;
    setShowAddModal(false);
    router.push(`/admin/clinics/${selectedClinicId}/providers/new?backUrl=/admin/providers`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminDelete(`/providers/${pendingDelete.id}`);
      setProviders((prev) => prev.filter((p) => p.id !== pendingDelete.id));
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
      await adminPatch(`/providers/${pendingToggle.id}`, { is_active: next });
      setProviders((prev) =>
        prev.map((p) => (p.id === pendingToggle.id ? { ...p, is_active: next } : p))
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
          <h2 className="text-lg font-semibold text-slate-900">Providers</h2>
          <p className="text-sm text-slate-500">
            Manage medical professionals and clinical providers across all locations.
          </p>
        </div>
        <Button
          onClick={openAddModal}
          className="shrink-0 bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] text-white hover:opacity-95"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Provider
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, title, or clinic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading providers...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-red-500 text-sm">
              <p>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Users size={36} className="opacity-30" />
              <p>No providers found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Provider
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Clinic Location
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[340px]">
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
                        <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserCircle2 size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {item.name}
                            {item.is_verified && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1.5 text-[9px] bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-50 shrink-0"
                              >
                                Verified
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {item.id.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-[13px] text-slate-600 inline-flex items-center gap-1">
                        <Building2 size={13} className="text-slate-400" />
                        {item.clinic_name}
                      </span>
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
                        {item.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 font-sans">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Link
                            href={`/providers/${item.id}/${slugify(item.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={12} /> View
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Link href={`/admin/providers/${item.id}/edit?backUrl=/admin/providers`}>
                            <Pencil size={12} /> Edit
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
                          {item.is_active ? "Disable" : "Enable"}
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

      {/* Select Clinic Dialog Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select a Clinic</DialogTitle>
            <DialogDescription>
              Providers are linked to clinics. Please choose the clinic to which you want to add the new provider.
            </DialogDescription>
          </DialogHeader>

          {loadingClinics ? (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin mr-1.5" /> Loading clinics list...
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 py-4">
              <Label htmlFor="clinic-select">Select Location</Label>
              <select
                id="clinic-select"
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2"
              >
                <option value="">-- Choose a clinic --</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.is_active ? "Published" : "Unpublished"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddContinue}
              disabled={!selectedClinicId}
              className="gap-1 bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] text-white hover:opacity-95"
            >
              Continue <ArrowRight size={13} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete provider profile?</DialogTitle>
            <DialogDescription>
              This will permanently delete the provider profile for{" "}
              <span className="font-medium text-slate-900">
                {pendingDelete?.name}
              </span>
              . This action cannot be undone.
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
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable / Disable Confirmation Dialog */}
      <Dialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.is_active ? "Disable provider?" : "Enable provider?"}
            </DialogTitle>
            <DialogDescription>
              {pendingToggle?.is_active ? (
                <>
                  <span className="font-medium text-slate-900">
                    {pendingToggle?.name}
                  </span>{" "}
                  will be hidden from the public site and any concern/clinic pages
                  they appear on. You can re-enable them at any time.
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900">
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
              {pendingToggle?.is_active ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
