import { afterEach, describe, expect, it, vi } from "vitest";
import { REMINDER_KEY, disableReminder, enableReminder, readReminderPref, reminderSupported } from "./reminderPush";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("reminder preference", () => {
  it("belongs to one account and ignores broken data", () => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 8 }));
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: true, hour: 8 });
    expect(readReminderPref("u2")).toBeNull();
    expect(readReminderPref(undefined)).toBeNull();
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 99 }));
    expect(readReminderPref("u1")).toBeNull();
    localStorage.setItem(REMINDER_KEY, "{not json");
    expect(readReminderPref("u1")).toBeNull();
  });
});

describe("without push support", () => {
  it("is reported as unsupported and enabling does nothing", async () => {
    // jsdom has no PushManager
    expect(reminderSupported()).toBe(false);
    expect(await enableReminder("u1", 19, "vi")).toBe("unsupported");
    expect(localStorage.getItem(REMINDER_KEY)).toBeNull();
  });

  it("turning off still remembers the choice for the account", async () => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ userId: "u1", on: true, hour: 7 }));
    await disableReminder("u1");
    expect(readReminderPref("u1")).toEqual({ userId: "u1", on: false, hour: 7 });
    await disableReminder();
    expect(localStorage.getItem(REMINDER_KEY)).toBeNull();
  });
});
