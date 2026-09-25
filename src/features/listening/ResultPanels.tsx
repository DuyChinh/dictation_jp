import type { LocalizedText } from "../../shared/content/getLocalizedText";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import type { SupportLang } from "../../shared/content/languageSettings";

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

/**
 * Whole dialogue: each line in Japanese with its translation under it.
 * When lines have no translation, the question-level translation is shown after the dialogue.
 */
export function DialoguePanel({
  segments,
  speakers,
  dialogue,
  lang,
}: {
  segments: Array<{ speaker_id: string; text: LocalizedText }>;
  speakers: Array<{ id: string; label: LocalizedText }>;
  dialogue?: LocalizedText | null;
  lang: SupportLang;
}) {
  const labelOf = (id: string) => {
    const s = speakers.find((x) => x.id === id);
    return getLocalizedText(s?.label, "ja") || id;
  };
  // Only the requested language: getLocalizedText would fall back to Japanese or "—".
  const lineTr = (t: LocalizedText) => (usable(t[lang] ?? "") ? t[lang]!.trim() : "");
  const hasLineTr = segments.some((s) => lineTr(s.text));
  const full = dialogue && usable(dialogue[lang] ?? "") ? dialogue[lang]!.trim() : "";

  return (
    <section className="dialogue" aria-label="Transcript">
      <ol className="dialogue__lines">
        {segments.map((s, i) => {
          const tr = lineTr(s.text);
          return (
            <li key={i} className="dialogue__line">
              <strong className="dialogue__who jp">{labelOf(s.speaker_id)}</strong>
              <div className="dialogue__text">
                <span className="jp">{getLocalizedText(s.text, "ja")}</span>
                {tr && <span className="dialogue__tr">{tr}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {!hasLineTr && full && (
        <div className="dialogue__full">
          <span className="eyebrow">{lang === "vi" ? "Bản dịch" : "Translation"}</span>
          <p>{full}</p>
        </div>
      )}
    </section>
  );
}
