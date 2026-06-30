"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Plus,
  MessageSquareQuote,
  Star,
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
  CardTitle,
} from "@/components/ui/card";
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
import { StarPicker } from "@/components/admin/star-picker";

const BRAND = "#9b3a9b";

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

interface FormState {
  rating: number | null;
  body: string;
  reviewer_name: string;
}

const EMPTY_FORM: FormState = {
  rating: 5,
  body: "",
  reviewer_name: "",
};

/**
 * Manage the reviews for a single clinic: list, add, edit, approve/unapprove,
 * and (soft) delete. Each action hits the existing /api/admin/reviews endpoints
 * immediately — the DB trigger recomputes the clinic's avg_rating / review_count.
 *
 * NOTE: this renders inside the clinic edit <form>, so every inline action
 * button is type="button" to avoid submitting the clinic form. The add/edit
 * dialogs render their own <form> inside a portaled Radix Dialog, so they are
 * not nested in the edit form's DOM tree.
 */
export function ClinicReviewsManager({ clinicId }: { clinicId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<Review[]>(
        `/reviews?clinicId=${encodeURIComponent(clinicId)}`
      );
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Only show active reviews (soft-deleted ones are is_active = false).
  const visible = useMemo(() => reviews.filter((r) => r.is_active), [reviews]);

  async function handleToggleApprove(review: Review) {
    setTogglingId(review.id);
    try {
      const updated = await adminPatch<Review>(`/reviews/${review.id}`, {
        is_approved: !review.is_approved,
      });
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
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
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.body.trim()) {
      setAddError("Review body is required.");
      return;
    }
    setAddSaving(true);
    try {
      const created = await adminPost<Review>("/reviews", {
        clinic_id: clinicId,
        rating: addForm.rating,
        body: addForm.body.trim(),
        reviewer_name: addForm.reviewer_name.trim() || null,
        // source defaults to "internal" server-side.
      });
      setAddOpen(false);
      setReviews((prev) => [created, ...prev]);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add review.");
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(review: Review) {
    setEditTarget(review);
    setEditForm({
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
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Star size={16} style={{ color: BRAND }} />
          Reviews
          <Badge variant="secondary" className="font-normal">
            {visible.length}
          </Badge>
        </CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus size={14} /> Add review
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-6">
        <p className="text-xs text-slate-500">
          Reviews save immediately and recompute this clinic&apos;s rating. They
          are independent of the Save Clinic button above.
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <Loader2 size={24} className="animate-spin opacity-50" />
            <p>Loading reviews…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <MessageSquareQuote size={32} className="opacity-30" />
            <p>No reviews yet for this clinic.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((review) => {
              const busy =
                togglingId === review.id || deletingId === review.id;
              return (
                <div
                  key={review.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {review.rating != null ? (
                        <StarRating
                          rating={review.rating}
                          className="gap-0.5"
                          starClassName="size-4"
                        />
                      ) : (
                        <span className="text-xs italic text-slate-400">
                          No rating
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-700">
                        {review.reviewer_name || (
                          <span className="italic text-slate-400">
                            Anonymous
                          </span>
                        )}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 capitalize"
                      >
                        {review.source}
                      </Badge>
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
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
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
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(review)}
                        disabled={busy}
                        className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={12} />
                      </Button>

                      <Button
                        type="button"
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
                  </div>

                  <p className="text-[13px] leading-relaxed text-slate-600">
                    {review.body || (
                      <span className="italic text-slate-400">(empty)</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* ── Add Review dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Review</DialogTitle>
            <DialogDescription>
              Create an internal review for this clinic. The clinic rating
              recomputes automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
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

            {addError && <p className="text-sm text-red-600">{addError}</p>}

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

            {editError && <p className="text-sm text-red-600">{editError}</p>}

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
    </Card>
  );
}
