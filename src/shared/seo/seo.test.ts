import { describe, expect, it } from "vitest";
import { applyMeta, canonicalFor, metaFor } from "./seo";

describe("seo", () => {
  it("gives each public page its own title and lets search engines index it", () => {
    for (const path of ["/", "/lessons", "/exams", "/dictionary", "/flashcards"]) {
      const m = metaFor(path);
      expect(m.noindex).toBeFalsy();
      expect(m.description.length).toBeGreaterThan(40);
    }
    expect(metaFor("/lessons").title).not.toBe(metaFor("/dictionary").title);
  });

  it("keeps account, admin and private pages out of search results", () => {
    for (const path of ["/admin", "/admin/users", "/auth", "/auth/forgot-password", "/profile", "/history", "/exams/history", "/flashcards/abc", "/nonsense"]) {
      expect(metaFor(path).noindex).toBe(true);
    }
  });

  it("builds the canonical address without a trailing slash", () => {
    expect(canonicalFor("/")).toBe("https://kaitiq.vn/");
    expect(canonicalFor("/lessons/")).toBe("https://kaitiq.vn/lessons");
  });

  it("writes the tags into the document head", () => {
    applyMeta("/dictionary");
    expect(document.title).toContain("Từ điển");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://kaitiq.vn/dictionary");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    applyMeta("/profile");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });
});
