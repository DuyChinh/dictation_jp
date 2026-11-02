import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../i18n/UiLanguageContext";
import { pickJapaneseVoice } from "../audio/speech";
import { SpeakButton } from "./SpeakButton";

const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
const kyoko = voice("Kyoko", "ja-JP");

let voices: SpeechSynthesisVoice[];
const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  voices = [voice("Samantha", "en-US"), kyoko];
  speak.mockReset();
  cancel.mockReset();
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      voice: unknown;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { getVoices: () => voices, speak, cancel, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error removing the stub
  delete window.speechSynthesis;
});

const renderButton = (text = "ひま") =>
  render(
    <UiLanguageProvider>
      <SpeakButton text={text} />
    </UiLanguageProvider>,
  );

describe("SpeakButton", () => {
  it("reads the text aloud with the Japanese voice", () => {
    renderButton("ひま");
    fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm" }));
    expect(speak).toHaveBeenCalledTimes(1);
    const u = speak.mock.calls[0]![0] as { text: string; voice: unknown; lang: string };
    expect(u.text).toBe("ひま");
    expect(u.voice).toBe(kyoko);
    expect(u.lang).toBe("ja-JP");
  });

  it("stops when pressed again while reading", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Nghe phát âm" });
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("is not offered when the device has no Japanese voice", () => {
    voices = [voice("Samantha", "en-US")];
    renderButton();
    expect(screen.queryByRole("button", { name: "Nghe phát âm" })).toBeNull();
  });

  it("is not offered when the browser cannot speak at all", () => {
    // @ts-expect-error removing the stub
    delete window.speechSynthesis;
    renderButton();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("pickJapaneseVoice", () => {
  it("takes a Japanese voice, a natural-sounding one first, and none when there is no Japanese", () => {
    const plain = voice("Some Voice", "ja_JP");
    expect(pickJapaneseVoice([voice("Samantha", "en-US"), plain, kyoko])).toBe(kyoko);
    expect(pickJapaneseVoice([voice("Samantha", "en-US"), plain])).toBe(plain);
    expect(pickJapaneseVoice([voice("Samantha", "en-US")])).toBeNull();
  });
});
