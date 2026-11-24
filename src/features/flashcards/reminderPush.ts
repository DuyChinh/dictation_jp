import { apiUrl } from "../../shared/env";

/**
 * "Cards to review" reminders outside the app, as Web Push. The server (dictation_jp_service, modules/push) checks every
 * few minutes and, once a day at the hour the learner picked, sends one notification when cards are due.
 * This file subscribes or unsubscribes this browser; the choice is kept in localStorage per account.
 */
export const REMINDER_KEY = "jd.review_reminder.v1";
export const DEFAULT_HOUR = 19;

export type ReminderPref = { userId: string; on: boolean; hour: number };
export type ReminderLang = "vi" | "en" | "ja";
export type EnableResult = "ok" | "unsupported" | "unavailable" | "denied" | "error";

const token = (): string | null => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

export function readReminderPref(userId: string | undefined): ReminderPref | null {
  if (!userId) return null;
  try {
    const v = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? "null") as Partial<ReminderPref> | null;
    if (!v || v.userId !== userId || typeof v.hour !== "number" || !Number.isInteger(v.hour) || v.hour < 0 || v.hour > 23) return null;
    return { userId, on: v.on === true, hour: v.hour };
  } catch {
    return null;
  }
}

function writeReminderPref(pref: ReminderPref | null): void {
  try {
    if (pref) localStorage.setItem(REMINDER_KEY, JSON.stringify(pref));
    else localStorage.removeItem(REMINDER_KEY);
  } catch {
    /* the choice just is not remembered on this device */
  }
}

/** Whether this browser can show push notifications at all. */
export function reminderSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

export const notificationsBlocked = (): boolean => typeof Notification !== "undefined" && Notification.permission === "denied";

function keyBytes(base64Url: string): Uint8Array {
  const b64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function serverKey(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("/api/push/config"));
    if (!res.ok) return null;
    const json = (await res.json()) as { enabled?: boolean; publicKey?: string };
    return json.enabled && json.publicKey ? json.publicKey : null;
  } catch {
    return null;
  }
}

/** Where the learner is on the clock, so "19:00" means 19:00 for them. Minutes east of UTC. */
const utcOffsetMin = (): number => -new Date().getTimezoneOffset();

async function register(sub: PushSubscription, hour: number, lang: ReminderLang): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetch(apiUrl("/api/push/subscription"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ subscription: sub.toJSON(), lang, hour, utcOffsetMin: utcOffsetMin() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Asks for permission if needed, subscribes this browser and tells the server the hour and language. */
export async function enableReminder(userId: string, hour: number, lang: ReminderLang): Promise<EnableResult> {
  if (!reminderSupported()) return "unsupported";
  try {
    const key = await serverKey();
    if (!key) return "unavailable";
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "unsupported"; // the service worker only runs in the built site
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
    if (!(await register(sub, hour, lang))) return "error";
    writeReminderPref({ userId, on: true, hour });
    return "ok";
  } catch {
    return "error";
  }
}

/** Changes the hour (or language) of a reminder that is already on. */
export async function updateReminder(userId: string, hour: number, lang: ReminderLang): Promise<boolean> {
  if (!reminderSupported() || notificationsBlocked()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub || !(await register(sub, hour, lang))) return false;
    writeReminderPref({ userId, on: true, hour });
    return true;
  } catch {
    return false;
  }
}

/** Stops the reminders for this browser: the server forgets it, then the browser drops the subscription. */
export async function disableReminder(userId?: string): Promise<void> {
  const t = token(); // read now: signing out clears it right after
  if (userId) writeReminderPref({ userId, on: false, hour: readReminderPref(userId)?.hour ?? DEFAULT_HOUR });
  else writeReminderPref(null);
  if (!reminderSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    if (t) {
      await fetch(apiUrl("/api/push/subscription"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
        keepalive: true,
      }).catch(() => undefined);
    }
    await sub.unsubscribe();
  } catch {
    /* nothing more to do */
  }
}
