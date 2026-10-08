import type { PracticePackage } from "../../shared/api/content";
import type { ListeningAnswer } from "../../shared/storage/listeningScoreStore";
import type { ListeningAttempt } from "../../shared/storage/listeningAttemptStore";
import { flattenUnits } from "./listeningUnits";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Snapshot of the answers as they stand, scored per part. `onlyQuestionIds` limits it to a
 * retry of chosen questions; otherwise it covers the whole test, unanswered questions included.
 */
export function buildAttempt(
  lessonId: string,
  practice: PracticePackage,
  answers: Record<string, ListeningAnswer>,
  opts: { onlyQuestionIds?: string[]; now?: number } = {},
): ListeningAttempt {
  const units = flattenUnits(practice, { onlyQuestionIds: opts.onlyQuestionIds });
  const bySection = new Map<string, { sectionId: string; total: number; right: number; wrong: number }>();
  const kept: Record<string, ListeningAnswer> = {};
  for (const unit of units) {
    for (const part of unit.parts) {
      const id = part.question.id;
      const s = bySection.get(part.section.id) ?? { sectionId: part.section.id, total: 0, right: 0, wrong: 0 };
      s.total += 1;
      const a = answers[id];
      if (a) {
        kept[id] = a;
        if (a.correct) s.right += 1;
        else s.wrong += 1;
      }
      bySection.set(part.section.id, s);
    }
  }
  const sections = [...bySection.values()];
  const times = Object.values(kept).map((a) => a.answeredAt).filter((t) => t > 0);
  return {
    id: newId(),
    lessonId,
    mode: opts.onlyQuestionIds?.length ? "retry" : "full",
    startedAt: times.length ? Math.min(...times) : null,
    submittedAt: opts.now ?? Date.now(),
    total: sections.reduce((n, s) => n + s.total, 0),
    right: sections.reduce((n, s) => n + s.right, 0),
    wrong: sections.reduce((n, s) => n + s.wrong, 0),
    sections,
    answers: kept,
  };
}

/** Correct share of the answered questions, 0–100. */
export function attemptPct(a: Pick<ListeningAttempt, "right" | "wrong">): number {
  const answered = a.right + a.wrong;
  return answered ? Math.round((a.right / answered) * 100) : 0;
}
