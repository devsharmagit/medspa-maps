"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatientLeadDialog } from "@/components/leads/patient-lead-dialog";
import { Input } from "@/components/ui/input";
import {
  LocationTypeahead,
  type LocationSelection,
} from "@/components/ui/location-typeahead";
import { useLocation } from "@/lib/location/location-context";
import {
  AGE_RANGES,
  GOAL_OPTIONS,
  CONCERN_OPTIONS,
  NAVIGATOR_DISCLAIMER,
  type NavigatorAnalyzeResponse,
  type NavigatorClinicMatch,
} from "@/lib/skin-navigator/schema";
import { cn } from "@/lib/utils";

type AgeRange = (typeof AGE_RANGES)[number];
type StepKey = "basics" | "goals" | "preferences" | "photos" | "results";

const steps: { key: StepKey; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "goals", label: "Goals" },
  { key: "preferences", label: "Preferences" },
  { key: "photos", label: "Photos" },
  { key: "results", label: "Results" },
];

const mobileStepLabels: Record<StepKey, string> = {
  basics: "Basic",
  goals: "Goals",
  preferences: "Pref",
  photos: "Photo",
  results: "Done",
};

const ageLabels: Record<AgeRange, string> = {
  "under-25": "Under 25",
  "25-34": "25-34",
  "35-44": "35-44",
  "45-54": "45-54",
  "55-64": "55-64",
  "65-plus": "65+",
};

interface WizardState {
  basics: {
    ageRange: AgeRange | "";
    gender: string;
    skinTone: string;
    location: LocationSelection;
  };
  goals: {
    selected: string[];
    freeText: string;
  };
  preferences: {
    previousTreatments: "none" | "yes" | "not-sure";
    downtime: "none" | "few-days" | "flexible";
    comfort: "gentle" | "injectables-devices" | "not-sure";
    medicalConsiderations: string;
  };
}

interface PhotoState {
  photo: File | null;
}

interface PersistedNavigatorDraft {
  state: WizardState;
  stepIndex: number;
  result: NavigatorAnalyzeResponse | null;
}

const DRAFT_STORAGE_KEY = "medspa.ai-treatment-navigator.draft.v1";

const initialState: WizardState = {
  basics: {
    ageRange: "",
    gender: "",
    skinTone: "",
    location: { label: "", value: "", lat: null, lng: null },
  },
  goals: {
    selected: [],
    freeText: "",
  },
  preferences: {
    previousTreatments: "not-sure",
    downtime: "flexible",
    comfort: "not-sure",
    medicalConsiderations: "",
  },
};

const initialPhotoState: PhotoState = { photo: null };

function loadDraft(): PersistedNavigatorDraft {
  if (typeof window === "undefined") {
    return { state: initialState, stepIndex: 0, result: null };
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { state: initialState, stepIndex: 0, result: null };
    const parsed = JSON.parse(raw) as Partial<PersistedNavigatorDraft>;
    const savedResult = parsed.result ?? null;
    const savedStep =
      typeof parsed.stepIndex === "number"
        ? Math.min(Math.max(parsed.stepIndex, 0), steps.length - 1)
        : 0;
    return {
      state: parsed.state ?? initialState,
      stepIndex: savedStep === steps.length - 1 && !savedResult ? steps.length - 2 : savedStep,
      result: savedResult,
    };
  } catch {
    return { state: initialState, stepIndex: 0, result: null };
  }
}

function saveDraft(draft: PersistedNavigatorDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}

// Tab-scoped preview cache, separate from the localStorage draft above (which
// deliberately excludes photo bytes). sessionStorage clears automatically when
// the tab/browser closes, so this only smooths over in-session navigation
// (leaving the page and coming back) without persisting the photo long-term.
const PHOTO_PREVIEW_SESSION_KEY = "medspa.ai-treatment-navigator.photo-preview.v1";

function savePhotoPreview(dataUrl: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PHOTO_PREVIEW_SESSION_KEY, dataUrl);
  } catch {
    // Quota exceeded or storage disabled — preview simply won't survive
    // navigation; not worth failing the flow over.
  }
}

function loadPhotoPreview(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PHOTO_PREVIEW_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function clearPhotoPreview() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PHOTO_PREVIEW_SESSION_KEY);
  } catch {
    // ignore
  }
}

function eventNameForStep(step: StepKey) {
  return `navigator.step.${step}`;
}

const CONCERN_SOURCE_LABELS: Record<string, string> = {
  questionnaire: "From your answers",
  photo: "From your photo",
  both: "From your answers + photo",
};

async function recordEvent(sessionId: string | null, eventName: string, step?: string, payload = {}) {
  await fetch("/api/skin-navigator/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, eventName, step, payload }),
    keepalive: true,
  }).catch(() => {});
}

export function SkinNavigatorClient() {
  const draftHydratedRef = useRef(false);
  const skipNextDraftSaveRef = useRef(false);
  const stepFocusReadyRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<WizardState>(initialState);
  const [photos, setPhotos] = useState<PhotoState>(initialPhotoState);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NavigatorAnalyzeResponse | null>(null);
  const [goalNote, setGoalNote] = useState("");
  const [stepAnnouncement, setStepAnnouncement] = useState("");
  // Lead capture gate: we collect contact details before running the analysis.
  const [leadOpen, setLeadOpen] = useState(false);
  const leadCapturedRef = useRef(false);
  // Data-URL preview cached in sessionStorage so it survives leaving the page
  // and coming back within the same tab (the photo File object itself does
  // not survive a remount). Cleared on retake and when the tab/browser closes.
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  const {
    location: userLocation,
    status: geoStatus,
    requested: geoRequested,
    requestLocation,
  } = useLocation();

  const step = steps[stepIndex].key;
  const sessionId = result?.sessionId ?? null;

  useEffect(() => {
    recordEvent(sessionId, eventNameForStep(step), step);
  }, [sessionId, step]);

  // Announce step changes for screen readers and move focus into the new step.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- live-region text follows the active step */
    setStepAnnouncement(`Step ${stepIndex + 1} of ${steps.length}: ${steps[stepIndex].label}`);
    if (stepFocusReadyRef.current) {
      panelRef.current?.focus();
    } else {
      stepFocusReadyRef.current = true;
    }
  }, [stepIndex]);

  // When the user opts into "use my location", fill the location field once resolved.
  useEffect(() => {
    if (!geoRequested || userLocation?.outsideUS) return;
    if (!userLocation?.city && !userLocation?.stateCode) return;
    const label =
      userLocation.city && userLocation.stateCode
        ? `${userLocation.city}, ${userLocation.stateCode}`
        : userLocation.stateName || userLocation.stateCode || "";
    if (!label) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- fill location after a deliberate geolocation grant */
    setState((current) => ({
      ...current,
      basics: {
        ...current.basics,
        location: { label, value: label, lat: userLocation.lat ?? null, lng: userLocation.lng ?? null },
      },
    }));
  }, [
    geoRequested,
    userLocation?.city,
    userLocation?.stateCode,
    userLocation?.stateName,
    userLocation?.lat,
    userLocation?.lng,
    userLocation?.outsideUS,
  ]);

  useEffect(() => {
    const draft = loadDraft();
    draftHydratedRef.current = true;
    skipNextDraftSaveRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- restore anonymous local draft after hydration */
    setState(draft.state);
    setStepIndex(draft.stepIndex);
    setResult(draft.result);
    setPhotoPreviewUrl(loadPhotoPreview());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }
    saveDraft({ state, stepIndex, result });
  }, [state, stepIndex, result]);

  const canContinue = useMemo(() => {
    if (step === "basics") {
      // Age range and location are both required to continue.
      return Boolean(state.basics.ageRange) && Boolean(state.basics.location.value.trim());
    }
    if (step === "goals") return state.goals.selected.length > 0;
    return true;
  }, [state, step]);

  const continueHint = useMemo(() => {
    if (canContinue) return "";
    if (step === "basics") {
      if (!state.basics.ageRange) return "Select your age range to continue.";
      return "Enter your location to continue.";
    }
    if (step === "goals") return "Pick at least one goal or concern to continue.";
    return "";
  }, [canContinue, step, state.basics.ageRange]);

  const payload = useMemo(
    () => ({
      basics: {
        ageRange: state.basics.ageRange,
        gender: state.basics.gender,
        skinTone: state.basics.skinTone,
        location: state.basics.location,
      },
      goals: state.goals,
      preferences: state.preferences,
    }),
    [state]
  );

  const goNext = () => {
    if (!canContinue || stepIndex >= steps.length - 2) return;
    recordEvent(sessionId, "navigator.step_completed", step);
    setStepIndex((idx) => idx + 1);
  };

  const goBack = () => {
    setError("");
    setStepIndex((idx) => Math.max(0, idx - 1));
  };

  const toggleGoal = (slug: string) => {
    const selected = state.goals.selected;
    const alreadySelected = selected.includes(slug);
    if (!alreadySelected && selected.length >= 8) {
      setGoalNote("You can pick up to 8 in total.");
      return;
    }
    setGoalNote("");
    setState((current) => {
      const next = current.goals.selected.includes(slug)
        ? current.goals.selected.filter((item) => item !== slug)
        : [...current.goals.selected, slug].slice(0, 8);
      return { ...current, goals: { ...current.goals, selected: next } };
    });
  };

  // Open the lead form before running the analysis (once per session); if the
  // lead was already captured, go straight to the analysis.
  const beginAnalysis = () => {
    if (submitting) return;
    if (leadCapturedRef.current) {
      submit();
    } else {
      setLeadOpen(true);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (step === "photos") {
      beginAnalysis();
    } else if (step !== "results") {
      goNext();
    }
  };

  const setPhoto = (file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setError("Each photo must be 5 MB or smaller.");
      return;
    }
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photos must be JPEG, PNG, or WebP images.");
      return;
    }
    setError("");
    setPhotos({ photo: file });
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (dataUrl) {
          setPhotoPreviewUrl(dataUrl);
          savePhotoPreview(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoPreviewUrl("");
      clearPhotoPreview();
    }
    recordEvent(sessionId, file ? "navigator.photo_added" : "navigator.photo_removed", "photos", {
      slot: "photo",
    });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    recordEvent(sessionId, "navigator.analysis_requested", "photos", {
      photoCount: Number(Boolean(photos.photo)),
    });

    try {
      const form = new FormData();
      form.set("payload", JSON.stringify(payload));
      if (photos.photo) form.set("photo", photos.photo);

      const res = await fetch("/api/skin-navigator/analyze", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Something went wrong. Please try again.");
      }
      setResult(json.data);
      setStepIndex(steps.length - 1);
      recordEvent(json.data.sessionId ?? null, "navigator.analysis_succeeded", "results", {
        clinicCount: json.data.clinics?.length ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      recordEvent(sessionId, "navigator.analysis_failed", "photos", { message });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setState(initialState);
    setPhotos(initialPhotoState);
    setPhotoPreviewUrl("");
    setResult(null);
    setError("");
    setStepIndex(0);
    leadCapturedRef.current = false;
    clearDraft();
    clearPhotoPreview();
    recordEvent(null, "navigator.retake");
  };

  const totalUserSteps = steps.length - 1; // exclude the results screen from the "quick steps" count

  return (
    <section className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-4 pb-16 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:px-8">
      <p className="sr-only" role="status" aria-live="polite">
        {stepAnnouncement}
      </p>
      <div className="grid gap-5 pt-2 text-white sm:pt-4 lg:grid-cols-[1fr_360px] lg:items-end">
        <div className="max-w-3xl">
          <Badge className="mb-4 h-auto border-white/25 bg-white/15 px-3 py-1 text-white backdrop-blur">
            <Sparkles className="size-3.5" />
            AI Treatment Navigator
          </Badge>
          <h1 className="font-heading text-[2.45rem] font-medium leading-[1.12] sm:text-5xl">
            Find the right aesthetic treatment with a calmer first step.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/86">
            Share a few basics and goals, then get cosmetic treatment ideas and nearby clinics.
          </p>
          {step !== "results" && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Clock className="size-4" aria-hidden />
              About 2 minutes • {totalUserSteps} quick steps
            </p>
          )}
        </div>
        <div className="rounded-lg border border-white/20 bg-white/12 p-4 text-sm leading-6 text-white backdrop-blur">
          {NAVIGATOR_DISCLAIMER}
        </div>
      </div>

      <div className="rounded-lg border border-black/5 bg-white shadow-[0_20px_70px_rgba(46,31,51,0.12)]">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <ol
            className="grid grid-cols-5 gap-2"
            aria-label={`Step ${stepIndex + 1} of ${steps.length}`}
          >
            {steps.map((item, index) => (
              <li
                key={item.key}
                className="min-w-0"
                aria-current={index === stepIndex ? "step" : undefined}
              >
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    index <= stepIndex ? "bg-brand-coral" : "bg-slate-200"
                  )}
                />
                <div
                  className={cn(
                    "mt-2 truncate text-[11px] font-semibold sm:text-xs",
                    index <= stepIndex ? "text-slate-900" : "text-slate-400"
                  )}
                >
                  <span className="sm:hidden">{mobileStepLabels[item.key]}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div
            key={step}
            ref={panelRef}
            tabIndex={-1}
            className="min-h-[520px] p-4 outline-none motion-safe:animate-[navigatorStep_260ms_ease-out] sm:p-6 lg:p-8"
          >
            {submitting ? (
              <AnalyzingView hasPhoto={Boolean(photos.photo)} />
            ) : (
              <>
                {step === "basics" && (
                  <BasicsStep
                    state={state}
                    setState={setState}
                    onUseMyLocation={() => requestLocation({ force: true })}
                    locating={geoStatus === "prompting"}
                  />
                )}
                {step === "goals" && (
                  <GoalsStep
                    state={state}
                    setState={setState}
                    toggleGoal={toggleGoal}
                    goalNote={goalNote}
                  />
                )}
                {step === "preferences" && (
                  <PreferencesStep state={state} setState={setState} />
                )}
                {step === "photos" && (
                  <PhotosStep
                    photos={photos}
                    setPhoto={setPhoto}
                    submitting={submitting}
                    submit={beginAnalysis}
                  />
                )}
                {step === "results" && result && (
                  <ResultsStep
                    result={result}
                    location={state.basics.location}
                    photoPreviewUrl={photoPreviewUrl}
                    reset={reset}
                    editAnswers={() => setStepIndex(0)}
                  />
                )}
              </>
            )}
          </div>

          {step !== "results" && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={stepIndex === 0 || submitting}
                className="h-11 px-4"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                {error && (
                  <p role="alert" className="max-w-lg text-sm text-red-600">
                    {error}
                  </p>
                )}
                {!error && continueHint && (
                  <p aria-live="polite" className="max-w-lg text-sm text-slate-500">
                    {continueHint}
                  </p>
                )}
                {step === "photos" ? (
                  <Button
                    type="submit"
                    variant="gradient"
                    disabled={submitting}
                    className="h-11 px-5"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {submitting ? "Analyzing" : "Get My Results"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="gradient"
                    disabled={!canContinue || submitting}
                    className="h-11 px-5"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      <PatientLeadDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        title="Get your treatment plan"
        description="Add your contact details and we'll generate your personalized results."
        submitLabel="Get my results"
        context={{
          source: "skin_navigator",
          location: state.basics.location.value || null,
          concern: state.goals.selected.join(", ") || null,
          skinNavigator: payload,
        }}
        onSubmitted={() => {
          leadCapturedRef.current = true;
          setLeadOpen(false);
          submit();
        }}
      />
    </section>
  );
}

function AnalyzingView({ hasPhoto }: { hasPhoto: boolean }) {
  const messages = useMemo(
    () =>
      [
        "Reviewing your goals",
        hasPhoto ? "Looking over your photo" : "Weighing your preferences",
        "Matching treatments to your profile",
        "Finding clinics near you",
      ].filter(Boolean) as string[],
    [hasPhoto]
  );
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    setMessageIndex(0);
    const timer = setInterval(() => {
      setMessageIndex((current) => Math.min(current + 1, messages.length - 1));
    }, 2500);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="space-y-8">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-5"
      >
        <Loader2 className="size-5 shrink-0 animate-spin text-brand-coral" />
        <div>
          <p className="font-heading text-lg font-medium text-slate-950">{messages[messageIndex]}…</p>
          <p className="mt-1 text-sm text-slate-500">
            This usually takes a few seconds. Please keep this tab open.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <ResultSkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}

function ResultSkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <div className="h-6 w-2/5 animate-pulse rounded-md bg-[#f0eaf0]" />
        <div className="h-5 w-16 animate-pulse rounded-md bg-[#f5f0f5]" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded-md bg-[#f5f0f5]" />
        <div className="h-4 w-4/5 animate-pulse rounded-md bg-[#f5f0f5]" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-12 animate-pulse rounded-md bg-[#f5f0f5]" />
        <div className="h-12 animate-pulse rounded-md bg-[#f5f0f5]" />
      </div>
      <div className="mt-5 h-10 w-full animate-pulse rounded-md bg-[#f0eaf0]" />
    </div>
  );
}

function StepShell({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[320px_1fr]">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-brand-coral">{eyebrow}</p>
        <h2 className="mt-2 font-heading text-3xl font-medium leading-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function BasicsStep({
  state,
  setState,
  onUseMyLocation,
  locating,
}: {
  state: WizardState;
  setState: Dispatch<SetStateAction<WizardState>>;
  onUseMyLocation: () => void;
  locating: boolean;
}) {
  return (
    <StepShell
      eyebrow="Step 1"
      title="A few basics"
      body="Your age range and location are required so we can suggest nearby clinics."
    >
      <div className="space-y-6">
        <div>
          <label className="text-sm font-semibold text-slate-900">Age range</label>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AGE_RANGES.map((age) => (
              <button
                key={age}
                type="button"
                aria-pressed={state.basics.ageRange === age}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    basics: { ...current.basics, ageRange: age },
                  }))
                }
                className={cn(
                  "h-12 rounded-lg border px-3 text-sm font-semibold transition",
                  state.basics.ageRange === age
                    ? "border-brand-coral bg-orange-50 text-slate-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                {ageLabels[age]}
              </button>
            ))}
          </div>
        </div>

        <LocationTypeahead
          value={state.basics.location.value}
          label="City or ZIP"
          icon={<MapPin className="size-4 text-brand-coral" />}
          placeholder="Nashville, TN or 37203"
          inputClassName="h-12 rounded-lg !border !border-slate-300 bg-white px-4 shadow-sm focus:!border-brand-coral"
          onUseMyLocation={onUseMyLocation}
          locating={locating}
          onChange={(location) =>
            setState((current) => ({
              ...current,
              basics: { ...current.basics, location },
            }))
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-900">Gender optional</label>
            <Input
              value={state.basics.gender}
              onChange={(e) =>
                setState((current) => ({
                  ...current,
                  basics: { ...current.basics, gender: e.target.value },
                }))
              }
              placeholder="Optional"
              className="mt-2 h-12"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-900">Skin tone optional</label>
            <Input
              value={state.basics.skinTone}
              onChange={(e) =>
                setState((current) => ({
                  ...current,
                  basics: { ...current.basics, skinTone: e.target.value },
                }))
              }
              placeholder="Optional"
              className="mt-2 h-12"
            />
          </div>
        </div>
      </div>
    </StepShell>
  );
}

function GoalsStep({
  state,
  setState,
  toggleGoal,
  goalNote,
}: {
  state: WizardState;
  setState: Dispatch<SetStateAction<WizardState>>;
  toggleGoal: (slug: string) => void;
  goalNote: string;
}) {
  const selectedCount = state.goals.selected.length;
  const renderChip = (option: { slug: string; label: string }) => {
    const selected = state.goals.selected.includes(option.slug);
    return (
      <button
        key={option.slug}
        type="button"
        aria-pressed={selected}
        onClick={() => toggleGoal(option.slug)}
        className={cn(
          "flex h-12 items-center justify-between rounded-lg border px-3 text-left text-sm font-semibold transition",
          selected
            ? "border-brand-purple bg-fuchsia-50 text-slate-950"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
        )}
      >
        {option.label}
        {selected && <Check className="size-4 text-brand-purple" />}
      </button>
    );
  };
  return (
    <StepShell
      eyebrow="Step 2"
      title="What would you like to improve?"
      body="Tell us your overall goal and the specific things you'd like to fix. You can add a short note if the chips miss something."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">
            Your selections <span className="font-medium text-slate-500">({selectedCount}/8)</span>
          </p>
          {goalNote && (
            <p aria-live="polite" className="text-sm text-brand-coral">
              {goalNote}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">What&apos;s your goal?</p>
            <p className="text-xs text-slate-500">The overall look you&apos;re after.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GOAL_OPTIONS.map(renderChip)}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">What would you like to fix?</p>
            <p className="text-xs text-slate-500">Specific concerns or symptoms.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONCERN_OPTIONS.map(renderChip)}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-900">Anything else optional</label>
          <textarea
            value={state.goals.freeText}
            onChange={(e) =>
              setState((current) => ({
                ...current,
                goals: { ...current.goals, freeText: e.target.value },
              }))
            }
            placeholder="Example: I want something subtle with little downtime."
            className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50"
            maxLength={800}
          />
        </div>
      </div>
    </StepShell>
  );
}

function PreferencesStep({
  state,
  setState,
}: {
  state: WizardState;
  setState: Dispatch<SetStateAction<WizardState>>;
}) {
  return (
    <StepShell
      eyebrow="Step 3"
      title="Two quick preferences"
      body="This keeps the recommendations practical without turning the flow into an intake form."
    >
      <div className="space-y-6">
        <ChoiceGroup
          label="Downtime preference"
          value={state.preferences.downtime}
          options={[
            ["none", "None"],
            ["few-days", "A few days"],
            ["flexible", "Flexible"],
          ]}
          onChange={(value) =>
            setState((current) => ({
              ...current,
              preferences: { ...current.preferences, downtime: value as WizardState["preferences"]["downtime"] },
            }))
          }
        />
        <ChoiceGroup
          label="Comfort preference"
          value={state.preferences.comfort}
          options={[
            ["gentle", "Gentle"],
            ["injectables-devices", "Injectables or devices okay"],
            ["not-sure", "Not sure"],
          ]}
          onChange={(value) =>
            setState((current) => ({
              ...current,
              preferences: { ...current.preferences, comfort: value as WizardState["preferences"]["comfort"] },
            }))
          }
        />
      </div>
    </StepShell>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={cn(
              "min-h-12 rounded-lg border px-3 text-sm font-semibold transition",
              value === optionValue
                ? "border-brand-coral bg-orange-50 text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotosStep({
  photos,
  setPhoto,
  submitting,
  submit,
}: {
  photos: PhotoState;
  setPhoto: (file: File | null) => void;
  submitting: boolean;
  submit: () => void;
}) {
  return (
    <StepShell
      eyebrow="Step 4"
      title="Add one photo optional"
      body="A single clear face photo can help the AI comment on visible cosmetic concerns. It is not stored."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Your photo is used only for this analysis request. This is an informational cosmetic assessment, not a diagnosis.
        </div>
        <PhotoUploader
          label="Face photo"
          file={photos.photo}
          onChange={setPhoto}
        />
        <Button
          type="button"
          variant="outline"
          onClick={submit}
          disabled={submitting}
          className="h-11 w-full sm:w-auto"
        >
          <Camera className="size-4" />
          Analyze without a photo
        </Button>
      </div>
    </StepShell>
  );
}

function PhotoUploader({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;

    const markReady = () => {
      setCameraReady(true);
      if (readyTimeout) {
        window.clearTimeout(readyTimeout);
        readyTimeout = null;
      }
    };

    const playVideo = () => {
      video
        .play()
        .then(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) markReady();
        })
        .catch(() => {
          setCameraError("Camera preview could not start. Please try upload instead.");
        });
    };

    video.srcObject = stream;
    video.addEventListener("loadedmetadata", playVideo);
    video.addEventListener("canplay", markReady);
    playVideo();

    readyTimeout = setTimeout(() => {
      if (!video.videoWidth || !video.videoHeight) {
        setCameraError("Camera preview is taking longer than expected. Check browser camera permission or upload a photo.");
      }
    }, 3500);

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
      video.removeEventListener("canplay", markReady);
      if (readyTimeout) window.clearTimeout(readyTimeout);
    };
  }, [cameraOpen]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError("");
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser. You can upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError("Camera permission was not available. You can upload a photo instead.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Could not capture the photo. Please try upload instead.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture the photo. Please try upload instead.");
          return;
        }
        onChange(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="relative rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      {file && preview ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label}`}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : cameraOpen ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-4 text-center text-sm font-semibold text-white">
                Starting camera preview...
              </div>
            )}
          </div>
          {cameraError && <p role="alert" className="text-sm text-red-600">{cameraError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={stopCamera} className="h-10">
              Cancel
            </Button>
            <Button type="button" variant="gradient" onClick={capturePhoto} className="h-10">
              <Camera className="size-4" />
              Capture photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-52 gap-3 p-3 text-center sm:grid-cols-2">
          <button
            type="button"
            onClick={openCamera}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand-coral"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-orange-50 text-brand-coral shadow-sm">
              <Camera className="size-5" />
            </span>
            <span className="text-sm font-semibold text-slate-900">Use camera</span>
            <span className="text-xs text-slate-500">Open a live preview</span>
          </button>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand-purple">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-fuchsia-50 text-brand-purple shadow-sm">
              <Upload className="size-5" />
            </span>
            <span className="text-sm font-semibold text-slate-900">Upload photo</span>
            <span className="text-xs text-slate-500">JPEG, PNG, or WebP up to 5 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {cameraError && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-2">{cameraError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function treatmentSearchHref(treatmentName: string, location: LocationSelection): string {
  const params = new URLSearchParams();
  params.set("q", treatmentName);
  if (location.value) params.set("location", location.value);
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    params.set("lat", String(location.lat));
    params.set("lng", String(location.lng));
    params.set("radius", "80");
    params.set("sort", "distance");
  }
  return `/search?${params.toString()}`;
}

function ResultsStep({
  result,
  location,
  photoPreviewUrl,
  reset,
  editAnswers,
}: {
  result: NavigatorAnalyzeResponse;
  location: LocationSelection;
  photoPreviewUrl: string;
  reset: () => void;
  editAnswers: () => void;
}) {
  const locationLabel = location.value || location.label || "your area";
  const hasLocation = Boolean(location.value.trim());

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className="h-auto bg-emerald-100 px-3 py-1 text-emerald-800">
            <Check className="size-3.5" />
            Results ready
          </Badge>
          <h2 className="mt-3 font-heading text-3xl font-medium text-slate-950">
            Your treatment starting point
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={editAnswers} className="h-10">
            <ArrowLeft className="size-4" />
            Edit
          </Button>
          <Button type="button" variant="outline" onClick={reset} className="h-10">
            <RotateCcw className="size-4" />
            Retake
          </Button>
        </div>
      </div>

      {photoPreviewUrl && (
        <section className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreviewUrl}
              alt="Photo used for the cosmetic assessment"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-950">Your photo</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Used only for this analysis request and not stored by MedSpaMaps.
            </p>
          </div>
        </section>
      )}

      {/* 1: Concerns */}
      <section>
        <h3 className="mb-1 text-xl font-bold text-slate-950">Possible concerns</h3>
        <p className="mb-4 text-sm text-slate-600">What we focused on, and where it came from.</p>
        {result.analysis.concerns.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
            The AI did not call out a specific concern from the information provided.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.analysis.concerns.map((concern) => (
              <article
                key={`${concern.slug}-${concern.label}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{concern.label}</p>
                  <Badge variant="outline" className="h-auto px-2 py-0.5 capitalize">
                    {concern.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-coral">
                  {CONCERN_SOURCE_LABELS[concern.source] ?? concern.source}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{concern.rationale}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 2: Treatments */}
      <section>
        <h3 className="mb-1 text-xl font-bold text-slate-950">Suggested treatments</h3>
        <p className="mb-4 text-sm text-slate-600">Cosmetic options that fit your goals, a starting point for a consultation.</p>
        {result.analysis.recommendedTreatments.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
            The AI did not return a specific treatment recommendation. You can still explore the full directory by treatment.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.analysis.recommendedTreatments.map((treatment) => (
              <TreatmentCard
                key={`${treatment.slug}-${treatment.priority}`}
                treatment={treatment}
                location={location}
                locationLabel={locationLabel}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3: Clinics (only when a location was given) */}
      {hasLocation && (
        <section>
          <h3 className="mb-1 text-xl font-bold text-slate-950">Nearby clinics</h3>
          <p className="mb-4 text-sm text-slate-600">Matched to your treatments near {locationLabel}.</p>
          {result.clinics.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
              We could not find a nearby clinic match yet. You can still search the full directory by treatment above.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.clinics.map((clinic) => (
                <ClinicCard key={clinic.clinicId} clinic={clinic} sessionId={result.sessionId} />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="border-t border-slate-100 pt-6 text-sm leading-6 text-slate-500">
        { result.disclaimer || NAVIGATOR_DISCLAIMER}
      </p>
    </div>
  );
}

function TreatmentCard({
  treatment,
  location,
  locationLabel,
}: {
  treatment: NavigatorAnalyzeResponse["analysis"]["recommendedTreatments"][number];
  location: LocationSelection;
  locationLabel: string;
}) {
  const hasLocation = Boolean(location.value?.trim());
  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
      <h4 className="font-heading text-lg font-medium text-slate-950">{treatment.name}</h4>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{treatment.whyItFits}</p>
      <Button asChild variant="outline" className="mt-4 h-10 w-full">
        <Link href={treatmentSearchHref(treatment.name, location)}>
          {hasLocation ? `Find clinics in ${locationLabel}` : "Find clinics"}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </article>
  );
}

// Mirrors the clinic card look used elsewhere on the site (landing page
// FindClinicSection / search results) so this card doesn't feel like a
// different product: cover image with a Featured pill, a small logo, a star
// rating row, treatment chips, and a View Profile + Book Now action pair.
function ClinicCard({
  clinic,
  sessionId,
}: {
  clinic: NavigatorClinicMatch;
  sessionId: string | null;
}) {
  const visibleTreatments = clinic.matchedTreatments.slice(0, 3);
  const initials = clinic.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const bookUrl = clinic.bookingUrl || clinic.website || clinic.profileUrl;
  const bookExternal = Boolean(clinic.bookingUrl || clinic.website);

  return (
    <article
      className="overflow-hidden rounded-[18px] border-2 border-white bg-white"
      style={{ boxShadow: "0px 4px 21.3px #E2D8E6" }}
    >
      <div className="relative h-[160px] w-full overflow-hidden">
        {clinic.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clinic.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#DE7F4C]/20 to-[#C341D7]/20 text-3xl font-semibold text-white/70">
            {initials || "M"}
          </div>
        )}
        {clinic.featured && (
          <div className="absolute left-4 top-4 rounded bg-[#D3A845] px-2.5 py-1">
            <span className="text-xs font-semibold uppercase tracking-[-0.02em] text-white">
              Featured
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-[42px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E5E5E5] bg-[#faf5fa]">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
            ) : (
              <span className="text-sm font-semibold text-brand-magenta">{initials || "M"}</span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-lg font-medium leading-tight text-[#383838]">
              {clinic.name}
            </h4>
            {clinic.distanceMiles !== null && (
              <p className="mt-0.5 text-xs text-[#727272]">{clinic.distanceMiles} mi away</p>
            )}
          </div>
        </div>

        {clinic.rating !== null && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-[#727272]">
            <span className="font-semibold text-[#1a1a1a]">{clinic.rating}</span>
            <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
            {clinic.reviewCount > 0 && <span>({clinic.reviewCount})</span>}
          </div>
        )}

        {visibleTreatments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleTreatments.map((treatment) => (
              <span
                key={treatment.slug}
                className="rounded border border-[#DFDFDF] bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#7F7F7F]"
              >
                {treatment.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={clinic.profileUrl}
            onClick={() =>
              recordEvent(sessionId, "navigator.clinic_profile_clicked", "results", {
                clinicId: clinic.clinicId,
                clinicSlug: clinic.slug,
              })
            }
            className="flex h-[43px] flex-1 items-center justify-center rounded-lg border border-[#CF5B9D] text-sm font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50"
          >
            View Profile
          </Link>
          <a
            href={bookUrl}
            {...(bookExternal ? { target: "_blank", rel: "noreferrer" } : {})}
            className="flex h-[43px] flex-1 items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Book Now
          </a>
        </div>
      </div>
    </article>
  );
}
