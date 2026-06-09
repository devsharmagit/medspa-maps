"use client";

import { useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Globe, Building2, Loader2, ExternalLink } from "lucide-react";
import type { ApiResponse } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Business {
  id: string;
  name: string;
  website_url: string;
  is_enabled: boolean;
  created_at: string;
}

export default function BusinessesTable({ initialBusinesses }: { initialBusinesses: Business[] }) {
  const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openDialog() { setShowDialog(true); setFormError(""); }
  function closeDialog() { setShowDialog(false); setFormError(""); setNewName(""); setNewUrl(""); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, website_url: newUrl }),
      });
      const json: ApiResponse<Business> = await res.json();
      if (!json.success) { setFormError(json.error ?? "Failed to add business."); return; }
      setBusinesses((prev) => [json.data, ...prev]);
      closeDialog();
    } catch {
      setFormError("Something went wrong.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggle(business: Business) {
    setTogglingId(business.id);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !business.is_enabled }),
      });
      const json: ApiResponse<Business> = await res.json();
      if (json.success) setBusinesses((prev) => prev.map((b) => (b.id === business.id ? json.data : b)));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this business? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
      const json: ApiResponse = await res.json();
      if (json.success) setBusinesses((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base text-slate-900">Businesses</CardTitle>
            <CardDescription>{businesses.length} total listings</CardDescription>
          </div>
          <Button size="sm" onClick={openDialog} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
            <Plus size={14} />
            Add Business
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Building2 size={36} className="opacity-30" />
              <p>No businesses yet. Add your first one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[260px]">Business Name</TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Website</TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[100px]">Status</TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[130px]">Added</TableHead>
                  <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((b) => (
                  <TableRow key={b.id} className={`border-slate-100 ${!b.is_enabled ? "opacity-50" : ""}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium text-slate-800 text-sm">
                        <div className="w-7 h-7 rounded-md bg-slate-50 flex items-center justify-center text-slate-900 shrink-0">
                          <Building2 size={13} />
                        </div>
                        {b.name}
                      </div>
                    </TableCell>

                    <TableCell>
                      <a
                        href={b.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-[13px] transition-colors max-w-[240px] truncate"
                      >
                        <Globe size={12} className="shrink-0" />
                        {b.website_url.replace(/^https?:\/\//, "")}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={b.is_enabled ? "default" : "secondary"}
                        className={
                          b.is_enabled
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }
                      >
                        {b.is_enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-[13px] text-slate-400 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(b)}
                          disabled={togglingId === b.id || deletingId === b.id}
                          className={`h-7 px-2.5 text-xs gap-1 border ${
                            b.is_enabled
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {togglingId === b.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : b.is_enabled ? (
                            <ToggleRight size={12} />
                          ) : (
                            <ToggleLeft size={12} />
                          )}
                          {b.is_enabled ? "Disable" : "Enable"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(b.id)}
                          disabled={deletingId === b.id || togglingId === b.id}
                          className="h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {deletingId === b.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Delete
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

      {/* Add Business Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Add Business</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdd} className="flex flex-col gap-4 pt-2" id="add-business-form">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                {formError}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="business-name" className="text-slate-700">Business Name</Label>
              <Input
                id="business-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Luxe Medspa & Wellness"
                required
                className="border-slate-300 focus-visible:ring-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="business-url" className="text-slate-700">Website URL</Label>
              <Input
                id="business-url"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="border-slate-300 focus-visible:ring-slate-900"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="border-slate-300 text-slate-600">
                Cancel
              </Button>
              <Button
                id="dialog-submit"
                type="submit"
                disabled={formLoading}
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
              >
                {formLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Add Business
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
