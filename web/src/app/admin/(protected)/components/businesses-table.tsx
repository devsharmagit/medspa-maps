"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Loader2, ToggleLeft, ToggleRight, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { ApiResponse } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export interface Business {
  id: string;
  name: string;
  tier: string;
  verified: boolean;
  data_source: string;
  is_active: boolean;
  created_at: string;
  g99_business_id: string | null;
  g99_tenant_id: string | null;
}

interface Props {
  initialData: Business[];
  searchQuery: string;
  currentPage: number;
  totalPages: number;
}

export default function BusinessesTable({ initialData, searchQuery, currentPage, totalPages }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Business[]>(initialData);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchQuery);
  const [pendingDelete, setPendingDelete] = useState<Business | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/businesses?q=${encodeURIComponent(search)}&page=1`);
  }

  function goToPage(page: number) {
    router.push(`/admin/businesses?q=${encodeURIComponent(searchQuery)}&page=${page}`);
  }

  async function handleToggle(business: Business, e: React.MouseEvent) {
    e.stopPropagation();
    setTogglingId(business.id);
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !business.is_active }),
      });
      const json: ApiResponse<any> = await res.json();
      if (json.success) {
        setData((prev) => prev.map((item) => (item.id === business.id ? { ...item, is_active: !item.is_active } : item)));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
      const json: ApiResponse = await res.json();
      if (json.success) {
        setData((prev) => prev.filter((item) => item.id !== id));
        setPendingDelete(null);
      } else {
        setDeleteError(json.error);
      }
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-9">Search</Button>
        </form>
      </CardHeader>
      
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
            <Building2 size={36} className="opacity-30" />
            <p>No businesses found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Business Name</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[120px]">Tier</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[100px]">Status</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[130px]">Added</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={`border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors ${!item.is_active ? "opacity-50" : ""}`}
                  onClick={() => router.push(`/admin/businesses/${item.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3 font-medium text-slate-800 text-sm">
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                        <Building2 size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="text-[11px] text-slate-400 font-normal">{item.id}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs font-medium text-slate-600 bg-slate-50">{item.tier}</Badge>
                    {item.verified && <Badge variant="default" className="ml-1 bg-blue-50 text-blue-600 hover:bg-blue-50 text-[10px] px-1 py-0 h-4 border-blue-200">✓</Badge>}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={item.is_active ? "default" : "secondary"}
                      className={
                        item.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-100"
                      }
                    >
                      {item.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-[13px] text-slate-500 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline" size="sm"
                        onClick={(e) => handleToggle(item, e)}
                        disabled={togglingId === item.id || deletingId === item.id}
                        className={`h-7 px-2.5 text-xs gap-1 border ${item.is_active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        {togglingId === item.id ? <Loader2 size={12} className="animate-spin" /> : item.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {item.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setPendingDelete(item);
                        }}
                        disabled={deletingId === item.id || togglingId === item.id}
                        className="h-7 px-2.5 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                      >
                        {deletingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 border-slate-200 text-slate-600"
            >
              <ChevronLeft size={14} className="mr-1" /> Prev
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-8 border-slate-200 text-slate-600"
            >
              Next <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>

    <Dialog
      open={pendingDelete !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPendingDelete(null);
          setDeleteError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete business?</DialogTitle>
          <DialogDescription>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{pendingDelete?.name}</span>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPendingDelete(null);
              setDeleteError(null);
            }}
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
            {deletingId !== null ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
