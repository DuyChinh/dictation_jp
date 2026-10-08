import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PassageStage } from "../features/paper/PassageStage";
import { PaperItemCard } from "../features/paper/PaperItemCard";
import { usePaperPractice } from "../features/paper/usePaperPractice";
import type { ExamItemResult, PaperItemResult } from "../shared/api/paper";
import { getLocalizedText } from "../shared/content/getLocalizedText";
import { useLesson } from "../shared/content/hooks";
import { lessonShortTitle } from "../shared/content/lessonLabels";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../shared/i18n/translations";
import { getExam } from "../shared/storage/paperExamStore";
import { getPaperProgress, saveSentence, type SentenceStatus } from "../shared/storage/paperProgressStore";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";

type Filter = "review" | "wrong" | "blank" | "all";
const FILTERS: Array<{ id: Filter; label: TranslationKey }> = [
  { id: "review", label: "exam.filter.review" },
  { id: "wrong", label: "exam.filter.wrong" },
  { id: "blank", label: "exam.filter.blank" },
  { id: "all", label: "exam.filter.all" },
];

const stateOf = (i: ExamItemResult) => (i.selected === null ? "blank" : i.correct ? "right" : "wrong");
const matches = (f: Filter, i: ExamItemResult) =>
  f === "all" ? true : f === "review" ? stateOf(i) !== "right" : stateOf(i) === f;

/** Every question of a finished sitting with its answer and the explanation of all four choices. */
export function PaperExamReviewPage() {
  const { lessonId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, uiLang } = useUiLanguage();
  const { lesson } = useLesson(lessonId);
  const { paper, error, loading } = usePaperPractice(lessonId);
  const [evidence, setEvidence] = useState<Record<string, string[]>>({});
  const [sentences, setSentences] = useState<Record<string, SentenceStatus>>(() => getPaperProgress(lessonId).sentences);

  const session = getExam(lessonId);
  const result = session?.submittedAt ? session.result : undefined;
  const base = `/lessons/${encodeURIComponent(lessonId)}`;
  const examHref = `${base}/paper/exam`;
  const fallback = (lesson && getLocalizedText(lesson.title, uiLang)) || lessonId;

  const requestedFilter = params.get("filter") as Filter | null;
  const filter: Filter = FILTERS.some((f) => f.id === requestedFilter) ? (requestedFilter as Filter) : "review";
  const requestedNo = Number(params.get("q"));

  const counts = useMemo(() => {
    const items = result?.items ?? [];
    return Object.fromEntries(FILTERS.map((f) => [f.id, items.filter((i) => matches(f.id, i)).length])) as Record<Filter, number>;
  }, [result]);
  const list = useMemo(() => (result?.items ?? []).filter((i) => matches(filter, i)), [result, filter]);
  // A question that is not in the chosen group (e.g. opened from the result) switches to "all" so it can show.
  const current = (result?.items ?? []).find((i) => i.no === requestedNo) ?? list[0];
  const shown = current && list.includes(current) ? list : (result?.items ?? []);

  function open(no: number, f: Filter = filter) {
    const next = new URLSearchParams(params);
    next.set("q", String(no));
    next.set("filter", f);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  }

  const item = current && paper?.items.find((i) => i.id === current.item_id);
  const passage = item?.passage_id ? paper?.passages.find((p) => p.id === item.passage_id) : undefined;
  const index = current ? shown.indexOf(current) : -1;
  const nextItem = shown[index + 1];
  const crumbs = [
    { label: t("nav.practice"), to: "/lessons" },
    { label: lessonShortTitle(lesson?.source, fallback), to: base },
    { label: t("exam.review.title") },
  ];

  const card =
    item && current ? (
      <PaperItemCard
        key={item.id}
        lessonId={lessonId}
        item={item}
        review={{ selected: current.selected, correctId: current.correct_choice_id }}
        onAnswered={(it: typeof item, r: PaperItemResult) => setEvidence((prev) => ({ ...prev, [it.id]: r.evidence_sentence_ids }))}
        onRetry={() => undefined}
        onNext={nextItem ? { label: "paper.nextQuestion", run: () => open(nextItem.no, filter) } : undefined}
      />
    ) : null;

  return (
    <AppShell breadcrumbs={crumbs}>
      {loading && <div className="notice">{t("dictation.loading")}</div>}

      {!loading && (error || !paper) && (
        <div className="notice notice--error" role="alert">
          <Icon name="alert" />
          {t("paper.notAvailable")}
        </div>
      )}

      {paper && !result && (
        <div className="notice">
          <Icon name="clock" />
          {t("exam.noSession")}
          <Link to={`${examHref}/setup`} className="paper-soft" style={{ marginLeft: "auto" }}>
            {t("exam.title")}
          </Link>
        </div>
      )}

      {paper && result && (
        <div className="exam-review-page">
          <header className="exam-review-page__head">
            <Link to={examHref} className="paper-back">
              <span aria-hidden="true">‹</span>
              {t("exam.review.back")} · {result.correct}/{result.total} {t("exam.correctOf")}
            </Link>
            <div className="exam-filters" role="tablist" aria-label={t("exam.review.title")}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`exam-filter${filter === f.id ? " is-on" : ""}`}
                  onClick={() => {
                    const first = result.items.find((i) => matches(f.id, i));
                    const next = new URLSearchParams(params);
                    next.set("filter", f.id);
                    if (first) next.set("q", String(first.no));
                    setParams(next, { replace: true });
                  }}
                >
                  {t(f.label)}
                  <b>{counts[f.id]}</b>
                </button>
              ))}
            </div>
          </header>

          <div className="exam-review-page__cols">
            <aside className="exam-review-nav" aria-label={t("exam.palette")}>
              {shown.length === 0 && <p className="exam-hint">{t("exam.review.empty")}</p>}
              {shown.map((i) => (
                <button
                  key={i.item_id}
                  type="button"
                  className={`exam-review-nav__item is-${stateOf(i)}${current?.item_id === i.item_id ? " is-current" : ""}`}
                  aria-current={current?.item_id === i.item_id ? "true" : undefined}
                  onClick={() => open(i.no)}
                >
                  <strong>
                    {t("paper.question")} {i.no}
                  </strong>
                  <span>{stateOf(i) === "right" ? t("exam.right") : stateOf(i) === "wrong" ? t("exam.wrongTag") : t("exam.blank")}</span>
                </button>
              ))}
            </aside>

            <div className="exam-review-page__main">
              {passage ? (
                <PassageStage
                  key={passage.id}
                  lessonId={lessonId}
                  passage={passage}
                  evidenceIds={new Set(evidence[item!.id] ?? [])}
                  drillReady
                  statuses={sentences}
                  onSentenceStatus={(id, status) => setSentences(saveSentence(lessonId, id, status).sentences)}
                >
                  {card}
                </PassageStage>
              ) : (
                card
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
