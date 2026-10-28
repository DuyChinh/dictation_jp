import type { UiLang } from "../../shared/i18n/translations";

type Label = { vi: string; en: string };

/** JMdict part-of-speech tags, in words a learner knows. */
const POS: Record<string, Label> = {
  n: { vi: "danh từ", en: "noun" },
  "n-adv": { vi: "danh từ làm trạng từ", en: "adverbial noun" },
  "n-t": { vi: "danh từ chỉ thời gian", en: "temporal noun" },
  "n-suf": { vi: "danh từ làm hậu tố", en: "noun suffix" },
  "n-pref": { vi: "danh từ làm tiền tố", en: "noun prefix" },
  pn: { vi: "đại từ", en: "pronoun" },
  v1: { vi: "động từ nhóm 2", en: "ichidan verb" },
  "v1-s": { vi: "động từ nhóm 2", en: "ichidan verb" },
  v5: { vi: "động từ nhóm 1", en: "godan verb" },
  vs: { vi: "danh từ + する", en: "noun + suru" },
  "vs-i": { vi: "động từ する", en: "suru verb" },
  "vs-s": { vi: "động từ する", en: "suru verb" },
  "vs-c": { vi: "động từ する", en: "suru verb" },
  vk: { vi: "động từ 来る", en: "kuru verb" },
  vt: { vi: "tha động từ", en: "transitive" },
  vi: { vi: "tự động từ", en: "intransitive" },
  vz: { vi: "động từ ずる", en: "zuru verb" },
  "adj-i": { vi: "tính từ -i", en: "i-adjective" },
  "adj-ix": { vi: "tính từ -i", en: "i-adjective" },
  "adj-na": { vi: "tính từ -na", en: "na-adjective" },
  "adj-no": { vi: "tính từ の", en: "no-adjective" },
  "adj-pn": { vi: "liên thể từ", en: "prenominal adjective" },
  "adj-t": { vi: "tính từ taru", en: "taru-adjective" },
  "adj-f": { vi: "từ bổ nghĩa danh từ", en: "noun-modifying word" },
  adv: { vi: "phó từ", en: "adverb" },
  "adv-to": { vi: "phó từ (と)", en: "adverb taking と" },
  prt: { vi: "trợ từ", en: "particle" },
  conj: { vi: "liên từ", en: "conjunction" },
  int: { vi: "thán từ", en: "interjection" },
  exp: { vi: "cụm từ", en: "expression" },
  aux: { vi: "trợ từ bổ trợ", en: "auxiliary" },
  "aux-v": { vi: "trợ động từ", en: "auxiliary verb" },
  "aux-adj": { vi: "trợ tính từ", en: "auxiliary adjective" },
  ctr: { vi: "trợ số từ", en: "counter" },
  num: { vi: "số từ", en: "numeric" },
  pref: { vi: "tiền tố", en: "prefix" },
  suf: { vi: "hậu tố", en: "suffix" },
  cop: { vi: "hệ từ", en: "copula" },
  unc: { vi: "chưa phân loại", en: "unclassified" },
};

/** Usage notes (JMdict "misc") and fields. */
const MISC: Record<string, Label> = {
  uk: { vi: "thường viết bằng kana", en: "usually written in kana" },
  col: { vi: "khẩu ngữ", en: "colloquial" },
  fam: { vi: "thân mật", en: "familiar" },
  pol: { vi: "lịch sự", en: "polite" },
  hon: { vi: "tôn kính", en: "honorific" },
  hum: { vi: "khiêm nhường", en: "humble" },
  sl: { vi: "tiếng lóng", en: "slang" },
  arch: { vi: "từ cổ", en: "archaic" },
  ksb: { vi: "phương ngữ Kansai", en: "Kansai dialect" },
  osb: { vi: "phương ngữ Osaka", en: "Osaka dialect" },
  kyb: { vi: "phương ngữ Kyoto", en: "Kyoto dialect" },
  ktb: { vi: "phương ngữ Kantō", en: "Kantō dialect" },
  kyu: { vi: "phương ngữ Kyushu", en: "Kyushu dialect" },
  thb: { vi: "phương ngữ Tōhoku", en: "Tōhoku dialect" },
  hob: { vi: "phương ngữ Hokkaido", en: "Hokkaido dialect" },
  tsb: { vi: "phương ngữ Tosa", en: "Tosa dialect" },
  tsug: { vi: "phương ngữ Tsugaru", en: "Tsugaru dialect" },
  nab: { vi: "phương ngữ Nagano", en: "Nagano dialect" },
  rkb: { vi: "phương ngữ Ryukyu", en: "Ryukyu dialect" },
  obs: { vi: "lỗi thời", en: "obsolete" },
  vulg: { vi: "thô tục", en: "vulgar" },
  derog: { vi: "miệt thị", en: "derogatory" },
  joc: { vi: "đùa vui", en: "humorous" },
  yoji: { vi: "thành ngữ bốn chữ", en: "yojijukugo" },
  abbr: { vi: "viết tắt", en: "abbreviation" },
  form: { vi: "trang trọng", en: "formal" },
  male: { vi: "ngôn ngữ nam giới", en: "male term" },
  fem: { vi: "ngôn ngữ nữ giới", en: "female term" },
  "on-mim": { vi: "từ tượng thanh / tượng hình", en: "onomatopoeia" },
  poet: { vi: "thơ ca", en: "poetical" },
  rare: { vi: "hiếm", en: "rare" },
  sens: { vi: "nhạy cảm", en: "sensitive" },
  proverb: { vi: "tục ngữ", en: "proverb" },
  "id": { vi: "quán dụng ngữ", en: "idiom" },
  hist: { vi: "lịch sử", en: "historical" },
  ateji: { vi: "chữ ateji", en: "ateji" },
  uK: { vi: "thường viết bằng kanji", en: "usually written in kanji" },
  ik: { vi: "cách viết kana không chuẩn", en: "irregular kana" },
  iK: { vi: "cách viết kanji không chuẩn", en: "irregular kanji" },
  oK: { vi: "kanji cổ", en: "outdated kanji" },
  ok: { vi: "kana cổ", en: "outdated kana" },
  rK: { vi: "kanji ít dùng", en: "rarely used kanji" },
  sK: { vi: "chỉ để tìm kiếm", en: "search-only kanji" },
  math: { vi: "toán học", en: "mathematics" },
  comp: { vi: "tin học", en: "computing" },
  med: { vi: "y học", en: "medicine" },
  law: { vi: "luật", en: "law" },
  econ: { vi: "kinh tế", en: "economics" },
  food: { vi: "ẩm thực", en: "food" },
  physics: { vi: "vật lý", en: "physics" },
  chem: { vi: "hóa học", en: "chemistry" },
  bio: { vi: "sinh học", en: "biology" },
  ling: { vi: "ngôn ngữ học", en: "linguistics" },
  sports: { vi: "thể thao", en: "sports" },
  music: { vi: "âm nhạc", en: "music" },
  geol: { vi: "địa chất", en: "geology" },
  astron: { vi: "thiên văn", en: "astronomy" },
  Buddh: { vi: "Phật giáo", en: "Buddhism" },
  Shinto: { vi: "Thần đạo", en: "Shinto" },
};

/** Conjugations the lookup undid, outermost first. */
const REASONS: Record<string, Label> = {
  polite: { vi: "dạng ます", en: "polite (ます)" },
  "polite-past": { vi: "quá khứ lịch sự (ました)", en: "polite past (ました)" },
  "polite-negative": { vi: "phủ định lịch sự (ません)", en: "polite negative (ません)" },
  "polite-past-negative": { vi: "quá khứ phủ định lịch sự (ませんでした)", en: "polite past negative (ませんでした)" },
  "polite-volitional": { vi: "ý chí lịch sự (ましょう)", en: "polite volitional (ましょう)" },
  "polite-te": { vi: "dạng て lịch sự", en: "polite te-form" },
  negative: { vi: "phủ định (ない)", en: "negative (ない)" },
  "past-negative": { vi: "quá khứ phủ định (なかった)", en: "past negative (なかった)" },
  "negative-te": { vi: "phủ định dạng て (なくて)", en: "negative te-form (なくて)" },
  "negative-conditional": { vi: "điều kiện phủ định (なければ)", en: "negative conditional (なければ)" },
  "negative-concessive": { vi: "phủ định nhượng bộ (なくても)", en: "negative concessive (なくても)" },
  past: { vi: "quá khứ (た)", en: "past (た)" },
  te: { vi: "dạng て", en: "te-form" },
  conditional: { vi: "điều kiện (ば / たら)", en: "conditional (ば / たら)" },
  tari: { vi: "liệt kê (たり)", en: "tari" },
  volitional: { vi: "ý chí (う / よう)", en: "volitional (う / よう)" },
  imperative: { vi: "mệnh lệnh", en: "imperative" },
  potential: { vi: "khả năng", en: "potential" },
  "potential-passive": { vi: "khả năng / bị động (られる)", en: "potential / passive (られる)" },
  passive: { vi: "bị động", en: "passive" },
  causative: { vi: "sai khiến", en: "causative" },
  "causative-passive": { vi: "sai khiến bị động", en: "causative-passive" },
  want: { vi: "muốn (たい)", en: "want to (たい)" },
  "looks-like": { vi: "có vẻ (そう)", en: "looks like (そう)" },
  "too-much": { vi: "quá (すぎる)", en: "too much (すぎる)" },
  while: { vi: "vừa … vừa (ながら)", en: "while (ながら)" },
  stem: { vi: "dạng liên dụng", en: "stem form" },
  adverbial: { vi: "dạng trạng từ (く)", en: "adverbial (く)" },
  noun: { vi: "danh từ hóa (さ)", en: "nominalised (さ)" },
  progressive: { vi: "đang … (ている)", en: "progressive (ている)" },
  resultative: { vi: "trạng thái (てある)", en: "resultative (てある)" },
  preparatory: { vi: "làm sẵn (ておく)", en: "preparatory (ておく)" },
  completive: { vi: "làm xong / lỡ (てしまう)", en: "completive (てしまう)" },
  try: { vi: "thử (てみる)", en: "try (てみる)" },
  "go-on": { vi: "tiếp diễn (ていく)", en: "going on (ていく)" },
  "come-to": { vi: "dần dần (てくる)", en: "coming to (てくる)" },
  favour: { vi: "làm giúp (てくれる / てもらう)", en: "favour (てくれる / てもらう)" },
  request: { vi: "nhờ vả (てください)", en: "request (てください)" },
};

function pick(table: Record<string, Label>, code: string, lang: UiLang): string {
  const label = table[code];
  if (!label) return code;
  return lang === "vi" ? label.vi : label.en;
}

/** JMdict writes godan verbs as v5k, v5s, …; they are all "nhóm 1". */
export function posLabel(code: string, lang: UiLang): string {
  return pick(POS, code.startsWith("v5") || code === "v4r" ? "v5" : code, lang);
}
export const miscLabel = (code: string, lang: UiLang) => pick(MISC, code, lang);
export const reasonLabel = (code: string, lang: UiLang) => pick(REASONS, code, lang);

/** N5 … N1 for the 5 … 1 stored on an entry. */
export const jlptLabel = (level: number) => `N${level}`;

/** Part-of-speech tags to show for a sense: transitivity is shown, the rest folded into one label each. */
export function uniquePos(pos: string[], lang: UiLang): string[] {
  return [...new Set(pos.map((p) => posLabel(p, lang)))];
}
