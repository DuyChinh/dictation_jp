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

export function mondaiLabel(mondai: number, lang: UiLang): string {
  const l = MONDAI[mondai];
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
