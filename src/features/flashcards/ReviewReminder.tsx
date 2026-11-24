import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { DEFAULT_HOUR, disableReminder, enableReminder, notificationsBlocked, readReminderPref, reminderSupported, updateReminder } from "./reminderPush";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
type Problem = "blocked" | "unavailable" | "unsupported" | "error" | null;

/** Turns the daily "cards to review" push notification on or off for this browser, and picks its hour. */
export function ReviewReminder() {
  const ft = useFt();
  const { uiLang } = useUiLanguage();
  const { user } = useAuth();
  const userId = user?._id;
  const pref = readReminderPref(userId);
  const [on, setOn] = useState(Boolean(pref?.on) && !notificationsBlocked());
  const [hour, setHour] = useState(pref?.hour ?? DEFAULT_HOUR);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  // keep the server's copy of the hour, language and time zone fresh while the reminder is on
  useEffect(() => {
    if (userId && on) void updateReminder(userId, hour, uiLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, uiLang]);

  if (!userId || !reminderSupported()) return null;

  async function turnOn(h: number) {
    setBusy(true);
    setProblem(null);
    const r = await enableReminder(userId!, h, uiLang);
    setBusy(false);
    if (r === "ok") setOn(true);
    else setProblem(r === "denied" ? "blocked" : r);
  }

  async function turnOff() {
    setBusy(true);
    setProblem(null);
    await disableReminder(userId);
    setBusy(false);
    setOn(false);
  }

  async function pickHour(h: number) {
    setHour(h);
    if (!on) return;
    setProblem((await updateReminder(userId!, h, uiLang)) ? null : "error");
  }

  return (
    <aside className="fc-reminder" aria-label={ft("reminder.title")}>
      <span className="fc-remind__icon" aria-hidden="true"><Icon name="bell" size={22} /></span>
      <div className="fc-remind__text">
        <strong>{ft("reminder.title")}</strong>
        <span>{problem ? ft(`reminder.${problem}`) : on ? fmt(ft("reminder.enabled"), { h: hour }) : ft("reminder.sub")}</span>
      </div>
      <label className="fc-reminder__hour">
        <span>{ft("reminder.hour")}</span>
        <select className="fc-input" value={hour} onChange={(e) => void pickHour(Number(e.target.value))} disabled={busy}>
          {HOURS.map((h) => (
            <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
          ))}
        </select>
      </label>
      <button type="button" className={`btn ${on ? "btn--ghost" : "btn--primary"}`} onClick={() => void (on ? turnOff() : turnOn(hour))} disabled={busy} aria-pressed={on}>
        {on ? ft("reminder.off") : ft("reminder.on")}
      </button>
    </aside>
  );
}
