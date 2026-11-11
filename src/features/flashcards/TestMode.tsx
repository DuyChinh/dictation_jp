import { useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { useFt, type Ft } from "./flashText";
import { useBackTo } from "./StudyContext";
import {
  QUESTION_KINDS,
  buildTest,
  gradeTest,
  isAnswered,
  type Answer,
  type Question,
  type QuestionKind,
  type QuestionResult,
} from "./quiz";
import { recordAnswers } from "./store";
import { useShowHiragana } from "./prefs";
import { SideView } from "./SideView";
import type { Card, Direction, Side } from "./types";

type Props = { deckId: string; cards: Card[]; direction: Direction };

const DEFAULT_KINDS: Record<QuestionKind, boolean> = { mc: true, tf: true, write: true, match: true };

/** A Quizlet-style test: pick the question types and length, answer everything on one page, then submit for a score. */
export function TestMode({ deckId, cards, direction }: Props) {
  const ft = useFt();
  const backTo = useBackTo(deckId);
  const [count, setCount] = useState(Math.min(20, cards.length));
  const [kinds, setKinds] = useState(DEFAULT_KINDS);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [graded, setGraded] = useState<ReturnType<typeof gradeTest> | null>(null);
  const [view, setView] = useState<"single" | "all">("single");
  const [current, setCurrent] = useState(0);

  const anyKind = QUESTION_KINDS.some((k) => kinds[k]);

  function begin(pool: Card[], n: number) {
    setQuestions(buildTest(pool, { count: n, direction, kinds }));
    setAnswers({});
    setGraded(null);
    setCurrent(0);
    window.scrollTo?.({ top: 0 });
  }

  function submit() {
    if (!questions) return;
    const g = gradeTest(questions, answers);
    setGraded(g);
    recordAnswers(g.results.flatMap((r) => r.cards.map((c) => ({ cardId: c.cardId, correct: c.correct }))));
    window.scrollTo?.({ top: 0 });
  }

  if (!questions) {
    return (
      <section className="fc-panel fc-start">
        <h2>{ft("test.title")}</h2>
        <p>{ft("test.intro")}</p>
        <label className="fc-count">
          <span>{ft("test.count")}</span>
          <input
            type="number"
            min={1}
            max={cards.length}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(cards.length, Number(e.target.value) || 1)))}
          />
          <span className="fc-note">/ {cards.length}</span>
        </label>
        <fieldset className="fc-kinds">
          <legend>{ft("test.kinds")}</legend>
          {QUESTION_KINDS.map((k) => (
            <label key={k} className="fc-check">
              <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
              {ft(`test.kind.${k}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="fc-kinds">
          <legend>{ft("test.view")}</legend>
          {(["single", "all"] as const).map((v) => (
            <label key={v} className="fc-check">
              <input type="radio" name="test-view" checked={view === v} onChange={() => setView(v)} />
              {ft(`test.view.${v}`)}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn--primary btn--lg" disabled={!anyKind} onClick={() => begin(cards, count)}>
          {ft("test.begin")}
        </button>
      </section>
    );
  }

  const answered = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  if (graded) {
    const percent = graded.total ? Math.round((graded.right / graded.total) * 100) : 0;
    const wrongIds = new Set(graded.results.flatMap((r) => r.cards.filter((c) => !c.correct).map((c) => c.cardId)));
    const retry = cards.filter((c) => wrongIds.has(c.id));
    return (
      <div className="fc-test">
        <section className="fc-panel fc-result" aria-live="polite">
          <p className="eyebrow">{ft("test.result")}</p>
          <p className="fc-result__big">{percent}%</p>
          <p className="fc-result__score">{fmt(ft("test.score"), { right: graded.right, total: graded.total })}</p>
          <div className="fc-actions">
            {retry.length > 0 && (
              <button type="button" className="btn btn--primary" onClick={() => begin(retry, retry.length)}>
                {fmt(ft("test.retryWrong"), { n: retry.length })}
              </button>
            )}
            <button type="button" className="btn btn--outline" onClick={() => setQuestions(null)}>
              {ft("test.newTest")}
            </button>
            <Link className="btn btn--ghost" to={backTo}>{ft("common.backToDeck")}</Link>
          </div>
        </section>
        {questions.map((q, i) => (
          <QuestionView key={q.id} n={i + 1} q={q} answer={answers[q.id]} onChange={() => undefined} result={graded.results[i]!} ft={ft} />
        ))}
      </div>
    );
  }

  const submitBar = (
    <div className="fc-actions fc-actions--end">
      <button type="button" className="btn btn--outline" onClick={() => setQuestions(null)}>
        {ft("common.cancel")}
      </button>
      <button type="button" className="btn btn--primary btn--lg" onClick={submit}>
        {ft("test.submit")}
      </button>
    </div>
  );

  if (view === "all") {
    return (
      <div className="fc-test">
        <p className="fc-note">{fmt(ft("test.progress"), { done: answered, total: questions.length })}</p>
        {questions.map((q, i) => (
          <QuestionView
            key={q.id}
            n={i + 1}
            q={q}
            answer={answers[q.id]}
            onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
            ft={ft}
          />
        ))}
        {submitBar}
      </div>
    );
  }

  const idx = Math.min(current, questions.length - 1);
  const q = questions[idx]!;
  const last = idx === questions.length - 1;
  return (
    <div className="fc-test fc-test--single">
      <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}>
        <span style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>
      <div className="fc-test__head">
        <p className="fc-note">{fmt(ft("test.questionOf"), { n: idx + 1, total: questions.length })}</p>
        <p className="fc-note">{fmt(ft("test.progress"), { done: answered, total: questions.length })}</p>
      </div>
      <nav className="fc-dots" aria-label={ft("test.title")}>
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className={`fc-dots__item${i === idx ? " is-current" : ""}${isAnswered(x, answers[x.id]) ? " is-done" : ""}`}
            aria-current={i === idx ? "step" : undefined}
            aria-label={fmt(ft("test.goTo"), { n: i + 1 })}
            onClick={() => setCurrent(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <div
        key={q.id}
        className="fc-test__stage"
        onKeyDown={(e) => {
          // Enter in a text box moves on, as it would on a form
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            if (!last) setCurrent(idx + 1);
          }
        }}
      >
        <QuestionView n={idx + 1} q={q} answer={answers[q.id]} onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))} ft={ft} />
      </div>
      <div className="fc-test__nav">
        <button type="button" className="btn btn--outline" onClick={() => setCurrent(idx - 1)} disabled={idx === 0}>
          {ft("test.prev")}
        </button>
        {last ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={submit}>
            {ft("test.submit")}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setCurrent(idx + 1)}>
            {ft("test.next")}
          </button>
        )}
      </div>
      <div className="fc-actions fc-actions--end">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuestions(null)}>
          {ft("common.cancel")}
        </button>
      </div>
    </div>
  );
}

type QProps = {
  n: number;
  q: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  /** Present once the test is graded. */
  result?: QuestionResult;
  ft: Ft;
};

function QuestionView({ n, q, answer, onChange, result, ft }: QProps) {
  const locked = !!result;
  const state = result ? (result.right === result.total ? "ok" : result.right === 0 ? "bad" : "part") : "open";
  const close = result?.cards.some((c) => c.close);
  return (
    <section className={`fc-q fc-q--${state}`} aria-label={fmt(ft("test.question"), { n })}>
      <header className="fc-q__head">
        <span className="fc-q__n">{n}</span>
        <span className="fc-q__kind">{ft(`test.kind.${q.kind}`)}</span>
        {result && (
          <span className="fc-q__verdict">
            {state === "ok" ? ft("test.correct") : state === "bad" ? ft("test.wrong") : `${result.right}/${result.total}`}
          </span>
        )}
      </header>

      {q.kind === "mc" && (
        <>
          <div className="fc-q__prompt"><SideView side={q.prompt} big /></div>
          <div className="fc-q__options" role="radiogroup" aria-label={ft("test.chooseAnswer")}>
            {q.options.map((o) => {
              const chosen = answer === o.cardId;
              const mark = locked ? (o.cardId === q.cardId ? " is-right" : chosen ? " is-wrong" : "") : "";
              return (
                <button
                  key={o.cardId}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={locked}
                  className={`fc-q__option${chosen ? " is-on" : ""}${mark}`}
                  onClick={() => onChange(o.cardId)}
                >
                  <SideView side={o.side} speak={false} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {q.kind === "tf" && (
        <>
          <div className="fc-q__tf">
            <div className="fc-q__prompt"><SideView side={q.prompt} big /></div>
            <span className="fc-q__equals" aria-hidden="true">=</span>
            <div className="fc-q__prompt"><SideView side={q.shown} big speak={false} /></div>
          </div>
          <div className="fc-q__options fc-q__options--row" role="radiogroup" aria-label={ft("test.tfAsk")}>
            {(["true", "false"] as const).map((v) => {
              const chosen = answer === v;
              const right = (q.isTrue ? "true" : "false") === v;
              const mark = locked ? (right ? " is-right" : chosen ? " is-wrong" : "") : "";
              return (
                <button key={v} type="button" role="radio" aria-checked={chosen} disabled={locked} className={`fc-q__option${chosen ? " is-on" : ""}${mark}`} onClick={() => onChange(v)}>
                  {ft(v === "true" ? "test.true" : "test.false")}
                </button>
              );
            })}
          </div>
          {locked && !q.isTrue && <CorrectLine label={ft("test.rightAnswer")} side={q.answer} />}
        </>
      )}

      {q.kind === "write" && (
        <>
          <div className="fc-q__prompt"><SideView side={q.prompt} big /></div>
          <input
            className={`fc-input${q.answer.lang === "ja" ? " jp" : ""}`}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={locked}
            placeholder={ft("test.typeAnswer")}
            aria-label={ft("test.typeAnswer")}
            lang={q.answer.lang}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {locked && result!.right === 0 && <CorrectLine label={ft("test.rightAnswer")} side={q.answer} />}
          {locked && close && <p className="fc-note">{ft("test.accentNote")}</p>}
        </>
      )}

      {q.kind === "match" && (
        <MatchBlock q={q} answer={typeof answer === "object" ? answer : undefined} onChange={onChange} result={result} ft={ft} />
      )}
    </section>
  );
}

function CorrectLine({ label, side }: { label: string; side: Side }) {
  return (
    <p className="fc-q__correct">
      <span>{label}:</span> <SideView side={side} />
    </p>
  );
}

function MatchBlock({
  q,
  answer,
  onChange,
  result,
  ft,
}: {
  q: Extract<Question, { kind: "match" }>;
  answer: Record<string, string> | undefined;
  onChange: (a: Answer) => void;
  result?: QuestionResult;
  ft: Ft;
}) {
  const [hiragana] = useShowHiragana();
  const given = answer ?? {};
  const choiceText = (side: Side) => side.lead && hiragana ? `${side.lead}: ${side.text}` : side.text;
  return (
    <>
      <p className="fc-note">{ft("test.matchHint")}</p>
      <ul className="fc-q__match">
        {q.pairs.map((p, i) => {
          const r = result?.cards[i];
          const picked = q.choices.find((c) => c.cardId === given[p.cardId]);
          return (
            <li key={p.cardId} className={r ? (r.correct ? "is-right" : "is-wrong") : ""}>
              <span className="fc-q__match-term"><SideView side={p.prompt} /></span>
              <select
                value={given[p.cardId] ?? ""}
                disabled={!!result}
                onChange={(e) => onChange({ ...given, [p.cardId]: e.target.value })}
                aria-label={p.prompt.text}
                lang={p.answer.lang}
              >
                <option value="">{ft("test.pick")}</option>
                {q.choices.map((c) => (
                  <option key={c.cardId} value={c.cardId}>{choiceText(c.side)}</option>
                ))}
              </select>
              {r && !r.correct && (
                <span className="fc-q__correct">
                  {ft("test.rightAnswer")}: <SideView side={p.answer} speak={false} />
                  {picked && <span className="fc-note"> ({ft("test.yourAnswer")}: {choiceText(picked.side)})</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
