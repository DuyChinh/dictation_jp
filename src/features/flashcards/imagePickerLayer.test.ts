import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (name: string) => readFileSync([`src/${name}`, `frontend/src/${name}`].map((f) => resolve(process.cwd(), f)).find(existsSync)!, "utf8");

/** The z-index of the rule for `selector` (the first one that sets it). */
function zIndex(css: string, selector: string): number {
  const rule = new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(rule)) {
    const z = /z-index:\s*(\d+)/.exec(m[1]!);
    if (z) return Number(z[1]);
  }
  throw new Error(`${selector} sets no z-index`);
}

// There is no browser in these tests, so the stacking order is checked in the stylesheets themselves.
describe("the picture picker is on top of whatever it is opened from", () => {
  const picker = zIndex(read("flashimages.css"), ".fc-imgpick-modal");

  it("is above the select-to-create panel and its button, where a word's picture is chosen from", () => {
    const flash = read("flashcards.css");
    expect(picker).toBeGreaterThan(zIndex(flash, ".fc-selpanel"));
    expect(picker).toBeGreaterThan(zIndex(flash, ".fc-selbtn"));
  });

  it("is above the dictionary popup, where it can also be opened from", () => {
    expect(picker).toBeGreaterThan(zIndex(read("dictionary.css"), ".dict-popup"));
  });

  it("is above the card edit box and the undo bar", () => {
    const flash = read("flashcards.css");
    expect(picker).toBeGreaterThan(zIndex(flash, ".fc-modal"));
    expect(picker).toBeGreaterThan(zIndex(flash, ".fc-undo"));
  });
});
