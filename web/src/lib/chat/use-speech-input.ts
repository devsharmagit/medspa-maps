"use client";

/**
 * use-speech-input.ts — dictation for the chat composer, via the browser's
 * built-in Web Speech API.
 *
 * No API key, no server round-trip and no per-minute cost: recognition runs in
 * the browser and we only ever see the resulting text. Supported in Chrome,
 * Edge and Safari; Firefox has no implementation, so `supported` is false there
 * and the caller simply doesn't render a mic button rather than showing one
 * that does nothing.
 *
 * The microphone is only touched inside `start()` — never on mount. The widget
 * is mounted on every public page, so requesting permission any earlier would
 * fire a browser prompt sitewide.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in this project's DOM lib types, so declare the
// slice we actually use rather than pulling in a dependency for it.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Capability never changes within a page's lifetime, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/** Plain-language messages — the raw API codes mean nothing to a visitor. */
function messageFor(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. You can allow it in your browser settings, or just type instead.";
    case "no-speech":
      return "I didn't catch that — try again, or type your question.";
    case "audio-capture":
      return "No microphone was found. You can type your question instead.";
    case "network":
      return "Speech recognition couldn't reach the network. You can type instead.";
    case "aborted":
      return "";
    default:
      return "Voice input didn't work that time. You can type your question instead.";
  }
}

export interface SpeechInput {
  /** false on browsers with no Web Speech API (Firefox) — hide the control. */
  supported: boolean;
  listening: boolean;
  /** User-facing error, or "" when there is nothing to say. */
  error: string;
  start: () => void;
  stop: () => void;
}

export interface UseSpeechInputOptions {
  /**
   * Called with the transcript so far. `isFinal` is false for the live interim
   * text that appears while the user is still speaking.
   */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Skip work entirely while the panel is closed. */
  enabled?: boolean;
}

export function useSpeechInput({
  onTranscript,
  enabled = true,
}: UseSpeechInputOptions): SpeechInput {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Held in a ref so the recognition callbacks always see the latest handler
  // without us having to tear down and rebuild recognition on every render.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Capability detection. useSyncExternalStore rather than setState-in-effect:
  // it reads a client-only value with a defined server snapshot, so there is no
  // hydration mismatch and no lint violation (react-hooks v7 makes
  // set-state-in-effect an error in this project).
  const supported = useSyncExternalStore(
    subscribeNever,
    () => getRecognitionCtor() !== null,
    () => false,
  );

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    // `stop()` still delivers a final result; `abort()` would discard it.
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return; // already listening
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError("");

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      setError(messageFor("default"));
      return;
    }

    rec.lang = "en-US";
    // One utterance at a time: recognition ends itself on a natural pause,
    // which is the behaviour people expect from a press-to-talk button.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) final += text;
        else interim += text;
      }
      if (final) onTranscriptRef.current(final.trim(), true);
      else if (interim) onTranscriptRef.current(interim.trim(), false);
    };

    rec.onerror = (event) => {
      const msg = messageFor(event.error);
      if (msg) setError(msg);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      // Chrome throws if start() is called twice in quick succession.
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  // Release the microphone when the panel closes or the widget unmounts —
  // mirrors the camera teardown in the skin navigator.
  useEffect(() => {
    if (enabled) return;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* noop */
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { supported, listening, error, start, stop };
}
