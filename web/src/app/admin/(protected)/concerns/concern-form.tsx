"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { adminGet, adminPost, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConcernDetail {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LIST_PATH = "/admin/concerns";

// ---------------------------------------------------------------------------
// Form page (create + edit) — full page, no modal
// ---------------------------------------------------------------------------

export function ConcernForm({ concernId }: { concernId?: string }) {
  const router = useRouter();
  const isNew = !concernId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Load existing concern for edit.
  useEffect(() => {
    if (!concernId) return;
    let cancelled = false;
    adminGet<ConcernDetail>(`/concerns/${concernId}`)
      .then((c) => {
        if (cancelled) return;
        setName(c.name);
        setSlug(c.slug);
        setSlugTouched(true);
        setIsActive(c.is_active);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load concern");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [concernId]);

  // Auto-derive slug from name until the user edits the slug manually.
  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Concern name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      is_active: isActive,
    };

    try {
      if (isNew) {
        await adminPost("/concerns", payload);
      } else {
        await adminPatch(`/concerns/${concernId}`, payload);
      }
      router.push(LIST_PATH);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save concern");
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={LIST_PATH}
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Back to concerns
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? "New concern" : "Edit concern"}
          </h2>
          <p className="text-sm text-slate-500">
            Concern name and slug for the catalog.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading concern…
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Basics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="concern-name">Name</Label>
                  <Input
                    id="concern-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Fine Lines & Wrinkles"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="concern-slug">Slug</Label>
                  <Input
                    id="concern-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="auto-generated"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">Active</span>
                  <span className="text-xs text-slate-500">
                    Available across the site when enabled.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    isActive
                      ? "bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]"
                      : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      isActive ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button asChild variant="outline" disabled={saving}>
                  <Link href={LIST_PATH}>Cancel</Link>
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1.5"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {isNew ? "Create concern" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
