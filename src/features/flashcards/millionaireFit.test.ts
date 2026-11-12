import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = ["src/millionaire.css", "frontend/src/millionaire.css"].map((f) => resolve(process.cwd(), f)).find(existsSync)!;
const css = readFileSync(file, "utf8");

/** The text of the `{ ... }` that follows `query`. */
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

// There is no browser in these tests, so the rules that keep the game inside the window are checked in the CSS itself.
describe("the quiz game fits the window without scrolling", () => {
  it("shares what is left of the window's height between the question and the answers, and sizes the ladder from them", () => {
    const root = block(".fc-mil {");
    expect(root).toMatch(/--mil-room: max\(0px, calc\(100dvh - \d+px\)\)/);
    expect(root).toMatch(/--mil-q: clamp\([^;]*var\(--mil-room\)/);
    expect(root).toMatch(/--mil-a: clamp\([^;]*var\(--mil-room\)/);
    expect(root).toMatch(/--mil-rung: clamp\([^;]*var\(--mil-q\)[^;]*var\(--mil-a\)/);
  });

  it("uses those sizes for the question, the answers and the rungs of the ladder", () => {
    expect(css).toMatch(/\.fc-mil__question \{[^}]*min-height: var\(--mil-q\)/);
    expect(css).toMatch(/\.fc-mil__ans \{[^}]*min-height: var\(--mil-a\)/);
    expect(css).toMatch(/\.fc-mil__ladder li \{[^}]*min-height: var\(--mil-rung\)/);
  });

  it("no longer forces a tall studio on wide screens", () => {
    expect(css).not.toMatch(/min-width: 1100px/);
    expect(css).not.toMatch(/min-height: 590px/);
    expect(css).not.toMatch(/\.fc-mil__question \{[^}]*min-height: 1[6-9]\dpx/);
  });

  it("gives each answer less of the height when they stack in one column", () => {
    const narrow = block("@container (max-width: 699px)");
    expect(narrow).toMatch(/--mil-room: max\(0px, calc\(100dvh - 350px\)\)/);
    expect(narrow).toMatch(/--mil-a: clamp\(44px/);
    expect(narrow).toMatch(/\.fc-mil__brand > div > span \{ display: none/);
  });

  it("hides the settings above the game while it is on, but not on the start and result screens", () => {
    expect(css).toMatch(/\.fc-page--millionaire:has\(\.fc-mil__stage\) > \.fc-pickers \{ display: none; \}/);
    // those two screens are not the stage, so the rule does not reach them
    expect(css).not.toMatch(/:has\([^)]*(fc-mil-start|fc-mil-result)/);
  });

  it("lets the boxes laid over a short game scroll instead of being cut off", () => {
    expect(css).toMatch(/\.fc-mil__popup \{ overflow-y: auto; justify-content: safe center; \}/);
    const games = readFileSync(resolve(file, "..", "flashgames.css"), "utf8");
    expect(games).toMatch(/\.fc-mil__milestone \{[^}]*display: flex; overflow-y: auto/);
    expect(games).toMatch(/\.fc-mil__cheque \{[^}]*margin: auto/);
  });

  it("keeps the show's emblem sized in the brand row, the start screen and the mode list", () => {
    expect(css).toMatch(/\.fc-mil__brand-mark \.icon-logo \{[^}]*width: 100%/);
    expect(css).toMatch(/\.fc-mil-start__logo/);
    expect(css).toMatch(/\.fc-mode > \.icon-logo \{[^}]*width: 40px/);
  });
});
