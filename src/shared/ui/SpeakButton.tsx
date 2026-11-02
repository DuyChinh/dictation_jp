import { useEffect, useRef, useState } from "react";
import { speakJapanese, stopSpeaking, useJapaneseVoice } from "../audio/speech";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import { Icon } from "./Icon";

type Props = {
  /** What to read: kana for a word (kanji can be read two ways), the sentence itself for an example. */
  text: string;
  className?: string;
};

/** A small speaker that reads Japanese text aloud; absent when the device has no Japanese voice. */
export function SpeakButton({ text, className = "" }: Props) {
  const { t } = useUiLanguage();
  const voice = useJapaneseVoice();
  const [speaking, setSpeaking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A button that goes away while reading (popup closed) must not leave the voice running.
  useEffect(() => () => {
    if (speaking) stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!voice || !text.trim()) return null;

  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speakJapanese(text, voice!, () => {
      if (mounted.current) setSpeaking(false);
    });
  }

  return (
    <button
      type="button"
      className={`speak-btn${speaking ? " is-speaking" : ""} ${className}`.trim()}
      onClick={toggle}
      aria-label={t("speak.listen")}
      aria-pressed={speaking}
      title={t("speak.listen")}
    >
      <Icon name="volume" size={16} strokeWidth={2.2} />
    </button>
  );
}
