import type { LocalizedText } from "../../shared/content/getLocalizedText";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import type { SupportLang } from "../../shared/content/languageSettings";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";

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
}: {
  segments: DialogueSegment[];
  speakers: Array<{ id: string; label: LocalizedText }>;
  dialogue?: LocalizedText | null;
  lang: SupportLang;
  evidenceIds?: readonly string[];
  wrongIds?: readonly string[];
  onPlayLine?: (fromMs: number, toMs: number) => void;
}) {
  const { t } = useUiLanguage();
  const labelOf = (id: string) => {
    const s = speakers.find((x) => x.id === id);
    return getLocalizedText(s?.label, "ja") || id;
  };
  // Only the requested language: getLocalizedText would fall back to Japanese or "—".
  const lineTr = (text: LocalizedText) => (usable(text[lang] ?? "") ? text[lang]!.trim() : "");
  const hasLineTr = segments.some((s) => lineTr(s.text));
  const full = dialogue && usable(dialogue[lang] ?? "") ? dialogue[lang]!.trim() : "";
  const evidence = new Set(evidenceIds ?? []);
  const wrong = new Set((wrongIds ?? []).filter((id) => !evidence.has(id)));
  const markOf = (id?: string): "answer" | "wrong" | null =>
    id && evidence.has(id) ? "answer" : id && wrong.has(id) ? "wrong" : null;
  const fullLines = full ? translationLines(full, segments, markOf) : null;
  const order = [...new Set(segments.map((s) => s.speaker_id))];

  return (
    <section className="dialogue" aria-label="Transcript">
      {evidenceIds && (
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
      )}
      <ol className="dialogue__lines">
        {segments.map((s, i) => {
          const tr = lineTr(s.text);
          const who = labelOf(s.speaker_id);
          const mark = markOf(s.id);
          const timed = s.start_ms != null && s.end_ms != null;
          return (
            <li
              key={s.id ?? i}
              className={`dialogue__line${mark === "answer" ? " is-answer" : mark === "wrong" ? " is-wrong" : ""}`}
              data-tone={speakerTone(s.speaker_id, who, order)}
            >
              <strong className="dialogue__who jp">{who}</strong>
              <div className="dialogue__text">
                {mark === "answer" && <span className="dialogue__badge">{t("listening.answerHere")}</span>}
                {mark === "wrong" && (
                  <span className="dialogue__badge dialogue__badge--wrong">{t("listening.wrongHere")}</span>
                )}
                <span className="jp">{getLocalizedText(s.text, "ja")}</span>
                {tr && <span className="dialogue__tr">{tr}</span>}
              </div>
              {onPlayLine && timed && (
                <button
                  type="button"
                  className="icon-btn icon-btn--round dialogue__play"
                  style={{ width: 34, height: 34 }}
                  aria-label={t("listening.playLine")}
                  title={t("listening.playLine")}
                  onClick={() => onPlayLine(s.start_ms!, s.end_ms!)}
                >
                  <Icon name="play" size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {!hasLineTr && full && (
        <div className="dialogue__full">
          <span className="eyebrow">{lang === "vi" ? "Bản dịch" : "Translation"}</span>
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
      )}
    </section>
  );
}
