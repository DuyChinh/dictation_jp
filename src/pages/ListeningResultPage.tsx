import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePractice } from "../shared/content/hooks";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { lessonShortTitle, partLabel, partType } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { fmt } from "../shared/i18n/format";
import { clearListeningAnswers, getListeningAnswers } from "../shared/storage/listeningScoreStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import {
  flattenUnits,
  isBareNumber,
  scoreBySection,
  sectionNo,
} from "../features/listening/listeningUnits";

/** Parts scoring below this share of correct answers are flagged for practice. */
const WEAK_PCT = 65;

export function ListeningResultPage() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const { t, uiLang } = useUiLanguage();
  const { practice, error, loading } = usePractice(lessonId);
  const [answers] = useState(() => getListeningAnswers(lessonId));
  const [filter, setFilter] = useState<string>("all");

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const listeningHref = `${lessonHref}/listening`;
  const fallback = (practice && getLocalizedText(practice.title, uiLang)) || lessonId;
  const shortTitle = lessonShortTitle(practice?.source, fallback);

  const score = useMemo(() => (practice ? scoreBySection(practice, answers) : null), [practice, answers]);

  /** Wrong answers in exam order, with the unit number shown in the exam. */
  const wrong = useMemo(() => {
    if (!practice) return [];
    return flattenUnits(practice).flatMap((u) =>
      u.parts
        .filter((p) => answers[p.question.id] && !answers[p.question.id]!.correct)
        .map((p) => {
          const a = answers[p.question.id]!;
          const correct = p.question.choices?.find((c) => c.id === a.correctChoiceId);
          const correctJa = getLocalizedText(correct?.text, "ja");
          return {
            questionId: p.question.id,
            section: u.section,
            number: u.numberInSection,
            prompt: getLocalizedText(p.question.prompt, "ja"),
            picked: a.choiceId,
            correctId: a.correctChoiceId,
            correctText: correctJa && !isBareNumber(correctJa) ? correctJa : "",
          };
        }),
    );
  }, [answers, practice]);

  const crumbs = [
    { label: t("nav.practice"), to: "/lessons" },
    { label: shortTitle, to: lessonHref },
    { label: t("listening.title"), to: listeningHref },
    { label: t("lresult.crumb") },
  ];

  if (loading || error || !practice || !score) {
    return (
      <AppShell breadcrumbs={crumbs}>
        {loading && <div className="notice">{t("dictation.loading")}</div>}
        {error && (
          <div className="notice notice--error" role="alert">
            <Icon name="alert" />
            {error}
          </div>
        )}
      </AppShell>
    );
  }

  const answered = score.right + score.wrong;
  const blank = score.total - answered;
  const pct = answered ? Math.round((score.right / answered) * 100) : 0;
  const nameOf = (order: number, title: typeof practice.sections[number]["title"]) => {
    const type = partType(practice.source, order);
    return type ? partLabel(type, uiLang) : getLocalizedText(title, uiLang);
  };

  const rated = score.sections
    .filter((s) => s.right + s.wrong > 0)
    .map((s) => ({ ...s, pct: Math.round((s.right / (s.right + s.wrong)) * 100) }));
  const best = [...rated].sort((a, b) => b.pct - a.pct)[0];
  const weakest = [...rated].filter((s) => s.wrong > 0).sort((a, b) => a.pct - b.pct || b.wrong - a.wrong)[0];
  const summary = [
    weakest && best && best.pct >= 80 && best !== weakest
      ? fmt(t("lresult.good"), { part: nameOf(best.section.order, best.section.title) })
      : "",
    weakest
      ? fmt(t("lresult.weak"), { part: nameOf(weakest.section.order, weakest.section.title), n: weakest.wrong })
      : t("lresult.allRight"),
    blank > 0 ? fmt(t("lresult.unfinished"), { n: blank }) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const retry = (ids?: string[]) => {
    clearListeningAnswers(lessonId, ids);
    navigate(ids ? `${listeningHref}?only=${ids.map(encodeURIComponent).join(",")}` : listeningHref);
  };

  const wrongSections = score.sections.filter((s) => s.wrong > 0);
  const shown = filter === "all" ? wrong : wrong.filter((w) => w.section.id === filter);

  return (
    <AppShell breadcrumbs={crumbs}>
      <div className="page-head">
        <div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {t("listening.title")} · {shortTitle}
          </p>
          <h1>{t("lresult.title")}</h1>
        </div>
        <div className="page-head__aside">
          <Link to={lessonHref} className="btn btn--ghost">
            {t("lresult.backLesson")}
          </Link>
          {answered > 0 && (
            <button type="button" className="btn btn--outline" onClick={() => retry()}>
              <Icon name="replay" size={18} strokeWidth={1.9} />
              {t("lresult.retryAll")}
            </button>
          )}
          {wrong.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={() => retry(wrong.map((w) => w.questionId))}>
              {t("lresult.retryWrong")} ({wrong.length})
              <Icon name="chevronRight" size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {answered === 0 ? (
        <section className="panel">
          <div className="empty">
            <h3>{t("lresult.emptyTitle")}</h3>
            <p>{t("lresult.emptyBody")}</p>
            <Link to={listeningHref} className="btn btn--primary">
              {t("lresult.start")}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="panel lres-hero" aria-label={t("lresult.title")}>
            <div
              className="score-ring lres-ring"
              style={{ ["--pct" as string]: pct, ["--ring-color" as string]: "var(--ok)" }}
            >
              <span>
                {pct}%<small>{t("lresult.rate")}</small>
              </span>
            </div>
            <div className="lres-hero__text">
              <strong>
                {score.right} / {answered} {t("lresult.rightOf")}
              </strong>
              <p>{summary}</p>
              <span>{fmt(t("lresult.meta"), { done: answered, total: score.total })}</span>
            </div>
            <dl className="lres-kpis">
              <div className="is-ok">
                <dt>{t("lresult.right")}</dt>
                <dd>{score.right}</dd>
              </div>
              <div className="is-bad">
                <dt>{t("lresult.wrong")}</dt>
                <dd>{score.wrong}</dd>
              </div>
              <div>
                <dt>{t("lresult.blank")}</dt>
                <dd>{blank}</dd>
              </div>
            </dl>
          </section>

          <div className="lres-grid">
            <section className="panel lres-parts" aria-label={t("lresult.byPart")}>
              <h2>{t("lresult.byPart")}</h2>
              {score.sections.map((s) => {
                const done = s.right + s.wrong;
                const sPct = done ? Math.round((s.right / done) * 100) : 0;
                return (
                  <div key={s.section.id} className="lres-part">
                    <div className="lres-part__row">
                      <strong className="jp">{sectionNo(s.section)}</strong>
                      <span>{nameOf(s.section.order, s.section.title)}</span>
                      <span className="lres-part__score">
                        {done ? s.right : "—"} / {s.total}
                      </span>
                      <span className="lres-part__pct">{done ? `${sPct}%` : ""}</span>
                    </div>
                    <span className="split-bar" aria-hidden="true">
                      <i className="is-ok" style={{ width: `${(s.right / s.total) * 100}%` }} />
                      <i className="is-bad" style={{ width: `${(s.wrong / s.total) * 100}%` }} />
                    </span>
                    {done > 0 && sPct < WEAK_PCT && <span className="lres-part__weak">{t("lresult.needWork")}</span>}
                  </div>
                );
              })}
              <div className="seg-legend">
                <span><i className="i-bar-ok" />{t("listening.legendRight")}</span>
                <span><i className="i-bar-bad" />{t("listening.legendWrong")}</span>
                <span><i className="i-bar-todo" />{t("listening.legendTodo")}</span>
              </div>
            </section>

            <section className="panel lres-wrong" aria-label={t("lresult.wrongList")}>
              <div className="lres-wrong__head">
                <h2>
                  {t("lresult.wrongList")}{" "}
                  <small>
                    · {wrong.length} {t("lresult.questionsUnit")}
                  </small>
                </h2>
                {wrongSections.length > 1 && (
                  <div className="segmented" role="group" aria-label={t("lresult.filter")}>
                    <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                      {t("lresult.all")}
                    </button>
                    {wrongSections.map((s) => (
                      <button
                        key={s.section.id}
                        type="button"
                        aria-pressed={filter === s.section.id}
                        onClick={() => setFilter(s.section.id)}
                        className="jp"
                      >
                        {sectionNo(s.section)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {shown.length === 0 ? (
                <div className="empty">
                  <p>{t("lresult.noWrong")}</p>
                </div>
              ) : (
                <ul>
                  {shown.map((w) => (
                    <li key={w.questionId} className="lres-item">
                      <span className="lres-item__no">
                        <strong className="jp">{sectionNo(w.section)}</strong>
                        <span>
                          {t("listening.question")} {w.number}
                        </span>
                      </span>
                      <div className="lres-item__body">
                        {w.prompt && w.prompt !== "—" && <span className="lres-item__prompt jp">{w.prompt}</span>}
                        <div className="lres-item__answer">
                          <span className="lres-chip lres-chip--bad">
                            {t("lresult.picked")} {w.picked}
                          </span>
                          <span className="lres-chip lres-chip--ok">
                            {t("lresult.answer")} {w.correctId ?? "—"}
                          </span>
                          {w.correctText && <span className="lres-item__text jp">{w.correctText}</span>}
                        </div>
                      </div>
                      <Link
                        to={`${listeningHref}?section=${encodeURIComponent(w.section.id)}&question=${encodeURIComponent(w.questionId)}`}
                        className="btn btn--soft btn--sm"
                      >
                        {t("lresult.review")}
                        <Icon name="chevronRight" size={16} strokeWidth={2} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
