import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { PassageStage } from "./PassageStage";
import { PaperItemCard } from "./PaperItemCard";
import { mondaiLabel } from "./paperLabels";

type Props = { lessonId: string; paper: PaperPractice; part: PaperPart };

/** One part of the written paper: steps per 問題, a dot per question, and one question at a time. */
export function PaperWorkspace({ lessonId, paper, part }: Props) {
  const { t, uiLang } = useUiLanguage();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState<PaperProgress>(() => getPaperProgress(lessonId));
  const [evidence, setEvidence] = useState<Record<string, string[]>>({});
  // Bumped to remount the cards when the whole part is redone.
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
  const groupItems = groups[activeIndex]?.[1] ?? [];
  const requestedNo = Number(params.get("q"));
  const item =
    groupItems.find((i) => i.no === requestedNo) ??
    groupItems.find((i) => !progress.answers[i.id]) ??
    groupItems[0];
  const itemIndex = item ? groupItems.indexOf(item) : -1;

  const total = items.length;
  const done = answered(items);
  const right = items.filter((i) => progress.answers[i.id]?.correct).length;

  function go(mondai: number, no?: number) {
    const next = new URLSearchParams(params);
    next.set("mondai", String(mondai));
    if (no) next.set("q", String(no));
    else next.delete("q");
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  }

  function onAnswered(it: PaperItem, result: PaperItemResult) {
    setProgress(saveAnswer(lessonId, it.id, { choiceId: result.selected_choice_id, correct: result.correct, at: Date.now(), part: it.part }));
    setEvidence((prev) => ({ ...prev, [it.id]: result.evidence_sentence_ids }));
  }

  function onRetry(it: PaperItem) {
    setProgress(clearAnswers(lessonId, [it.id]));
    setEvidence((prev) => {
      const { [it.id]: _gone, ...rest } = prev;
      return rest;
    });
  }

  function onSentenceStatus(sentenceId: string, status: SentenceStatus) {
    setProgress(saveSentence(lessonId, sentenceId, status));
  }

  function redoPart() {
    setProgress(clearAnswers(lessonId, items.map((i) => i.id)));
    setEvidence({});
    setRound((r) => r + 1);
    if (groups[0]) go(groups[0][0]);
  }

  // Pin the question we are on in the URL. Without this, "the first unanswered question" is a moving
  // target: answering the current one would make the page jump to the next one before it can be read.
  const itemNo = item?.no;
  useEffect(() => {
    if (itemNo === undefined || active === undefined) return;
    if (Number(params.get("mondai")) === active && Number(params.get("q")) === itemNo) return;
    const next = new URLSearchParams(params);
    next.set("mondai", String(active));
    next.set("q", String(itemNo));
    setParams(next, { replace: true });
  }, [active, itemNo, params, setParams]);

  if (!item || active === undefined) return null;

  const nextInGroup = groupItems[itemIndex + 1];
  const nextGroup = groups[activeIndex + 1];
  const onNext = nextInGroup
    ? { label: "paper.nextQuestion" as const, run: () => go(active, nextInGroup.no) }
    : nextGroup
      ? { label: "paper.nextType" as const, run: () => go(nextGroup[0]) }
      : { label: "paper.finishPart" as const, run: () => navigate(`/lessons/${encodeURIComponent(lessonId)}/paper`) };

  const passage = item.passage_id ? paper.passages.find((p) => p.id === item.passage_id) : undefined;
  const passageItems = passage ? items.filter((i) => i.passage_id === passage.id) : [];
  const evidenceIds = new Set(passageItems.flatMap((i) => evidence[i.id] ?? []));

  const card = (
    <PaperItemCard
      key={`${round}-${item.id}`}
      lessonId={lessonId}
      item={item}
      saved={progress.answers[item.id]}
      onAnswered={onAnswered}
      onRetry={onRetry}
      onNext={onNext}
    />
  );

  return (
    <div className="paper-ws">
      <div className="paper-score" aria-live="polite">
        <span>
          <strong>
            {right}/{done}
          </strong>{" "}
          {t("paper.rightLabel")}
        </span>
        <i aria-hidden="true" />
        <span>
          <strong>
            {done}/{total}
          </strong>{" "}
          {t("paper.doneLabel")}
        </span>
      </div>

      <nav className="paper-steps" aria-label={t("paper.group")}>
        {groups.map(([m, list]) => (
          <button
            key={m}
            type="button"
            className={`paper-step${m === active ? " is-active" : ""}${answered(list) === list.length ? " is-done" : ""}`}
            aria-current={m === active ? "true" : undefined}
            onClick={() => go(m)}
          >
            <span className="paper-step__top">
              <strong className="jp">問題{m}</strong>
              <span>
                {answered(list)}/{list.length}
              </span>
            </span>
            <span className="paper-step__name">{mondaiLabel(m, uiLang)}</span>
          </button>
        ))}
      </nav>

      <div className="paper-dotsbar">
        <span className="paper-dotsbar__label">
          <strong className="jp">問題{active}</strong>
          <span>· {mondaiLabel(active, uiLang)}</span>
        </span>
        <div className="paper-dots" role="group" aria-label={`問題${active}`}>
          {groupItems.map((i) => {
            const a = progress.answers[i.id];
            const state = a ? (a.correct ? " is-right" : " is-wrong") : "";
            return (
              <button
                key={i.id}
                type="button"
                className={`paper-dot${state}${i.id === item.id ? " is-current" : ""}`}
                aria-label={`${t("paper.question")} ${i.no}`}
                aria-current={i.id === item.id ? "true" : undefined}
                onClick={() => go(active, i.no)}
              >
                {i.no}
              </button>
            );
          })}
        </div>
      </div>

      {passage ? (
        <PassageStage
          key={`${round}-${passage.id}`}
          lessonId={lessonId}
          passage={passage}
          evidenceIds={evidenceIds}
          drillReady={passage.kind !== "cloze" || passageItems.every((i) => progress.answers[i.id])}
          statuses={progress.sentences}
          onSentenceStatus={onSentenceStatus}
        >
          {card}
        </PassageStage>
      ) : (
        <div className="paper-solo">{card}</div>
      )}

      <footer className="paper-ws__foot">
        <button type="button" className="paper-ghost" onClick={redoPart} disabled={done === 0}>
          {t("paper.redo")}
        </button>
      </footer>
    </div>
  );
}
