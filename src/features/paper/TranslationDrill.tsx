import { useState } from "react";
import { evaluateTranslation, type TranslationResult } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { SentenceStatus } from "../../shared/storage/paperProgressStore";
import { Icon } from "../../shared/ui/Icon";
import { segmentSentence } from "./paperLabels";

type Props = {
  lessonId: string;
  sentences: Array<{ id: string; ja: string }>;
  statuses: Record<string, SentenceStatus>;
  onStatus: (sentenceId: string, status: SentenceStatus) => void;
  onClose: () => void;
};

/**
 * Translate a passage sentence by sentence. After each try the Japanese sentence is coloured by
 * chunk: green where the learner's text contains an accepted translation, amber where nothing
 * matching was found. The matching is phrase-based, so "not found" is a hint, never a verdict.
 */
export function TranslationDrill({ lessonId, sentences, statuses, onStatus, onClose }: Props) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState(() => {
    const firstOpen = sentences.findIndex((s) => !statuses[s.id]);
    return firstOpen < 0 ? 0 : firstOpen;
  });
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentence = sentences[index];
  if (!sentence) return null;
  const done = sentences.filter((s) => statuses[s.id]).length;

  function go(to: number) {
    setIndex(to);
    setText("");
    setResult(null);
    setError(null);
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const { result: r } = await evaluateTranslation({ lesson_id: lessonId, sentence_id: sentence!.id, text });
      setResult(r);
      if (statuses[sentence!.id] !== "self") onStatus(sentence!.id, r.analysis.verdict);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const analysis = result?.analysis;
  const verdictKey = analysis ? (`paper.verdict.${analysis.verdict}` as const) : null;
  const parts = analysis ? segmentSentence(sentence.ja, analysis.chunks) : null;

  return (
    <section className="paper-drill" aria-label={t("paper.drillTitle")}>
      <header className="paper-drill__head">
        <div>
          <h3>{t("paper.drillTitle")}</h3>
          <p>{t("paper.drillHint")}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          <Icon name="close" size={16} />
          {t("paper.close")}
        </button>
      </header>

      <div className="paper-drill__progress">
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={sentences.length} aria-valuenow={done}>
          <span style={{ width: `${Math.round((done / sentences.length) * 100)}%` }} />
        </div>
        <span>
          {t("paper.sentence")} {index + 1}/{sentences.length}
        </span>
      </div>

      <p className="paper-drill__ja jp" lang="ja">
        {parts
          ? parts.map((p, i) =>
              p.chunk ? (
                <span key={i} className={`paper-chunk ${p.chunk.hit ? "is-hit" : "is-miss"}`}>
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )
          : sentence.ja}
      </p>

      <textarea
        className="paper-drill__input"
        rows={3}
        value={text}
        disabled={busy || !!result}
        placeholder={t("paper.drillPlaceholder")}
        onChange={(e) => setText(e.target.value)}
        aria-label={t("paper.drillPlaceholder")}
      />

      {!result && (
        <div className="paper-drill__actions">
          <button type="button" className="btn btn--primary" disabled={busy || !text.trim()} onClick={() => void analyze()}>
            {busy ? t("paper.checking") : t("paper.analyze")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => go(Math.min(sentences.length - 1, index + 1))} disabled={index >= sentences.length - 1}>
            {t("paper.skip")}
          </button>
        </div>
      )}
      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      )}

      {result && analysis && verdictKey && (
        <div className="paper-feedback">
          <p className={`paper-feedback__verdict is-${analysis.verdict}`}>
            {t(verdictKey)} · {analysis.hits}/{analysis.total}
          </p>
          <ul className="paper-feedback__chunks">
            {analysis.chunks.map((c, i) => (
              <li key={i} className={c.hit ? "is-hit" : "is-miss"}>
                <span className="paper-feedback__ja jp" lang="ja">
                  {c.ja}
                </span>
                {c.hit ? (
                  <span>
                    <Icon name="check" size={14} strokeWidth={3} /> {t("paper.chunkHit")}: “{c.matched}”{c.loose ? ` ${t("paper.loose")}` : ""}
                  </span>
                ) : (
                  <span>
                    <strong>{t("paper.chunkMiss")}.</strong> {t("paper.suggest")}: <em>{c.vi}</em>
                  </span>
                )}
                {c.note_vi && <small>{c.note_vi}</small>}
              </li>
            ))}
          </ul>
          {analysis.pitfalls.map((p, i) => (
            <p key={i} className="paper-feedback__pitfall">
              <Icon name="alert" size={16} /> <strong>{t("paper.pitfall")}:</strong> “{p.matched}” — {p.explanation_vi}
            </p>
          ))}
          <div className="paper-feedback__ref">
            <strong>{t("paper.reference")}</strong>
            <p>{result.reference.vi}</p>
            {result.reference.notes_vi && <small>{result.reference.notes_vi}</small>}
          </div>
          <p className="paper-feedback__caveat">{t("paper.drillCaveat")}</p>
          <div className="paper-drill__actions">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={statuses[sentence.id] === "self"}
              onClick={() => onStatus(sentence.id, "self")}
            >
              <Icon name="check" size={16} />
              {statuses[sentence.id] === "self" ? t("paper.selfDone") : t("paper.selfOk")}
            </button>
            {index < sentences.length - 1 ? (
              <button type="button" className="btn btn--primary" onClick={() => go(index + 1)}>
                {t("paper.next")}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {t("paper.finish")}
              </button>
            )}
          </div>
        </div>
      )}

      {index > 0 && !result && (
        <button type="button" className="btn btn--ghost btn--sm paper-drill__back" onClick={() => go(index - 1)}>
          {t("paper.prev")}
        </button>
      )}
    </section>
  );
}
