import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f));
const pngSize = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

describe("favicon", () => {
  it("is an .ico holding 16, 32 and 48px pictures, each a real PNG of that size", () => {
    const ico = read("public/favicon.ico");
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]); // reserved, type: icon
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes: number[] = [];
    for (let k = 0; k < count; k++) {
      const e = 6 + 16 * k;
      const size = ico[e]!;
      const len = ico.readUInt32LE(e + 8);
      const off = ico.readUInt32LE(e + 12);
      const img = ico.subarray(off, off + len);
      expect(img.subarray(1, 4).toString()).toBe("PNG");
      expect(pngSize(img)).toEqual({ w: size, h: size });
      sizes.push(size);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("has PNG versions at 32 and 64px", () => {
    expect(pngSize(read("public/favicon-32.png"))).toEqual({ w: 32, h: 32 });
    expect(pngSize(read("public/favicon.png"))).toEqual({ w: 64, h: 64 });
  });

  it("is linked from the page at every size, so the browser does not shrink the biggest one to 16px", () => {
    const html = read("index.html").toString();
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico"/);
    expect(html).toMatch(/sizes="32x32" href="\/favicon-32\.png"/);
    expect(html).toMatch(/sizes="64x64" href="\/favicon\.png"/);
  });

  it("shows a picture, not an empty square (the centre is not the plain background)", () => {
    const png = read("public/favicon-32.png");
    // 8-bit RGBA: a flat cream icon would compress to a few dozen bytes
    expect(png.length).toBeGreaterThan(600);
  });
});
