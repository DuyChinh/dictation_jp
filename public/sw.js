/*
 * Lets the site open and the flashcards work without a network.
 *
 * - The page (index.html): the network first, the saved copy when there is none or it is slow.
 * - Built files in /assets (code, styles, the quiz-show sounds): saved when the site is installed and kept.
 * - Fonts, the site's own pictures, and card pictures from other sites (up to PICS_MAX): saved once seen.
 * - Everything under /api is left alone, so the learner's data always comes from the server when there is one.
 *
 * `__BUILD__` is replaced at build time, so every release changes this file and the browser installs it.
 * To take this off every device, publish a sw.js that calls `self.registration.unregister()` and clears the caches.
 */
const BUILD = "__BUILD__";
const SHELL = "motto-shell-v1";
const ASSETS = "motto-assets-v1";
const STATIC = "motto-static-v1";
const FONTS = "motto-fonts-v1";
const PICS = "motto-pics-v1";
const CURRENT = [SHELL, ASSETS, STATIC, FONTS, PICS];

const ASSETS_MAX = 400;
const STATIC_MAX = 120;
const PICS_MAX = 80;
const SLOW_MS = 4000;
const WARM = ["/favicon.png", "/logo.png", "/apple-touch-icon.png", "/millionaire/logo.webp", "/miner/old-miner.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // the page and every built file it may need, so a first visit is enough to work offline
      const shell = await caches.open(SHELL);
      const assets = await caches.open(ASSETS);
      const page = await fetch("/", { cache: "reload" });
      if (page.ok) await shell.put("/", page);
      try {
        const list = await (await fetch("/asset-manifest.json", { cache: "no-store" })).json();
        await Promise.all(list.map((url) => assets.add(url).catch(() => undefined)));
      } catch {
        // no list (the development server): files are saved as they are used
      }
      const statics = await caches.open(STATIC);
      await Promise.all(WARM.map((url) => statics.add(url).catch(() => undefined)));
    })().catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("motto-") && !CURRENT.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const STATIC_KINDS = ["image", "font", "style", "script"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
    if (req.mode === "navigate") return event.respondWith(page(req));
    if (url.pathname.startsWith("/assets/")) return event.respondWith(built(req));
    if (STATIC_KINDS.includes(req.destination) || url.pathname.startsWith("/handwriting/")) {
      return event.respondWith(freshen(req, STATIC, STATIC_MAX));
    }
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) return event.respondWith(freshen(req, FONTS, 40));
  if (req.destination === "image") return event.respondWith(keepFirst(req, PICS, PICS_MAX));
});

/** The oldest entries go once a cache holds more than `max`. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function store(name, req, res, max) {
  // a picture from another site arrives "opaque" (status 0), which can still be kept and shown
  if (!res || !(res.ok || res.type === "opaque")) return;
  const cache = await caches.open(name);
  await cache.put(req, res.clone());
  await trim(cache, max);
}

/** The page: every address of the site is the same index.html, so one copy serves them all. */
async function page(req) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match("/");
  const network = fetch(req).then(
    (res) => {
      if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) cache.put("/", res.clone());
      return res;
    },
    () => null,
  );
  if (!saved) return (await network) || Response.error();
  // a slow connection is no better than none: show what is saved
  const slow = new Promise((resolve) => setTimeout(() => resolve(null), SLOW_MS));
  return (await Promise.race([network, slow])) || saved;
}

/** Slices a saved file for the Range requests that audio makes. */
async function slice(res, range) {
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const start = m[1] ? Number(m[1]) : Math.max(0, buf.byteLength - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

/** Built files have the hash in their name, so a saved one is never out of date. */
async function built(req) {
  const range = req.headers.get("range");
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(req.url);
  if (saved) return range ? slice(saved, range) : saved;
  try {
    const res = await fetch(req);
    if (!range) await store(ASSETS, req.url, res, ASSETS_MAX);
    return res;
  } catch {
    return Response.error();
  }
}

/** What is saved is shown at once and renewed in the background. */
async function freshen(req, name, max) {
  const cache = await caches.open(name);
  const saved = await cache.match(req);
  const network = fetch(req).then(
    (res) => {
      void store(name, req, res, max);
      return res;
    },
    () => null,
  );
  return saved || (await network) || Response.error();
}

/** What is saved is shown; only what was never seen is fetched. */
async function keepFirst(req, name, max) {
  const cache = await caches.open(name);
  const saved = await cache.match(req);
  if (saved) return saved;
  try {
    const res = await fetch(req);
    void store(name, req, res, max);
    return res;
  } catch {
    return Response.error();
  }
}
