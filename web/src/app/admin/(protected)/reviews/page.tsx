"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Plus,
  MessageSquareQuote,
} from "lucide-react";
import {
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
} from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/ui/star-rating";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";

interface Review {
  id: string;
  clinic_id: string | null;
  rating: number | null;
  body: string | null;
  reviewer_name: string | null;
  source: string;
  source_url: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ClinicListItem {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

// ── A small interactive star picker for the create/edit forms ────────────────
function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={22}
            className={
              n <= active
                ? "fill-brand-star text-brand-star"
                : "text-brand-star/30"
            }
          />
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-2 text-xs text-slate-400 hover:text-slate-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}

interface FormState {
  clinic_id: string;
  rating: number | null;
  body: string;
  reviewer_name: string;
}

const EMPTY_FORM: FormState = {
  clinic_id: "",
  rating: 5,
  body: "",
  reviewer_name: "",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clinicFilter, setClinicFilter] = useState("");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const clinicNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clinics) map.set(c.id, c.name);
    return map;
  }, [clinics]);

  const clinicOptions: DropdownOption[] = useMemo(
    () =>
      clinics.map((c) => ({
        value: c.id,
        label:
          c.city && c.state ? `${c.name} — ${c.city}, ${c.state}` : c.name,
      })),
    [clinics]
  );

  const loadReviews = useCallback(async (clinicId: string) => {
    setLoading(true);
    setError(null);
    try {
      const path = clinicId
        ? `/reviews?clinicId=${encodeURIComponent(clinicId)}`
        : "/reviews";
      const data = await adminGet<Review[]>(path);
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: clinics (for filter + form) and reviews.
  useEffect(() => {
    adminGet<ClinicListItem[]>("/clinics")
      .then(setClinics)
      .catch(() => {
        /* clinic dropdown is optional; ignore */
      });
  }, []);

  useEffect(() => {
    loadReviews(clinicFilter);
  }, [clinicFilter, loadReviews]);

  // Only show active reviews (soft-deleted ones are is_active = false).
  const visible = useMemo(
    () => reviews.filter((r) => r.is_active),
    [reviews]
  );

  async function handleToggleApprove(review: Review) {
    setTogglingId(review.id);
    try {
      const updated = await adminPatch<Review>(`/reviews/${review.id}`, {
        is_approved: !review.is_approved,
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? updated : r))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update review.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(review: Review) {
    if (
      !confirm(
        "Delete this review? It will be removed from the site and the clinic rating will recompute."
      )
    )
      return;
    setDeletingId(review.id);
    try {
      await adminDelete(`/reviews/${review.id}`);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete review.");
    } finally {
      setDeletingId(null);
    }
  }

  function openAdd() {
    setAddForm({
      ...EMPTY_FORM,
      clinic_id: clinicFilter || "",
    });
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.clinic_id) {
      setAddError("Please select a clinic.");
      return;
    }
    if (!addForm.body.trim()) {
      setAddError("Review body is required.");
      return;
    }
    setAddSaving(true);
    try {
      const created = await adminPost<Review>("/reviews", {
        clinic_id: addForm.clinic_id,
        rating: addForm.rating,
        body: addForm.body.trim(),
        reviewer_name: addForm.reviewer_name.trim() || null,
        // source defaults to "internal" server-side.
      });
      setAddOpen(false);
      // If the new review matches the current filter (or no filter), show it.
      if (!clinicFilter || clinicFilter === created.clinic_id) {
        setReviews((prev) => [created, ...prev]);
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add review.");
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(review: Review) {
    setEditTarget(review);
    setEditForm({
      clinic_id: review.clinic_id ?? "",
      rating: review.rating,
      body: review.body ?? "",
      reviewer_name: review.reviewer_name ?? "",
    });
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    if (!editForm.body.trim()) {
      setEditError("Review body cannot be empty.");
      return;
    }
    setEditSaving(true);
    try {
      const updated = await adminPatch<Review>(`/reviews/${editTarget.id}`, {
        rating: editForm.rating,
        body: editForm.body.trim(),
        reviewer_name: editForm.reviewer_name.trim() || null,
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === editTarget.id ? updated : r))
      );
      setEditTarget(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save review.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
          <p className="text-sm text-slate-500">
            Moderate, edit, and publish clinic reviews.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-1.5 bg-[linear-gradient(135deg,#DE7F4C_0%,#C341D7_100%)] text-white shadow-[0_4px_12px_rgba(195,65,215,0.25)] hover:opacity-90"
        >
          <Plus size={16} /> Add Review
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 max-w-sm">
            <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
              <SearchableDropdown
                options={[
                  { value: "", label: "All clinics" },
                  ...clinicOptions,
                ]}
                value={clinicFilter}
                onChange={setClinicFilter}
                placeholder="Filter by clinic…"
                label="Clinic"
              />
            </div>
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
              <p>Loading reviews…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <MessageSquareQuote size={36} className="opacity-30" />
              <p>No reviews found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Clinic
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[140px]">
                    Rating
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    Review
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[150px]">
                    Reviewer
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">
                    Source
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
                {visible.map((review) => {
                  const clinicName = review.clinic_id
                    ? clinicNameById.get(review.clinic_id) ?? "Unknown clinic"
                    : "—";
                  const busy =
                    togglingId === review.id || deletingId === review.id;
                  return (
                    <TableRow
                      key={review.id}
                      className="border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell>
                        <span className="font-semibold text-slate-900 text-sm">
                          {clinicName}
                        </span>
                      </TableCell>

                      <TableCell>
                        {review.rating != null ? (
                          <StarRating
                            rating={review.rating}
                            className="gap-0.5"
                            starClassName="size-4"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            No rating
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <p className="text-[13px] text-slate-600 line-clamp-2 max-w-[360px]">
                          {review.body || (
                            <span className="italic text-slate-400">
                              (empty)
                            </span>
                          )}
                        </p>
                      </TableCell>

                      <TableCell>
                        <span className="text-[13px] text-slate-700">
                          {review.reviewer_name || (
                            <span className="italic text-slate-400">
                              Anonymous
                            </span>
                          )}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 capitalize"
                        >
                          {review.source}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={review.is_approved ? "default" : "secondary"}
                          className={
                            review.is_approved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                              : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50"
                          }
                        >
                          {review.is_approved ? "Approved" : "Pending"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleApprove(review)}
                            disabled={busy}
                            className={`h-7 px-2.5 text-xs gap-1 border ${
                              review.is_approved
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {togglingId === review.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : review.is_approved ? (
                              <XCircle size={12} />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            {review.is_approved ? "Unapprove" : "Approve"}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(review)}
                            disabled={busy}
                            className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil size={12} />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(review)}
                            disabled={busy}
                            className="h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          >
                            {deletingId === review.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add Review dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Review</DialogTitle>
            <DialogDescription>
              Create an internal review for a clinic. The clinic rating
              recomputes automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Clinic</Label>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <SearchableDropdown
                  options={clinicOptions}
                  value={addForm.clinic_id}
                  onChange={(v) =>
                    setAddForm((f) => ({ ...f, clinic_id: v }))
                  }
                  placeholder="Select a clinic…"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rating</Label>
              <StarPicker
                value={addForm.rating}
                onChange={(n) => setAddForm((f) => ({ ...f, rating: n }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-reviewer">Reviewer name</Label>
              <Input
                id="add-reviewer"
                value={addForm.reviewer_name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, reviewer_name: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-body">Review</Label>
              <textarea
                id="add-body"
                value={addForm.body}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={4}
                placeholder="Write the review…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
              />
            </div>

            {addError && (
              <p className="text-sm text-red-600">{addError}</p>
            )}

            <Separator />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addSaving}
                className="gap-1.5 bg-[linear-gradient(135deg,#DE7F4C_0%,#C341D7_100%)] text-white hover:opacity-90"
              >
                {addSaving && <Loader2 size={14} className="animate-spin" />}
                Add Review
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Review dialog ── */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
            <DialogDescription>
              Update the rating, reviewer name, or body of this review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Rating</Label>
              <StarPicker
                value={editForm.rating}
                onChange={(n) => setEditForm((f) => ({ ...f, rating: n }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reviewer">Reviewer name</Label>
              <Input
                id="edit-reviewer"
                value={editForm.reviewer_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, reviewer_name: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-body">Review</Label>
              <textarea
                id="edit-body"
                value={editForm.body}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
              />
            </div>

            {editError && (
              <p className="text-sm text-red-600">{editError}</p>
            )}

            <Separator />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editSaving}
                className="gap-1.5 bg-[linear-gradient(135deg,#DE7F4C_0%,#C341D7_100%)] text-white hover:opacity-90"
              >
                {editSaving && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
