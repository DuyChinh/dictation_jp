import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { sfx } from "../../shared/utils/sfx";
import { useFt } from "./flashText";
import { useMillText } from "./millionaireText";
import { musicOn, saveMusic, saveSound, soundOn } from "./prefs";

export type Fx = "correct" | "wrong" | "flip" | "win";

/** Plays a game sound unless the learner turned sound off. */
export function playFx(kind: Fx): void {
  if (!soundOn()) return;
  if (kind === "correct") sfx.playCorrect();
  else if (kind === "wrong") sfx.playWrong();
  else if (kind === "flip") sfx.playFlip();
  else sfx.playVictory();
}

export function SoundToggle() {
  const ft = useFt();
  const [on, setOn] = useState(soundOn);
  return (
    <button
      type="button"
      className="icon-btn icon-btn--ghost fc-sound"
      aria-pressed={on}
      aria-label={on ? ft("game.soundOff") : ft("game.soundOn")}
      title={on ? ft("game.soundOff") : ft("game.soundOn")}
      onClick={() => {
        saveSound(!on);
        setOn(!on);
      }}
    >
      <Icon name={on ? "volume" : "eyeOff"} size={18} />
    </button>
  );
}

/** Switches the background music of the quiz show on and off; the sound effects have their own button. */
export function MusicToggle() {
  const mt = useMillText();
  const [on, setOn] = useState(musicOn);
  const label = on ? mt("music.on") : mt("music.off");
  return (
    <button
      type="button"
      className="icon-btn icon-btn--ghost fc-sound fc-music"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => {
        saveMusic(!on);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M9 18V6l10-2v12" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

/** Three stars that pop in one after the other; `count` of them are filled. */
export function Stars({ count }: { count: number }) {
  const ft = useFt();
  return (
    <span className="fc-stars" role="img" aria-label={ft("game.stars", { n: count })}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="44" height="44" className={i < count ? "is-on" : ""} style={{ animationDelay: `${0.15 + i * 0.18}s` }} aria-hidden="true">
          <path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}

export type Pop = { id: number; text: string; tone: "good" | "bad" | "info"; left: number };

/** Little "+10" labels that float up and fade; they remove themselves. */
export function usePops(): { pops: Pop[]; pop: (text: string, tone?: Pop["tone"], left?: number) => void } {
  const [pops, setPops] = useState<Pop[]>([]);
  const seq = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const pop = useCallback((text: string, tone: Pop["tone"] = "good", left = 50) => {
    const id = ++seq.current;
    setPops((p) => [...p.slice(-4), { id, text, tone, left }]);
    timers.current.push(setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000));
  }, []);
  return { pops, pop };
}

export function Pops({ pops }: { pops: Pop[] }) {
  return (
    <span className="fc-pops" aria-hidden="true">
      {pops.map((p) => (
        <span key={p.id} className={`fc-pop fc-pop--${p.tone}`} style={{ left: `${p.left}%` }}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

const SPARKS = 10;

/** A ring of little sparks that fly outwards once; put it inside a positioned element. */
export function Burst({ tone = "good" }: { tone?: "good" | "bad" }) {
  return (
    <span className={`fc-burst fc-burst--${tone}`} aria-hidden="true">
      {Array.from({ length: SPARKS }, (_, i) => (
        <i key={i} style={{ ["--a" as string]: `${(360 / SPARKS) * i}deg`, ["--d" as string]: `${0.02 * i}s` }} />
      ))}
    </span>
  );
}

/** Restarts a CSS animation on its element each time `trigger` changes (e.g. a screen shake). */
export function useShake(): { shaking: boolean; shake: () => void } {
  const [shaking, setShaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shake = useCallback(() => {
    clearTimeout(timer.current);
    setShaking(false);
    // a frame later, so the class is added again and the animation restarts
    timer.current = setTimeout(() => {
      setShaking(true);
      timer.current = setTimeout(() => setShaking(false), 450);
    }, 20);
  }, []);
  return { shaking, shake };
}
