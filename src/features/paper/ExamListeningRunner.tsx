import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticePackage } from "../../shared/api/content";
import { submitListeningExam } from "../../shared/api/paper";
import { useAudioEngine } from "../../shared/audio/useAudioEngine";
import { getLocalizedText } from "../../shared/content/getLocalizedText";
import { partLabel, partType } from "../../shared/content/lessonLabels";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { recordListeningAnswer } from "../../shared/storage/listeningScoreStore";
import {
  clearExamAnswer,
  finishExam,
  formatClock,
  markExamPlayed,
  setExamAnswer,
  toggleExamFlag,
  type ExamSession,
} from "../../shared/storage/paperExamStore";
import { Icon } from "../../shared/ui/Icon";
import { ChoiceCards } from "../listening/ChoiceCards";
import { ImageChoiceGrid } from "../listening/ImageChoiceGrid";
import { flattenUnits, resolveListeningUi, sectionNo, type ListeningUnit } from "../listening/listeningUnits";

type Props = {
  lessonId: string;
  practice: PracticePackage;
  session: ExamSession;
  onChange: (session: ExamSession) => void;
};

const WARN_MS = 5 * 60_000;
const DANGER_MS = 60_000;

const unitAnswered = (u: ListeningUnit, answers: Record<string, string>) => u.parts.every((p) => answers[p.question.id]);

/**
 * The listening exam room: a clock, the palette of questions, one question at a time with its audio
 * playing by itself (once, unless replays were allowed), and no feedback until the test is handed in.
 */
export function ExamListeningRunner({ lessonId, practice, session, onChange }: Props) {
  const { t, uiLang } = useUiLanguage();
  const units = useMemo(() => flattenUnits(practice), [practice]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [clockMs, setClockMs] = useState(0);
  const submittedOnce = useRef(false);
  /** The unit whose audio was just asked to play: it counts as heard once the engine reports "playing". */
  const armed = useRef<string | null>(null);
  const audio = useAudioEngine();

  const current = units[index];
  const primary = current?.parts[0]?.question;
  const range = primary ? { startMs: primary.audio.start_ms, endMs: primary.audio.end_ms } : null;
  const played = !!current && !!session.played?.[current.unitId];
  const playing = audio.state === "playing";
  const remaining = session.endsAt - now;
  const answeredUnits = units.filter((u) => unitAnswered(u, session.answers)).length;
  const flaggedUnits = units.filter((u) => session.flagged[u.unitId]).length;

  useEffect(() => {
    void audio.load(practice.audio_url).catch(() => setAudioError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.audio_url]);

  const start = useCallback(
    (unit: ListeningUnit) => {
      const q = unit.parts[0]?.question;
      if (!q) return;
      armed.current = unit.unitId;
      setAudioError(false);
      void audio.playSegment({ startMs: q.audio.start_ms, endMs: q.audio.end_ms }).catch(() => {
        armed.current = null;
        setAudioError(true);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audio.playSegment],
  );

  // Opening a question plays its audio the first time; later visits stay silent.
  useEffect(() => {
    if (!current) return;
    if (session.played?.[current.unitId]) {
      armed.current = null;
      audio.pause();
      return;
    }
    start(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.unitId]);

  // A unit counts as heard once its audio really started, so a blocked autoplay can be started by hand.
  useEffect(() => {
    if (playing && current && armed.current === current.unitId && !session.played?.[current.unitId]) {
      const next = markExamPlayed(lessonId, current.unitId);
      if (next) onChange(next);
    }
  }, [playing, current, lessonId, onChange, session.played]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      const eng = audio.engine;
      if (eng) setClockMs(eng.getCurrentTimeMs());
    }, 250);
    return () => window.clearInterval(id);
  }, [audio.engine]);

  const submit = useCallback(async () => {
    if (submittedOnce.current) return;
    submittedOnce.current = true;
    setSubmitting(true);
    setConfirming(false);
    setError(null);
    try {
      const { result } = await submitListeningExam({
        lesson_id: lessonId,
        answers: Object.entries(session.answers).map(([question_id, choice_id]) => ({ question_id, choice_id })),
      });
      // What was answered counts as progress in the listening practice too.
      for (const r of result.items) {
        if (r.selected) {
          recordListeningAnswer(lessonId, r.item_id, {
            choiceId: r.selected,
            correct: r.correct,
            correctChoiceId: r.correct_choice_id,
          });
        }
      }
      audio.pause();
      const done = finishExam(lessonId, result);
      if (done) onChange(done);
    } catch (e) {
      submittedOnce.current = false;
      setError(e instanceof Error ? e.message : t("exam.submitFailed"));
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, onChange, session.answers, t]);

  useEffect(() => {
    if (remaining <= 0 && !submittedOnce.current && !submitting && !error) {
      setTimeUp(true);
      void submit();
    }
  }, [remaining, submit, submitting, error]);

  const pick = useCallback(
    (questionId: string, choiceId: string) => {
      const next = setExamAnswer(lessonId, questionId, choiceId);
      if (next) onChange(next);
    },
    [lessonId, onChange],
  );

  // 1–4 answers the first open part of the question on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.altKey || e.metaKey || e.ctrlKey || !current) return;
      if (!/^[1-4]$/.test(e.key) || confirming) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select")) return;
      const part = current.parts.find((p) => !session.answers[p.question.id]) ?? current.parts[current.parts.length - 1];
      const choice = part?.question.choices?.[Number(e.key) - 1];
      if (part && choice) pick(part.question.id, choice.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, current, pick, session.answers]);

  function go(i: number) {
    if (i >= 0 && i < units.length) {
      setIndex(i);
      window.scrollTo({ top: 0 });
    }
  }
  function flag(u: ListeningUnit) {
    const next = toggleExamFlag(lessonId, u.unitId);
    if (next) onChange(next);
  }
  function clearUnit(u: ListeningUnit) {
    let next: ExamSession | null = null;
    for (const p of u.parts) next = clearExamAnswer(lessonId, p.question.id) ?? next;
    if (next) onChange(next);
  }

  if (!current || !primary) return <div className="notice">{t("exam.listen.noQuestions")}</div>;

  const tone = remaining <= DANGER_MS ? " is-danger" : remaining <= WARN_MS ? " is-warn" : "";
  const announce = remaining <= DANGER_MS ? t("exam.warn1") : remaining <= WARN_MS ? t("exam.warn5") : "";
  const sections = [...new Set(units.map((u) => u.section.id))].map((id) => units.find((u) => u.section.id === id)!.section);
  const span = range ? Math.max(1, range.endMs - range.startMs) : 1;
  const pct = range ? Math.round((Math.min(Math.max(clockMs - range.startMs, 0), span) / span) * 100) : 0;
  const canReplay = !!session.allowReplay && !playing;
  const canStartByHand = !played || audioError;

  const card = (
    <article className="paper-card exam-card exam-listen" id={`q-${current.unitId}`}>
      <header className="paper-qhead">
        <span className="paper-qno">{current.numberInSection}</span>
        <span className="exam-listen__where jp">
          {getLocalizedText(current.section.title, "ja")}
          <small>
            {" · "}
            {partLabel(partType(practice.source, current.section.order), uiLang)}
          </small>
        </span>
        <button
          type="button"
          className={`exam-flag${session.flagged[current.unitId] ? " is-on" : ""}`}
          aria-pressed={!!session.flagged[current.unitId]}
          onClick={() => flag(current)}
        >
          <Icon name="pin" size={16} />
          {session.flagged[current.unitId] ? t("exam.flagged") : t("exam.flag")}
        </button>
      </header>

      <div className={`exam-audio${playing ? " is-playing" : ""}`} role="status" aria-live="polite">
        <span className="exam-audio__icon" aria-hidden="true">
          <Icon name="headphones" size={22} />
        </span>
        <div className="exam-audio__body">
          <strong>
            {playing ? t("exam.listen.playing") : audioError ? t("exam.listen.audioError") : played ? t("exam.listen.played") : t("exam.listen.start")}
          </strong>
          <div className="exam-audio__bar" role="presentation">
            <span style={{ width: `${playing || played ? pct : 0}%` }} />
          </div>
          <small>{session.allowReplay ? "" : t("exam.listen.once")}</small>
        </div>
        {canStartByHand && !playing && (
          <button type="button" className="paper-outline" onClick={() => start(current)}>
            {t("exam.listen.start")}
          </button>
        )}
        {!canStartByHand && canReplay && (
          <button type="button" className="paper-outline" onClick={() => start(current)}>
            <Icon name="replay" size={16} />
            {t("exam.listen.replay")}
          </button>
        )}
      </div>

      {current.parts.map((part, pi) => {
        const q = part.question;
        const { mode, hidePromptUntilSubmit } = resolveListeningUi(q, current.section.id);
        const prompt = getLocalizedText(q.prompt, "ja");
        const showPrompt = prompt && prompt !== "—" && !hidePromptUntilSubmit;
        const selected = session.answers[q.id] ?? null;
        const label =
          current.parts.length > 1
            ? `${t("exam.listen.sub")} ${pi + 1}/${current.parts.length}`
            : `${t("exam.listen.question")} ${current.numberInSection}`;
        return (
          <div key={q.id} className="listen-q__part">
            {current.parts.length > 1 && <span className="eyebrow">{label}</span>}
            {showPrompt && (
              <div className="listen-q__prompt">
                <h2 className="jp">{prompt}</h2>
              </div>
            )}
            {q.image?.url && (
              <figure className="listen-figure">
                <img src={q.image.url} alt={getLocalizedText(q.image.alt, uiLang) || ""} />
              </figure>
            )}
            {mode === "image" ? (
              <ImageChoiceGrid choices={q.choices ?? []} selectedId={selected} onSelect={(id) => pick(q.id, id)} />
            ) : (
              <ChoiceCards
                choices={q.choices ?? []}
                mode={mode}
                selectedId={selected}
                onSelect={(id) => pick(q.id, id)}
                translationLang="vi"
                label={label}
              />
            )}
          </div>
        );
      })}

      <footer className="paper-actions">
        <button
          type="button"
          className="paper-ghost"
          disabled={!current.parts.some((p) => session.answers[p.question.id])}
          onClick={() => clearUnit(current)}
        >
          {t("exam.clear")}
        </button>
        <div className="exam-nav">
          <button type="button" className="paper-outline" disabled={index === 0} onClick={() => go(index - 1)}>
            {t("exam.prev")}
          </button>
          <button type="button" className="paper-primary" disabled={index === units.length - 1} onClick={() => go(index + 1)}>
            {t("exam.next")}
          </button>
        </div>
      </footer>
    </article>
  );

  return (
    <div className="exam">
      <div className={`exam-bar${tone}`}>
        <div className="exam-clock" role="timer" aria-label={t("exam.timeLeft")}>
          <Icon name="clock" size={22} strokeWidth={2.2} />
          <strong>{formatClock(remaining)}</strong>
          <small>{t("exam.timeLeft").toLowerCase()}</small>
        </div>
        <span className="exam-bar__scope">{t("exam.scope.listening")}</span>
        <div className="exam-bar__count">
          <strong>
            {answeredUnits}/{units.length}
          </strong>{" "}
          {t("exam.answered")}
        </div>
        <button type="button" className="paper-primary" disabled={submitting} onClick={() => setConfirming(true)}>
          {t("exam.submit")}
        </button>
      </div>
      <div className="exam-sr" role="status" aria-live="polite">
        {announce}
      </div>

      {timeUp && (
        <div className="notice" role="status">
          <Icon name="clock" />
          {submitting ? t("exam.submitting") : t("exam.timeUp")}
        </div>
      )}

      {confirming && (
        <div
          className="exam-modal"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirming(false);
          }}
        >
          <div className="exam-confirm" role="alertdialog" aria-modal="true" aria-labelledby="exam-confirm-title">
            <div className="exam-confirm__head">
              <h3 id="exam-confirm-title">{t("exam.confirmTitle")}</h3>
              <p>{t("exam.confirmWarn")}</p>
            </div>
            <ul>
              <li>
                <span>{t("exam.confirmLeft")}</span>
                <strong>{formatClock(remaining)}</strong>
              </li>
              {units.length - answeredUnits > 0 && (
                <li className="is-warn">
                  <span>{t("exam.confirmBlankLabel")}</span>
                  <strong>
                    {units.length - answeredUnits} {t("paper.questionsUnit")}
                  </strong>
                </li>
              )}
              {flaggedUnits > 0 && (
                <li>
                  <span>{t("exam.confirmFlaggedLabel")}</span>
                  <strong>
                    {flaggedUnits} {t("paper.questionsUnit")}
                  </strong>
                </li>
              )}
            </ul>
            <div className="exam-confirm__actions">
              <button type="button" className="paper-outline" autoFocus onClick={() => setConfirming(false)}>
                {t("exam.keepGoing")}
              </button>
              <button type="button" className="paper-primary" onClick={() => void submit()}>
                {t("exam.submitNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          <span>{t("exam.submitFailed")}</span>
          <button type="button" className="paper-soft" style={{ marginLeft: "auto" }} onClick={() => void submit()}>
            {t("exam.retrySubmit")}
          </button>
        </div>
      )}

      <div className="exam-layout">
        <aside className="exam-palette" aria-label={t("exam.palette")}>
          {sections.map((section) => (
            <div key={section.id} className="exam-palette__group">
              <span className="exam-palette__label">
                <strong className="jp">{sectionNo(section)}</strong> · {partLabel(partType(practice.source, section.order), uiLang)}
              </span>
              <div className="exam-palette__dots">
                {units
                  .filter((u) => u.section.id === section.id)
                  .map((u) => (
                    <button
                      key={u.unitId}
                      type="button"
                      className={`paper-dot${unitAnswered(u, session.answers) ? " is-answered" : ""}${session.flagged[u.unitId] ? " is-flagged" : ""}${u.unitId === current.unitId ? " is-current" : ""}`}
                      aria-label={`${t("exam.listen.question")} ${u.numberInSection}`}
                      aria-current={u.unitId === current.unitId ? "true" : undefined}
                      onClick={() => go(units.indexOf(u))}
                    >
                      {u.numberInSection}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <ul className="exam-palette__legend">
            <li>
              <i className="is-answered" aria-hidden="true" />
              {t("exam.legend.answered")}
            </li>
            <li>
              <i className="is-flagged" aria-hidden="true" />
              {t("exam.legend.flagged")}
            </li>
            <li>
              <i aria-hidden="true" />
              {t("exam.legend.blank")}
            </li>
          </ul>
        </aside>
        <div className="exam-main">{card}</div>
      </div>
    </div>
  );
}
