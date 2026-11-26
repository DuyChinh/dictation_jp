import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../i18n/UiLanguageContext";
import { Zoomable } from "./Zoomable";

// jsdom has no <dialog> modal support
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

const view = (onParentClick = vi.fn()) =>
  render(
    <UiLanguageProvider>
      <button type="button" onClick={onParentClick}>
        <Zoomable src="https://example.test/big.jpg" alt="dog">
          <img src="https://example.test/small.jpg" alt="" />
        </Zoomable>
      </button>
    </UiLanguageProvider>,
  );

describe("Zoomable", () => {
  it("has a magnifier next to the picture, and nothing open until it is used", () => {
    const { container } = view();
    expect(container.querySelector(".zoomable__btn")).not.toBeNull();
    expect(document.querySelector("dialog.avatar-viewer img")).toBeNull();
  });

  it("opens the picture full size without clicking the button around it", () => {
    const parent = vi.fn();
    const { container } = view(parent);
    fireEvent.click(container.querySelector(".zoomable__btn")!);
    const big = document.querySelector("dialog.avatar-viewer img")!;
    expect(big.getAttribute("src")).toBe("https://example.test/big.jpg");
    expect(parent).not.toHaveBeenCalled();
  });

  it("closes again without reaching the button around it", () => {
    const parent = vi.fn();
    const { container } = view(parent);
    fireEvent.click(container.querySelector(".zoomable__btn")!);
    const close = document.querySelector("dialog.avatar-viewer .avatar-viewer__close")!;
    fireEvent.click(close);
    expect(document.querySelector("dialog.avatar-viewer img")).toBeNull();
    expect(parent).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: "dog" })).toBeNull();
  });
});
