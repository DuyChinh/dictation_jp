import type { UiLang } from "../../shared/i18n/translations";
import type { PaperPart } from "../../shared/api/paper";

type L = { ja: string; vi: string; en: string };

/** 問題 numbers of a JLPT N2 paper and what each one tests. */
export const MONDAI: Record<number, L> = {
  1: { ja: "漢字の読み", vi: "Cách đọc kanji", en: "Kanji readings" },
  2: { ja: "表記", vi: "Viết bằng kanji", en: "Writing in kanji" },
  3: { ja: "語形成", vi: "Cấu tạo từ", en: "Word formation" },
  4: { ja: "文脈規定", vi: "Từ hợp ngữ cảnh", en: "Words in context" },
  5: { ja: "言い換え類義", vi: "Từ đồng nghĩa", en: "Close in meaning" },
  6: { ja: "用法", vi: "Cách dùng từ", en: "Usage" },
  7: { ja: "文の文法", vi: "Ngữ pháp trong câu", en: "Sentence grammar" },
  8: { ja: "文の組み立て", vi: "Sắp xếp câu (★)", en: "Sentence arrangement (★)" },
  9: { ja: "文章の文法", vi: "Ngữ pháp trong đoạn", en: "Passage grammar" },
  10: { ja: "内容理解（短文）", vi: "Đoạn ngắn", en: "Short passages" },
  11: { ja: "内容理解（中文）", vi: "Đoạn vừa", en: "Medium passages" },
  12: { ja: "統合理解", vi: "Đọc so sánh A/B", en: "Comparing A and B" },
  13: { ja: "主張理解", vi: "Bài dài, ý tác giả", en: "Long passage" },
  14: { ja: "情報検索", vi: "Tìm thông tin", en: "Information retrieval" },
};

/**
 * N4 papers restart the printed 問題 numbers per booklet part, so their `mondai` ids run 1–11 in
 * paper order (vocab 1–5, grammar 6–8, reading 9–11); `no` is the number printed in the exam.
 */
const N4_MONDAI: Record<number, L & { no: number }> = {
  1: { no: 1, ja: "漢字の読み", vi: "Cách đọc kanji", en: "Kanji readings" },
  2: { no: 2, ja: "表記", vi: "Viết bằng kanji", en: "Writing in kanji" },
  3: { no: 3, ja: "文脈規定", vi: "Từ hợp ngữ cảnh", en: "Words in context" },
  4: { no: 4, ja: "言い換え類義", vi: "Từ đồng nghĩa", en: "Close in meaning" },
  5: { no: 5, ja: "用法", vi: "Cách dùng từ", en: "Usage" },
  6: { no: 1, ja: "文の文法", vi: "Ngữ pháp trong câu", en: "Sentence grammar" },
  7: { no: 2, ja: "文の組み立て", vi: "Sắp xếp câu (★)", en: "Sentence arrangement (★)" },
  8: { no: 3, ja: "文章の文法", vi: "Ngữ pháp trong đoạn", en: "Passage grammar" },
  9: { no: 4, ja: "内容理解（短文）", vi: "Đoạn ngắn", en: "Short passages" },
  10: { no: 5, ja: "内容理解（中文）", vi: "Đoạn vừa", en: "Medium passages" },
  11: { no: 6, ja: "情報検索", vi: "Tìm thông tin", en: "Information retrieval" },
};

/** N1 papers have no 語形成 group, so their 問題 numbers (printed 1–13) mean something else than N2/N3. */
const N1_MONDAI: Record<number, L> = {
  1: { ja: "漢字読み", vi: "Cách đọc kanji", en: "Kanji readings" },
  2: { ja: "文脈規定", vi: "Từ hợp ngữ cảnh", en: "Words in context" },
  3: { ja: "言い換え類義", vi: "Từ đồng nghĩa", en: "Close in meaning" },
  4: { ja: "用法", vi: "Cách dùng từ", en: "Usage" },
  5: { ja: "文法形式の判断", vi: "Chọn mẫu ngữ pháp", en: "Grammar forms" },
  6: { ja: "文の組み立て", vi: "Sắp xếp câu (★)", en: "Sentence arrangement (★)" },
  7: { ja: "文章の文法", vi: "Ngữ pháp trong đoạn", en: "Passage grammar" },
  8: { ja: "内容理解（短文）", vi: "Đoạn ngắn", en: "Short passages" },
  9: { ja: "内容理解（中文）", vi: "Đoạn vừa", en: "Medium passages" },
  10: { ja: "内容理解（長文）", vi: "Bài dài", en: "Long passage" },
  11: { ja: "統合理解", vi: "Đọc so sánh A/B", en: "Comparing A and B" },
  12: { ja: "主張理解（長文）", vi: "Bài dài, ý tác giả", en: "Author's argument" },
  13: { ja: "情報検索", vi: "Tìm thông tin", en: "Information retrieval" },
};

/** JLPT level encoded in a lesson id such as "jlpt-n4-2025-12". */
export function levelOfLesson(lessonId: string): string | undefined {
  return /^jlpt-(n[1-5])-/i.exec(lessonId)?.[1]?.toUpperCase();
}

/** The 問題 number as printed in the exam (N4 restarts it per booklet part). */
export function mondaiNo(mondai: number, lessonId?: string): number {
  return lessonId && levelOfLesson(lessonId) === "N4" ? (N4_MONDAI[mondai]?.no ?? mondai) : mondai;
}

export function mondaiLabel(mondai: number, lang: UiLang, lessonId?: string): string {
  const level = lessonId ? levelOfLesson(lessonId) : undefined;
  const table: Record<number, L> = level === "N4" ? N4_MONDAI : level === "N1" ? N1_MONDAI : MONDAI;
  const l = table[mondai];
  if (!l) return `問題${mondai}`;
  return lang === "ja" ? l.ja : lang === "en" ? l.en : l.vi;
}

export const PARTS: PaperPart[] = ["vocab", "grammar", "reading"];

/** One big kanji marks each part wherever it is listed. */
export const PART_KANJI: Record<PaperPart, string> = { vocab: "語", grammar: "文", reading: "読" };

export function isPaperPart(v: string | undefined): v is PaperPart {
  return v === "vocab" || v === "grammar" || v === "reading";
}

/** Show the underlined / asked-about word of a stem with an underline, as in the exam booklet. */
export function splitTarget(ja: string, target?: string): Array<{ text: string; mark: boolean }> {
  if (!target) return [{ text: ja, mark: false }];
  const i = ja.indexOf(target);
  if (i < 0) return [{ text: ja, mark: false }];
  return [
    { text: ja.slice(0, i), mark: false },
    { text: target, mark: true },
    { text: ja.slice(i + target.length), mark: false },
  ].filter((p) => p.text);
}

/** Cut a sentence along the chunks a translation was checked against, in order. */
export function segmentSentence<T extends { ja: string }>(
  sentence: string,
  chunks: T[],
): Array<{ text: string; chunk?: T }> {
  const out: Array<{ text: string; chunk?: T }> = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const at = sentence.indexOf(chunk.ja, cursor);
    if (at < 0) continue;
    if (at > cursor) out.push({ text: sentence.slice(cursor, at) });
    out.push({ text: chunk.ja, chunk });
    cursor = at + chunk.ja.length;
  }
  if (cursor < sentence.length) out.push({ text: sentence.slice(cursor) });
  return out;
}

import type { ExamScope } from "../../shared/api/paper";

/** Display name of the part (or the whole written part) an exam sitting covers. */
export function scopeTitle(scope: ExamScope, t: (key: never) => string): string {
  if (scope === "listening") return t("exam.scope.listening" as never);
  return scope === "all" ? t("exam.scope.all" as never) : t(`paper.title.${scope}` as never);
}
