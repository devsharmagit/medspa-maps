"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Loader2, MapPin, Star, ToggleLeft, ToggleRight, Trash2, ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { ApiResponse } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  about: string | null;
  is_active: boolean;
  verified: boolean;
  featured: boolean;
  tier: string;
  created_at: string;
  g99_clinic_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  yelp_url: string | null;
  avg_rating: string | null;
  review_count: number;
}

interface Props {
  initialData: Clinic[];
  searchQuery: string;
  currentPage: number;
  totalPages: number;
}

export default function ClinicsTable({ initialData, searchQuery, currentPage, totalPages }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Clinic[]>(initialData);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchQuery);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/clinics?q=${encodeURIComponent(search)}&page=1`);
  }

  function goToPage(page: number) {
    router.push(`/admin/clinics?q=${encodeURIComponent(searchQuery)}&page=${page}`);
  }

  async function handleToggle(clinic: Clinic, e: React.MouseEvent) {
    e.stopPropagation();
    setTogglingId(clinic.id);
    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !clinic.is_active }),
      });
      const json: ApiResponse = await res.json();
      if (json.success) {
        setData((prev) => prev.map((item) => (item.id === clinic.id ? { ...item, is_active: !item.is_active } : item)));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleFeature(clinic: Clinic, e: React.MouseEvent) {
    e.stopPropagation();
    setFeaturingId(clinic.id);
    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !clinic.featured }),
      });
      const json: ApiResponse = await res.json();
      if (json.success) {
        setData((prev) => prev.map((item) => (item.id === clinic.id ? { ...item, featured: !item.featured } : item)));
      }
    } finally {
      setFeaturingId(null);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this clinic? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/clinics/${id}`, { method: "DELETE" });
      const json: ApiResponse = await res.json();
      if (json.success) setData((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search clinics..."
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
            <p>No clinics found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Clinic Name</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Website</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[100px]">Status</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[110px]">Featured</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[130px]">Added</TableHead>
                <TableHead className="text-slate-500 font-semibold text-xs uppercase tracking-wider w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={`border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors ${!item.is_active ? "opacity-50" : ""}`}
                  onClick={() => router.push(`/admin/clinics/${item.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3 font-medium text-slate-800 text-sm">
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-coral/10 to-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                        <Building2 size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="text-xs text-slate-500">{item.id.split("-")[0]}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin size={12} className="text-slate-400" />
                      {item.city && item.state ? `${item.city}, ${item.state}` : "No location"}
                    </div>
                  </TableCell>

                  <TableCell>
                    {item.website ? (
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-brand-purple text-[13px] transition-colors max-w-[200px] truncate"
                      >
                        <Globe size={12} className="shrink-0" />
                        <span className="truncate">{item.website.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[13px] italic">No website</span>
                    )}
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

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline" size="sm"
                      onClick={(e) => handleFeature(item, e)}
                      disabled={featuringId === item.id || deletingId === item.id}
                      className={`h-7 px-2.5 text-xs gap-1 border ${item.featured ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      {featuringId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} className={item.featured ? "fill-amber-400 text-amber-500" : ""} />}
                      {item.featured ? "Featured" : "Feature"}
                    </Button>
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
                        onClick={(e) => handleDelete(item.id, e)}
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
  );
}
