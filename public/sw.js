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
const SHELL = "kaitiq-shell-v1";
const ASSETS = "kaitiq-assets-v1";
const STATIC = "kaitiq-static-v4"; // bumped with a new logo or favicon, so installed copies drop the old pictures at once
const FONTS = "kaitiq-fonts-v1";
const PICS = "kaitiq-pics-v1";
const CURRENT = [SHELL, ASSETS, STATIC, FONTS, PICS];

const ASSETS_MAX = 400;
const STATIC_MAX = 120;
const PICS_MAX = 80;
const SLOW_MS = 4000;
const WARM = ["/favicon-32x32.png", "/logo-192.png", "/apple-touch-icon.png", "/millionaire/logo.webp", "/miner/miner-cut.webp"];

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
      // "motto-" caches belong to the app's former name; no release uses them any more.
      for (const name of await caches.keys()) {
        if ((name.startsWith("kaitiq-") && !CURRENT.includes(name)) || name.startsWith("motto-")) await caches.delete(name);
      }
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

/** `copy` must be a clone taken before the response was handed to the page: a body can only be read once. */
async function store(name, req, copy, max) {
  // a picture from another site arrives "opaque" (status 0), which can still be kept and shown
  if (!copy || !(copy.ok || copy.type === "opaque")) return;
  const cache = await caches.open(name);
  await cache.put(req, copy);
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
    if (!range) await store(ASSETS, req.url, res.clone(), ASSETS_MAX);
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
      // cloned now, before the page starts reading the body, and stored in the background
      void store(name, req, res.clone(), max).catch(() => undefined);
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
    void store(name, req, res.clone(), max).catch(() => undefined);
    return res;
  } catch {
    return Response.error();
  }
}

/*
 * Reminders: the server sends a push when flashcards are due for review ({ title, body, url, tag }).
 * Tapping it opens (or focuses) the site at that address.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Kaitiq";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/apple-touch-icon.png",
      badge: "/favicon-32x32.png",
      tag: typeof data.tag === "string" ? data.tag : "review-due",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/flashcards" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/flashcards", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
