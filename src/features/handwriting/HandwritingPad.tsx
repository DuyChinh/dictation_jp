import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { recognize, type Point, type Template } from "./recognize";
import { loadTemplates } from "./templates";

type Props = {
  /** A character was chosen from the guesses. */
  onPick: (ch: string) => void;
  onClose: () => void;
};

const SIZE = 340;

/** Each stroke has its own hue, spread far apart so neighbours in the order are easy to tell apart. */
const hue = (i: number) => Math.round((215 + i * 137.5) % 360);
const inkOf = (i: number) => `hsl(${hue(i)} 78% 60%)`;
const badgeOf = (i: number) => `hsl(${hue(i)} 70% 40%)`;
const CANDIDATES = 14;

/** A drawing board for writing a kanji or kana by hand; the closest characters are offered as it is drawn. */
export function HandwritingPad({ onPick, onClose }: Props) {
  const { t } = useUiLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<Point[] | null>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTemplates()
      .then((list) => !cancelled && setTemplates(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const guesses = useMemo(
    () => (templates && strokes.length ? recognize(strokes, templates, CANDIDATES) : []),
    [strokes, templates],
  );

  const paint = useCallback((extra?: Point[] | null) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    if (el.width !== SIZE * ratio) {
      el.width = SIZE * ratio;
      el.height = SIZE * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = extra ? [...strokesRef.current, extra] : strokesRef.current;
    all.forEach((s, i) => {
      ctx.strokeStyle = inkOf(i);
      ctx.fillStyle = inkOf(i);
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0]!.x, s[0]!.y, 3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(s[0]!.x, s[0]!.y);
      for (const p of s.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    // Where each stroke began, numbered in the order drawn, as in a stroke-order diagram.
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    all.forEach((s, i) => {
      const b = s[0]!;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = badgeOf(i);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(String(i + 1), b.x, b.y + 0.5);
    });
  }, []);

  // The painting reads the strokes through a ref, so a stroke in progress is drawn without re-rendering.
  const strokesRef = useRef<Point[][]>([]);
  strokesRef.current = strokes;
  useEffect(() => paint(), [strokes, paint]);

  function at(e: PointerEvent<HTMLCanvasElement>): Point {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * SIZE, y: ((e.clientY - box.top) / box.height) * SIZE };
  }
  function down(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = [at(e)];
    paint(live.current);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!live.current) return;
    live.current.push(at(e));
    paint(live.current);
  }
  function up() {
    const done = live.current;
    live.current = null;
    if (done) setStrokes((s) => [...s, done]);
  }

  const clear = () => setStrokes([]);

  const note = failed
    ? { text: t("dict.hw.error"), error: true }
    : !templates
      ? { text: t("dict.hw.loading"), error: false }
      : strokes.length === 0
        ? { text: t("dict.hw.hint"), error: false }
        : guesses.length === 0
          ? { text: t("dict.hw.noMatch"), error: false }
          : null;

  return (
    <section className="hw" aria-label={t("dict.hw.title")}>
      <header className="hw__head">
        <h2>{t("dict.hw.title")}</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          <Icon name="close" size={16} />
          {t("dict.hw.close")}
        </button>
      </header>

      <div className="hw__strip" aria-live="polite">
        {note && <p className={`hw__note${note.error ? " hw__note--error" : ""}`}>{note.text}</p>}
        {guesses.map((ch) => (
          <button
            key={ch}
            type="button"
            className="hw__guess jp"
            lang="ja"
            onClick={() => {
              onPick(ch);
              clear();
            }}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="hw__board">
        <canvas
          ref={canvas}
          className="hw__canvas"
          width={SIZE}
          height={SIZE}
          aria-label={t("dict.hw.canvas")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <div className="hw__tools">
          <button
            type="button"
            className="hw__tool"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((s) => s.slice(0, -1))}
            aria-label={t("dict.hw.undo")}
            title={t("dict.hw.undo")}
          >
            <Icon name="replay" size={18} />
          </button>
          <button
            type="button"
            className="hw__tool"
            disabled={strokes.length === 0}
            onClick={clear}
            aria-label={t("dict.hw.clear")}
            title={t("dict.hw.clear")}
          >
            <Icon name="trash" size={18} />
          </button>
          <span className="hw__count" aria-live="off">
            {strokes.length > 0 ? fmt(t("dict.hw.strokes"), { n: strokes.length }) : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
