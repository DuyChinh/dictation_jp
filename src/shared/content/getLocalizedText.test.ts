import { describe, expect, it } from "vitest";
import { getLocalizedText } from "./getLocalizedText";

describe("getLocalizedText", () => {
  it("prefers requested lang then fallbacks vi → en → ja", () => {
    const obj = { ja: "日本", vi: "Việt", en: "English" };
    expect(getLocalizedText(obj, "en")).toBe("English");
    expect(getLocalizedText(obj, "vi")).toBe("Việt");
    expect(getLocalizedText({ ja: "日本" }, "vi")).toBe("日本");
    expect(getLocalizedText({ en: "En only" }, "vi")).toBe("En only");
  });

  it("returns empty for null/empty", () => {
    expect(getLocalizedText(null, "vi")).toBe("");
    expect(getLocalizedText({ vi: "  " }, "vi")).toBe("");
    expect(getLocalizedText("plain", "ja")).toBe("plain");
  });
});
