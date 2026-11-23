import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSitemap, collectPages, fileFor, renderPage, type StaticPage } from "./prerender";

const template = readFileSync("index.html", "utf8");

const lessonPage = (id: string, paper = false): StaticPage => {
  const pages = collectPages([{ id, hasPaper: true }]);
  return pages.find((p) => p.path === `/lessons/${id}${paper ? "/paper" : ""}`)!;
};

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("collectPages", () => {
  it("lists the fixed pages and every exam, with its written part only when it has one", () => {
    const pages = collectPages([
      { id: "jlpt-n2-2025-12", hasPaper: true },
      { id: "jlpt-n3-2026-07", hasPaper: false },
    ]);
    const paths = pages.map((p) => p.path);
    expect(paths[0]).toBe("/");
    expect(paths).toContain("/lessons");
    expect(paths).toContain("/dictionary");
    expect(paths).toContain("/lessons/jlpt-n2-2025-12");
    expect(paths).toContain("/lessons/jlpt-n2-2025-12/paper");
    expect(paths).toContain("/lessons/jlpt-n3-2026-07");
    expect(paths).not.toContain("/lessons/jlpt-n3-2026-07/paper");
  });

  it("skips test fixtures, repeated ids and blank ids", () => {
    const paths = collectPages([
      { id: "fixture-sample-1", hasPaper: true },
      { id: "jlpt-n1-2024-07", hasPaper: false },
      { id: "jlpt-n1-2024-07", hasPaper: false },
      { id: "", hasPaper: false },
    ]).map((p) => p.path);
    expect(paths.filter((p) => p === "/lessons/jlpt-n1-2024-07")).toHaveLength(1);
    expect(paths.some((p) => p.includes("fixture"))).toBe(false);
  });

  it("never lists a page that search engines are told to skip", () => {
    const pages = collectPages([{ id: "jlpt-n2-2025-12", hasPaper: true }]);
    expect(pages.every((p) => !p.meta.noindex)).toBe(true);
  });
});

describe("renderPage", () => {
  it("gives an exam's page its own title, description, canonical link and share tags", () => {
    const html = renderPage(template, lessonPage("jlpt-n2-2025-12"));
    expect(html).toContain("<title>Đề thi JLPT N2 tháng 12/2025: phần Nghe hiểu có đáp án | Kaitiq</title>");
    expect(html).toContain('<link rel="canonical" href="https://kaitiq.vn/lessons/jlpt-n2-2025-12" />');
    expect(html).toContain('<meta property="og:url" content="https://kaitiq.vn/lessons/jlpt-n2-2025-12" />');
    expect(html).toMatch(/<meta name="description" content="Làm lại đề thi JLPT N2 tháng 12\/2025/);
    expect(html).toMatch(/<meta property="og:title" content="Đề thi JLPT N2 tháng 12\/2025/);
    expect(html).toMatch(/<meta name="twitter:title" content="Đề thi JLPT N2 tháng 12\/2025/);
    // the home page's own text must be gone, and each tag must appear once
    expect(html).not.toContain("<title>Kaitiq: luyện thi JLPT bằng đề thật, từ điển và flashcard</title>");
    expect(count(html, 'rel="canonical"')).toBe(1);
    expect(count(html, 'property="og:title"')).toBe(1);
  });

  it("keeps everything else of index.html, including the app's script and the share image", () => {
    const html = renderPage(template, lessonPage("jlpt-n2-2025-12"));
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).toContain("https://kaitiq.vn/og-image.png");
    expect(html).toContain('"@type": "Organization"');
  });

  it("adds breadcrumb data to an exam page and leaves it off pages with no trail", () => {
    const html = renderPage(template, lessonPage("jlpt-n2-2025-12", true));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const crumbs = ld.map((t) => JSON.parse(t)).find((d) => d["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual([
      "Kaitiq",
      "Thư viện đề thi",
      "JLPT N2 12/2025",
      "Từ vựng, Ngữ pháp, Đọc hiểu",
    ]);
    expect(crumbs.itemListElement[3].item).toBe("https://kaitiq.vn/lessons/jlpt-n2-2025-12/paper");
    const home = renderPage(template, { path: "/", meta: { title: "t", description: "d" }, breadcrumbs: [{ name: "Kaitiq", path: "/" }], priority: 1 });
    expect(home).not.toContain("BreadcrumbList");
  });

  it("escapes characters that would break a tag", () => {
    const html = renderPage(template, {
      path: "/lessons",
      meta: { title: 'A "quoted" <title> & more', description: 'say "hi" & <b>' },
      breadcrumbs: [{ name: "Kaitiq", path: "/" }],
      priority: 0.5,
    });
    expect(html).toContain('content="say &quot;hi&quot; &amp; &lt;b&gt;"');
    expect(html).toContain("<title>A &quot;quoted&quot; &lt;title&gt; &amp; more</title>");
  });

  it("fails loudly when index.html lacks a tag it has to fill in", () => {
    const broken = template.replace(/<link\s+rel="canonical"[^>]*>/, "");
    expect(() => renderPage(broken, lessonPage("jlpt-n2-2025-12"))).toThrow(/canonical/);
  });

  it("also fills in the fixed pages", () => {
    const page = collectPages([]).find((p) => p.path === "/dictionary")!;
    const html = renderPage(template, page);
    expect(html).toContain('<link rel="canonical" href="https://kaitiq.vn/dictionary" />');
    expect(html).toContain("<title>Từ điển Nhật - Việt");
  });
});

describe("buildSitemap", () => {
  it("lists the home page first, then every page once, as valid XML text", () => {
    const xml = buildSitemap(collectPages([{ id: "jlpt-n2-2025-12", hasPaper: true }]));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs[0]).toBe("https://kaitiq.vn/");
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs).toContain("https://kaitiq.vn/lessons/jlpt-n2-2025-12");
    expect(locs).toContain("https://kaitiq.vn/lessons/jlpt-n2-2025-12/paper");
    expect(xml).toContain("<priority>1.0</priority>");
  });

  it("escapes the characters XML reserves", () => {
    const xml = buildSitemap([{ path: "/a&b", meta: { title: "t", description: "d" }, breadcrumbs: [], priority: 0.5 }]);
    expect(xml).toContain("<loc>https://kaitiq.vn/a&amp;b</loc>");
  });
});

describe("fileFor", () => {
  it("puts each page in its own folder", () => {
    expect(fileFor("/")).toBe("index.html");
    expect(fileFor("/lessons")).toBe("lessons/index.html");
    expect(fileFor("/lessons/jlpt-n2-2025-12/paper")).toBe("lessons/jlpt-n2-2025-12/paper/index.html");
  });
});
