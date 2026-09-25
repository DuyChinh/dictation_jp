import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PracticePackage } from "../../shared/api/content";
import { evaluateListening, type ListeningEvalResult } from "../../shared/api/evaluate";
import { useAudioEngine } from "../../shared/audio/useAudioEngine";
import { SegmentPlayer } from "../../shared/audio/SegmentPlayer";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { useContentLanguage } from "../../shared/content/LanguageProvider";
import type { SupportLang } from "../../shared/content/languageSettings";
import { partLabel, partType } from "../../shared/content/lessonLabels";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  getListeningAnswers,
  recordListeningAnswer,
  type ListeningAnswer,
} from "../../shared/storage/listeningScoreStore";
import { Icon } from "../../shared/ui/Icon";
import { ChoiceCards } from "./ChoiceCards";
import { ImageChoiceGrid } from "./ImageChoiceGrid";
import { DialoguePanel } from "./ResultPanels";
import {
  flattenUnits,
  isUsefulExplanation,
  resolveListeningUi,
  scoreBySection,
  sectionNo,
  unitStatus,
  type ListeningUnit,
} from "./listeningUnits";

type Props = {
  lessonId: string;
  /** The whole lesson; scores cover every part even when one part is shown. */
  practice: PracticePackage;
  sectionId?: string;
  initialQuestionId?: string;
  /** Retry mode: only these questions are shown. */
  onlyQuestionIds?: string[];
  /** Base path of this page, e.g. /lessons/x/listening */
  basePath: string;
  lessonHref: string;
};

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ListeningWorkspace({
  lessonId,
  practice,
  sectionId,
  initialQuestionId,
  onlyQuestionIds,
  basePath,
  lessonHref,
}: Props) {
  const { t, uiLang } = useUiLanguage();
  const navigate = useNavigate();
  const units = useMemo(
    () => flattenUnits(practice, { sectionId, onlyQuestionIds }),
    [practice, sectionId, onlyQuestionIds],
  );
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      units.findIndex((u) =>
        u.parts.some((p) => p.question.id === initialQuestionId || u.unitId === initialQuestionId),
      ),
    ),
  );
  const [answers, setAnswers] = useState<Record<string, ListeningAnswer>>(() => getListeningAnswers(lessonId));
  const [selectedByPart, setSelectedByPart] = useState<Record<string, string>>({});
  const [resultsByPart, setResultsByPart] = useState<Record<string, ListeningEvalResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);
  const audio = useAudioEngine();
  const { translationLang, setExplanationLang, setTranslationLang } = useContentLanguage();

  const current: ListeningUnit | undefined = units[index];
  const primary = current?.parts[0]?.question;
  const range = primary ? { startMs: primary.audio.start_ms, endMs: primary.audio.end_ms } : null;

  useEffect(() => {
    void audio.load(practice.audio_url).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  // New question: clear the page, restore earlier answers, or start the audio.
  useEffect(() => {
    setSelectedByPart({});
    setResultsByPart({});
    setError(null);
    setReplayCount(0);
    setShowDialogue(false);
    if (!current || !primary) return;
    const stored = getListeningAnswers(lessonId);
    const answered = current.parts.filter((p) => stored[p.question.id]);
    if (answered.length === 0) {
      void audio.playSegment({ startMs: primary.audio.start_ms, endMs: primary.audio.end_ms }).catch(() => undefined);
      return;
    }
    let cancelled = false;
    // The package has no answers in it; ask the server again to show the reveal.
    Promise.all(
      answered.map((p) =>
        evaluateListening({
          lesson_id: lessonId,
          question_id: p.question.id,
          answer: { choice_id: stored[p.question.id]!.choiceId },
        }).then(({ result }) => [p.question.id, result] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        setResultsByPart(Object.fromEntries(pairs));
        setSelectedByPart(Object.fromEntries(pairs.map(([id, r]) => [id, r.selected_choice_id])));
      })
      .catch(() => {
        if (!cancelled) setError(t("listening.submitError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.unitId]);

  const score = useMemo(() => scoreBySection(practice, answers), [practice, answers]);
  const answeredCount = score.right + score.wrong;
  const pct = answeredCount ? Math.round((score.right / answeredCount) * 100) : 0;

  const submitted = !!current && current.parts.every((p) => resultsByPart[p.question.id]);
  const allSelected =
    !!current && current.parts.every((p) => selectedByPart[p.question.id] || resultsByPart[p.question.id]);

  const onSubmit = useCallback(async () => {
    if (!current || !allSelected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const next: Record<string, ListeningEvalResult> = { ...resultsByPart };
      let stored = answers;
      // A retried unit can keep sub-questions answered earlier; only send the open ones.
      for (const part of current.parts.filter((p) => !resultsByPart[p.question.id])) {
        const choiceId = selectedByPart[part.question.id]!;
        const { result } = await evaluateListening({
          lesson_id: lessonId,
          question_id: part.question.id,
          answer: { choice_id: choiceId },
          behavior: { replay_count: replayCount },
        });
        next[part.question.id] = result;
        const saved = recordListeningAnswer(lessonId, part.question.id, {
          choiceId: result.selected_choice_id,
          correct: result.correct,
          correctChoiceId: result.correct_choice_id,
        });
        stored = { ...stored, [part.question.id]: saved };
      }
      setResultsByPart(next);
      setAnswers(stored);
    } catch {
      setError(t("listening.submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [allSelected, answers, current, lessonId, replayCount, resultsByPart, selectedByPart, submitting, t]);

  const onReplay = useCallback(() => {
    if (!range) return;
    setReplayCount((n) => n + 1);
    void audio.playSegment(range).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, range?.startMs, range?.endMs]);

  // Next: the next unit here, else the next part, else the results.
  const sectionIndex = current ? practice.sections.findIndex((s) => s.id === current.section.id) : -1;
  const nextSection = sectionId && !onlyQuestionIds ? practice.sections[sectionIndex + 1] : undefined;
  const resultHref = `${basePath}/result`;
  const nextKind: "unit" | "section" | "result" =
    index < units.length - 1 ? "unit" : nextSection ? "section" : "result";
  const goNext = useCallback(() => {
    if (nextKind === "unit") setIndex((i) => i + 1);
    else if (nextKind === "section" && nextSection)
      navigate(`${basePath}?section=${encodeURIComponent(nextSection.id)}`);
    else navigate(resultHref);
  }, [basePath, navigate, nextKind, nextSection, resultHref]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const pickForFirstOpenPart = useCallback(
    (n: number) => {
      if (!current || submitted) return;
      setSelectedByPart((s) => {
        const open = current.parts.filter((p) => !resultsByPart[p.question.id]);
        const part = open.find((p) => !s[p.question.id]) ?? open[open.length - 1];
        const choice = part?.question.choices?.[n - 1];
        return part && choice ? { ...s, [part.question.id]: choice.id } : s;
      });
    },
    [current, resultsByPart, submitted],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select")) return;
      const onControl = !!target?.closest("button, a");
      if (!e.altKey && !e.metaKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        pickForFirstOpenPart(Number(e.key));
        return;
      }
      if (e.key === "Enter" && !onControl && !e.shiftKey) {
        e.preventDefault();
        if (submitted) goNext();
        else void onSubmit();
        return;
      }
      if (e.key === " " && !onControl) {
        e.preventDefault();
        if (audio.state === "playing") audio.pause();
        else if (range) void audio.playSegment(range).catch(() => undefined);
        return;
      }
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        onReplay();
        return;
      }
      if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (index < units.length - 1) setIndex((i) => i + 1);
        return;
      }
      if (e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audio, goNext, goPrev, index, onReplay, onSubmit, pickForFirstOpenPart, range, submitted, units.length]);

  if (!units.length) {
    return <div className="notice">{t("listening.empty")}</div>;
  }
  if (!current || !primary) return null;

  const typeLabel = partLabel(partType(practice.source, current.section.order), uiLang);
  const sectionUnits = units.filter((u) => u.section.id === current.section.id);
  const sectionUnitCount = flattenUnits(practice, { sectionId: current.section.id }).length;
  const sectionScore = score.sections.find((s) => s.section.id === current.section.id);
  const setContentLang = (l: SupportLang) => {
    setTranslationLang(l);
    setExplanationLang(l);
  };
  const dictationHref = `${lessonHref}/dictation?section=${encodeURIComponent(current.section.id)}&question=${encodeURIComponent(primary.id)}`;
  const nextLabel =
    nextKind === "unit"
      ? t("dictation.next")
      : nextKind === "section" && nextSection
        ? `${t("listening.nextPart")} ${sectionNo(nextSection)}`
        : t("listening.seeResult");

  return (
    <div className="dict listen">
      <div className="dict__main">
        {onlyQuestionIds && (
          <div className="notice">
            <Icon name="replay" size={18} />
            {t("listening.retryBanner")} · {units.length} {t("lresult.questionsUnit")}
            <Link to={basePath} className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
              {t("listening.retryExit")}
            </Link>
          </div>
        )}

        <div className="dict-head">
          <div className="dict-head__title">
            <span className="jp">
              {getLocalizedText(current.section.title, "ja")}
              {typeLabel ? ` · ${typeLabel}` : ""}
            </span>
            <h1>
              {t("listening.question")} {current.numberInSection} <small>/ {sectionUnitCount}</small>
            </h1>
          </div>
          <div className="dict-head__tools">
            <label className="listen-lang">
              {t("listening.contentLang")}
              <select
                className="select"
                value={translationLang}
                onChange={(e) => setContentLang(e.target.value as SupportLang)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>

        <SegmentPlayer audio={audio} range={range} onReplay={onReplay} clock="relative" />

        <section className="panel listen-q" aria-label={t("listening.question")}>
          {!submitted && resolveListeningUi(primary, current.section.id).hidePromptUntilSubmit && (
            <div className="listen-q__prompt">
              <h2>{t("listening.hiddenTitle")}</h2>
              <span>{t("listening.hiddenSub")}</span>
            </div>
          )}

          {current.parts.map((part, pi) => {
            const q = part.question;
            const { mode, hidePromptUntilSubmit } = resolveListeningUi(q, current.section.id);
            const result = resultsByPart[q.id];
            const prompt = getLocalizedText(q.prompt, "ja");
            const promptTr = q.prompt?.[translationLang];
            const showPrompt = prompt && prompt !== "—" && (submitted || !hidePromptUntilSubmit);
            const selected = selectedByPart[q.id] ?? null;
            const onSelect = (id: string) => setSelectedByPart((s) => ({ ...s, [q.id]: id }));
            const reveal = result
              ? { correctId: result.correct_choice_id, selectedId: result.selected_choice_id }
              : undefined;
            const label =
              current.parts.length > 1
                ? `${t("listening.subPart")} ${pi + 1}/${current.parts.length}`
                : t("listening.question");
            return (
              <div key={q.id} className="listen-q__part">
                {current.parts.length > 1 && <span className="eyebrow">{label}</span>}
                {showPrompt && (
                  <div className="listen-q__prompt">
                    <h2 className="jp">{prompt}</h2>
                    {submitted && promptTr && promptTr !== prompt && <span>{promptTr}</span>}
                  </div>
                )}
                {q.image?.url && (
                  <figure className="listen-figure">
                    <img
                      src={q.image.url}
                      alt={getLocalizedText(q.image.alt, uiLang) || t("listening.figureAlt")}
                    />
                  </figure>
                )}
                {mode === "image" ? (
                  <ImageChoiceGrid
                    choices={q.choices ?? []}
                    selectedId={selected}
                    onSelect={onSelect}
                    disabled={!!result}
                    reveal={reveal}
                  />
                ) : (
                  <ChoiceCards
                    choices={q.choices ?? []}
                    mode={mode}
                    selectedId={selected}
                    onSelect={onSelect}
                    reveal={result && { ...reveal!, choices: result.choices }}
                    translationLang={translationLang}
                    label={label}
                  />
                )}
                {result && <Verdict result={result} lang={translationLang} />}
              </div>
            );
          })}

          {!submitted && (
            <div className="listen-q__submit">
              <button
                type="button"
                className="btn btn--primary btn--lg"
                disabled={!allSelected || submitting}
                onClick={() => void onSubmit()}
              >
                {submitting ? "…" : t("listening.submit")}
                <kbd className="kbd">Enter</kbd>
              </button>
              <span>{t("listening.pickHint")}</span>
            </div>
          )}
        </section>

        {error && (
          <div className="notice notice--error" role="alert">
            <Icon name="alert" />
            {error}
          </div>
        )}

        {submitted && (
          <section className="panel listen-why" aria-label={t("listening.why")}>
            {current.parts.map((part) => {
              const r = resultsByPart[part.question.id]!;
              return (
                <WhyBlock
                  key={part.question.id}
                  result={r}
                  questionStartMs={part.question.audio.start_ms}
                  lang={translationLang}
                  onPlay={(from, to) => void audio.playSegment({ startMs: from, endMs: to }).catch(() => undefined)}
                />
              );
            })}
            <div className="listen-why__actions">
              <button
                type="button"
                className="btn btn--outline btn--sm"
                aria-expanded={showDialogue}
                onClick={() => setShowDialogue((v) => !v)}
              >
                <Icon name="file" size={16} />
                {showDialogue ? t("listening.hideDialogue") : t("listening.showDialogue")}
              </button>
              <Link to={dictationHref} className="btn btn--ghost btn--sm">
                <Icon name="pencil" size={16} />
                {t("listening.toDictation")}
              </Link>
            </div>
            {showDialogue && (
              <DialoguePanel
                segments={resultsByPart[primary.id]?.segments ?? primary.segments}
                speakers={practice.speakers}
                dialogue={primary.dialogue_translation}
                lang={translationLang}
              />
            )}
          </section>
        )}

        <div className="dict-foot">
          <button type="button" className="btn btn--outline" onClick={goPrev} disabled={index === 0}>
            <Icon name="chevronLeft" size={18} strokeWidth={2} />
            {t("dictation.prev")}
          </button>
          <span className="dict-foot__keys listen-keys">
            {t("dictation.shortcuts")}: <kbd className="kbd">1–4</kbd> {t("listening.kbPick")} ·{" "}
            <kbd className="kbd">Enter</kbd> {t("listening.kbSubmit")} · <kbd className="kbd">Space</kbd>{" "}
            {t("listening.kbPlay")}
          </span>
          <button type="button" className="btn btn--dark dict-foot__next" onClick={goNext}>
            {nextLabel}
            <Icon name="chevronRight" size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <aside className="dict__aside" aria-label={t("listening.score")}>
        <section className="panel lscore">
          <span className="eyebrow">{t("listening.score")}</span>
          <div className="lscore__top">
            <div
              className="score-ring score-ring--lg"
              style={{ ["--pct" as string]: pct, ["--ring-color" as string]: "var(--ok)" }}
            >
              <span>{pct}%</span>
            </div>
            <div className="lscore__nums">
              <strong>
                {score.right} / {answeredCount} {t("listening.rightOf")}
              </strong>
              <span>
                {t("listening.doneOf")} {answeredCount} / {score.total} {t("listening.ofExam")}
              </span>
            </div>
          </div>
          <ul className="lscore__parts">
            {score.sections.map((s) => {
              const type = partType(practice.source, s.section.order);
              const active = s.section.id === current.section.id;
              return (
                <li key={s.section.id}>
                  <Link
                    to={`${basePath}?section=${encodeURIComponent(s.section.id)}`}
                    className={`lscore__part${active ? " is-active" : ""}`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="lscore__row">
                      <strong className="jp">{sectionNo(s.section)}</strong>
                      <span>{type ? partLabel(type, uiLang) : getLocalizedText(s.section.title, uiLang)}</span>
                      <span className="lscore__val">
                        {s.right + s.wrong ? s.right : "—"} / {s.total}
                      </span>
                    </span>
                    <span className="split-bar" aria-hidden="true">
                      <i className="is-ok" style={{ width: `${(s.right / s.total) * 100}%` }} />
                      <i className="is-bad" style={{ width: `${(s.wrong / s.total) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="seg-legend">
            <span><i className="i-bar-ok" />{t("listening.legendRight")}</span>
            <span><i className="i-bar-bad" />{t("listening.legendWrong")}</span>
            <span><i className="i-bar-todo" />{t("listening.legendTodo")}</span>
          </div>
        </section>

        <section className="panel dict-nav">
          <div className="dict-nav__block">
            <div className="dict-nav__row">
              <span className="eyebrow">
                {t("listening.questionsIn")} {getLocalizedText(current.section.title, "ja")}
              </span>
              <span>
                {sectionScore?.right ?? 0} / {sectionScore?.total ?? 0} {t("listening.correctShort")}
              </span>
            </div>
            <div className="pill-grid">
              {sectionUnits.map((u) => {
                const i = units.indexOf(u);
                const status = unitStatus(u, answers);
                const here = i === index;
                const cls = status === "correct" ? " is-correct" : status === "incorrect" ? " is-incorrect" : "";
                const word =
                  status === "correct"
                    ? t("listening.legendRight")
                    : status === "incorrect"
                      ? t("listening.legendWrong")
                      : t("listening.legendTodo");
                return (
                  <button
                    key={u.unitId}
                    type="button"
                    className={`seg-pill${cls}${here ? " is-here" : ""}`}
                    aria-current={here ? "step" : undefined}
                    aria-label={`${t("listening.question")} ${u.numberInSection}, ${word}`}
                    onClick={() => setIndex(i)}
                  >
                    {u.numberInSection}
                  </button>
                );
              })}
            </div>
          </div>
          <hr />
          <Link to={resultHref} className="btn btn--outline btn--block">
            {t("listening.finish")}
          </Link>
          <p className="lscore__note">{t("listening.firstTry")}</p>
        </section>
      </aside>
    </div>
  );
}

function Verdict({ result, lang }: { result: ListeningEvalResult; lang: SupportLang }) {
  const { t } = useUiLanguage();
  const picked = result.choices.find((c) => c.id === result.selected_choice_id);
  const pickedText = picked ? getLocalizedText(picked.text, lang) : "";
  return (
    <div className={`verdict ${result.correct ? "verdict--ok" : "verdict--bad"}`} role="status">
      <span className="verdict__icon">
        <Icon name={result.correct ? "check" : "close"} size={20} strokeWidth={2.6} />
      </span>
      <div className="verdict__text">
        <strong>
          {result.correct ? t("listening.rightTitle") : `${t("listening.wrongTitle")} ${result.correct_choice_id ?? ""}`}
        </strong>
        <span>
          {result.correct
            ? t("listening.rightSub")
            : `${t("listening.wrongSub")} ${result.selected_choice_id}${
                pickedText && !/^\s*\d+\s*$/.test(pickedText) && !pickedText.startsWith("（") ? ` · ${pickedText}` : ""
              }. ${t("listening.wrongHint")}`}
        </span>
      </div>
      <span className="verdict__points">{result.correct ? t("listening.pointPlus") : t("listening.pointZero")}</span>
    </div>
  );
}

function WhyBlock({
  result,
  questionStartMs,
  lang,
  onPlay,
}: {
  result: ListeningEvalResult;
  questionStartMs: number;
  lang: SupportLang;
  onPlay: (fromMs: number, toMs: number) => void;
}) {
  const { t } = useUiLanguage();
  const timed = result.evidence_segments.filter((s) => s.start_ms != null && s.end_ms != null);
  const from = timed.length ? Math.min(...timed.map((s) => s.start_ms!)) : null;
  const to = timed.length ? Math.max(...timed.map((s) => s.end_ms!)) : null;
  const ja = result.evidence_segments.map((s) => getLocalizedText(s.text, "ja")).join("");
  const tr = result.evidence_segments
    .map((s) => s.text[lang] ?? "")
    .filter(Boolean)
    .join(" ");

  const correct = result.choices.find((c) => c.id === result.correct_choice_id);
  const picked = result.correct ? undefined : result.choices.find((c) => c.id === result.selected_choice_id);
  const whyRight = getLocalizedText(correct?.explanation, lang);
  const whyWrong = getLocalizedText(picked?.explanation, lang);

  if (!ja && !isUsefulExplanation(whyRight) && !isUsefulExplanation(whyWrong)) return null;

  return (
    <div className="listen-why__block">
      {ja && (
        <>
          <div className="listen-why__head">
            <h3>{t("listening.why")}</h3>
            {from != null && to != null && (
              <button type="button" className="btn btn--soft btn--sm" onClick={() => onPlay(from, to)}>
                <Icon name="play" size={16} />
                {t("listening.playPart")}
                <span className="tabular listen-why__time">
                  {clock(from - questionStartMs)}–{clock(to - questionStartMs)}
                </span>
              </button>
            )}
          </div>
          <blockquote className="listen-why__quote">
            <span className="jp">「{ja}」</span>
            {tr && <span>{tr}</span>}
          </blockquote>
        </>
      )}
      {isUsefulExplanation(whyRight) && (
        <div className="listen-why__note">
          <span className="eyebrow">{t("listening.whyCorrect")}</span>
          <p>{whyRight}</p>
        </div>
      )}
      {isUsefulExplanation(whyWrong) && (
        <div className="listen-why__note">
          <span className="eyebrow">{t("listening.whyWrong")}</span>
          <p>{whyWrong}</p>
        </div>
      )}
    </div>
  );
}
