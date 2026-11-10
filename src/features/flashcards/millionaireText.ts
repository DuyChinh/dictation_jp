import { useCallback } from "react";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";

/** Words for the quiz show's milestone card and its sound controls; Vietnamese is the reference. */
const vi = {
  "ms.eyebrow": "Mốc an toàn",
  "ms.title": "Chúc mừng! Bạn đã vượt qua câu {n}",
  "ms.amount": "Bạn đã chắc chắn có",
  "ms.safe": "Dù trả lời sai ở các câu sau, bạn vẫn giữ được mức này.",
  "ms.next": "Mốc tiếp theo: {prize}",
  "ms.top": "Giải thưởng lớn nhất: {prize}",
  "ms.go": "Chơi tiếp",
  "ms.tag": "Câu hỏi mốc",
  "music.on": "Tắt nhạc nền",
  "music.off": "Bật nhạc nền",
  "sound.hint": "Âm thanh và nhạc nền có thể tắt bằng hai nút bên dưới.",
  "sound.effects": "Âm thanh",
  "sound.music": "Nhạc nền",
} as const;

type Key = keyof typeof vi;

const ja: Record<Key, string> = {
  "ms.eyebrow": "セーフティレベル",
  "ms.title": "おめでとう！{n}問目を突破しました",
  "ms.amount": "確定した賞金",
  "ms.safe": "このあと間違えても、この金額は守られます。",
  "ms.next": "次のレベル：{prize}",
  "ms.top": "最高賞金：{prize}",
  "ms.go": "続ける",
  "ms.tag": "セーフティ問題",
  "music.on": "BGMを切る",
  "music.off": "BGMを入れる",
  "sound.hint": "効果音とBGMは下の2つのボタンで切れます。",
  "sound.effects": "効果音",
  "sound.music": "BGM",
};

const en: Record<Key, string> = {
  "ms.eyebrow": "Safe level",
  "ms.title": "Well done! You passed question {n}",
  "ms.amount": "You are now certain of",
  "ms.safe": "Even if you answer wrongly from here, you keep this amount.",
  "ms.next": "Next safe level: {prize}",
  "ms.top": "Top prize: {prize}",
  "ms.go": "Play on",
  "ms.tag": "Milestone question",
  "music.on": "Turn the music off",
  "music.off": "Turn the music on",
  "sound.hint": "Sound effects and music can be switched off with the two buttons below.",
  "sound.effects": "Sound",
  "sound.music": "Music",
};

const tables: Record<string, Record<Key, string>> = { vi, ja, en };

export type MillText = (key: Key, vars?: Record<string, string | number>) => string;

export function useMillText(): MillText {
  const { uiLang } = useUiLanguage();
  return useCallback<MillText>(
    (key, vars) => {
      const text = (tables[uiLang] ?? vi)[key] ?? vi[key];
      return (vars ? fmt(text, vars) : text).normalize("NFC");
    },
    [uiLang],
  );
}
