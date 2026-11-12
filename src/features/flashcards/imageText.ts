import { useCallback } from "react";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";

/** Words for card pictures (the picker, the buttons and the display setting); Vietnamese is the reference. */
const vi = {
  "img.add": "Thêm ảnh",
  "img.change": "Đổi ảnh",
  "img.remove": "Bỏ ảnh",
  "img.entry": "Tìm ảnh cho thẻ",
  "img.entryDone": "Thẻ đã có ảnh. Bấm để đổi ảnh.",
  "img.entryAdded": "Đã thêm vào bộ “{deck}” kèm ảnh",
  "img.entryAttached": "Đã thêm ảnh vào thẻ",
  "img.title": "Chọn ảnh cho thẻ",
  "img.forWord": "Từ: {word}",
  "img.searchLabel": "Tìm ảnh (từ khóa tiếng Anh cho kết quả tốt nhất)",
  "img.suggest": "Gợi ý từ khóa",
  "img.tip": "Từ trừu tượng khó có ảnh đúng nghĩa: hãy thử tả một cảnh cụ thể, ví dụ “man nodding”, “person eating”.",
  "img.placeholder": "ví dụ: dog",
  "img.search": "Tìm ảnh",
  "img.loading": "Đang tìm ảnh… lần đầu có thể mất vài giây.",
  "img.error": "Chưa tìm được ảnh lúc này: nguồn ảnh đang chậm hoặc không phản hồi.",
  "img.retry": "Thử lại",
  "img.empty": "Không có ảnh phù hợp. Hãy thử từ khóa khác, tốt nhất bằng tiếng Anh.",
  "img.partial": "Một nguồn ảnh đang chậm nên có thể còn ít kết quả.",
  "img.results": "Ảnh gợi ý",
  "img.use": "Dùng ảnh này",
  "img.credit": "Ảnh từ Openverse và Wikimedia Commons. Quyền thuộc về tác giả; giấy phép ghi dưới từng ảnh.",
  "img.close": "Đóng",
  "img.current": "Ảnh hiện tại",
  "img.toggle": "Hình ảnh",
  "img.on": "Hiện",
  "img.off": "Ẩn",
  "img.cardPicture": "Ảnh của thẻ",
  "img.aiSuggest": "AI gợi ý",
  "img.aiDescLabel": "Mô tả ảnh bạn muốn",
  "img.aiDescPlaceholder": "Mô tả ảnh bạn muốn (tiếng Việt, Nhật hoặc Anh)…",
  "img.aiDescSubmit": "Tìm bằng mô tả",
  "img.aiLoading": "Đang tạo cụm từ gợi ý…",
  "img.aiError": "Không thể tạo gợi ý lúc này.",
  "img.aiNotPicturable": "Từ này khó minh hoạ bằng ảnh; thử các cụm gợi ý hoặc bỏ qua",
} as const;

type Key = keyof typeof vi;

const ja: Record<Key, string> = {
  "img.add": "画像を追加",
  "img.change": "画像を変更",
  "img.remove": "画像を外す",
  "img.entry": "カードの画像を探す",
  "img.entryDone": "カードに画像があります。押すと変更できます。",
  "img.entryAdded": "「{deck}」に画像付きで追加しました",
  "img.entryAttached": "カードに画像を追加しました",
  "img.title": "カードの画像を選ぶ",
  "img.forWord": "単語：{word}",
  "img.searchLabel": "画像を検索（英語のキーワードがおすすめ）",
  "img.suggest": "キーワード候補",
  "img.tip": "抽象的な言葉は合う画像が少なめです。“man nodding”、“person eating” のように具体的な場面で探してみてください。",
  "img.placeholder": "例：dog",
  "img.search": "画像を探す",
  "img.loading": "画像を探しています… 初回は数秒かかることがあります。",
  "img.error": "今は画像を取得できません。画像の提供元が遅いか、応答していません。",
  "img.retry": "もう一度",
  "img.empty": "合う画像がありません。別のキーワード（できれば英語）をお試しください。",
  "img.partial": "提供元の一つが遅いため、結果が少ないかもしれません。",
  "img.results": "候補の画像",
  "img.use": "この画像を使う",
  "img.credit": "画像は Openverse と Wikimedia Commons から。著作権は作者にあり、ライセンスは各画像に表示されます。",
  "img.close": "閉じる",
  "img.current": "今の画像",
  "img.toggle": "画像",
  "img.on": "表示",
  "img.off": "非表示",
  "img.cardPicture": "カードの画像",
  "img.aiSuggest": "AIの提案",
  "img.aiDescLabel": "欲しい画像の説明",
  "img.aiDescPlaceholder": "欲しい画像の説明（日本語、ベトナム語、英語など）…",
  "img.aiDescSubmit": "説明で探す",
  "img.aiLoading": "キーワード候補を生成中…",
  "img.aiError": "候補を生成できませんでした。",
  "img.aiNotPicturable": "この単語は画像で表すのが難しいです。候補を試すか、スキップしてください",
};

const en: Record<Key, string> = {
  "img.add": "Add a picture",
  "img.change": "Change picture",
  "img.remove": "Remove picture",
  "img.entry": "Find a picture for the card",
  "img.entryDone": "The card has a picture. Press to change it.",
  "img.entryAdded": "Added to “{deck}” with a picture",
  "img.entryAttached": "Picture added to the card",
  "img.title": "Pick a picture for the card",
  "img.forWord": "Word: {word}",
  "img.searchLabel": "Search pictures (English keywords work best)",
  "img.suggest": "Keyword ideas",
  "img.tip": "Abstract words rarely have a picture that fits: try describing a concrete scene, such as “man nodding” or “person eating”.",
  "img.placeholder": "e.g. dog",
  "img.search": "Find pictures",
  "img.loading": "Looking for pictures… the first search can take a few seconds.",
  "img.error": "Could not get pictures right now: the picture sources are slow or not answering.",
  "img.retry": "Try again",
  "img.empty": "No suitable picture. Try another keyword, preferably in English.",
  "img.partial": "One picture source is slow, so there may be fewer results.",
  "img.results": "Suggested pictures",
  "img.use": "Use this picture",
  "img.credit": "Pictures from Openverse and Wikimedia Commons. The rights belong to their authors; the licence is under each picture.",
  "img.close": "Close",
  "img.current": "Current picture",
  "img.toggle": "Pictures",
  "img.on": "Show",
  "img.off": "Hide",
  "img.cardPicture": "Card picture",
  "img.aiSuggest": "AI ideas",
  "img.aiDescLabel": "Describe the picture you want",
  "img.aiDescPlaceholder": "Describe the picture you want (any language)…",
  "img.aiDescSubmit": "Search with description",
  "img.aiLoading": "Generating search phrases…",
  "img.aiError": "Could not generate ideas right now.",
  "img.aiNotPicturable": "This word is hard to picture; try the suggested phrases or skip",
};

const tables: Record<string, Record<Key, string>> = { vi, ja, en };

export type ImgText = (key: Key, vars?: Record<string, string | number>) => string;

export function useImgText(): ImgText {
  const { uiLang } = useUiLanguage();
  return useCallback<ImgText>(
    (key, vars) => {
      const text = (tables[uiLang] ?? vi)[key] ?? vi[key];
      return (vars ? fmt(text, vars) : text).normalize("NFC");
    },
    [uiLang],
  );
}
