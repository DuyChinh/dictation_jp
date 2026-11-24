import { afterEach, describe, expect, it, vi } from "vitest";
import { REMINDER_KEY, disableReminder, enableReminder, fetchAccountTime, readReminderPref, reminderSupported, saveAccountTime, saveReminderTime, parseTime } from "./reminderPush";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("reminder preference", () => {
  it("keeps the chosen hour even while the reminder is off, and does not switch it on", () => {
    saveReminderTime("u1", 7, 45);
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: false, hour: 7, minute: 45 });
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 8 }));
    saveReminderTime("u1", 21, 5);
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: true, hour: 21, minute: 5 });
  });

  it("belongs to one account and ignores broken data", () => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 8 }));
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: true, hour: 8, minute: 0 });
    expect(readReminderPref("u2")).toBeNull();
    expect(readReminderPref(undefined)).toBeNull();
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 99 }));
    expect(readReminderPref("u1")).toBeNull();
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 8, minute: 60 }));
    expect(readReminderPref("u1")).toBeNull();
    localStorage.setItem(REMINDER_KEY, "{not json");
    expect(readReminderPref("u1")).toBeNull();
  });
});

describe("the time on the account", () => {
  const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }));

  it("is read from the server, so a new device starts from it", async () => {
    localStorage.setItem("token", "t");
    const fetchMock = answer({ time: { hour: 23, minute: 30 } });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAccountTime()).toEqual({ hour: 23, minute: 30 });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: "Bearer t" } });
  });

  it("is null when there is none, when signed out, or when the server cannot be reached or sends nonsense", async () => {
    vi.stubGlobal("fetch", answer({ time: null }));
    expect(await fetchAccountTime()).toBeNull(); // signed out: no call is even made
    localStorage.setItem("token", "t");
    expect(await fetchAccountTime()).toBeNull();
    vi.stubGlobal("fetch", answer({ time: { hour: 99, minute: 0 } }));
    expect(await fetchAccountTime()).toBeNull();
    vi.stubGlobal("fetch", answer({}, false));
    expect(await fetchAccountTime()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await fetchAccountTime()).toBeNull();
  });

  it("is saved to the server", async () => {
    localStorage.setItem("token", "t");
    const fetchMock = answer({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveAccountTime(7, 45)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/api/push/preference")).toBe(true);
    expect(init).toMatchObject({ method: "PUT", body: JSON.stringify({ hour: 7, minute: 45 }) });
  });

  it("reports a failed save, and does nothing when signed out", async () => {
    const fetchMock = answer({}, false);
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveAccountTime(7, 45)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    localStorage.setItem("token", "t");
    expect(await saveAccountTime(7, 45)).toBe(false);
  });
});

describe("parseTime", () => {
  it("accepts real 24-hour times and nothing else", () => {
    expect(parseTime("19:30")).toEqual({ hour: 19, minute: 30 });
    expect(parseTime("07:05")).toEqual({ hour: 7, minute: 5 });
    expect(parseTime("0:00")).toEqual({ hour: 0, minute: 0 });
    for (const bad of ["", "24:00", "19:60", "19", "7pm", "19:5", "ab:cd", "-1:00"]) expect(parseTime(bad)).toBeNull();
  });
});

describe("without push support", () => {
  it("is reported as unsupported and enabling does nothing", async () => {
    // jsdom has no PushManager
    expect(reminderSupported()).toBe(false);
    expect(await enableReminder("u1", 19, 0, "vi")).toBe("unsupported");
    expect(localStorage.getItem(REMINDER_KEY)).toBeNull();
  });

  it("turning off still remembers the choice for the account", async () => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 7 }));
    await disableReminder("u1");
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: false, hour: 7, minute: 0 });
    await disableReminder();
    expect(localStorage.getItem(REMINDER_KEY)).toBeNull();
  });
});
