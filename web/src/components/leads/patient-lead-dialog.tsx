"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PatientLeadContext {
  source: "search" | "skin_navigator";
  treatment?: string | null;
  concern?: string | null;
  location?: string | null;
  skinNavigator?: unknown;
}

interface PatientLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lead context (treatment / concern / location / navigator payload). */
  context: PatientLeadContext;
  /** Called after the lead is saved successfully. */
  onSubmitted: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const emptyForm: FormState = { firstName: "", lastName: "", email: "", phone: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PatientLeadDialog({
  open,
  onOpenChange,
  context,
  onSubmitted,
  title = "Almost there",
  description = "Tell us where to reach you and we'll take you to your results.",
  submitLabel = "See results",
}: PatientLeadDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset transient error/submitting on open/close; keep any typed values so a
  // visitor who dismisses and reopens doesn't lose their input.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setError("");
      setSubmitting(false);
    }
    onOpenChange(next);
  };

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.phone.trim().length < 5) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/patient-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          source: context.source,
          treatment: context.treatment ?? null,
          concern: context.concern ?? null,
          location: context.location ?? null,
          skinNavigator: context.skinNavigator ?? null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Something went wrong. Please try again.");
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-first-name">First name</Label>
              <Input
                id="lead-first-name"
                autoComplete="given-name"
                value={form.firstName}
                onChange={update("firstName")}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-last-name">Last name</Label>
              <Input
                id="lead-last-name"
                autoComplete="family-name"
                value={form.lastName}
                onChange={update("lastName")}
                className="h-11"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update("phone")}
              className="h-11"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="gradient"
            disabled={submitting}
            className="h-11 w-full text-sm font-semibold text-white"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Saving" : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
