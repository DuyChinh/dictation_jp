import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearGame, hasSavedGame, loadGame, saveGame, GAME_KEY } from "./gameProgress";
import { clearLearn, resumeLearn, saveLearn, LEARN_KEY } from "./learnProgress";
import { PROGRESS_SYNC_KEY, applyRemoteProgress, collectProgress, syncProgress } from "./progressSync";
import type { Card } from "./types";

const card = (id: string): Card => ({ id, deckId: "d1", term: id, termLang: "ja", definition: id, definitionLang: "vi", box: 0, due: 0, right: 0, wrong: 0, createdAt: 1, updatedAt: 1 }) as Card;
const accept = (d: unknown): d is { direction: string } => !!d && typeof d === "object" && "direction" in d;
const round = (at: number, index = 1) => ({ order: ["a", "b", "c"], flips: [false, true, false], index, unknown: ["a"], at });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(async () => {
  await vi.runOnlyPendingTimersAsync(); // let a scheduled sync fire, so the module's pending-timer flag is clear for the next test
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("finishing a game", () => {
  it("leaves a dated mark instead of nothing, and Continue goes away", () => {
    const t = Date.now();
    saveGame("d1", "blitz", { direction: "term" }, t - 1000);
    expect(hasSavedGame("d1", "blitz")).toBe(true);
    clearGame("d1", "blitz", t);
    expect(hasSavedGame("d1", "blitz")).toBe(false);
    expect(loadGame("d1", "blitz", accept)).toBeNull();
    expect(collectProgress()["g:d1:blitz"]).toEqual({ at: t, data: null });
  });
  it("marks it once, however often a game asks", () => {
    const t = Date.now();
    saveGame("d1", "blitz", { direction: "term" }, t - 1000);
    clearGame("d1", "blitz", t);
    clearGame("d1", "blitz", t + 7000);
    expect(collectProgress()["g:d1:blitz"].at).toBe(t);
    clearGame("d1", "never-saved", t + 8000);
    expect(collectProgress()).not.toHaveProperty("g:d1:never-saved");
  });
});

describe("a study round", () => {
  it("is over once cleared, and shows on the wire as such", () => {
    saveLearn("d1", round(Date.now()));
    expect(resumeLearn("d1", [card("a"), card("b"), card("c")])).not.toBeNull();
    expect(collectProgress()["l:d1"].data).toMatchObject({ order: ["a", "b", "c"], index: 1 });
    clearLearn("d1", Date.now() + 5);
    expect(resumeLearn("d1", [card("a"), card("b"), card("c")])).toBeNull();
    expect(collectProgress()["l:d1"].data).toBeNull();
  });
});

describe("taking in the account's copy", () => {
  it("offers Continue for a game that was started on another device", () => {
    const at = Date.now() - 1000;
    expect(applyRemoteProgress({ "g:d1:match": { at, data: { direction: "term", tiles: [] } } })).toBe(true);
    expect(hasSavedGame("d1", "match", "term")).toBe(true);
    expect(hasSavedGame("d1", "match", "definition")).toBe(false);
  });
  it("offers Continue for a study round, and drops it when the other device finished it", () => {
    const at = Date.now() - 1000;
    applyRemoteProgress({ "l:d1": { at, data: { order: ["a", "b", "c"], flips: [false, false, true], index: 1, unknown: [] } } });
    expect(resumeLearn("d1", [card("a"), card("b"), card("c")])?.index).toBe(1);
    applyRemoteProgress({ "l:d1": { at: at + 10, data: null } });
    expect(resumeLearn("d1", [card("a"), card("b"), card("c")])).toBeNull();
  });
  it("keeps the newer copy on each side", () => {
    const t = Date.now();
    saveGame("d1", "blitz", { direction: "term", from: "here" }, t - 10);
    applyRemoteProgress({ "g:d1:blitz": { at: t - 500, data: { direction: "term", from: "account" } } });
    expect(loadGame("d1", "blitz", accept)).toMatchObject({ from: "here" });
    applyRemoteProgress({ "g:d1:blitz": { at: t + 500, data: { direction: "term", from: "account" } } });
    expect(loadGame("d1", "blitz", accept)).toMatchObject({ from: "account" });
  });
  it("ignores what is malformed or too old", () => {
    const t = Date.now();
    const changed = applyRemoteProgress({
      "g:d1:old": { at: t - 8 * 24 * 3600 * 1000, data: { direction: "term" } },
      "g:bad key:blitz": { at: t, data: { direction: "term" } },
      "g:d1:str": { at: t, data: "oops" as never },
      "l:d1": { at: t, data: { order: "nope", flips: [], index: 0 } as never },
    });
    expect(changed).toBe(false);
    expect(localStorage.getItem(GAME_KEY)).toBeNull();
    expect(localStorage.getItem(LEARN_KEY)).toBeNull();
  });
});

describe("syncProgress", () => {
  const ok = (progress: unknown) => ({ ok: true, json: async () => ({ progress }) }) as Response;

  it("does nothing when signed out", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    saveGame("d1", "blitz", { direction: "term" });
    expect(await syncProgress()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("sends what changed, takes in the account's games, and sends nothing twice", async () => {
    localStorage.setItem("token", "t");
    const t = Date.now();
    saveGame("d1", "blitz", { direction: "term" }, t - 1000);
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? ok({ ...JSON.parse(String(init.body)).progress, "g:d2:match": { at: t - 50, data: { direction: "term" } } })
        : ok({ "g:d1:blitz": { at: t - 1000, data: { direction: "term" } }, "g:d2:match": { at: t - 50, data: { direction: "term" } } }),
    );
    vi.stubGlobal("fetch", f);

    expect(await syncProgress()).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/flashcards/progress");
    expect(init.method).toBe("PUT");
    expect(Object.keys(JSON.parse(String(init.body)).progress)).toEqual(["g:d1:blitz"]);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
    expect(hasSavedGame("d2", "match")).toBe(true);

    // a second round has nothing new to send: it only downloads
    expect(await syncProgress()).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1].method).toBe("GET");
  });

  it("sends a finished game so the account drops it", async () => {
    localStorage.setItem("token", "t");
    saveGame("d1", "blitz", { direction: "term" }, Date.now() - 5000);
    clearGame("d1", "blitz", Date.now() - 1000);
    const f = vi.fn(async (_url: string, init?: RequestInit) => ok(JSON.parse(String(init?.body ?? '{"progress":{}}')).progress));
    vi.stubGlobal("fetch", f);
    await syncProgress();
    const sent = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).progress;
    expect(sent["g:d1:blitz"].data).toBeNull();
  });

  it("keeps trying later when the server is down, without losing the progress", async () => {
    localStorage.setItem("token", "t");
    saveGame("d1", "blitz", { direction: "term" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await syncProgress()).toBe(false);
    expect(hasSavedGame("d1", "blitz")).toBe(true);
    expect(localStorage.getItem(PROGRESS_SYNC_KEY)).toBeNull();
  });

  it("uploads a save a few seconds after it, once for a burst", async () => {
    localStorage.setItem("token", "t");
    const f = vi.fn(async (_url: string, init?: RequestInit) => ok(JSON.parse(String(init?.body ?? '{"progress":{}}')).progress));
    vi.stubGlobal("fetch", f);
    saveGame("d1", "blitz", { direction: "term", n: 1 });
    saveGame("d1", "blitz", { direction: "term", n: 2 });
    saveGame("d1", "blitz", { direction: "term", n: 3 });
    expect(f).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3500);
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).progress["g:d1:blitz"].data.n).toBe(3);
  });
});
