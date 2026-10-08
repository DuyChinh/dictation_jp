import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ExamScope, PaperPractice } from "../../shared/api/paper";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import {
  getExam,
  lastMinutes,
  MAX_MINUTES,
  MIN_MINUTES,
  parseMinutes,
  PRESET_MINUTES,
  startExam,
} from "../../shared/storage/paperExamStore";
import { PARTS, PART_KANJI, scopeTitle } from "./paperLabels";

type Props = { lessonId: string; paper: PaperPractice; lessonLabel: string };

const isPreset = (m: number) => (PRESET_MINUTES as readonly number[]).includes(m);

function clock(minutes: number | null): string {
  if (minutes === null) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:00` : `${m}:00`;
}

function perQuestion(minutes: number | null, count: number): string {
  if (minutes === null || count === 0) return "—";
  const s = Math.round((minutes * 60) / count);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Pick what to sit and for how long; a live exam slip shows what the sitting will be. */
export function ExamSetup({ lessonId, paper, lessonLabel }: Props) {
  const { t } = useUiLanguage();
  const navigate = useNavigate();
  const [scope, setScope] = useState<ExamScope>("all");
  const initial = lastMinutes();
  const [preset, setPreset] = useState<number | null>(isPreset(initial) ? initial : null);
  const [custom, setCustom] = useState(isPreset(initial) ? "" : String(initial));

  const minutes = preset ?? parseMinutes(custom);
  const customInvalid = preset === null && custom.trim() !== "" && parseMinutes(custom) === null;
  const count = scope === "all" ? paper.items.length : paper.counts[scope];
  const running = getExam(lessonId);
  const unfinished = running && !running.submittedAt;
  const examHref = `/lessons/${encodeURIComponent(lessonId)}/paper/exam`;
  const canStart = minutes !== null && count > 0;

  function start() {
    if (minutes === null || count === 0) return;
    startExam(lessonId, scope, minutes);
    navigate(examHref);
  }

  const scopes: Array<{ id: ExamScope; kanji: string; n: number }> = [
    { id: "all", kanji: "全", n: paper.items.length },
    ...PARTS.map((p) => ({ id: p as ExamScope, kanji: PART_KANJI[p], n: paper.counts[p] })),
  ];

  return (
    <div className="exam-setup">
      <header className="exam-setup__title">
        <span className="exam-eyebrow">{t("exam.setup.eyebrow")}</span>
        <h1>{t("exam.setup.title")}</h1>
        <p>{t("exam.sub")}</p>
      </header>

      {unfinished && (
        <div className="exam-setup__resume">
          <span>{t("exam.running")}</span>
          <Link to={examHref} className="paper-soft">
            {t("exam.resume")}
          </Link>
        </div>
      )}

      <div className="exam-setup__cols">
        <div className="exam-setup__form">
          <fieldset className="exam-field">
            <legend>{t("exam.setup.step1")}</legend>
            <div className="exam-scopes" role="radiogroup" aria-label={t("exam.scope")}>
              {scopes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={scope === s.id}
                  className={`exam-scope${scope === s.id ? " is-on" : ""}`}
                  onClick={() => setScope(s.id)}
                >
                  <span className="exam-scope__kanji" aria-hidden="true">
                    {s.kanji}
                  </span>
                  <span className="exam-scope__text">
                    <strong>{scopeTitle(s.id, t)}</strong>
                    <small>
                      {s.n} {t("paper.questionsUnit")}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="exam-field">
            <legend>{t("exam.setup.step2")}</legend>
            <div className="exam-options" role="radiogroup" aria-label={t("exam.minutes")}>
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={preset === m}
                  className={`exam-preset${preset === m ? " is-on" : ""}`}
                  onClick={() => {
                    setPreset(m);
                    setCustom("");
                  }}
                >
                  <strong>{m}</strong>
                  <span>{t("exam.minutesUnit")}</span>
                </button>
              ))}
              <label className={`exam-custom${preset === null ? " is-on" : ""}${customInvalid ? " is-bad" : ""}`}>
                <span>{t("exam.custom")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={custom}
                  placeholder={t("exam.customPlaceholder")}
                  aria-invalid={customInvalid}
                  aria-describedby="exam-range"
                  onFocus={() => setPreset(null)}
                  onChange={(e) => {
                    setPreset(null);
                    setCustom(e.target.value.replace(/\D/g, ""));
                  }}
                />
                <small>{t("exam.minutesUnit")}</small>
              </label>
            </div>
            <p id="exam-range" className={`exam-hint${customInvalid ? " is-bad" : ""}`}>
              {customInvalid ? `${t("exam.range")} (${MIN_MINUTES}–${MAX_MINUTES})` : t("exam.setup.hint")}
            </p>
          </fieldset>

          <ul className="exam-rules">
            {(["exam.rule1", "exam.rule2", "exam.rule3"] as const).map((k, i) => (
              <li key={k}>
                <span aria-hidden="true">{["①", "②", "③"][i]}</span>
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        <aside className="exam-setup__aside" aria-label={t("exam.slip.title")}>
          <div className="exam-slip">
            <span className="exam-slip__notch is-left" aria-hidden="true" />
            <span className="exam-slip__notch is-right" aria-hidden="true" />
            <div className="exam-slip__top">
              <div className="exam-slip__head">
                <span className="exam-slip__kanji jp" lang="ja">
                  受験票
                </span>
                <span>{t("exam.slip.title")}</span>
              </div>
              <strong>{lessonLabel}</strong>
              <span className="exam-slip__scope">{scopeTitle(scope, t)}</span>
            </div>
            <div className="exam-slip__bottom">
              <div>
                <span className="exam-slip__label">{t("exam.slip.time")}</span>
                <strong className={`exam-slip__clock${customInvalid ? " is-bad" : ""}`}>{clock(minutes)}</strong>
              </div>
              <div className="exam-slip__facts">
                <div>
                  <span>{t("exam.slip.count")}</span>
                  <strong>{count}</strong>
                </div>
                <div>
                  <span>{t("exam.slip.perQuestion")}</span>
                  <strong>{perQuestion(minutes, count)}</strong>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="exam-start" disabled={!canStart} onClick={start}>
            {canStart ? (
              <>
                {t("exam.start")}
                <span aria-hidden="true">→</span>
              </>
            ) : (
              t("exam.startDisabled")
            )}
          </button>
        </aside>
      </div>
    </div>
  );
}
