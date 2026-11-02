import { useEffect, useState } from "react";

/**
 * Japanese text read aloud by the browser's own voices. Nothing is sent anywhere, and when the device has no
 * Japanese voice there is nothing to offer, so the speaker buttons stay away rather than read kana in a
 * foreign accent.
 */

const isJapanese = (v: SpeechSynthesisVoice) => /^ja([-_]|$)/i.test(v.lang);
// Voices that are known to sound natural come first.
const PREFERRED = /kyoko|nanami|haruka|google|otoya|o-ren/i;

function engine(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
    ? window.speechSynthesis
    : null;
}

export function pickJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ja = voices.filter(isJapanese);
  return ja.find((v) => PREFERRED.test(v.name)) ?? ja[0] ?? null;
}

/** The Japanese voice to use, or null when there is none. Browsers fill their voice list in late, so it is waited for. */
export function useJapaneseVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => {
    const e = engine();
    return e ? pickJapaneseVoice(e.getVoices()) : null;
  });
  useEffect(() => {
    const e = engine();
    if (!e) return;
    const update = () => setVoice(pickJapaneseVoice(e.getVoices()));
    update();
    e.addEventListener("voiceschanged", update);
    return () => e.removeEventListener("voiceschanged", update);
  }, []);
  return voice;
}

/** Reads `text` aloud, replacing anything already being read. `onEnd` runs when it finishes or is cut off. */
export function speakJapanese(text: string, voice: SpeechSynthesisVoice, onEnd?: () => void): void {
  const e = engine();
  if (!e || !text.trim()) return;
  e.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  e.speak(u);
}

export function stopSpeaking(): void {
  engine()?.cancel();
}
