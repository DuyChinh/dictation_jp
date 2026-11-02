import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { HandwritingPad } from "./HandwritingPad";
import type { Template } from "./recognize";

const line = (a: [number, number], b: [number, number]) => {
  const out = new Float32Array(16);
  for (let i = 0; i < 8; i++) {
    out[i * 2] = a[0] + ((b[0] - a[0]) * i) / 7;
    out[i * 2 + 1] = a[1] + ((b[1] - a[1]) * i) / 7;
  }
  return out;
};
const templates: Template[] = [
  { ch: "一", strokes: [line([0, 32], [63, 32])] },
  { ch: "十", strokes: [line([0, 32], [63, 32]), line([32, 0], [32, 63])] },
];

const loadTemplates = vi.fn();
vi.mock("./templates", () => ({ loadTemplates: () => loadTemplates() }));

// jsdom has no PointerEvent, so a drawn point would arrive without its position.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", FakePointerEvent);
  loadTemplates.mockReset();
  loadTemplates.mockResolvedValue(templates);
  Element.prototype.setPointerCapture = vi.fn();
  // jsdom has no canvas; a context that accepts every drawing call is enough here.
  const noop = new Proxy({}, { get: () => () => undefined, set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => noop) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 340, height: 340, right: 340, bottom: 340, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPad(onPick = vi.fn(), onClose = vi.fn()) {
  render(
    <UiLanguageProvider>
      <HandwritingPad onPick={onPick} onClose={onClose} />
    </UiLanguageProvider>,
  );
  return { onPick, onClose, canvas: screen.getByLabelText("Khung vẽ chữ") };
}

function stroke(canvas: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1], pointerId: 1, button: 0 });
  for (let i = 1; i <= 6; i++) {
    fireEvent.pointerMove(canvas, {
      clientX: from[0] + ((to[0] - from[0]) * i) / 6,
      clientY: from[1] + ((to[1] - from[1]) * i) / 6,
      pointerId: 1,
    });
  }
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe("HandwritingPad", () => {
  it("asks for a drawing first, then offers the closest characters as strokes are drawn", async () => {
    const { canvas } = renderPad();
    await waitFor(() => expect(screen.getByText(/Vẽ chữ Hán hoặc kana/)).toBeTruthy());
    stroke(canvas, [20, 170], [320, 170]);
    expect(await screen.findByRole("button", { name: "一" })).toBeTruthy();
    expect(screen.getByText("1 nét")).toBeTruthy();
    stroke(canvas, [170, 20], [170, 320]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^[一十]$/ })[0]!.textContent).toBe("十"));
    expect(screen.getByText("2 nét")).toBeTruthy();
  });

  it("adds the chosen character and clears the board for the next one", async () => {
    const { canvas, onPick } = renderPad();
    await waitFor(() => expect(screen.getByText(/Vẽ chữ Hán hoặc kana/)).toBeTruthy());
    stroke(canvas, [20, 170], [320, 170]);
    fireEvent.click(await screen.findByRole("button", { name: "一" }));
    expect(onPick).toHaveBeenCalledWith("一");
    await waitFor(() => expect(screen.queryByRole("button", { name: "一" })).toBeNull());
    expect(screen.getByText(/Vẽ chữ Hán hoặc kana/)).toBeTruthy();
  });

  it("undoes the last stroke and clears everything", async () => {
    const { canvas } = renderPad();
    await waitFor(() => expect(screen.getByText(/Vẽ chữ Hán hoặc kana/)).toBeTruthy());
    const undo = screen.getByRole("button", { name: "Xóa nét cuối" }) as HTMLButtonElement;
    const clear = screen.getByRole("button", { name: "Xóa hết" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    stroke(canvas, [20, 170], [320, 170]);
    stroke(canvas, [170, 20], [170, 320]);
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^[一十]$/ })[0]!.textContent).toBe("一"));
    fireEvent.click(clear);
    await waitFor(() => expect(screen.getByText(/Vẽ chữ Hán hoặc kana/)).toBeTruthy());
  });

  it("says so when the stroke data cannot be loaded", async () => {
    loadTemplates.mockRejectedValue(new Error("offline"));
    renderPad();
    expect(await screen.findByText(/Không tải được dữ liệu nét chữ/)).toBeTruthy();
  });

  it("closes", () => {
    const { onClose } = renderPad();
    fireEvent.click(screen.getByRole("button", { name: /Đóng/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
