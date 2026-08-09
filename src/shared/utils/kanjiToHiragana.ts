/**
 * Utility for Hiragana & Katakana conversion and Kanji reading mapping on frontend.
 */

export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

const KANJI_READING_MAP: Record<string, string> = {
  "女の人": "おんなのひと",
  "男の人": "おとこのひと",
  "女の子": "おんなのこ",
  "男の子": "おとこのこ",
  "この後": "このあと",
  "その後": "そのあと",
  "まず何": "まずなに",
  "何時": "なんじ",
  "何分": "なんぷん",
  "何人": "なにじん",
  "何日": "なんにち",
  "何月": "なんがつ",
  "何年": "なんねん",
  "何処": "どこ",
  "何故": "なぜ",
  "何か": "なにか",
  "何も": "なにも",
  "何を": "なにを",
  "何が": "なにが",
  "何に": "なにに",
  "何で": "なんで",
  "今日": "きょう",
  "明日": "あした",
  "昨日": "きのう",
  "明後日": "あさって",
  "一昨日": "おととい",
  "今週": "こんしゅう",
  "来週": "らいしゅう",
  "先週": "せんしゅう",
  "今年": "ことし",
  "来年": "らいねん",
  "去年": "きょねん",
  "時間": "じかん",
  "午前": "ごぜん",
  "午後": "ごご",
  "朝": "あさ",
  "昼": "ひる",
  "夜": "よる",
  "晩": "ばん",
  "今": "いま",
  "前": "まえ",
  "後": "あと",
  "中": "なか",
  "外": "そと",
  "上": "うえ",
  "下": "した",
  "右": "みぎ",
  "左": "ひだり",
  "東": "ひがし",
  "西": "にし",
  "南": "みなみ",
  "北": "きた",

  "私": "わたし",
  "僕": "ぼく",
  "俺": "おれ",
  "彼": "かれ",
  "彼女": "かのじょ",
  "先生": "せんせい",
  "学生": "がくせい",
  "学校": "がっこう",
  "会社": "かいしゃ",
  "社員": "しゃいん",
  "友達": "ともだち",
  "家族": "かぞく",
  "父": "ちち",
  "母": "はは",
  "兄": "あに",
  "姉": "あね",
  "弟": "おとうと",
  "妹": "いもうと",
  "夫": "おっと",
  "妻": "つま",
  "子": "こ",
  "人": "ひと",
  "女": "おんな",
  "男": "おとこ",
  "家": "いえ",
  "部屋": "へや",
  "車": "くるま",
  "電車": "でんしゃ",
  "駅": "えき",
  "本": "ほん",
  "水": "みず",
  "魚": "さかな",
  "肉": "にく",
  "野菜": "やさい",
  "何": "なに",

  "食": "た",
  "飲": "の",
  "買": "か",
  "見": "み",
  "聞": "き",
  "話": "はな",
  "読": "よ",
  "書": "か",
  "行": "い",
  "来": "き",
  "帰": "かえ",
  "会": "あ",
  "作": "つく",
  "使": "つか",
  "言": "い",
  "思": "おも",
  "知": "し",
  "待": "ま",
  "持": "も",
  "歩": "ある",
  "走": "はし",
  "始": "はじ",
  "終": "お",
  "休": "やす",
  "働": "はたら",
  "勉": "べん",
  "強": "きょう",
  "習": "なら",
  "教": "おし",
};

const SORTED_ENTRIES = Object.entries(KANJI_READING_MAP).sort(
  (a, b) => b[0].length - a[0].length
);

export function kanjiToHiragana(text: string): string {
  let result = katakanaToHiragana(text);
  for (const [kanji, hiragana] of SORTED_ENTRIES) {
    if (result.includes(kanji)) {
      result = result.split(kanji).join(hiragana);
    }
  }
  return result;
}

/**
 * Returns list of kanji -> hiragana mappings detected between expected and actual
 * Example: expected="女の人はこの後", actual="女のひとこのあと" => [{ hiragana: "ひと", kanji: "人" }, { hiragana: "あと", kanji: "後" }]
 */
export function getReadingMappings(expected: string, actual: string): Array<{ hiragana: string; kanji: string }> {
  const mappings: Array<{ hiragana: string; kanji: string }> = [];
  
  for (const [kanji, hiragana] of SORTED_ENTRIES) {
    if (expected.includes(kanji) && actual.includes(hiragana)) {
      // Check if actual replaced kanji with hiragana
      const expectedReading = kanjiToHiragana(expected);
      const actualReading = kanjiToHiragana(actual);
      if (expectedReading === actualReading) {
        mappings.push({ hiragana, kanji });
      }
    }
  }

  // Remove duplicates
  const seen = new Set<string>();
  return mappings.filter((m) => {
    const key = `${m.hiragana}_${m.kanji}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
