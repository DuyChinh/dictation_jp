import { beforeEach, describe, expect, it } from "vitest";
import { clickContext, rangeForMatch } from "./textContext";

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}
const textOf = (el: Element, i = 0) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode() as Text;
  for (let k = 0; k < i; k++) n = walker.nextNode() as Text;
  return n;
};

describe("clickContext", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("gives the clicked character as a code-point offset into the nearby text", () => {
    const p = mount("<p>私は毎日学校で日本語を勉強しました。</p>");
    const ctx = clickContext(textOf(p), 12)!;
    expect([...ctx.text][ctx.offset]).toBe("強");
  });

  it("joins text split across inline elements, so a word broken by markup stays whole", () => {
    const p = mount("<p>昨日<u>食べ</u>ませんでした</p>");
    const ctx = clickContext(textOf(p, 1), 1)!;
    expect(ctx.text).toBe("昨日食べませんでした");
    expect([...ctx.text][ctx.offset]).toBe("べ");
  });

  it("ignores furigana", () => {
    const p = mount("<p><ruby>学校<rt>がっこう</rt></ruby>に行く</p>");
    const ctx = clickContext(textOf(p, 2), 0)!;
    expect(ctx.text).toBe("学校に行く");
    expect([...ctx.text][ctx.offset]).toBe("に");
  });

  it("counts characters outside the BMP as one", () => {
    const p = mount("<p>𠮟られた</p>");
    const ctx = clickContext(textOf(p), 2)!;
    expect([...ctx.text][ctx.offset]).toBe("ら");
  });

  it("returns null past the end of the text", () => {
    const p = mount("<p>食べる</p>");
    expect(clickContext(textOf(p), 3)).toBeNull();
  });
});

describe("rangeForMatch", () => {
  it("covers a word even when it spans several text nodes", () => {
    const p = mount("<p>昨日<u>食べ</u>ませんでした</p>");
    const ctx = clickContext(textOf(p, 1), 0)!;
    const range = rangeForMatch(ctx, 2, 8)!;
    expect(range.toString()).toBe("食べませんでした");
  });

  it("finds the right place when the sent text starts mid-block", () => {
    const long = "あ".repeat(20) + "学校に行きました";
    const p = mount(`<p>${long}</p>`);
    const ctx = clickContext(textOf(p), 22)!;
    expect(ctx.blockStart).toBeGreaterThan(0);
    const start = [...ctx.text].indexOf("学");
    expect(rangeForMatch(ctx, start, 2)!.toString()).toBe("学校");
  });
});
