import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Brand } from "../../shared/ui/AppShell";
import { Icon } from "../../shared/ui/Icon";

/** Split layout for sign-in, sign-up and password pages. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useUiLanguage();
  return (
    <div className="auth">
      <section className="auth__hero">
        <Brand />
        <div className="auth__hero-body">
          <span className="auth__motto" lang="ja">
            聞いて、
            <br />
            書いて、
            <br />
            身につける。
          </span>
          <p className="auth__line">{t("auth.heroLine")}</p>
          <ul className="auth__benefits">
            {(["auth.benefit1", "auth.benefit2", "auth.benefit3"] as const).map((k) => (
              <li key={k}>
                <Icon name="check" size={18} strokeWidth={2.2} />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth__panel">
        <Link to="/" className="btn btn--ghost auth__home">
          {t("auth.backHome")}
        </Link>
        <div className="auth__form-wrap">
          <div className="auth__title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
