import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../i18n/UiLanguageContext";
import { OfflineNotice } from "./OfflineNotice";
import { registerServiceWorker } from "./registerServiceWorker";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("registering the service worker", () => {
  it("registers /sw.js in the built site, and not in development", () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    registerServiceWorker({ enabled: false });
    expect(register).not.toHaveBeenCalled();
    registerServiceWorker({ enabled: true });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});

describe("the offline notice", () => {
  const setOnline = (on: boolean) => Object.defineProperty(navigator, "onLine", { value: on, configurable: true });

  it("shows while there is no network and goes when it is back", () => {
    setOnline(true);
    render(<UiLanguageProvider><OfflineNotice /></UiLanguageProvider>);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status").textContent).toMatch(/offline/);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

/** Runs the real sw.js against a small fake of the browser's caches and network. */
function loadWorker(net: { online: boolean; files: Record<string, string> }) {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, "https://kaitiq.test").href;
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      match: async (r: Request | string) => m.get(key(r))?.clone(),
      put: async (r: Request | string, res: Response) => void m.set(key(r), res),
      add: async (r: string) => void m.set(key(r), await fakeFetch(r)),
      keys: async () => [...m.keys()].map((k) => new Request(k)),
      delete: async (r: Request | string) => m.delete(key(r)),
    };
  };
  const fakeFetch = async (r: Request | string) => {
    if (!net.online) throw new TypeError("offline");
    const body = net.files[new URL(key(r)).pathname];
    return body === undefined ? new Response("", { status: 404 }) : new Response(body, { headers: { "content-type": key(r).endsWith("/") ? "text/html" : "application/javascript" } });
  };
  const listeners: Record<string, (e: any) => void> = {};
  const self = { location: new URL("https://kaitiq.test/"), addEventListener: (t: string, f: (e: any) => void) => (listeners[t] = f), skipWaiting: () => undefined, clients: { claim: async () => undefined } };
  const context = vm.createContext({ self, caches: { open: async (n: string) => cacheOf(n), keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n), match: async () => undefined }, fetch: fakeFetch, Response, Request, URL, setTimeout, Promise, Number, Math, String, Error });
  vm.runInContext(readFileSync(resolve(__dirname, "../../../public/sw.js"), "utf8"), context);
  const install = async () => {
    const waits: Promise<unknown>[] = [];
    listeners.install!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  const ask = async (path: string, init: { mode?: string; destination?: string; range?: string; method?: string } = {}) => {
    let answered: Promise<Response> | undefined;
    const request = { url: `https://kaitiq.test${path}`, method: init.method ?? "GET", mode: init.mode ?? "cors", destination: init.destination ?? "", headers: { get: (h: string) => (h.toLowerCase() === "range" ? (init.range ?? null) : null) } };
    listeners.fetch!({ request, respondWith: (p: Promise<Response>) => (answered = p) });
    return answered ? await answered : undefined;
  };
  const activate = async () => {
    const waits: Promise<unknown>[] = [];
    listeners.activate!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { install, activate, ask, stores };
}

describe("the service worker", () => {
  const files = { "/": "<html>page</html>", "/asset-manifest.json": JSON.stringify(["/assets/app-1.js", "/assets/sound-1.mp3"]), "/assets/app-1.js": "code", "/assets/sound-1.mp3": "0123456789" };

  it("saves the page and every built file when it installs", async () => {
    const w = loadWorker({ online: true, files });
    await w.install();
    expect([...w.stores.get("kaitiq-assets-v1")!.keys()].map((k) => new URL(k).pathname)).toEqual(["/assets/app-1.js", "/assets/sound-1.mp3"]);
    expect(await (await w.stores.get("kaitiq-shell-v1")!.get("https://kaitiq.test/")!.clone().text())).toBe("<html>page</html>");
  });

  it("opens the page, a built file and a sound from what is saved when there is no network", async () => {
    const net = { online: true, files };
    const w = loadWorker(net);
    await w.install();
    net.online = false;
    expect(await (await w.ask("/flashcards/abc", { mode: "navigate" }))!.text()).toBe("<html>page</html>");
    expect(await (await w.ask("/assets/app-1.js", { destination: "script" }))!.text()).toBe("code");
    const part = (await w.ask("/assets/sound-1.mp3", { range: "bytes=2-5" }))!;
    expect(part.status).toBe(206);
    expect(await part.text()).toBe("2345");
    expect(part.headers.get("Content-Range")).toBe("bytes 2-5/10");
  });

  it("leaves the API and anything that is not a GET to the network", async () => {
    const w = loadWorker({ online: true, files });
    await w.install();
    expect(await w.ask("/api/flashcards")).toBeUndefined();
    expect(await w.ask("/flashcards", { method: "PUT" })).toBeUndefined();
  });

  it("clears out caches of an older version when it takes over", async () => {
    const w = loadWorker({ online: true, files });
    w.stores.set("kaitiq-assets-v0", new Map());
    w.stores.set("motto-assets-v1", new Map()); // left by the app's former name
    w.stores.set("other-site", new Map());
    await w.install();
    await w.activate();
    expect([...w.stores.keys()]).not.toContain("kaitiq-assets-v0");
    expect([...w.stores.keys()]).not.toContain("motto-assets-v1");
    expect([...w.stores.keys()]).toContain("other-site");
    expect([...w.stores.keys()]).toContain("kaitiq-assets-v1");
  });
});
