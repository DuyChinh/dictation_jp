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
  if (!body) return null;
  return (
    <section style={{ marginTop: 16, padding: "1rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.95rem" }}>{body}</p>
    </section>
  );
}

export function TranscriptPanel({
  segments,
  speakers,
}: {
  segments: Array<{
    speaker_id: string;
    text: LocalizedText;
  }>;
  speakers: Array<{ id: string; label: LocalizedText }>;
}) {
  const labelOf = (id: string) => {
    const s = speakers.find((x) => x.id === id);
    return getLocalizedText(s?.label, "ja") || id;
  };
  return (
    <section style={{ marginTop: 16, padding: "1rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 700 }}>Transcript (JA)</h3>
      <div style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "var(--text-main)" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <strong style={{ color: "var(--primary-color)" }}>{labelOf(s.speaker_id)}:</strong>{" "}
            {getLocalizedText(s.text, "ja")}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TranslationPanel({
  dialogue,
  segments,
  lang,
}: {
  dialogue?: LocalizedText | null;
  segments: Array<{ text: LocalizedText }>;
  lang: SupportLang;
}) {
  const full = getLocalizedText(dialogue, lang);
  if (full) {
    return (
      <section style={{ marginTop: 16, padding: "1rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 700 }}>
          Bản dịch ({lang.toUpperCase()})
        </h3>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          {full}
        </p>
      </section>
    );
  }
  const lines = segments
    .map((s) => getLocalizedText(s.text, lang))
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <section style={{ marginTop: 16, padding: "1rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "1rem", color: "var(--text-main)", fontWeight: 700 }}>
        Bản dịch ({lang.toUpperCase()})
      </h3>
      {lines.map((l, i) => (
        <p key={i} style={{ margin: "0 0 6px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          {l}
        </p>
      ))}
    </section>
  );
}
