import { Link } from "react-router-dom";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import { AppShell } from "../../shared/ui/AppShell";
import { Icon, type IconName } from "../../shared/ui/Icon";

const FEATURES: Array<{ icon: IconName; title: TranslationKey; desc: TranslationKey }> = [
  { icon: "message", title: "soon.f1.t", desc: "soon.f1.d" },
  { icon: "thumbUp", title: "soon.f2.t", desc: "soon.f2.d" },
  { icon: "chart", title: "soon.f3.t", desc: "soon.f3.d" },
];

const STEPS: Array<{ label: TranslationKey; state: "done" | "now" | "next" }> = [
  { label: "soon.step1", state: "done" },
  { label: "soon.step2", state: "now" },
  { label: "soon.step3", state: "next" },
];

/** Stands in for the feedback board while it is switched off (see config/feedback.ts). */
export function FeedbackComingSoon() {
  const { t } = useUiLanguage();
  return (
    <AppShell title={t("nav.feedback")}>
      <section className="soon" aria-labelledby="soon-title">
        <div className="soon__card">
          <span className="soon__badge">
            <span className="soon__dot" aria-hidden="true" />
            {t("soon.badge")}
          </span>

          <svg className="soon__art" viewBox="0 0 220 150" role="presentation" aria-hidden="true" focusable="false">
            <ellipse className="soon__shadow" cx="110" cy="138" rx="70" ry="7" />
            <g className="soon__bubble soon__bubble--back">
              <path d="M128 22h56a14 14 0 0 1 14 14v34a14 14 0 0 1-14 14h-10l-10 14-4-14h-42a14 14 0 0 1-14-14V36a14 14 0 0 1 14-14z" />
              <circle cx="132" cy="53" r="4" />
              <circle cx="152" cy="53" r="4" />
              <circle cx="172" cy="53" r="4" />
            </g>
            <g className="soon__bubble soon__bubble--front">
              <path d="M36 52h78a16 16 0 0 1 16 16v38a16 16 0 0 1-16 16H72l-18 18-4-18H36a16 16 0 0 1-16-16V68a16 16 0 0 1 16-16z" />
              <path className="soon__heart" d="M75 100s-17-9.6-20.8-20.2C52.2 74 56.4 68 62.8 68c4.4 0 7.6 2.4 10.4 6.4C76 70.4 79.2 68 83.6 68c6.4 0 10.6 6 8.6 11.8C88.4 90.4 75 100 75 100z" />
            </g>
            <g className="soon__spark">
              <path d="M196 96l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
              <path d="M24 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
              <circle cx="206" cy="20" r="3" />
            </g>
          </svg>

          <h1 id="soon-title">{t("soon.title")}</h1>
          <p className="soon__lead">{t("soon.lead")}</p>

          <ul className="soon__features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="soon__icon" aria-hidden="true">
                  <Icon name={f.icon} size={22} />
                </span>
                <strong>{t(f.title)}</strong>
                <span>{t(f.desc)}</span>
              </li>
            ))}
          </ul>

          <ol className="soon__steps" aria-label={t("soon.steps")}>
            {STEPS.map((s) => (
              <li key={s.label} className={`is-${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
                <span className="soon__marker" aria-hidden="true">
                  {s.state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : null}
                </span>
                {t(s.label)}
              </li>
            ))}
          </ol>

          <div className="soon__actions">
            <Link to="/" className="btn btn--primary btn--lg">
              <Icon name="home" size={18} /> {t("soon.home")}
            </Link>
            <Link to="/lessons" className="btn btn--outline btn--lg">
              <Icon name="book" size={18} /> {t("soon.practice")}
            </Link>
          </div>
          <p className="soon__thanks">{t("soon.thanks")}</p>
        </div>
      </section>
    </AppShell>
  );
}
