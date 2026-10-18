import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { Icon } from "../shared/ui/Icon";

type Stage = "verify" | "profile" | "prepare" | "ready" | "error";
const ORDER: Stage[] = ["verify", "profile", "prepare", "ready"];
const STEPS = ["auth.cb.step1", "auth.cb.step2", "auth.cb.step3"] as const;
const PETALS = [8, 22, 38, 54, 70, 86];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Landing page of the Google sign-in: takes the token, loads the account, then opens the app. */
export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const { t } = useUiLanguage();
  const [stage, setStage] = useState<Stage>("verify");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      navigate("/auth", { replace: true });
      return;
    }
    (async () => {
      try {
        await wait(350);
        setStage("profile");
        await loginWithToken(token);
        setStage("prepare");
        await wait(450);
        setStage("ready");
        await wait(600);
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Login failed after Google callback:", err);
        setStage("error");
        await wait(1800);
        navigate("/auth", { replace: true });
      }
    })();
  }, [token, navigate, loginWithToken]);

  const at = ORDER.indexOf(stage);
  const progress = stage === "error" ? 100 : Math.round(((at + 1) / ORDER.length) * 100);

  return (
    <main className="cb" aria-busy={stage !== "ready" && stage !== "error"}>
      <div className="cb__petals" aria-hidden="true">
        {PETALS.map((left, i) => (
          <span key={left} style={{ left: `${left}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${7 + (i % 3) * 2}s` }} />
        ))}
      </div>

      <section className={`cb__card${stage === "error" ? " is-error" : ""}${stage === "ready" ? " is-ready" : ""}`}>
        <div className="cb__logo">
          <span className="cb__ring" aria-hidden="true" />
          <span className="cb__ring cb__ring--2" aria-hidden="true" />
          <img src="/logo.png" alt="" />
          {stage === "ready" && (
            <span className="cb__tick" aria-hidden="true">
              <Icon name="check" size={20} strokeWidth={3} />
            </span>
          )}
        </div>

        <p className="cb__brand">Motto</p>
        <h1 className="cb__title" role="status" aria-live="polite">
          {stage === "error" ? t("auth.cb.error") : stage === "ready" ? t("auth.cb.ready") : t("auth.cb.title")}
          {stage !== "error" && stage !== "ready" && (
            <span className="cb__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </h1>
        {stage !== "error" && stage !== "ready" && <p className="cb__sub">{t("auth.cb.sub")}</p>}

        <div className="cb__bar" role="presentation">
          <span style={{ width: `${progress}%` }} />
        </div>

        {stage !== "error" && (
          <ol className="cb__steps">
            {STEPS.map((key, i) => {
              const done = at > i;
              const active = at === i;
              return (
                <li key={key} className={done ? "is-done" : active ? "is-active" : ""}>
                  <span className="cb__mark" aria-hidden="true">
                    {done ? <Icon name="check" size={14} strokeWidth={3} /> : active ? <span className="cb__spin" /> : null}
                  </span>
                  {t(key)}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
