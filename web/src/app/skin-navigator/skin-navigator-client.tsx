"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
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
import { Input } from "@/components/ui/input";
import {
  LocationTypeahead,
  type LocationSelection,
} from "@/components/ui/location-typeahead";
import {
  AGE_RANGES,
  GOAL_OPTIONS,
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

function eventNameForStep(step: StepKey) {
  return `navigator.step.${step}`;
}

function confidenceClass(confidence: string) {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

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
  const [state, setState] = useState<WizardState>(initialState);
  const [photos, setPhotos] = useState<PhotoState>(initialPhotoState);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NavigatorAnalyzeResponse | null>(null);

  const step = steps[stepIndex].key;
  const sessionId = result?.sessionId ?? null;

  useEffect(() => {
    recordEvent(sessionId, eventNameForStep(step), step);
  }, [sessionId, step]);

  useEffect(() => {
    const draft = loadDraft();
    draftHydratedRef.current = true;
    skipNextDraftSaveRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- restore anonymous local draft after hydration */
    setState(draft.state);
    setStepIndex(draft.stepIndex);
    setResult(draft.result);
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
      return Boolean(state.basics.ageRange && state.basics.location.value.trim().length >= 2);
    }
    if (step === "goals") return state.goals.selected.length > 0;
    return true;
  }, [state, step]);

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
    setState((current) => {
      const selected = current.goals.selected.includes(slug)
        ? current.goals.selected.filter((item) => item !== slug)
        : [...current.goals.selected, slug].slice(0, 8);
      return { ...current, goals: { ...current.goals, selected } };
    });
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
    setResult(null);
    setError("");
    setStepIndex(0);
    clearDraft();
    recordEvent(null, "navigator.retake");
  };

  return (
    <section className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-4 pb-16 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:px-8">
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
        </div>
        <div className="rounded-lg border border-white/20 bg-white/12 p-4 text-sm leading-6 text-white backdrop-blur">
          {NAVIGATOR_DISCLAIMER}
        </div>
      </div>

      <div className="rounded-lg border border-black/5 bg-white shadow-[0_20px_70px_rgba(46,31,51,0.12)]">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-5 gap-2">
            {steps.map((item, index) => (
              <div key={item.key} className="min-w-0">
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
              </div>
            ))}
          </div>
        </div>

        <div
          key={step}
          className="min-h-[520px] p-4 motion-safe:animate-[navigatorStep_260ms_ease-out] sm:p-6 lg:p-8"
        >
          {step === "basics" && (
            <BasicsStep state={state} setState={setState} />
          )}
          {step === "goals" && (
            <GoalsStep state={state} setState={setState} toggleGoal={toggleGoal} />
          )}
          {step === "preferences" && (
            <PreferencesStep state={state} setState={setState} />
          )}
          {step === "photos" && (
            <PhotosStep
              photos={photos}
              setPhoto={setPhoto}
              submitting={submitting}
              submit={submit}
            />
          )}
          {step === "results" && result && (
            <ResultsStep
              result={result}
              location={state.basics.location}
              uploadedPhoto={photos.photo}
              reset={reset}
              editAnswers={() => setStepIndex(0)}
            />
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
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {error && <p className="max-w-lg text-sm text-red-600">{error}</p>}
              {step === "photos" ? (
                <Button
                  type="button"
                  variant="gradient"
                  onClick={submit}
                  disabled={submitting}
                  className="h-11 px-5"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {submitting ? "Analyzing" : "Get My Results"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="gradient"
                  onClick={goNext}
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
      </div>
    </section>
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
}: {
  state: WizardState;
  setState: Dispatch<SetStateAction<WizardState>>;
}) {
  return (
    <StepShell
      eyebrow="Step 1"
      title="A few basics"
      body="Location helps us find clinics nearby. Everything else is used only to tailor the guidance."
    >
      <div className="space-y-6">
        <div>
          <label className="text-sm font-semibold text-slate-900">Age range</label>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AGE_RANGES.map((age) => (
              <button
                key={age}
                type="button"
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
}: {
  state: WizardState;
  setState: Dispatch<SetStateAction<WizardState>>;
  toggleGoal: (slug: string) => void;
}) {
  return (
    <StepShell
      eyebrow="Step 2"
      title="What would you like to improve?"
      body="Pick a few that matter most. You can add a short note if the chips miss something."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GOAL_OPTIONS.map((goal) => {
            const selected = state.goals.selected.includes(goal.slug);
            return (
              <button
                key={goal.slug}
                type="button"
                onClick={() => toggleGoal(goal.slug)}
                className={cn(
                  "flex h-12 items-center justify-between rounded-lg border px-3 text-left text-sm font-semibold transition",
                  selected
                    ? "border-brand-purple bg-fuchsia-50 text-slate-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                {goal.label}
                {selected && <Check className="size-4 text-brand-purple" />}
              </button>
            );
          })}
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
          {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
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
            <p className="text-sm text-red-600 sm:col-span-2">{cameraError}</p>
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
  uploadedPhoto,
  reset,
  editAnswers,
}: {
  result: NavigatorAnalyzeResponse;
  location: LocationSelection;
  uploadedPhoto: File | null;
  reset: () => void;
  editAnswers: () => void;
}) {
  const primaryTreatment = result.analysis.recommendedTreatments[0];
  const locationLabel = location.value || location.label || "your area";
  const uploadedPhotoUrl = useMemo(
    () => (uploadedPhoto ? URL.createObjectURL(uploadedPhoto) : ""),
    [uploadedPhoto]
  );

  useEffect(() => {
    return () => {
      if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
    };
  }, [uploadedPhotoUrl]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className="h-auto bg-emerald-100 px-3 py-1 text-emerald-800">
            <Check className="size-3.5" />
            Results ready
          </Badge>
          <h2 className="mt-3 font-heading text-3xl font-medium text-slate-950">
            Your treatment starting point
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {result.disclaimer || NAVIGATOR_DISCLAIMER}
          </p>
        </div>
        <div className="flex gap-2">
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

      <div
        className={cn(
          "grid gap-4",
          uploadedPhotoUrl ? "lg:grid-cols-[0.8fr_1fr_0.95fr]" : "lg:grid-cols-[1fr_0.95fr]"
        )}
      >
        {uploadedPhotoUrl && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-950">Your photo</h3>
            <div className="mt-4 overflow-hidden rounded-lg bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedPhotoUrl}
                alt="Uploaded photo used for the cosmetic assessment"
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Used only for this analysis request and not stored by MedSpaMaps.
            </p>
          </section>
        )}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-base font-bold text-slate-950">Possible cosmetic concerns</h3>
          <div className="mt-4 space-y-3">
            {result.analysis.concerns.length === 0 ? (
              <p className="text-sm text-slate-600">The AI did not call out a specific visible concern from the information provided.</p>
            ) : (
              result.analysis.concerns.map((concern) => (
                <div key={`${concern.slug}-${concern.label}`} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{concern.label}</p>
                    <Badge variant="outline" className="h-auto px-2 py-0.5 capitalize">
                      {concern.severity}
                    </Badge>
                    <Badge variant="outline" className="h-auto px-2 py-0.5 capitalize">
                      {concern.source}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{concern.rationale}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-base font-bold text-slate-950">Photo notes</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              {result.analysis.photoObservations.provided
                ? "Photos were included in this analysis."
                : "Photos were not included in this analysis."}
            </p>
            {result.analysis.photoObservations.notes.map((note) => (
              <p key={note} className="rounded-lg bg-slate-50 p-3">{note}</p>
            ))}
            {result.analysis.photoObservations.limitations.map((note) => (
              <p key={note} className="rounded-lg bg-amber-50 p-3 text-amber-900">{note}</p>
            ))}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-slate-950">Recommended treatments</h3>
          {primaryTreatment && (
            <Button asChild variant="outline" className="h-10">
              <Link href={treatmentSearchHref(primaryTreatment.name, location)}>
                Search all clinics for this treatment
              </Link>
            </Button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {result.analysis.recommendedTreatments.map((treatment) => (
            <article key={`${treatment.slug}-${treatment.priority}`} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-heading text-xl font-medium text-slate-950">{treatment.name}</h4>
                <Badge variant="outline" className="h-auto px-2 py-0.5 capitalize">
                  {treatment.priority}
                </Badge>
                <Badge className={cn("h-auto border px-2 py-0.5 capitalize", confidenceClass(treatment.confidence))}>
                  {treatment.confidence} confidence
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{treatment.whyItFits}</p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p className="rounded-lg bg-slate-50 p-3">
                  <span className="font-semibold text-slate-950">Downtime: </span>
                  {treatment.expectedDowntime}
                </p>
                <p className="rounded-lg bg-slate-50 p-3">
                  <span className="font-semibold text-slate-950">Comfort: </span>
                  {treatment.comfortNotes}
                </p>
              </div>
              {treatment.cautions.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  {treatment.cautions.map((caution) => (
                    <li key={caution} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-coral" />
                      {caution}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" className="mt-5 h-10 w-full">
                <Link href={treatmentSearchHref(treatment.name, location)}>
                  Search clinics in {locationLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1">
          <h3 className="text-xl font-bold text-slate-950">Nearby clinics</h3>
          <p className="text-sm text-slate-600">
            Ranked by treatment match, location, ratings, and verified status.
          </p>
        </div>
        {result.clinics.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
            We could not find a nearby clinic match for these services yet. You can still search the full directory by treatment.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {result.clinics.map((clinic) => (
              <ClinicCard key={clinic.clinicId} clinic={clinic} sessionId={result.sessionId} />
            ))}
          </div>
        )}
      </section>

      {result.analysis.consultationQuestions.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-bold text-slate-950">Questions to ask at a consultation</h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
            {result.analysis.consultationQuestions.map((question) => (
              <li key={question} className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0 text-brand-green" />
                {question}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ClinicCard({
  clinic,
  sessionId,
}: {
  clinic: NavigatorClinicMatch;
  sessionId: string | null;
}) {
  const address = [clinic.address, clinic.city, clinic.state, clinic.zip].filter(Boolean).join(", ");
  const visibleTreatments = clinic.matchedTreatments.slice(0, 3);
  const extraTreatmentCount = Math.max(0, clinic.matchedTreatments.length - visibleTreatments.length);
  const initials = clinic.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <article className="group flex min-h-[300px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-coral/45 hover:shadow-[0_18px_45px_rgba(46,31,51,0.12)]">
      <div className="h-1.5 bg-brand-gradient" />
      <div className="relative h-36 bg-[linear-gradient(135deg,#fdf2ea_0%,#f7e9fb_52%,#eef7f0_100%)]">
        {clinic.coverImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clinic.coverImageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-brand-muted/70">
            MedSpaMaps
          </div>
        )}
        <div className="absolute -bottom-7 left-5 flex size-14 items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-white shadow-md">
          {clinic.logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clinic.logoUrl}
                alt=""
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            </>
          ) : (
            <span className="font-heading text-lg font-semibold text-brand-magenta">
              {initials || "M"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="font-heading text-xl font-medium leading-tight text-slate-950">
              {clinic.name}
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {clinic.rating !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  <Star className="size-3.5 fill-brand-star text-brand-star" />
                  {clinic.rating}
                  {clinic.reviewCount > 0 && (
                    <span className="font-medium text-amber-700/80">({clinic.reviewCount})</span>
                  )}
                </span>
              )}
              {clinic.distanceMiles !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-brand-coral">
                  <MapPin className="size-3.5" />
                  {clinic.distanceMiles} mi
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant="outline" className="h-auto border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-fuchsia-800">
              {Math.round(clinic.matchScore)} match
            </Badge>
            {clinic.verified && (
              <Badge className="h-auto bg-emerald-100 px-2 py-1 text-emerald-800">
                <BadgeCheck className="size-3.5" />
                Verified
              </Badge>
            )}
          </div>
        </div>

        {address && (
          <div className="mt-5 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-coral" />
            <p>{address}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Matching treatments
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleTreatments.map((treatment) => (
              <Badge
                key={treatment.slug}
                variant="outline"
                className="h-auto border-slate-200 bg-white px-2.5 py-1 text-slate-700"
              >
                {treatment.name}
              </Badge>
            ))}
            {extraTreatmentCount > 0 && (
              <Badge variant="outline" className="h-auto border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                +{extraTreatmentCount} more
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Button asChild variant="gradient" className="h-11 w-full">
            <Link
              href={clinic.profileUrl}
              onClick={() =>
                recordEvent(sessionId, "navigator.clinic_profile_clicked", "results", {
                  clinicId: clinic.clinicId,
                  clinicSlug: clinic.slug,
                })
              }
            >
              View Profile
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
