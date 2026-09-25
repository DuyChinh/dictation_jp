import type { PracticePackage, PracticeQuestion } from "../../shared/api/content";
import type { LocalizedText } from "../../shared/content/getLocalizedText";
import type { ListeningAnswer } from "../../shared/storage/listeningScoreStore";

export type ListeningSection = PracticePackage["sections"][number];

export type FlatQ = {
  question: PracticeQuestion;
  section: ListeningSection;
};

/** One exam "page": single MC or multi sub-questions (問題5 Q2) sharing audio. */
export type ListeningUnit = {
  unitId: string;
  section: ListeningSection;
  /** 1-based position of this unit inside its section. */
  numberInSection: number;
  parts: FlatQ[];
};

export function unitKey(q: PracticeQuestion): string {
  return q.listening_unit_id || q.id;
}

export function isListeningQuestion(q: PracticeQuestion): boolean {
  return q.type === "listening_multiple_choice" && !!q.choices?.length;
}

/** Parse 問題 number from question/section id (e.g. jlpt-n2-2025-12-m3-q1 → 3). */
function mondaiNumberFromId(id?: string): number | null {
  if (!id) return null;
  const m = id.match(/-m(\d+)(?:-|$)/i) || id.match(/mondai[_-]?(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * N2 listening display: prefer package flags, fall back to 問題 number.
 * See docs/jlpt-n2-listening-ui-rules.md
 */
export function resolveListeningUi(
  q: PracticeQuestion,
  sectionId?: string,
): { mode: "text" | "image" | "numbers"; hidePromptUntilSubmit: boolean } {
  const mNum =
    mondaiNumberFromId(q.id) ??
    mondaiNumberFromId(q.listening_unit_id) ??
    mondaiNumberFromId(sectionId);

  let mode: "text" | "image" | "numbers" =
    q.choice_display_mode === "image" ||
    q.choice_display_mode === "numbers" ||
    q.choice_display_mode === "text"
      ? q.choice_display_mode
      : "text";

  let hidePromptUntilSubmit = q.prompt_visibility === "after_submit";

  // JLPT N2 問題1–5: always hide stem until answer submit
  if (mNum != null && mNum >= 1 && mNum <= 5) {
    hidePromptUntilSubmit = true;
    // 問題3–5: number-only chips (do not override true image mode e.g. 問題1図).
    // Exception: sub-questions whose options are printed in the booklet (問題5 last item)
    // are marked "text" by the package and keep their labels.
    const printedSubQuestion =
      q.choice_display_mode === "text" && !!q.listening_unit_id && q.listening_unit_id !== q.id;
    if (mNum >= 3 && mode !== "image" && !printedSubQuestion) {
      mode = "numbers";
    }
  }

  return { mode, hidePromptUntilSubmit };
}

/** Units in exam order, optionally limited to one section and/or a set of question ids. */
export function flattenUnits(
  practice: PracticePackage,
  opts: { sectionId?: string; onlyQuestionIds?: string[] } = {},
): ListeningUnit[] {
  const only = opts.onlyQuestionIds?.length ? new Set(opts.onlyQuestionIds) : null;
  const units: ListeningUnit[] = [];
  for (const section of practice.sections) {
    const map = new Map<string, ListeningUnit>();
    let n = 0;
    for (const q of section.questions) {
      if (!isListeningQuestion(q)) continue;
      const id = unitKey(q);
      let unit = map.get(id);
      if (!unit) {
        n += 1;
        unit = { unitId: id, section, numberInSection: n, parts: [] };
        map.set(id, unit);
      }
      unit.parts.push({ question: q, section });
    }
    if (opts.sectionId && section.id !== opts.sectionId) continue;
    for (const unit of map.values()) {
      if (only && !unit.parts.some((p) => only.has(p.question.id))) continue;
      units.push(unit);
    }
  }
  return units;
}

export type SectionScore = {
  section: ListeningSection;
  total: number;
  right: number;
  wrong: number;
};

/** Per-section and overall counts; every listening question (sub-question) is one point. */
export function scoreBySection(
  practice: PracticePackage,
  answers: Record<string, ListeningAnswer>,
): { sections: SectionScore[]; total: number; right: number; wrong: number } {
  const sections = practice.sections
    .map((section) => {
      const qs = section.questions.filter(isListeningQuestion);
      let right = 0;
      let wrong = 0;
      for (const q of qs) {
        const a = answers[q.id];
        if (!a) continue;
        if (a.correct) right += 1;
        else wrong += 1;
      }
      return { section, total: qs.length, right, wrong };
    })
    .filter((s) => s.total > 0);
  return {
    sections,
    total: sections.reduce((n, s) => n + s.total, 0),
    right: sections.reduce((n, s) => n + s.right, 0),
    wrong: sections.reduce((n, s) => n + s.wrong, 0),
  };
}

export type UnitStatus = "correct" | "incorrect" | "todo";

export function unitStatus(unit: ListeningUnit, answers: Record<string, ListeningAnswer>): UnitStatus {
  const got = unit.parts.map((p) => answers[p.question.id]);
  if (got.some((a) => a && !a.correct)) return "incorrect";
  if (got.every((a) => a?.correct)) return "correct";
  return "todo";
}

export function isBareNumber(s: string | undefined): boolean {
  return /^\s*\d+\s*$/.test(s ?? "");
}

/**
 * Some packages carry one boilerplate explanation for every choice
 * ("Sai: phương án này không phải câu trả lời…"). It says nothing, so it is hidden.
 */
const GENERIC_EXPLANATION = [
  /^Đúng: đây là phương án phù hợp trực tiếp/,
  /^Sai: phương án này không phải câu trả lời được hội thoại xác định/,
  /^Correct: this option directly matches the information/,
  /^Incorrect: this is not the answer established by the dialogue/,
];

export function isUsefulExplanation(text: string | undefined): boolean {
  const s = (text ?? "").trim();
  if (!s || s === "—") return false;
  return !GENERIC_EXPLANATION.some((re) => re.test(s));
}

export function sectionNo(section: ListeningSection): string {
  return `問${section.order}`;
}

export function textOf(t: LocalizedText | undefined, lang: "ja" | "vi" | "en"): string {
  return (t?.[lang] ?? "").trim();
}
