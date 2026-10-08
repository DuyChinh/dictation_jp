import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExamEntry } from "../features/paper/ExamEntry";
import { mondaiLabel, PARTS, PART_KANJI } from "../features/paper/paperLabels";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import type { PaperItem, PaperPart } from "../shared/api/paper";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson } from "../shared/content/hooks";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { clearAnswers, getPaperProgress } from "../shared/storage/paperProgressStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

const RING_R = 62;
const RING_LEN = 2 * Math.PI * RING_R;

/** Entry to the written part: overall progress, where to continue, and one card per part. */
export function PaperOverviewPage() {
  const { lessonId = "" } = useParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, error, loading } = usePaperPractice(lessonId);
  const [progress, setProgress] = useState(() => getPaperProgress(lessonId));

  const lessonHref = `/lessons/${encodeURIComponent(lessonId)}`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;

  const stats = useMemo(() => {
    if (!paper) return null;
    const answers = progress.answers;
    const total = paper.items.length;
    const done = paper.items.filter((i) => answers[i.id]).length;
    const right = paper.items.filter((i) => answers[i.id]?.correct).length;
    const byPart = PARTS.map((part) => {
      const items = paper.items.filter((i) => i.part === part);
      const mondai = new Map<number, PaperItem[]>();
      for (const i of items) mondai.set(i.mondai, [...(mondai.get(i.mondai) ?? []), i]);
      return {
        part,
        items,
        done: items.filter((i) => answers[i.id]).length,
        chips: [...mondai.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([m, list]) => ({ m, done: list.filter((i) => answers[i.id]).length, total: list.length })),
      };
    });
    const next = paper.items.find((i) => !answers[i.id]);
    return { total, done, right, wrong: done - right, todo: total - done, byPart, next };
  }, [paper, progress]);

  function restart() {
    if (paper) setProgress(clearAnswers(lessonId, paper.items.map((i) => i.id)));
  }

  const crumbs = [
    { label: t("nav.practice"), to: "/lessons" },
    { label: lessonShortTitle(lesson?.source, fallback), to: lessonHref },
    { label: t("paper.sectionTitle") },
  ];

  if (loading) {
    return (
      <AppShell breadcrumbs={crumbs}>
        <div className="notice">{t("dictation.loading")}</div>
      </AppShell>
    );
  }
  if (error || !paper || !stats) {
    return (
      <AppShell breadcrumbs={crumbs}>
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("paper.notAvailable")}
          <Link to={lessonHref} className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }}>
            {t("paper.backToLesson")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const nextHref = stats.next
    ? `${lessonHref}/paper/${stats.next.part}?mondai=${stats.next.mondai}&q=${stats.next.no}`
    : `${lessonHref}/paper/vocab`;
  const ctaLabel = !stats.next
    ? t("paper.ov.restart")
    : stats.done === 0
      ? t("paper.start")
      : `${t("paper.continue")}: 問題${stats.next.mondai} · ${t("paper.question").toLowerCase()} ${stats.next.no}`;

  return (
    <AppShell breadcrumbs={crumbs}>
      <div className="paper-ov">
        <section className="paper-hero">
          <div className="paper-hero__copy">
            <span className="paper-eyebrow">{t("paper.ov.eyebrow")}</span>
            <h1>{t("paper.ov.title")}</h1>
            <p>{t("paper.ov.sub")}</p>
            <div className="paper-hero__cta">
              {stats.next ? (
                <Link to={nextHref} className="paper-primary paper-primary--lg">
                  {ctaLabel}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <button type="button" className="paper-primary paper-primary--lg" onClick={restart}>
                  {ctaLabel}
                </button>
              )}
              {stats.done > 0 && stats.next && (
                <button type="button" className="paper-ghost" onClick={restart}>
                  {t("paper.ov.restart")}
                </button>
              )}
            </div>
          </div>
          <div className="paper-hero__progress">
            <div className="paper-ring" role="img" aria-label={`${pct}%`}>
              <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
                <circle cx="74" cy="74" r={RING_R} className="paper-ring__track" />
                <circle
                  cx="74"
                  cy="74"
                  r={RING_R}
                  className="paper-ring__bar"
                  strokeDasharray={`${(stats.done / stats.total) * RING_LEN} ${RING_LEN}`}
                />
              </svg>
              <div className="paper-ring__label">
                <strong>{pct}%</strong>
                <span>
                  {stats.done}/{stats.total} {t("paper.questionsUnit")}
                </span>
              </div>
            </div>
            <ul className="paper-legend-list">
              <li>
                <i className="is-ok" aria-hidden="true" />
                {t("paper.ov.right")} <strong>{stats.right}</strong>
              </li>
              <li>
                <i className="is-acc" aria-hidden="true" />
                {t("paper.ov.review")} <strong>{stats.wrong}</strong>
              </li>
              <li>
                <i aria-hidden="true" />
                {t("paper.ov.todo")} <strong>{stats.todo}</strong>
              </li>
            </ul>
          </div>
        </section>

        <ExamEntry lessonId={lessonId} />

        <section className="paper-pick">
          <div className="paper-pick__head">
            <h2>{t("paper.ov.pick")}</h2>
            <span>{t("paper.ov.pickSub")}</span>
          </div>
          <div className="paper-partcards">
            {stats.byPart.map(({ part, items, done, chips }) => (
              <PartCard
                key={part}
                part={part}
                total={items.length}
                done={done}
                chips={chips}
                lessonHref={lessonHref}
                title={t(`paper.title.${part}` as const)}
                desc={t(`paper.desc.${part}` as const)}
                cta={done > 0 && done < items.length ? t("paper.continue") : done === 0 ? t("paper.start") : t("paper.redo")}
                label={(m) => mondaiLabel(m, uiLang)}
                progressLabel={t("paper.ov.progress")}
                unit={t("paper.questionsUnit")}
              />
            ))}
          </div>
        </section>

        <section className="paper-benefits">
          {(["b1", "b2", "b3"] as const).map((b, i) => (
            <div key={b} className="paper-benefit">
              <span className={`paper-benefit__icon is-${i}`}>
                <Icon name={i === 0 ? "check" : i === 1 ? "eye" : "pencil"} size={20} strokeWidth={2.2} />
              </span>
              <div>
                <strong>{t(`paper.ov.${b}.t` as const)}</strong>
                <p>{t(`paper.ov.${b}.d` as const)}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function PartCard(props: {
  part: PaperPart;
  total: number;
  done: number;
  chips: Array<{ m: number; done: number; total: number }>;
  lessonHref: string;
  title: string;
  desc: string;
  cta: string;
  label: (m: number) => string;
  progressLabel: string;
  unit: string;
}) {
  const { part, total, done, chips } = props;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const firstOpen = chips.find((c) => c.done < c.total)?.m;
  return (
    <article className="paper-partcard">
      <div className="paper-partcard__head">
        <span className="paper-kanji" aria-hidden="true">
          {PART_KANJI[part]}
        </span>
        <div>
          <h3>{props.title}</h3>
          <span>
            {total} {props.unit}
          </span>
        </div>
      </div>
      <p>{props.desc}</p>
      <ul className="paper-chips">
        {chips.map((c) => (
          <li
            key={c.m}
            className={`paper-chip${c.done === c.total ? " is-done" : c.m === firstOpen && done > 0 ? " is-current" : ""}`}
            title={props.label(c.m)}
          >
            <span className="jp">問題{c.m}</span>
            <small>
              {c.done}/{c.total}
            </small>
          </li>
        ))}
      </ul>
      <div className="paper-partcard__progress">
        <div className="paper-partcard__row">
          <span>{props.progressLabel}</span>
          <strong>
            {done}/{total}
          </strong>
        </div>
        <div className="paper-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Link to={`${props.lessonHref}/paper/${part}${firstOpen && done > 0 ? `?mondai=${firstOpen}` : ""}`} className={`paper-cta${done > 0 && done < total ? " is-primary" : ""}`}>
        {props.cta}
      </Link>
    </article>
  );
}
