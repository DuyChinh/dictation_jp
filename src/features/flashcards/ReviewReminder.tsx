import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fmt } from "../../shared/i18n/format";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import {
  DEFAULT_HOUR,
  DEFAULT_MINUTE,
  disableReminder,
  enableReminder,
  formatTime,
  notificationsBlocked,
  parseTime,
  readReminderPref,
  reminderSupported,
  saveReminderTime,
  sendTestReminder,
  updateReminder,
} from "./reminderPush";

type Problem = "blocked" | "unavailable" | "unsupported" | "error" | "badTime" | "testSent" | "testFailed" | null;

/** Turns the daily "cards to review" push notification on or off for this browser, and picks its time. */
export function ReviewReminder() {
  const ft = useFt();
  const { uiLang } = useUiLanguage();
  const { user } = useAuth();
  const userId = user?._id;
  const pref = readReminderPref(userId);
  const [on, setOn] = useState(Boolean(pref?.on) && !notificationsBlocked());
  // what is in the box (it can be half typed); `time` is the last valid time in it
  const [draft, setDraft] = useState(formatTime(pref?.hour ?? DEFAULT_HOUR, pref?.minute ?? DEFAULT_MINUTE));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const time = parseTime(draft);

  // the account may only be known after the first render, so take the saved choice again once it is
  useEffect(() => {
    const saved = readReminderPref(userId);
    setOn(Boolean(saved?.on) && !notificationsBlocked());
    setDraft(formatTime(saved?.hour ?? DEFAULT_HOUR, saved?.minute ?? DEFAULT_MINUTE));
  }, [userId]);

  // keep the server's copy of the time, language and time zone fresh while the reminder is on
  useEffect(() => {
    const saved = readReminderPref(userId);
    if (userId && saved?.on && !notificationsBlocked()) void updateReminder(userId, saved.hour, saved.minute, uiLang);
  }, [userId, uiLang]);

  if (!userId || !reminderSupported()) return null;

  async function turnOn() {
    if (!time) return setProblem("badTime");
    setBusy(true);
    setProblem(null);
    const r = await enableReminder(userId!, time.hour, time.minute, uiLang);
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

  async function pickTime(text: string) {
    setDraft(text);
    const t = parseTime(text);
    if (!t) return setProblem("badTime");
    setProblem(null);
    saveReminderTime(userId!, t.hour, t.minute);
    if (!on) return;
    setProblem((await updateReminder(userId!, t.hour, t.minute, uiLang)) ? null : "error");
  }

  async function test() {
    setBusy(true);
    const ok = await sendTestReminder(uiLang);
    setBusy(false);
    setProblem(ok ? "testSent" : "testFailed");
  }

  const status = problem
    ? ft(`reminder.${problem}`)
    : on && time
      ? fmt(ft("reminder.enabled"), { t: formatTime(time.hour, time.minute) })
      : ft("reminder.sub");

  return (
    <aside className="fc-reminder" aria-label={ft("reminder.title")}>
      <span className="fc-remind__icon" aria-hidden="true"><Icon name="bell" size={22} /></span>
      <div className="fc-remind__text">
        <strong>{ft("reminder.title")}</strong>
        <span role={problem === "badTime" ? "alert" : undefined}>{status}</span>
      </div>
      <label className="fc-reminder__hour">
        <span>{ft("reminder.hour")}</span>
        <input
          type="time"
          step={60}
          className="fc-input"
          value={draft}
          onChange={(e) => void pickTime(e.target.value)}
          aria-invalid={!time}
          disabled={busy}
        />
      </label>
      {on && (
        <button type="button" className="btn btn--ghost" onClick={() => void test()} disabled={busy}>
          {ft("reminder.test")}
        </button>
      )}
      <button type="button" className={`btn ${on ? "btn--ghost" : "btn--primary"}`} onClick={() => void (on ? turnOff() : turnOn())} disabled={busy || (!on && !time)} aria-pressed={on}>
        {on ? ft("reminder.off") : ft("reminder.on")}
      </button>
    </aside>
  );
}
