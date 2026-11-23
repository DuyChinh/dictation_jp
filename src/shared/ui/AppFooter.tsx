import { Link } from "react-router-dom";
import { useUiLanguage } from "../i18n/UiLanguageContext";
import { fmt } from "../i18n/format";
import type { TranslationKey } from "../i18n/translations";
import { Icon } from "./Icon";

const LINKS: Array<{ to: string; label: TranslationKey; heart?: boolean }> = [
  { to: "/lessons", label: "nav.practice" },
  { to: "/exams", label: "nav.exams" },
  { to: "/dictionary", label: "nav.dictionary" },
  { to: "/flashcards", label: "nav.flashcards" },
  { to: "/feedback", label: "nav.feedback" },
  { to: "/donate", label: "nav.donate", heart: true },
];

/** The foot of every page: a tip about selecting and looking up words, the way around, and the copyright. */
export function AppFooter() {
  const { t } = useUiLanguage();
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <section className="app-footer__tip" aria-labelledby="app-footer-tip">
          <div className="app-footer__tiptext">
            <strong id="app-footer-tip">{t("footer.tipLabel")}</strong>
            <p>{t("footer.tip")}</p>
          </div>
          <div className="app-footer__demo" aria-hidden="true">
            <p lang="ja">
              勉強を<mark>継続</mark>する
            </p>
            <div className="app-footer__chips">
              <span className="app-footer__chip app-footer__chip--fill">{t("footer.demoFlashcard")}</span>
              <span className="app-footer__chip">{t("footer.demoLookup")}</span>
            </div>
          </div>
        </section>

        <div className="app-footer__row">
          <Link to="/" className="app-footer__brand">
            <img src="/logo.png" alt="" width={38} height={38} />
            <span>
              <strong>Motto</strong>
              <span lang="ja">{t("brand.tagline")}</span>
            </span>
          </Link>
          <nav className="app-footer__nav" aria-label={t("footer.nav")}>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={l.heart ? "is-heart" : undefined}>
                {l.heart && <Icon name="heart" size={16} strokeWidth={2} />}
                {t(l.label)}
              </Link>
            ))}
          </nav>
        </div>

        <p className="app-footer__copy">{fmt(t("footer.copyright"), { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
