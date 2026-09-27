import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./videoLinks";

describe("parseVideoUrl", () => {
  const yt = { provider: "youtube", id: "dQw4w9WgXcQ" };

  it("reads the common YouTube link shapes", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toEqual(yt);
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(yt);
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(yt);
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual(yt);
    expect(parseVideoUrl("  https://www.youtube.com/embed/dQw4w9WgXcQ  ")).toEqual(yt);
  });

  it("reads Google Drive share links", () => {
    const drive = { provider: "drive", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345" };
    expect(parseVideoUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing")).toEqual(drive);
    expect(parseVideoUrl("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toEqual(drive);
  });

  it("rejects everything else", () => {
    expect(parseVideoUrl("not a url")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/123456")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/@channel")).toBeNull();
    expect(parseVideoUrl("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
