import { useEffect, useRef, useState } from "react";
import { refreshMyScore } from "../../shared/storage/myScoreStore";
import { Icon } from "../../shared/ui/Icon";
import { useMillText } from "./millionaireText";

const COUNT_MS = 1300;
const HOLD_MS = 700;
const FLY_MS = 900;

const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The points a game earned towards the ranking: the number counts up, then a copy of it flies to the account in the
 * header, and only then does the header's score change, so the gain is seen arriving rather than just appearing.
 */
export function MillionaireReward({ points }: { points: number }) {
  const mt = useMillText();
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const chip = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let frame = 0;
    let flight: Animation | undefined;
    let ghost: HTMLElement | undefined;

    const arrive = () => {
      if (done.current) return;
      done.current = true;
      ghost?.remove();
      setLanded(true);
      void refreshMyScore(true);
    };

    const fly = () => {
      const from = chip.current?.getBoundingClientRect();
      const target = document.querySelector(".account__chip")?.getBoundingClientRect();
      if (!from || !target || typeof document.body.animate !== "function" || reduced()) return arrive();
      ghost = document.createElement("div");
      ghost.className = "fc-mil-ghost";
      ghost.textContent = `+${points}`;
      ghost.style.left = `${from.left + from.width / 2}px`;
      ghost.style.top = `${from.top + from.height / 2}px`;
      document.body.appendChild(ghost);
      const dx = target.left + target.width / 2 - (from.left + from.width / 2);
      const dy = target.top + target.height / 2 - (from.top + from.height / 2);
      flight = ghost.animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1.25)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45)`, opacity: 0.1 },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" },
      );
      flight.onfinish = arrive;
    };

    if (reduced()) {
      setShown(points);
      timers.push(setTimeout(arrive, HOLD_MS));
    } else {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / COUNT_MS);
        setShown(Math.round(points * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
        else timers.push(setTimeout(fly, HOLD_MS));
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      flight?.cancel();
      ghost?.remove();
      // leaving early still brings the header's score up to date
      if (!done.current) {
        done.current = true;
        void refreshMyScore(true);
      }
    };
  }, [points]);

  return (
    <div ref={chip} className={`fc-mil-reward${landed ? " is-landed" : ""}`} role="status" aria-label={`+${points} ${mt("result.points")}`}>
      <Icon name="sparkles" size={18} />
      <strong className="tabular">+{shown}</strong>
      <span>{mt("result.points")}</span>
    </div>
  );
}
