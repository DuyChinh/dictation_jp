import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { CardEditor } from "./CardEditor";
import { findTermDuplicate } from "./store";
import type { Card } from "./types";

vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: vi.fn(async () => ({ results: [] })),
  lookupWord: vi.fn(async () => null),
}));

const card = (extra: Partial<Card> = {}): Card =>
  ({ id: "c1", deckId: "d1", term: "食べる", termLang: "ja", definition: "ăn", definitionLang: "vi", createdAt: 1, updatedAt: 1, ...extra }) as Card;

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("findTermDuplicate", () => {
  it("finds a live card with the same term in that deck only", () => {
    const cards = [card(), card({ id: "c2", deckId: "d2" }), card({ id: "c3", term: "飲む", deleted: true })];
    expect(findTermDuplicate(cards, "d1", " 食べる ")?.id).toBe("c1");
    expect(findTermDuplicate(cards, "d2", "食べる")?.id).toBe("c2");
    expect(findTermDuplicate(cards, "d1", "飲む")).toBeUndefined();
    expect(findTermDuplicate(cards, "d1", "")).toBeUndefined();
  });
});

describe("CardEditor term warning", () => {
  const renderEditor = () =>
    render(
      <UiLanguageProvider>
        <MemoryRouter>
          <CardEditor submitLabel="Add" onSubmit={() => undefined} duplicateOf={(t) => (t === "食べる" ? card() : undefined)} />
        </MemoryRouter>
      </UiLanguageProvider>,
    );

  it("marks the term box yellow with a note under it when the word is already in the deck", () => {
    renderEditor();
    const box = document.querySelector("textarea.fc-input")!;
    expect(document.querySelector(".fc-field__warn")).toBeNull();
    fireEvent.change(box, { target: { value: "食べる" } });
    expect(box.className).toContain("is-warn");
    expect(document.querySelector(".fc-field__warn")!.textContent).toContain("ăn");
    expect(box.getAttribute("aria-describedby")).toBe(document.querySelector(".fc-field__warn")!.id);
    fireEvent.change(box, { target: { value: "飲む" } });
    expect(box.className).not.toContain("is-warn");
    expect(document.querySelector(".fc-field__warn")).toBeNull();
    expect(screen.queryByRole("status", { name: /ăn/ })).toBeNull();
  });
});
