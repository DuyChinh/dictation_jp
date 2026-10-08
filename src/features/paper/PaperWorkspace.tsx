import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { PaperItem, PaperItemResult, PaperPart, PaperPractice } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  clearAnswers,
  getPaperProgress,
  saveAnswer,
  saveSentence,
  type PaperProgress,
  type SentenceStatus,
} from "../../shared/storage/paperProgressStore";
import { PassageView } from "./PassageView";
import { PaperItemCard } from "./PaperItemCard";
import { mondaiLabel } from "./paperLabels";

type Props = { lessonId: string; paper: PaperPractice; part: PaperPart };

/** One part of the written paper: tabs per 問題, questions (with their passages) of the open tab. */
export function PaperWorkspace({ lessonId, paper, part }: Props) {
  const { t, uiLang } = useUiLanguage();
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState<PaperProgress>(() => getPaperProgress(lessonId));
  const [evidence, setEvidence] = useState<Record<string, string[]>>({});
  // Bumped to remount the cards when the part is redone.
  const [round, setRound] = useState(0);

  const items = useMemo(() => paper.items.filter((i) => i.part === part), [paper, part]);
  const groups = useMemo(() => {
    const byMondai = new Map<number, PaperItem[]>();
    for (const item of items) byMondai.set(item.mondai, [...(byMondai.get(item.mondai) ?? []), item]);
    return [...byMondai.entries()].sort((a, b) => a[0] - b[0]);
  }, [items]);

  const answered = (list: PaperItem[]) => list.filter((i) => progress.answers[i.id]).length;
  const firstOpen = groups.find(([, list]) => answered(list) < list.length)?.[0] ?? groups[0]?.[0];
  const requested = Number(params.get("mondai"));
  const active = groups.some(([m]) => m === requested) ? requested : firstOpen;
  const activeIndex = groups.findIndex(([m]) => m === active);
  const activeItems = groups[activeIndex]?.[1] ?? [];

  const total = items.length;
  const done = answered(items);
  const right = items.filter((i) => progress.answers[i.id]?.correct).length;

  function onAnswered(item: PaperItem, result: PaperItemResult) {
    setProgress(saveAnswer(lessonId, item.id, { choiceId: result.selected_choice_id, correct: result.correct, at: Date.now(), part: item.part }));
    setEvidence((prev) => ({ ...prev, [item.id]: result.evidence_sentence_ids }));
  }

  function onSentenceStatus(sentenceId: string, status: SentenceStatus) {
    setProgress(saveSentence(lessonId, sentenceId, status));
  }

  function redo() {
    setProgress(clearAnswers(lessonId, items.map((i) => i.id)));
    setEvidence({});
    setRound((r) => r + 1);
  }

  function open(mondai: number) {
    const next = new URLSearchParams(params);
    next.set("mondai", String(mondai));
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  }

  // Questions of the open tab grouped by passage (reading) or listed plainly (vocab / grammar).
  const blocks = useMemo(() => {
    const withPassage = activeItems.filter((i) => i.passage_id);
    if (withPassage.length === 0) return [{ passage: null, items: activeItems }];
    const order = paper.passages.filter((p) => p.mondai === active).map((p) => p.id);
    return order
      .map((id) => ({ passage: paper.passages.find((p) => p.id === id)!, items: activeItems.filter((i) => i.passage_id === id) }))
      .filter((b) => b.items.length > 0);
  }, [activeItems, paper.passages, active]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="paper-ws">
      <header className="paper-ws__head">
        <div>
          <h1>{t(`paper.title.${part}` as const)}</h1>
          <p>{t(`paper.desc.${part}` as const)}</p>
        </div>
        <div className="paper-ws__score">
          <strong>
            {right}/{done}
          </strong>
          <span>{t("paper.rightOfDone")}</span>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <small>
            {done}/{total} {t("paper.questionsUnit")}
          </small>
        </div>
      </header>

      <nav className="paper-tabs" aria-label={t("paper.group")}>
        {groups.map(([m, list]) => (
          <button
            key={m}
            type="button"
            className={`paper-tab${m === active ? " is-active" : ""}${answered(list) === list.length ? " is-done" : ""}`}
            aria-current={m === active ? "true" : undefined}
            onClick={() => open(m)}
          >
            <span className="paper-tab__no jp">問題{m}</span>
            <span className="paper-tab__name">{mondaiLabel(m, uiLang)}</span>
            <span className="paper-tab__count">
              {answered(list)}/{list.length}
            </span>
          </button>
        ))}
      </nav>

      {blocks.map((b, bi) => {
        const ready = b.items.every((i) => progress.answers[i.id]);
        const evidenceIds = new Set(b.items.flatMap((i) => evidence[i.id] ?? []));
        return (
          <div key={`${round}-${b.passage?.id ?? bi}`} className="paper-block">
            {b.passage && (
              <PassageView
                lessonId={lessonId}
                passage={b.passage}
                evidenceIds={evidenceIds}
                drillReady={b.passage.kind !== "cloze" || ready}
                statuses={progress.sentences}
                onSentenceStatus={onSentenceStatus}
              />
            )}
            <div className="paper-items">
              {b.items.map((item) => (
                <PaperItemCard
                  key={`${round}-${item.id}`}
                  lessonId={lessonId}
                  item={item}
                  saved={progress.answers[item.id]}
                  onAnswered={onAnswered}
                />
              ))}
            </div>
          </div>
        );
      })}

      <footer className="paper-ws__foot">
        <button type="button" className="btn btn--ghost btn--sm" onClick={redo} disabled={done === 0}>
          {t("paper.redo")}
        </button>
        {activeIndex < groups.length - 1 && (
          <button type="button" className="btn btn--primary" onClick={() => open(groups[activeIndex + 1]![0])}>
            {t("paper.nextGroup")}
          </button>
        )}
      </footer>
    </div>
  );
}
