import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAnswers, getPaperProgress, PAPER_PROGRESS_KEY, PAPER_PROGRESS_SYNC_KEY,
  preparePaperProgressSync, resetPaperPart, saveAnswer, saveSentence,
  syncPaperProgressFromServer, uploadPaperProgress,
} from "./paperProgressStore";

const answer = { choiceId: "2", correct: false, at: 1000, part: "reading" as const, mondai: 10 };
let server: Map<string, any>;
let offline: boolean;
const fetchMock = vi.fn();

beforeEach(async () => {
  await uploadPaperProgress();
  localStorage.clear();
  server = new Map();
  offline = false;
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (offline) throw new Error("offline");
    if (init?.method === "POST") {
      for (const c of JSON.parse(init.body).changes) {
        const key = JSON.stringify([c.lessonId, c.kind, c.itemId]);
        if (!server.has(key) || server.get(key).at <= c.at) server.set(key, c);
      }
      return new Response(JSON.stringify({ success: true }));
    }
    const lessonId = String(url).split("/paper/")[1];
    return new Response(JSON.stringify({ changes: [...server.values()].filter(c => !lessonId || c.lessonId === lessonId) }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await uploadPaperProgress(); vi.unstubAllGlobals(); });

describe("written progress across devices", () => {
  it("restores a phone's answers and translation marks on a fresh desktop browser", async () => {
    localStorage.setItem("token", "same-account");
    saveAnswer("n1", "q1", answer);
    saveSentence("n1", "n1-r-p1-s1", "good");
    await uploadPaperProgress();
    localStorage.clear(); // another device, with no cached progress
    localStorage.setItem("token", "same-account");
    await syncPaperProgressFromServer("n1");
    expect(getPaperProgress("n1")).toEqual({ answers: { q1: answer }, sentences: { "n1-r-p1-s1": "good" } });
  });

  it("keeps answers made on both devices and syncs resets without reviving deleted answers", async () => {
    localStorage.setItem("token", "t");
    saveAnswer("n1", "q1", answer);
    saveSentence("n1", "n1-r-p1-s1", "weak");
    await uploadPaperProgress();
    const phone = { progress: localStorage.getItem(PAPER_PROGRESS_KEY)!, sync: localStorage.getItem(PAPER_PROGRESS_SYNC_KEY)! };
    localStorage.clear();
    localStorage.setItem("token", "t");
    saveAnswer("n1", "q2", { ...answer, part: "vocab" });
    await syncPaperProgressFromServer("n1");
    expect(Object.keys(getPaperProgress("n1").answers).sort()).toEqual(["q1", "q2"]);
    resetPaperPart("n1", "reading");
    await uploadPaperProgress();
    localStorage.setItem(PAPER_PROGRESS_KEY, phone.progress);
    localStorage.setItem(PAPER_PROGRESS_SYNC_KEY, phone.sync);
    await syncPaperProgressFromServer("n1");
    expect(getPaperProgress("n1").answers).toEqual({ q2: { ...answer, part: "vocab" } });
    expect(getPaperProgress("n1").sentences).toEqual({});
  });

  it("retries a failed answer and reset upload after a reload", async () => {
    localStorage.setItem("token", "t");
    offline = true;
    saveAnswer("n1", "q1", answer);
    await uploadPaperProgress();
    expect(server.size).toBe(0);
    expect(Object.values(JSON.parse(localStorage.getItem(PAPER_PROGRESS_SYNC_KEY)!))[0]).toMatchObject({ pending: true });
    offline = false;
    await syncPaperProgressFromServer("n1");
    expect(server.size).toBe(1);
    offline = true;
    clearAnswers("n1", ["q1"]);
    await uploadPaperProgress();
    offline = false;
    await syncPaperProgressFromServer("n1");
    expect(getPaperProgress("n1").answers).toEqual({});
    expect([...server.values()][0].value).toBeNull();
  });

  it("retains the outbox on HTTP failures too", async () => {
    localStorage.setItem("token", "t");
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    saveAnswer("n1", "q1", answer);
    await uploadPaperProgress();
    expect(Object.values(JSON.parse(localStorage.getItem(PAPER_PROGRESS_SYNC_KEY)!))[0]).toMatchObject({ pending: true });
  });

  it("migrates answers from the old local-only version, keeping the original answer date", async () => {
    localStorage.setItem(PAPER_PROGRESS_KEY, JSON.stringify({ n1: { answers: { q1: answer }, sentences: { s1: "good" } } }));
    preparePaperProgressSync();
    localStorage.setItem("token", "t");
    await syncPaperProgressFromServer();
    expect(server.size).toBe(2);
    expect([...server.values()].find(c => c.kind === "answer")).toMatchObject({ at: answer.at, value: answer });
    preparePaperProgressSync();
    expect(Object.values(JSON.parse(localStorage.getItem(PAPER_PROGRESS_SYNC_KEY)!)).every((c: any) => !c.pending)).toBe(true);
  });

  it("does not fetch or upload guest answers", async () => {
    saveAnswer("n1", "q1", answer);
    await syncPaperProgressFromServer("n1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getPaperProgress("n1").answers.q1).toEqual(answer);
  });

  it("ignores a response from an account that signed out while loading", async () => {
    localStorage.setItem("token", "a");
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { resolve = r; }));
    const request = syncPaperProgressFromServer("n1");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    localStorage.setItem("token", "b");
    resolve(new Response(JSON.stringify({ changes: [{ lessonId: "n1", kind: "answer", itemId: "q1", value: answer, at: 1000 }] })));
    await request;
    expect(getPaperProgress("n1").answers).toEqual({});
  });
});
