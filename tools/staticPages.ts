import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { buildSitemap, collectPages, fileFor, renderPage, type LessonRef } from "../src/shared/seo/prerender";

const ATTEMPTS = 3;
const TIMEOUT_MS = 45_000;

/**
 * The exams to list: from the API (a URL; the first call may wake a sleeping server, hence the patience)
 * or from a saved JSON file, in the shape of GET /api/content/lessons.
 */
async function loadLessons(source: string): Promise<LessonRef[]> {
  if (!source) return [];
  let body: unknown;
  if (/^https?:\/\//.test(source)) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await fetch(source, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = await res.json();
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) throw lastError;
  } else {
    body = JSON.parse(readFileSync(source, "utf8"));
  }
  const rows = (body as { lessons?: { id?: unknown; paper?: unknown }[] })?.lessons;
  if (!Array.isArray(rows)) throw new Error("no 'lessons' list in the response");
  return rows
    .filter((r): r is { id: string; paper?: unknown } => typeof r?.id === "string")
    .map((r) => ({ id: r.id, hasPaper: Boolean(r.paper) }));
}

/**
 * After the build, writes one HTML file per public page (each with its own title, description, canonical link,
 * share tags and breadcrumb data) and a sitemap listing every exam. The app itself is unchanged: these files are
 * the same index.html with different head tags, and the browser takes over from there.
 * If the exams cannot be fetched, the fixed pages are still written and the build goes on.
 */
export function staticPages(opts: { lessonsSource: string }): Plugin {
  let outDir = "dist";
  return {
    name: "static-pages",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      let template: string;
      try {
        template = readFileSync(path.join(outDir, "index.html"), "utf8");
      } catch {
        return; // nothing was built
      }

      let lessons: LessonRef[] = [];
      try {
        lessons = await loadLessons(opts.lessonsSource);
        console.log(`[static-pages] ${lessons.length} exam(s) from ${opts.lessonsSource || "(no source)"}`);
      } catch (e) {
        console.warn(`[static-pages] could not load the exams (${(e as Error).message}); writing the fixed pages only`);
      }

      const pages = collectPages(lessons);
      let written = 0;
      for (const page of pages) {
        if (page.path === "/") continue; // index.html is the home page already
        const file = path.join(outDir, fileFor(page.path));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, renderPage(template, page));
        written++;
      }
      writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(pages));
      console.log(`[static-pages] wrote ${written} page(s) and sitemap.xml (${pages.length} URLs)`);
    },
  };
}
