import type { DictKanji } from "../../shared/api/dictionary";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";

/** One kanji with its Hán Việt readings, meanings and On / Kun readings. */
export function KanjiCard({ kanji, compact = false }: { kanji: DictKanji; compact?: boolean }) {
  const { t } = useUiLanguage();
  // KANJIDIC2 lists the Sino-Vietnamese reading first and later Nôm readings; the card shows the first few.
  const hanViet = kanji.hanViet.slice(0, compact ? 2 : 4);
  return (
    <div className={`dict-kanji${compact ? " dict-kanji--compact" : ""}`}>
      <span className="dict-kanji__char jp" lang="ja">{kanji.char}</span>
      <div className="dict-kanji__body">
        {hanViet.length > 0 && (
          <p className="dict-kanji__hv">
            <span>{t("dict.hanViet")}</span>
            <strong>{hanViet.join(" / ")}</strong>
          </p>
        )}
        {kanji.meanings.length > 0 && <p className="dict-kanji__meaning">{kanji.meanings.slice(0, compact ? 3 : 6).join(", ")}</p>}
        {!compact && (
          <dl className="dict-kanji__readings jp" lang="ja">
            {kanji.on.length > 0 && (
              <>
                <dt>{t("dict.on")}</dt>
                <dd>{kanji.on.join("、")}</dd>
              </>
            )}
            {kanji.kun.length > 0 && (
              <>
                <dt>{t("dict.kun")}</dt>
                <dd>{kanji.kun.join("、")}</dd>
              </>
            )}
          </dl>
        )}
        {!compact && (
          <p className="dict-kanji__meta">
            {kanji.strokes ? fmt(t("dict.strokes"), { n: kanji.strokes }) : null}
            {kanji.jlpt ? ` · ${fmt(t("dict.jlptOld"), { n: kanji.jlpt })}` : null}
          </p>
        )}
      </div>
    </div>
  );
}
