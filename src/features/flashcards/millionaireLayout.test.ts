import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// run from the frontend folder or from the repository root
const file = ["src/flashcards.css", "frontend/src/flashcards.css"].map((f) => resolve(process.cwd(), f)).find(existsSync)!;
const css = readFileSync(file, "utf8");

// There is no browser in these tests, so the rules that make the game fit every screen are checked in the CSS itself.
const block = (query: string) => {
  const start = css.indexOf(query);
  expect(start, `${query} is in the stylesheet`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return "";
};

describe("the quiz game's layout follows the room it has", () => {
  it("measures its own width, so a sidebar beside it counts, and clips rather than scrolls", () => {
    expect(css).toMatch(/\.fc-mil \{[^}]*container-type: inline-size/);
    expect(css).toMatch(/\.fc-mil__stage \{[^}]*overflow: clip/);
  });
  it("drops the ladder for a row of dots, one column, when narrower than 700px", () => {
    const narrow = block("@container (max-width: 699px)");
    expect(narrow).toMatch(/\.fc-mil__stage \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(narrow).toMatch(/\.fc-mil__ladder \{ display: none/);
    expect(narrow).toMatch(/\.fc-mil__dots \{ display: flex/);
    expect(css).toMatch(/\.fc-mil__dots \{ display: none/);
  });
  it("stacks the four answers under 520px and tightens up under 400px", () => {
    expect(block("@container (max-width: 520px)")).toMatch(/\.fc-mil__answers \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(block("@container (max-width: 400px)")).toMatch(/\.fc-mil__bars/);
  });
  it("squeezes vertically on a phone held sideways", () => {
    expect(block("@media (max-height: 520px) {\n  .fc-mil__stage")).toMatch(/\.fc-mil__question/);
  });
  it("does not use the old viewport rule that left the ladder squeezed beside a sidebar", () => {
    expect(css).not.toMatch(/@media \(max-width: 760px\) \{\s*\.fc-mil__stage/);
  });
});
