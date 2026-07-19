"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { adminGet, adminPost, adminPatch } from "@/lib/admin/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Service {
  id: string;
  name: string;
  slug: string;
  origin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clinic_count: number;
}

interface FormState {
  name: string;
  slug: string;
  slugDirty: boolean;
  is_active: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    slugDirty: false,
    is_active: true,
  };
}

function formFromService(s: Service): FormState {
  return {
    name: s.name,
    slug: s.slug,
    slugDirty: true,
    is_active: s.is_active,
  };
}

const LIST_PATH = "/admin/services";

// ----------------------------------------------------------------------------
// Form page (create + edit) — full page, no modal
// ----------------------------------------------------------------------------

export function ServiceForm({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(serviceId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the target row for edit.
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    adminGet<Service>(`/services/${serviceId}`)
      .then((s) => {
        if (!cancelled) setForm(formFromService(s));
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load treatment");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slugDirty ? prev.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setForm((prev) => ({ ...prev, slug: value, slugDirty: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Treatment name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      is_active: form.is_active,
    };

    try {
      if (isEdit && serviceId) {
        await adminPatch<Service>(`/services/${serviceId}`, payload);
      } else {
        await adminPost<Service>("/services", payload);
      }
      router.push(LIST_PATH);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save treatment");
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={LIST_PATH}
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Back to treatments
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Edit treatment" : "New treatment"}
          </h2>
          <p className="text-sm text-slate-500">
            {isEdit
              ? "Update the catalog entry. Changes apply immediately."
              : "Add a treatment to the shared catalog."}
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading treatment…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Botox"
                  autoFocus
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-slug">Slug</Label>
                <Input
                  id="svc-slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="font-mono text-xs"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">Active</span>
                  <span className="text-xs text-slate-500">
                    Available across the site when enabled.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => update("is_active", !form.is_active)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    form.is_active
                      ? "bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]"
                      : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      form.is_active ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button asChild type="button" variant="outline" disabled={saving}>
                  <Link href={LIST_PATH}>Cancel</Link>
                </Button>
                <Button type="submit" variant="gradient" disabled={saving} className="gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {isEdit ? "Save changes" : "Create treatment"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
