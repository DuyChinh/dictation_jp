import { useCallback, useEffect, useRef, useState } from "react";
import { stopSpeaking } from "./speech";

/**
 * Japanese speech turned into text by the browser's own recognizer. Chrome and Edge have it (Chrome sends the
 * audio to Google to do so); Firefox has none and Safari's is unreliable, so callers show a microphone only
 * where `supported` is true.
 */

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative; length: number };
type ResultEvent = { resultIndex: number; results: ArrayLike<Result> };

type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognizerClass(): (new () => Recognizer) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognizeSpeech(): boolean {
  return recognizerClass() !== null;
}

/** Why listening stopped without a result, in terms the screen can explain. */
export type SpeechInputError = "denied" | "noSpeech" | "noMic" | "network" | "failed";

function errorOf(code: string): SpeechInputError | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "no-speech":
      return "noSpeech";
    case "audio-capture":
      return "noMic";
    case "network":
      return "network";
    case "aborted":
      return null; // we stopped it ourselves
    default:
      return "failed";
  }
}

type Options = {
  /** What was heard so far; `final` is false while the sentence is still being worked out. */
  onText: (text: string, final: boolean) => void;
  lang?: string;
};

export function useSpeechInput({ onText, lang = "ja-JP" }: Options) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechInputError | null>(null);
  const recognizer = useRef<Recognizer | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const supported = canRecognizeSpeech();

  const stop = useCallback(() => recognizer.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognizerClass();
    if (!Ctor || recognizer.current) return;
    // The microphone would hear a word being read aloud and search for that.
    stopSpeaking();
    setError(null);
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onstart = () => setListening(true);
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        text += res[0].transcript;
        final = final || res.isFinal;
      }
      if (text) onTextRef.current(text.trim(), final);
    };
    r.onerror = (e) => setError(errorOf(e.error));
    r.onend = () => {
      recognizer.current = null;
      setListening(false);
    };
    recognizer.current = r;
    try {
      r.start();
    } catch {
      recognizer.current = null;
      setError("failed");
    }
  }, [lang]);

  // Leaving the screen switches the microphone off.
  useEffect(() => () => recognizer.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
