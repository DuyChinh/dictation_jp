import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { DictEntry } from "../../shared/api/dictionary";
import type { ImageHit } from "../../shared/api/images";
import { CardEditor } from "./CardEditor";
import { CardRow } from "./CardRow";
import { EntryImageButton } from "./EntryImageButton";
import { ImagePicker } from "./ImagePicker";
import { ImagesPicker } from "./ImagesPicker";
import { SideView } from "./SideView";
import { StudyModes } from "./StudyModes";
import { creditText, imageKeywordsFrom, imageKeywordsFromEntry, imageQueryFrom, isAllowedImage, toCardImage } from "./cardImage";
import { showImages } from "./prefs";
import { sidesOf } from "./quiz";
import { addCard, createDeck, importSharedDeck, readState, updateCard } from "./store";
import type { Card, CardImage } from "./types";

const searchImages = vi.fn();
vi.mock("../../shared/api/images", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/images")>()),
  searchImages: (...a: unknown[]) => searchImages(...a),
}));
const searchDictionary = vi.fn();
vi.mock("../../shared/api/dictionary", async (orig) => ({
  ...(await orig<typeof import("../../shared/api/dictionary")>()),
  searchDictionary: (...a: unknown[]) => searchDictionary(...a),
  lookupWord: vi.fn(async () => null),
}));

const OV = (id: string): CardImage => ({ url: `https://api.openverse.org/v1/images/${id}/thumb/`, page: `https://openverse.org/image/${id}`, by: "Mathias Appel", lic: "CC0" });
const hit = (id: string, extra: Partial<ImageHit> = {}): ImageHit => ({ ...OV(id), title: `dog ${id}`, source: "openverse", ...extra });
const HITS = [hit("aaa"), hit("bbb", { by: "Sean MacEntee", lic: "CC BY 2.0" }), hit("ccc", { source: "wikimedia" })];
const answer = (hits: ImageHit[] = HITS, partial = false) => searchImages.mockResolvedValue({ query: "x", results: hits, partial });

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <UiLanguageProvider>{ui}</UiLanguageProvider>
  </MemoryRouter>
);

const TABERU: DictEntry = {
  id: 1,
  common: true,
  jlpt: 5,
  kanji: [{ text: "食べる", common: true, tags: [] }],
  kana: [{ text: "たべる", common: true, tags: [], appliesToKanji: null }],
  senses: [{ pos: ["v1"], field: [], misc: [], info: [], appliesToKanji: null, appliesToKana: null, glosses: ["to eat", "to have a meal"], vi: ["ăn"], examples: [] }],
  viSource: "ai",
};

const card = (extra: Partial<Card> = {}): Card => ({
  id: "c1", deckId: "d", term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", box: 0, due: 0, right: 0, wrong: 0, createdAt: 1, updatedAt: 1, ...extra,
});

beforeEach(() => {
  localStorage.clear();
  searchImages.mockReset();
  searchDictionary.mockReset();
  searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries: [], kanji: [] });
});
afterEach(() => cleanup());

describe("picture references on the page", () => {
  it("accepts only Openverse and Wikimedia Commons", () => {
    expect(isAllowedImage(OV("aaa"))).toBe(true);
    // Commons' own search answers with thumb.wikimedia.org addresses
    expect(isAllowedImage({ url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/D.jpg/400px-D.jpg" })).toBe(true);
    expect(isAllowedImage({ url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/D.jpg/400px-D.jpg" })).toBe(true);
    for (const url of ["https://evil.example/p.gif", "http://api.openverse.org/x", "https://api.openverse.org.evil.example/x", "https://u:p@api.openverse.org/x", "javascript:alert(1)", "data:image/png;base64,AAAA", "not a url"]) {
      expect(isAllowedImage({ url }), url).toBe(false);
    }
    expect(isAllowedImage(undefined)).toBe(false);
  });

  it("keeps only what a card needs from a search result", () => {
    expect(toCardImage(hit("aaa"))).toEqual(OV("aaa"));
    expect(toCardImage({ url: OV("aaa").url, source: "wikimedia" })).toEqual({ url: OV("aaa").url });
    expect(creditText(OV("aaa"))).toBe("Mathias Appel · CC0");
    expect(creditText({ url: "x" })).toBe("");
  });

  it("looks for the first meaning, without brackets or a leading 'to'", () => {
    expect(imageQueryFrom("to eat; to have a meal")).toBe("eat");
    expect(imageQueryFrom("(sl) cool; (a) cute thing")).toBe("cool");
    expect(imageQueryFrom("the sea, ocean")).toBe("sea");
    expect(imageQueryFrom("  an   apple ")).toBe("apple");
    expect(imageQueryFrom("")).toBe("");
    expect(imageQueryFrom("x".repeat(100))).toHaveLength(60);
  });

  it("leaves out 'be' as well, which says nothing a picture could show", () => {
    expect(imageQueryFrom("be convinced")).toBe("convinced");
    expect(imageQueryFrom("to be sure; to be certain")).toBe("sure");
    expect(imageQueryFrom("beautiful")).toBe("beautiful");
    expect(imageQueryFrom("bean")).toBe("bean");
  });

  it("offers every meaning as something else to look for, once each", () => {
    expect(imageKeywordsFrom(["to eat", "to have a meal", "Eat", "(sl) to live on"])).toEqual(["eat", "have a meal", "live on"]);
    expect(imageKeywordsFrom([])).toEqual([]);
    expect(imageKeywordsFrom(["x".repeat(41), "dog"])).toEqual(["dog"]);
    expect(imageKeywordsFrom(Array.from({ length: 20 }, (_, i) => `word${i}`))).toHaveLength(8);
  });

  it("adds 'person …' for a verb, since a verb alone finds animals and objects, but not for other words", () => {
    expect(imageKeywordsFrom(["to eat", "to have a meal"], { verb: true })).toEqual(["eat", "have a meal", "person eat"]);
    expect(imageKeywordsFrom(["dog"], { verb: false })).toEqual(["dog"]);
    expect(imageKeywordsFrom(["person"], { verb: true })).toEqual(["person"]);
  });

  it("reads them from a dictionary entry, every sense, and knows a verb by its word class", () => {
    expect(imageKeywordsFromEntry(TABERU)).toEqual(["eat", "have a meal", "person eat"]);
    const noun = { ...TABERU, senses: [{ ...TABERU.senses[0]!, pos: ["n"], glosses: ["dog"] }, { ...TABERU.senses[0]!, pos: ["n"], glosses: ["canine", "dog"] }] };
    expect(imageKeywordsFromEntry(noun)).toEqual(["dog", "canine"]);
  });
});

describe("a picture goes with the question", () => {
  it("is on the asked side, whichever side that is, and never on the answer", () => {
    const c = card({ image: OV("aaa") });
    expect(sidesOf(c).prompt.image).toEqual(OV("aaa"));
    expect(sidesOf(c).answer.image).toBeUndefined();
    expect(sidesOf(c, true).prompt).toMatchObject({ text: "chó", image: OV("aaa") });
    expect(sidesOf(c, true).answer.image).toBeUndefined();
    expect(sidesOf(card()).prompt.image).toBeUndefined();
  });

  it("is drawn with a question and left out of choices, lists and when it is switched off", () => {
    const side = sidesOf(card({ image: OV("aaa") })).prompt;
    const { container, rerender } = render(wrap(<SideView side={side} big />));
    expect(container.querySelector(".fc-side__pic img")!.getAttribute("src")).toBe(OV("aaa").url);
    expect(container.querySelector(".fc-side__credit")!.textContent).toBe("Mathias Appel · CC0");
    // an alt of its own would read the picture out before every question
    expect(container.querySelector(".fc-side__pic img")!.getAttribute("alt")).toBe("");

    rerender(wrap(<SideView side={side} />));
    expect(container.querySelector(".fc-side__pic")).toBeNull();

    localStorage.setItem("jd.flash_images.v1", "off");
    rerender(wrap(<SideView side={side} big />));
    expect(container.querySelector(".fc-side__pic")).toBeNull();
  });

  it("is shown unless turned off, and the choice is kept", () => {
    expect(showImages()).toBe(true);
    const onChange = vi.fn();
    render(wrap(<ImagesPicker value onChange={onChange} />));
    const group = screen.getByRole("radiogroup", { name: "Hình ảnh" });
    expect(within(group).getByRole("radio", { name: "Hiện" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: "Ẩn" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("is never loaded from an address that is not Openverse or Commons, and a broken picture is left out", () => {
    const evil = render(wrap(<SideView side={{ text: "犬", lang: "ja", image: { url: "https://evil.example/p.gif" } }} big />));
    expect(evil.container.querySelector("img")).toBeNull();
    cleanup();
    const { container } = render(wrap(<SideView side={sidesOf(card({ image: OV("aaa") })).prompt} big />));
    fireEvent.error(container.querySelector(".fc-side__pic img")!);
    expect(container.querySelector(".fc-side__pic")).toBeNull();
  });

  it("shows a small thumbnail in the card list", () => {
    const { container } = render(wrap(<ul><CardRow card={card({ image: OV("aaa") })} onEdit={() => undefined} onDelete={() => undefined} /></ul>));
    expect(container.querySelector(".fc-row__thumb")!.getAttribute("src")).toBe(OV("aaa").url);
    cleanup();
    const plain = render(wrap(<ul><CardRow card={card()} onEdit={() => undefined} onDelete={() => undefined} /></ul>));
    expect(plain.container.querySelector(".fc-row__thumb")).toBeNull();
  });
});

describe("the store", () => {
  const base = { termLang: "ja", definitionLang: "vi" } as const;

  it("keeps an allowed picture on a card and drops any other", () => {
    const d = createDeck("A", "d1");
    const good = addCard({ deckId: d.id, term: "犬", definition: "chó", image: OV("aaa"), ...base });
    const bad = addCard({ deckId: d.id, term: "猫", definition: "mèo", image: { url: "https://evil.example/p.gif" }, ...base });
    const cards = readState().cards;
    expect(cards.find((c) => c.id === good.id)!.image).toEqual(OV("aaa"));
    expect("image" in cards.find((c) => c.id === bad.id)!).toBe(false);
  });

  it("changes and removes a picture, and refuses to swap in a bad one", () => {
    const d = createDeck("A", "d1");
    const c = addCard({ deckId: d.id, term: "犬", definition: "chó", image: OV("aaa"), ...base });
    updateCard(c.id, { image: OV("bbb") });
    expect(readState().cards[0]!.image).toEqual(OV("bbb"));
    updateCard(c.id, { image: { url: "https://evil.example/p.gif" } });
    expect(readState().cards[0]!.image).toBeUndefined();
    updateCard(c.id, { image: OV("aaa") });
    updateCard(c.id, { image: undefined });
    expect("image" in readState().cards[0]!).toBe(false);
  });

  it("copies a shared deck's pictures, but only the allowed ones", () => {
    importSharedDeck("Shared", [
      { id: "1", term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", image: OV("aaa") },
      { id: "2", term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi", image: { url: "https://evil.example/p.gif" } },
    ]);
    const [dog, cat] = readState().cards;
    expect(dog!.image).toEqual(OV("aaa"));
    expect("image" in cat!).toBe(false);
  });
});

describe("ImagePicker", () => {
  const open = (props: Partial<React.ComponentProps<typeof ImagePicker>> = {}) => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(wrap(<ImagePicker initialQuery="dog" word="犬" onPick={onPick} onClose={onClose} {...props} />));
    return { onPick, onClose };
  };

  it("searches the word's meaning at once and offers the pictures with their credit", async () => {
    answer();
    open();
    expect(searchImages).toHaveBeenCalledWith("dog", expect.anything());
    expect((screen.getByLabelText(/Tìm ảnh \(từ khóa/) as HTMLInputElement).value).toBe("dog");
    expect(screen.getByText(/lần đầu có thể mất vài giây/)).toBeTruthy();
    const tiles = await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
    expect(tiles).toHaveLength(3);
    expect(tiles[1]!.textContent).toBe("Sean MacEntee · CC BY 2.0");
    expect(screen.getByText(/Openverse và Wikimedia Commons/)).toBeTruthy();
    expect(screen.getByText("Từ: 犬")).toBeTruthy();
  });

  it("offers other things to look for as buttons that search at once, marking the one in use", async () => {
    answer();
    open({ suggestions: ["eat", "have a meal", "person eat"], initialQuery: "eat" });
    const group = screen.getByRole("group", { name: "Gợi ý từ khóa" });
    expect(within(group).getByRole("button", { name: "eat" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "person eat" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(within(group).getByRole("button", { name: "person eat" }));
    expect(searchImages).toHaveBeenLastCalledWith("person eat", expect.anything());
    expect((screen.getByLabelText(/Tìm ảnh \(từ khóa/) as HTMLInputElement).value).toBe("person eat");
    expect(within(group).getByRole("button", { name: "person eat" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "eat" }).getAttribute("aria-pressed")).toBe("false");
    await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
  });

  it("shows no keyword buttons when there are none, and always tells how to look for an abstract word", async () => {
    answer();
    open();
    expect(screen.queryByRole("group", { name: "Gợi ý từ khóa" })).toBeNull();
    expect(screen.getByText(/Từ trừu tượng khó có ảnh đúng nghĩa/)).toBeTruthy();
    await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
  });

  it("hands over the picture that is clicked", async () => {
    answer();
    const { onPick } = open();
    fireEvent.click((await screen.findAllByRole("button", { name: /Dùng ảnh này/ }))[1]!);
    expect(onPick).toHaveBeenCalledWith(HITS[1]);
  });

  it("searches again for another word, and does not search an empty one", async () => {
    answer();
    open();
    await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
    const input = screen.getByLabelText(/Tìm ảnh \(từ khóa/);
    fireEvent.change(input, { target: { value: "  cat " } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm ảnh" }));
    expect(searchImages).toHaveBeenLastCalledWith("cat", expect.anything());
    fireEvent.change(input, { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Tìm ảnh" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("starts without a search when there is no word to look for", () => {
    open({ initialQuery: "" });
    expect(searchImages).not.toHaveBeenCalled();
  });

  it("says when the sources do not answer, and tries again on request", async () => {
    searchImages.mockRejectedValueOnce(new Error("502"));
    open();
    expect((await screen.findByRole("alert")).textContent).toMatch(/nguồn ảnh đang chậm/);
    answer();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findAllByRole("button", { name: /Dùng ảnh này/ })).toHaveLength(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when nothing was found, and when one source was slow", async () => {
    answer([]);
    open();
    expect(await screen.findByText(/Không có ảnh phù hợp/)).toBeTruthy();
    cleanup();
    answer(HITS, true);
    open();
    expect(await screen.findByText(/Một nguồn ảnh đang chậm/)).toBeTruthy();
  });

  it("ignores a result whose address is not an allowed one, and a picture that fails to load", async () => {
    answer([hit("aaa"), hit("bbb", { url: "https://evil.example/p.gif" })]);
    open();
    const tiles = await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
    expect(tiles).toHaveLength(1);
    fireEvent.error(tiles[0]!.querySelector("img")!);
    expect(await screen.findByText(/Không có ảnh phù hợp/)).toBeTruthy();
  });

  it("shows the current picture and lets it be taken off", async () => {
    answer();
    const onRemove = vi.fn();
    open({ current: OV("zzz"), onRemove });
    fireEvent.click(await screen.findByRole("button", { name: "Bỏ ảnh" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("closes with Escape, the close button or a click outside the box", async () => {
    answer();
    const { onClose } = open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(document.querySelector(".fc-imgpick-modal")!);
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("closes only itself on Escape, not the box it was opened from", async () => {
    answer();
    const outer = vi.fn();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && outer();
    window.addEventListener("keydown", onKey);
    open();
    fireEvent.keyDown(window, { key: "Escape" });
    window.removeEventListener("keydown", onKey);
    expect(outer).not.toHaveBeenCalled();
  });

  it("does not submit the form it was opened from when its own search is submitted", async () => {
    answer();
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      wrap(
        <form onSubmit={outerSubmit}>
          <ImagePicker initialQuery="dog" onPick={() => undefined} onClose={() => undefined} />
        </form>,
      ),
    );
    await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
    fireEvent.submit(screen.getByRole("search"));
    expect(outerSubmit).not.toHaveBeenCalled();
    expect(searchImages).toHaveBeenCalledTimes(2);
  });
});

describe("EntryImageButton", () => {
  const button = (name = "Tìm ảnh cho thẻ") => screen.getByRole("button", { name });

  it("searches by the entry's English meaning, and picking a picture adds the word to the flashcards with it", async () => {
    answer();
    render(wrap(<EntryImageButton entry={TABERU} meaning="vi" />));
    fireEvent.click(button());
    expect(searchImages).toHaveBeenCalledWith("eat", expect.anything());
    expect(screen.getByText("Từ: 食べる")).toBeTruthy();
    // and every meaning of the word is offered as another thing to look for
    const keywords = within(screen.getByRole("group", { name: "Gợi ý từ khóa" })).getAllByRole("button").map((b) => b.textContent);
    expect(keywords).toEqual(["eat", "have a meal", "person eat"]);
    fireEvent.click((await screen.findAllByRole("button", { name: /Dùng ảnh này/ }))[0]!);
    const cards = readState().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ term: "食べる", reading: "たべる", definition: "ăn", definitionLang: "vi", entryId: 1, image: OV("aaa") });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button("Đã thêm vào bộ “Từ của tôi” kèm ảnh")).toBeTruthy();
  });

  it("gives the picture to the card the word already has instead of adding a second one", async () => {
    answer();
    const d = createDeck("Của tôi", "default");
    addCard({ deckId: d.id, term: "食べる", termLang: "ja", definition: "ăn", definitionLang: "vi", entryId: 1 });
    render(wrap(<EntryImageButton entry={TABERU} meaning="vi" />));
    fireEvent.click(button());
    fireEvent.click((await screen.findAllByRole("button", { name: /Dùng ảnh này/ }))[1]!);
    const cards = readState().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]!.image).toEqual(toCardImage(HITS[1]!));
    expect(button("Đã thêm ảnh vào thẻ")).toBeTruthy();
  });

  it("starts out marked when the card has a picture, and can change or remove it", async () => {
    answer();
    const d = createDeck("A", "default");
    addCard({ deckId: d.id, term: "食べる", termLang: "ja", definition: "ăn", definitionLang: "vi", entryId: 1, image: OV("old") });
    render(wrap(<EntryImageButton entry={TABERU} meaning="vi" />));
    fireEvent.click(button("Thẻ đã có ảnh. Bấm để đổi ảnh."));
    fireEvent.click(await screen.findByRole("button", { name: "Bỏ ảnh" }));
    expect(readState().cards[0]!.image).toBeUndefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CardEditor", () => {
  it("adds a picture to the card being made, searching by the chosen suggestion's English meaning", async () => {
    answer();
    searchDictionary.mockResolvedValue({ query: "", lang: "ja", entries: [TABERU], kanji: [] });
    const onSubmit = vi.fn();
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={onSubmit} />));
    fireEvent.change(screen.getByLabelText("Từ"), { target: { value: "食べる" } });
    await waitFor(() => expect((screen.getByLabelText("Nghĩa") as HTMLInputElement).value).toBe("ăn"));
    fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    expect(searchImages).toHaveBeenCalledWith("eat", expect.anything());
    expect(within(screen.getByRole("group", { name: "Gợi ý từ khóa" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["eat", "have a meal"]);
    fireEvent.click((await screen.findAllByRole("button", { name: /Dùng ảnh này/ }))[0]!);
    expect(screen.getByAltText("Ảnh của thẻ").getAttribute("src")).toBe(OV("aaa").url);
    expect(screen.getByRole("button", { name: "Đổi ảnh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ term: "食べる", definition: "ăn", image: OV("aaa") }));
  });

  it("keeps the card form unsubmitted while the picker is searched, and can take a picture off", async () => {
    answer();
    const onSubmit = vi.fn();
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={onSubmit} initial={{ term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", image: OV("old") }} />));
    fireEvent.click(screen.getByRole("button", { name: "Đổi ảnh" }));
    // no English box and no suggestion, so the search starts empty and the learner types what to look for
    expect(searchImages).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Tìm ảnh \(từ khóa/), { target: { value: "dog" } });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findAllByRole("button", { name: /Dùng ảnh này/ });
    expect(searchImages).toHaveBeenCalledWith("dog", expect.anything());
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Bỏ ảnh" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmit.mock.calls[0]![0].image).toBeUndefined();
  });

  it("starts the picture search from an English box when there is no suggestion", async () => {
    answer();
    render(wrap(<CardEditor submitLabel="Lưu" onSubmit={() => undefined} initial={{ term: "dog", termLang: "en", definition: "chó", definitionLang: "vi" }} />));
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    expect(searchImages).toHaveBeenCalledWith("dog", expect.anything());
  });
});

describe("pictures while studying", () => {
  const deck = () => {
    const d = createDeck("Bộ thử", "deck1");
    addCard({ deckId: d.id, term: "犬", termLang: "ja", definition: "chó", definitionLang: "vi", image: OV("aaa") });
    return readState().cards;
  };

  it("show with the question of a study round, and a setting above the round hides them and is kept", () => {
    render(wrap(<StudyModes deckId="deck1" cards={deck()} mode="learn" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("犬")).toBeTruthy();
    expect(document.querySelector(".fc-flash__side--front .fc-side__pic img")!.getAttribute("src")).toBe(OV("aaa").url);

    const group = screen.getByRole("radiogroup", { name: "Hình ảnh" });
    expect(within(group).getByRole("radio", { name: "Hiện" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: "Ẩn" }));
    expect(localStorage.getItem("jd.flash_images.v1")).toBe("off");
    expect(document.querySelector(".fc-side__pic")).toBeNull();
    fireEvent.click(within(group).getByRole("radio", { name: "Hiện" }));
    expect(document.querySelector(".fc-side__pic img")).toBeTruthy();
  });

  it("are not shown for a card that has none", () => {
    const d = createDeck("Bộ thử", "deck1");
    addCard({ deckId: d.id, term: "猫", termLang: "ja", definition: "mèo", definitionLang: "vi" });
    render(wrap(<StudyModes deckId="deck1" cards={readState().cards} mode="learn" />));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(screen.getByText("猫")).toBeTruthy();
    expect(document.querySelector(".fc-side__pic")).toBeNull();
  });
});
