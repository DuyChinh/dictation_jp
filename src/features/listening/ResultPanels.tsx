import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalizedText } from "../../shared/content/getLocalizedText";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import type { SupportLang } from "../../shared/content/languageSettings";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { SegmentPlayer } from "../../shared/audio/SegmentPlayer";
import type { useAudioEngine } from "../../shared/audio/useAudioEngine";
import { Icon } from "../../shared/ui/Icon";

/** The usual "translate" mark: a Japanese character on one tile and a Latin letter on the one in front. */
function TranslateGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg className="tr-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="12.5" height="12.5" rx="3.5" className="tr-glyph__back" />
      <text x="7.75" y="8.3" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="700" className="tr-glyph__ja">
        文
      </text>
      <rect x="10" y="10" width="12.5" height="12.5" rx="3.5" className="tr-glyph__front" />
      <text x="16.25" y="16.5" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="800" className="tr-glyph__a">
        A
      </text>
    </svg>
  );
}

export function ExplanationPanel({
  text,
  lang,
  title = "Giải thích",
}: {
  text?: LocalizedText | null;
  lang: SupportLang;
  title?: string;
}) {
  const body = getLocalizedText(text, lang);
  if (!body || body === "—") return null;
  return (
    <section style={{ marginTop: 16, padding: "1rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.95rem" }}>{body}</p>
    </section>
  );
}

function usable(text: string): boolean {
  const s = text.trim();
  return s !== "" && s !== "—";
}

type DialogueSegment = {
  id?: string;
  speaker_id: string;
  start_ms?: number | null;
  end_ms?: number | null;
  text: LocalizedText;
};

/** Colour group of a speaker: men blue, women pink, narrator grey, anyone else by first appearance. */
function speakerTone(id: string, label: string, order: string[]): string {
  const key = `${id} ${label}`.toLowerCase();
  if (/narrator|announcer|ナレーション|アナウンサー/.test(key)) return "narrator";
  if (/female|woman|女/.test(key)) return "female";
  if (/male|man|男/.test(key)) return "male";
  const i = order.indexOf(id);
  return i % 2 === 0 ? "other1" : "other2";
}

/**
 * Splits a whole-dialogue translation ("Nam: …\nNữ: …") into its turns and marks the ones that
 * hold a marked line. The translation merges lines of the same speaker into one turn, so a turn is
 * marked when any of its lines is; returns null when the turns can't be matched one to one.
 */
function translationLines(
  full: string,
  segments: DialogueSegment[],
  markOf: (id?: string) => "answer" | "wrong" | null,
): Array<{ text: string; mark: "answer" | "wrong" | null }> | null {
  const lines = full.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: Array<DialogueSegment[]> = [];
  for (const seg of segments) {
    const last = turns[turns.length - 1];
    if (last && last[0]!.speaker_id === seg.speaker_id) last.push(seg);
    else turns.push([seg]);
  }
  if (lines.length !== turns.length) return null;
  return lines.map((text, i) => {
    const marks = turns[i]!.map((seg) => markOf(seg.id));
    return { text, mark: marks.includes("answer") ? "answer" : marks.includes("wrong") ? "wrong" : null };
  });
}

function splitSentences(text: string): string[] {
  const sents: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    cur += ch;
    if (ch === "“" || ch === "”" || ch === "\"" || ch === "「" || ch === "」") {
      inQuote = !inQuote;
    }
    if (!inQuote && (ch === "." || ch === "?" || ch === "!")) {
      const nextChar = text[i + 1];
      if (ch === "." && nextChar && /\d/.test(nextChar)) {
        continue;
      }
      if (i === text.length - 1 || /\s/.test(nextChar ?? "")) {
        sents.push(cur.trim());
        cur = "";
      }
    }
  }
  if (cur.trim()) {
    sents.push(cur.trim());
  }
  return sents.filter(Boolean);
}

function resolveLineTranslations(
  segments: DialogueSegment[],
  dialogue: LocalizedText | null | undefined,
  lang: SupportLang,
): string[] {
  const direct = segments.map((s) => (usable(s.text[lang] ?? "") ? s.text[lang]!.trim() : ""));
  if (direct.every((t) => !!t)) {
    return direct;
  }

  const full = dialogue && usable(dialogue[lang] ?? "") ? dialogue[lang]!.trim() : "";
  if (!full) return direct;

  const lines = full.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: Array<{ speaker_id: string; segments: Array<{ seg: DialogueSegment; sIdx: number }> }> = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]!;
    const last = turns[turns.length - 1];
    if (last && last.speaker_id === seg.speaker_id) {
      last.segments.push({ seg, sIdx });
    } else {
      turns.push({ speaker_id: seg.speaker_id, segments: [{ seg, sIdx }] });
    }
  }

  const result = [...direct];

  if (lines.length === turns.length) {
    for (let tIdx = 0; tIdx < turns.length; tIdx++) {
      const turn = turns[tIdx]!;
      const lineText = lines[tIdx]!.replace(/^[^:：]+[:：]\s*/, "").trim();
      if (turn.segments.length === 1) {
        const sIdx = turn.segments[0]!.sIdx;
        if (!result[sIdx]) result[sIdx] = lineText;
      } else {
        const sents = splitSentences(lineText);
        if (sents.length === turn.segments.length) {
          for (let i = 0; i < sents.length; i++) {
            const sIdx = turn.segments[i]!.sIdx;
            if (!result[sIdx]) result[sIdx] = sents[i]!;
          }
        } else {
          for (let i = 0; i < turn.segments.length; i++) {
            const sIdx = turn.segments[i]!.sIdx;
            if (!result[sIdx]) {
              result[sIdx] = sents[i] || lineText;
            }
          }
        }
      }
    }
  } else if (lines.length === segments.length) {
    for (let i = 0; i < segments.length; i++) {
      if (!result[i]) {
        result[i] = lines[i]!.replace(/^[^:：]+[:：]\s*/, "").trim();
      }
    }
  }

  return result;
}

/**
 * Whole dialogue: each line in Japanese with its translation under it, coloured by speaker.
 * Lines in `evidenceIds` carry the answer and are highlighted green; lines in `wrongIds` are what
 * tempted the learner into a wrong choice and are highlighted red. Both marks carry over to the
 * Vietnamese/English translation. `onPlayLine` adds a play button to every timed line. When
 * lines have no translation, the question-level translation is shown after the dialogue.
 */
export function DialoguePanel({
  segments,
  speakers,
  dialogue,
  lang,
  evidenceIds,
  wrongIds,
  onPlayLine,
  audio,
  audioRange,
  showPlayer = true,
  defaultShowTranslations = false,
}: {
  segments: DialogueSegment[];
  speakers: Array<{ id: string; label: LocalizedText }>;
  dialogue?: LocalizedText | null;
  lang: SupportLang;
  evidenceIds?: readonly string[];
  wrongIds?: readonly string[];
  onPlayLine?: (fromMs: number, toMs: number) => void;
  audio?: ReturnType<typeof useAudioEngine>;
  audioRange?: { startMs: number; endMs: number } | null;
  showPlayer?: boolean;
  defaultShowTranslations?: boolean;
}) {
  const { t, uiLang } = useUiLanguage();
  // Translations follow the web's language (and so does the VI/EN mark); other web languages keep the saved choice.
  const shownLang: SupportLang = uiLang === "vi" || uiLang === "en" ? uiLang : lang;
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeLineRef = useRef<HTMLLIElement | null>(null);

  const otherLang: SupportLang = shownLang === "vi" ? "en" : "vi";
  // Each line is translated into the web's language; a line that only exists in the other one shows that instead.
  const lineTr = useMemo(() => {
    const primary = resolveLineTranslations(segments, dialogue, shownLang);
    const fallback = resolveLineTranslations(segments, dialogue, otherLang);
    return segments.map((_, i): { text: string; lang: SupportLang } | null =>
      primary[i] ? { text: primary[i]!, lang: shownLang } : fallback[i] ? { text: fallback[i]!, lang: otherLang } : null,
    );
  }, [segments, dialogue, shownLang, otherLang]);
  const lineTranslations = useMemo(() => lineTr.map((x) => x?.text ?? ""), [lineTr]);

  const [expandedTrIndices, setExpandedTrIndices] = useState<Set<number>>(() => {
    if (defaultShowTranslations) {
      return new Set(segments.map((_, i) => i));
    }
    return new Set();
  });

  const hasAnyTr = useMemo(() => lineTranslations.some((tr) => !!tr), [lineTranslations]);
  const allExpanded = hasAnyTr && segments.every((_, i) => !lineTranslations[i] || expandedTrIndices.has(i));

  const toggleLineTr = (i: number) => {
    setExpandedTrIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAllTr = () => {
    if (allExpanded) {
      setExpandedTrIndices(new Set());
    } else {
      setExpandedTrIndices(new Set(segments.map((_, i) => i)));
    }
  };

  useEffect(() => {
    if (!audio?.engine) return;
    const eng = audio.engine;
    const update = () => {
      setNowMs(eng.getCurrentTimeMs());
      setIsPlaying(eng.getState() === "playing");
    };
    update();
    const id = setInterval(update, 80);
    return () => clearInterval(id);
  }, [audio, audio?.state]);

  const activeSegmentIndex = useMemo(() => {
    if (nowMs == null) return -1;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      if (s.start_ms == null || s.end_ms == null) continue;
      if (nowMs >= s.start_ms && nowMs < s.end_ms) {
        return i;
      }
      const next = segments[i + 1];
      if (
        nowMs >= s.end_ms &&
        ((next && next.start_ms != null && nowMs < next.start_ms) ||
          (!next && nowMs <= s.end_ms + 1200))
      ) {
        return i;
      }
    }
    return -1;
  }, [nowMs, segments]);

  useEffect(() => {
    if (activeSegmentIndex >= 0 && isPlaying && activeLineRef.current) {
      if (typeof activeLineRef.current.scrollIntoView === "function") {
        activeLineRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeSegmentIndex, isPlaying]);

  // How the current sound was started, so resuming continues over the same stretch.
  const startedFrom = useRef<"line" | "range">("range");

  const handleLineClick = (s: DialogueSegment) => {
    if (s.start_ms == null) return;
    if (audio && audioRange) {
      startedFrom.current = "range";
      void audio.playFrom(audioRange, s.start_ms).catch(() => undefined);
    } else if (onPlayLine && s.end_ms != null) {
      onPlayLine(s.start_ms, s.end_ms);
    }
  };

  const handlePlayLineOnly = (e: React.MouseEvent, s: DialogueSegment, isActive: boolean) => {
    e.stopPropagation();
    if (s.start_ms == null || s.end_ms == null) return;
    const lineRange = { startMs: s.start_ms, endMs: s.end_ms };
    if (audio && isActive) {
      // The line being read: pause where it is, or carry on from there.
      if (isPlaying) {
        audio.pause();
      } else if (startedFrom.current === "range" && audioRange) {
        void audio.resume(audioRange).catch(() => undefined);
      } else {
        void audio.resume(lineRange).catch(() => undefined);
      }
      return;
    }
    if (onPlayLine) {
      startedFrom.current = "line";
      onPlayLine(s.start_ms, s.end_ms);
    } else if (audio) {
      startedFrom.current = "line";
      void audio.playSegment(lineRange).catch(() => undefined);
    }
  };

  const labelOf = (id: string) => {
    const s = speakers.find((x) => x.id === id);
    return getLocalizedText(s?.label, "ja") || id;
  };
  const fullLang: SupportLang | null =
    dialogue && usable(dialogue[shownLang] ?? "") ? shownLang : dialogue && usable(dialogue[otherLang] ?? "") ? otherLang : null;
  const full = fullLang ? dialogue![fullLang]!.trim() : "";
  const evidence = new Set(evidenceIds ?? []);
  const wrong = new Set((wrongIds ?? []).filter((id) => !evidence.has(id)));
  const markOf = (id?: string): "answer" | "wrong" | null =>
    id && evidence.has(id) ? "answer" : id && wrong.has(id) ? "wrong" : null;
  const fullLines = full ? translationLines(full, segments, markOf) : null;
  const order = [...new Set(segments.map((s) => s.speaker_id))];

  return (
    <section className="dialogue" aria-label="Transcript">
      {audio && audioRange && showPlayer && (
        <div className="dialogue__player-wrap">
          <SegmentPlayer
            audio={audio}
            range={audioRange}
            onReplay={() => void audio.playSegment(audioRange).catch(() => undefined)}
            clock="relative"
            seekKeys
          />
        </div>
      )}

      <div className="dialogue__toolbar">
        {evidenceIds ? (
          <div className="seg-legend dialogue__legend" aria-label={t("listening.legendMarks")}>
            <span>
              <i className="i-ok" />
              {t("listening.legendAnswerLine")}
            </span>
            <span>
              <i className="i-bad" />
              {t("listening.legendWrongLine")}
            </span>
          </div>
        ) : <div />}
        {hasAnyTr && (
          <button
            type="button"
            className="btn btn--ghost btn--xs dialogue__toggle-all"
            onClick={toggleAllTr}
            title={allExpanded ? t("listening.hideAllTranslations") : t("listening.showAllTranslations")}
          >
            <TranslateGlyph size={18} />
            <span>{allExpanded ? t("listening.hideAllTranslations") : t("listening.showAllTranslations")}</span>
          </button>
        )}
      </div>

      <ol className="dialogue__lines">
        {segments.map((s, i) => {
          const tr = lineTranslations[i];
          const trCode = (lineTr[i]?.lang ?? shownLang) === "vi" ? "VI" : "EN";
          const isExpanded = expandedTrIndices.has(i);
          const who = labelOf(s.speaker_id);
          const mark = markOf(s.id);
          const timed = s.start_ms != null && s.end_ms != null;
          const isActive = activeSegmentIndex === i;
          const canPlay = timed && (!!audio || !!onPlayLine);
          const tone = speakerTone(s.speaker_id, who, order);
          const roleLabel =
            tone === "male"
              ? t("listening.roleMale")
              : tone === "female"
                ? t("listening.roleFemale")
                : tone === "narrator"
                  ? t("listening.roleNarrator")
                  : who;
          const progress =
            isActive && timed && nowMs != null
              ? Math.min(100, Math.max(0, ((nowMs - s.start_ms!) / Math.max(1, s.end_ms! - s.start_ms!)) * 100))
              : 0;
          return (
            <li
              key={s.id ?? i}
              ref={isActive ? activeLineRef : null}
              className={`dialogue__line${mark === "answer" ? " is-answer" : mark === "wrong" ? " is-wrong" : ""}${isActive ? " is-active" : ""}${canPlay ? " dialogue__line--interactive" : ""}`}
              data-tone={tone}
              onClick={canPlay ? () => handleLineClick(s) : undefined}
              title={canPlay ? t("listening.playFromLine") : undefined}
              tabIndex={canPlay ? 0 : undefined}
              role={canPlay ? "button" : undefined}
              onKeyDown={
                canPlay
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLineClick(s);
                      }
                    }
                  : undefined
              }
            >
              <div className="dialogue__who">
                <span className="dialogue__avatar jp" aria-hidden="true">
                  {tone === "narrator" ? <Icon name="mic" size={22} /> : Array.from(who)[0]}
                </span>
                <span className="dialogue__who-label">{roleLabel}</span>
              </div>
              <div className="dialogue__text">
                {isActive && (
                  <span className="dialogue__active-pill">
                    <Icon name="bars" size={14} strokeWidth={2.4} />
                    {isPlaying ? t("listening.nowPlaying") : t("listening.paused")}
                  </span>
                )}
                {mark === "answer" && <span className="dialogue__badge">{t("listening.answerHere")}</span>}
                {mark === "wrong" && (
                  <span className="dialogue__badge dialogue__badge--wrong">{t("listening.wrongHere")}</span>
                )}
                <span className="jp">{getLocalizedText(s.text, "ja")}</span>
                {isExpanded && tr && (
                  <div
                    className="dialogue__tr-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="dialogue__tr-badge">
                      <TranslateGlyph size={16} />
                      {trCode}
                    </span>
                    <span className="dialogue__tr-text">{tr}</span>
                    <button
                      type="button"
                      className="dialogue__tr-box-close"
                      aria-label={t("listening.hideLineTranslation")}
                      title={t("listening.hideLineTranslation")}
                      onClick={() => toggleLineTr(i)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="dialogue__actions" onClick={(e) => e.stopPropagation()}>
                {tr && (
                  <button
                    type="button"
                    className={`dialogue__tr-btn${isExpanded ? " is-active" : ""}`}
                    aria-label={isExpanded ? t("listening.hideLineTranslation") : t("listening.showLineTranslation")}
                    title={isExpanded ? t("listening.hideLineTranslation") : t("listening.showLineTranslation")}
                    aria-expanded={isExpanded}
                    onClick={() => toggleLineTr(i)}
                  >
                    <TranslateGlyph size={20} />
                    <span className="dialogue__tr-btn-label">
                      {trCode}
                    </span>
                  </button>
                )}
                {canPlay && (
                  <button
                    type="button"
                    className={`icon-btn icon-btn--round dialogue__play${isActive && isPlaying ? " is-playing" : ""}`}
                    style={{ width: 40, height: 40 }}
                    aria-label={isActive && isPlaying ? t("dictation.pause") : t("listening.playLine")}
                    title={isActive && isPlaying ? t("dictation.pause") : t("listening.playLine")}
                    onClick={(e) => handlePlayLineOnly(e, s, isActive)}
                  >
                    <Icon name={isActive && isPlaying ? "pause" : "play"} size={14} />
                  </button>
                )}
              </div>
              {isActive && timed && (
                <span className="dialogue__progress" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {full && (
        <details className="dialogue__full-details">
          <summary className="dialogue__full-summary">
            <span className="eyebrow">{fullLang === "vi" ? "Xem toàn bộ bản dịch bài nghe" : "Full dialogue translation"}</span>
            <Icon name="chevronRight" size={14} />
          </summary>
          <div className="dialogue__full-body">
            {fullLines ? (
              fullLines.map((l, i) => (
                <p key={i} className={`dialogue__trline${l.mark ? ` is-${l.mark}` : ""}`}>
                  {l.text}
                </p>
              ))
            ) : (
              <p>{full}</p>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
