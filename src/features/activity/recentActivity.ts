import { getAllDictationProgress } from "../../shared/storage/dictationProgressStore";
import { getAllListeningAnswers } from "../../shared/storage/listeningScoreStore";
import { getAllPaperProgress } from "../../shared/storage/paperProgressStore";
import type { TranslationKey } from "../../shared/i18n/translations";

export type ActivityKind = "listening" | "dictation" | "vocab" | "grammar" | "reading";

/** Where a learner last worked in one part of one lesson, and the link that reopens it. */
export type Position = {
  lessonId: string;
  kind: ActivityKind;
  at: number;
  /** The question's number in the exam (paper) or within its 問題 (listening, dictation); null when not known. */
  no: number | null;
  /** 問題 number, when known. */
  mondai: number | null;
  href: string;
};

const KIND_TITLE: Record<ActivityKind, TranslationKey> = {
  listening: "lesson.listeningPart",
  dictation: "lesson.dictationTitle",
  vocab: "paper.title.vocab",
  grammar: "paper.title.grammar",
  reading: "paper.title.reading",
};

/** "Đọc hiểu · Câu 54" (or just the part name when the question is not known). */
export function positionText(p: Pick<Position, "kind" | "no">, t: (key: TranslationKey) => string): string {
  const name = t(KIND_TITLE[p.kind]);
  return p.no ? `${name} · ${t("paper.question")} ${p.no}` : name;
}

const enc = encodeURIComponent;
/** `jlpt-n2-2025-07-m1-q3…` → section `…-m1`, question number 3, 問題 1. */
const AUDIO_ID = /^(.*-m(\d+))-q(\d+)/;

function newest(into: Map<string, Position>, p: Position): void {
  const key = `${p.lessonId}|${p.kind}`;
  const cur = into.get(key);
  if (!cur || p.at > cur.at) into.set(key, p);
}

/** The latest position in every part of every lesson that has been worked on, newest first. */
export function recentPositions(): Position[] {
  const best = new Map<string, Position>();

  for (const [lessonId, progress] of Object.entries(getAllPaperProgress())) {
    for (const [itemId, a] of Object.entries(progress.answers)) {
      const no = Number(/-q(\d+)$/.exec(itemId)?.[1]) || null;
      const base = `/lessons/${enc(lessonId)}/paper/${a.part}`;
      const query = a.mondai && no ? `?mondai=${a.mondai}&q=${no}` : "";
      newest(best, { lessonId, kind: a.part, at: a.at, no, mondai: a.mondai ?? null, href: base + query });
    }
  }

  for (const [lessonId, answers] of Object.entries(getAllListeningAnswers())) {
    for (const [questionId, a] of Object.entries(answers)) {
      const m = AUDIO_ID.exec(questionId);
      const query = m ? `?section=${enc(m[1]!)}&question=${enc(questionId)}` : "";
      newest(best, {
        lessonId,
        kind: "listening",
        at: a.answeredAt,
        no: m ? Number(m[3]) : null,
        mondai: m ? Number(m[2]) : null,
        href: `/lessons/${enc(lessonId)}/listening${query}`,
      });
    }
  }

  for (const [lessonId, segments] of Object.entries(getAllDictationProgress())) {
    for (const [segmentId, s] of Object.entries(segments)) {
      if (!s.updatedAt) continue;
      const questionId = segmentId.split("__")[0] ?? "";
      const m = AUDIO_ID.exec(questionId);
      const query = m ? `?section=${enc(m[1]!)}&question=${enc(questionId)}` : "";
      newest(best, {
        lessonId,
        kind: "dictation",
        at: s.updatedAt,
        no: m ? Number(m[3]) : null,
        mondai: m ? Number(m[2]) : null,
        href: `/lessons/${enc(lessonId)}/dictation${query}`,
      });
    }
  }

  return [...best.values()].sort((a, b) => b.at - a.at);
}

/** The latest position per lesson. */
export function lastPositionByLesson(positions: Position[] = recentPositions()): Map<string, Position> {
  const out = new Map<string, Position>();
  for (const p of positions) if (!out.has(p.lessonId)) out.set(p.lessonId, p);
  return out;
}
