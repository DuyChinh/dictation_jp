import { apiFetch } from "./client";

export type PaperPart = "vocab" | "grammar" | "reading";

export type PaperChoice = { id: string; text: string };

export type PaperItem = {
  id: string;
  no: number;
  part: PaperPart;
  mondai: number;
  type: "mcq" | "sort_star" | "cloze_blank";
  passage_id?: string;
  stem: { ja: string; reading?: string; target?: string };
  choices: PaperChoice[];
};

export type PaperSentence = { id: string; text: string; notes?: string };

export type PaperPassage = {
  id: string;
  mondai: number;
  kind: "prose" | "notice" | "email" | "pair" | "cloze" | "info";
  title_ja?: string;
  layout_ja?: string;
  sentences: PaperSentence[];
};

export type PaperPractice = {
  lesson_id: string;
  status: string;
  content_version: number;
  counts: Record<PaperPart, number>;
  items: PaperItem[];
  passages: PaperPassage[];
};

export type PaperItemResult = {
  correct: boolean;
  selected_choice_id: string;
  correct_choice_id: string | null;
  stem_vi: string;
  summary_vi: string;
  point_tags: string[];
  vocab: Array<{ word: string; reading?: string; meaning_vi: string; sino_vi?: string }>;
  choices: Array<{
    id: string;
    text: string;
    correct: boolean;
    explanation_vi: string;
    meaning_vi?: string;
    sino_vi?: string;
  }>;
  sort?: { slots: string[]; star_index: number };
  evidence_sentence_ids: string[];
};

export type ChunkFeedback = {
  ja: string;
  vi: string;
  note_vi?: string;
  hit: boolean;
  matched?: string;
  loose?: boolean;
};

export type TranslationAnalysis = {
  chunks: ChunkFeedback[];
  pitfalls: Array<{ matched: string; explanation_vi: string }>;
  hits: number;
  total: number;
  coverage: number;
  verdict: "good" | "partial" | "weak";
};

export type TranslationResult = {
  analysis: TranslationAnalysis;
  reference: { ja: string; vi: string; notes_vi?: string };
};

export type PassageTranslation = {
  passage_id: string;
  sentences: Array<{ id: string; ja: string; vi: string; notes_vi?: string }>;
  full_translation_vi: string;
};

const base = (lessonId: string) => `/api/content/lessons/${encodeURIComponent(lessonId)}/paper`;

export function getPaperPractice(lessonId: string) {
  return apiFetch<{ paper: PaperPractice }>(base(lessonId));
}

export function getPassageTranslation(lessonId: string, passageId: string) {
  return apiFetch<{ translation: PassageTranslation }>(
    `${base(lessonId)}/passages/${encodeURIComponent(passageId)}/translation`,
  );
}

export function evaluatePaperItem(body: { lesson_id: string; item_id: string; choice_id: string }) {
  return apiFetch<{ result: PaperItemResult }>("/api/evaluate/paper-item", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function evaluateTranslation(body: { lesson_id: string; sentence_id: string; text: string }) {
  return apiFetch<{ result: TranslationResult }>("/api/evaluate/translation", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type ExamScope = PaperPart | "all" | "listening";

export type ExamItemResult = {
  item_id: string;
  no: number;
  part: PaperPart | "listening";
  mondai: number;
  /** Listening only: the part (問題) the question belongs to, to open it in the listening practice. */
  section_id?: string;
  selected: string | null;
  correct_choice_id: string | null;
  correct: boolean;
};

export type ExamResult = {
  scope: ExamScope;
  total: number;
  answered: number;
  correct: number;
  items: ExamItemResult[];
};

export function submitPaperExam(body: {
  lesson_id: string;
  scope: ExamScope;
  answers: Array<{ item_id: string; choice_id: string }>;
}) {
  return apiFetch<{ result: ExamResult }>("/api/evaluate/paper-exam", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Grade a timed listening sitting: one pick per question id, correct answers revealed only in the result. */
export function submitListeningExam(body: {
  lesson_id: string;
  answers: Array<{ question_id: string; choice_id: string }>;
}) {
  return apiFetch<{ result: ExamResult }>("/api/evaluate/listening-exam", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
