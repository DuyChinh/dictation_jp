import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f));
const exists = (f: string) => fs.existsSync(path.join(root, f));
const pngSize = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

describe("site icons", () => {
  it("favicon.ico holds the 16, 32 and 48px pictures", () => {
    const ico = read("public/favicon.ico");
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]); // reserved, type: icon
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, k) => ico[6 + 16 * k]!);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("has the PNG icons at their sizes", () => {
    for (const [file, size] of [
      ["favicon-16x16.png", 16],
      ["favicon-32x32.png", 32],
      ["apple-touch-icon.png", 180],
      ["android-chrome-192x192.png", 192],
      ["android-chrome-512x512.png", 512],
    ] as const) {
      expect(pngSize(read(`public/${file}`)), file).toEqual({ w: size, h: size });
    }
  });

  it("links every size from the page, so the browser does not shrink a big one to 16px", () => {
    const html = read("index.html").toString();
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico"/);
    expect(html).toMatch(/sizes="32x32" href="\/favicon-32x32\.png"/);
    expect(html).toMatch(/sizes="16x16" href="\/favicon-16x16\.png"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  });

  it("lists the app icons in the manifest, and every file it names exists", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest").toString()) as { icons: Array<{ src: string; sizes: string }> };
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) expect(exists(`public${icon.src}`), icon.src).toBe(true);
  });

  it("no longer ships the old favicon files or the unpacked download", () => {
    for (const gone of ["favicon.png", "favicon-32.png", "favicon_io", "favicon_io.zip"]) expect(exists(`public/${gone}`), gone).toBe(false);
  });

  it("the service worker only names icons that exist", () => {
    const sw = read("public/sw.js").toString();
    const named = [...sw.matchAll(/"(\/[\w.-]+\.(?:png|ico))"/g)].map((m) => m[1]!);
    expect(named).toEqual(expect.arrayContaining(["/favicon-32x32.png", "/apple-touch-icon.png"]));
    for (const file of named) expect(exists(`public${file}`), file).toBe(true);
  });
});
