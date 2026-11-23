import { PAGES, SITE_NAME, canonicalFor, lessonLabel, lessonMeta, type PageMeta } from "./seo";

/**
 * Build-time helpers: they turn the app's single index.html into one HTML file per public page, so a crawler or
 * a chat app that does not run JavaScript still reads that page's own title, description and share image.
 * Nothing here touches the DOM or the file system, which keeps it testable.
 */

/** A lesson as the sitemap and the static pages need to know it. */
export interface LessonRef {
  id: string;
  /** Whether it has a written part (vocabulary, grammar, reading) with its own page. */
  hasPaper: boolean;
}

export interface StaticPage {
  path: string;
  meta: PageMeta;
  breadcrumbs: { name: string; path: string }[];
  priority: number;
}

const PRIORITY: Record<string, number> = {
  "/": 1.0,
  "/lessons": 0.9,
  "/exams": 0.8,
  "/dictionary": 0.8,
  "/flashcards": 0.7,
  "/leaderboard": 0.5,
  "/pricing": 0.5,
  "/feedback": 0.3,
  "/donate": 0.3,
};

/** Every page worth indexing: the fixed pages, then each published exam and its written part. */
export function collectPages(lessons: LessonRef[]): StaticPage[] {
  const home = { name: SITE_NAME, path: "/" };
  const pages: StaticPage[] = Object.entries(PAGES).map(([path, meta]) => ({
    path,
    meta,
    breadcrumbs: path === "/" ? [home] : [home, { name: meta.title.split(" | ")[0], path }],
    priority: PRIORITY[path] ?? 0.4,
  }));
  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (!lesson.id || seen.has(lesson.id) || lesson.id.startsWith("fixture")) continue;
    seen.add(lesson.id);
    const base = `/lessons/${encodeURIComponent(lesson.id)}`;
    const crumbs = [home, { name: "Thư viện đề thi", path: "/lessons" }, { name: lessonLabel(lesson.id), path: base }];
    pages.push({ path: base, meta: lessonMeta(lesson.id), breadcrumbs: crumbs, priority: 0.6 });
    if (lesson.hasPaper) {
      pages.push({
        path: `${base}/paper`,
        meta: lessonMeta(lesson.id, true),
        breadcrumbs: [...crumbs, { name: "Từ vựng, Ngữ pháp, Đọc hiểu", path: `${base}/paper` }],
        priority: 0.5,
      });
    }
  }
  return pages;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Replaces one tag. A missing tag is an error, so a change to index.html cannot silently drop a page's SEO. */
function replaceTag(html: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: ${what} not found in index.html`);
  return html.replace(pattern, () => replacement);
}

function metaTag(html: string, attr: "name" | "property", key: string, value: string): string {
  const pattern = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`);
  return replaceTag(html, pattern, `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`, `meta ${key}`);
}

/** The index.html template with one page's own head tags (and breadcrumb data) filled in. */
export function renderPage(template: string, page: StaticPage): string {
  const url = canonicalFor(page.path);
  const { title, description } = page.meta;
  let html = template;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`, "title");
  html = metaTag(html, "name", "description", description);
  html = replaceTag(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeAttr(url)}" />`, "canonical link");
  html = metaTag(html, "property", "og:title", title);
  html = metaTag(html, "property", "og:description", description);
  html = metaTag(html, "property", "og:url", url);
  html = metaTag(html, "name", "twitter:title", title);
  html = metaTag(html, "name", "twitter:description", description);
  if (page.breadcrumbs.length > 1) {
    const data = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: page.breadcrumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: canonicalFor(c.path),
      })),
    };
    // "<" is escaped so no value can close the script element early
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    html = replaceTag(html, /<\/head>/, `    <script type="application/ld+json">${json}</script>\n  </head>`, "closing head tag");
  }
  return html;
}

/** sitemap.xml for the given pages; the home page is always first. */
export function buildSitemap(pages: StaticPage[]): string {
  const rows = pages.map((p) => `  <url><loc>${escapeXml(canonicalFor(p.path))}</loc><priority>${p.priority.toFixed(1)}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

/** Where a page's HTML file goes inside the build folder: "/lessons" -> "lessons/index.html". */
export function fileFor(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/index.html` : "index.html";
}
