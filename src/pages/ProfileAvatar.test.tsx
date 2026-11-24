import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { ProfilePage } from "./ProfilePage";

vi.mock("../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const AVATAR = "data:image/jpeg;base64,/9j/AAAA";
let avatar: string | undefined = AVATAR;
vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "u1", displayName: "Linh", email: "linh@example.com", authProvider: "google", plan: "free", createdAt: "2026-08-09T00:00:00Z", avatar },
    loading: false,
    updateAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    updateProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  avatar = AVATAR;
});

const page = () =>
  render(
    <MemoryRouter>
      <UiLanguageProvider>
        <ProfilePage />
      </UiLanguageProvider>
    </MemoryRouter>,
  );

const picker = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe("profile photo", () => {
  it("opens larger when the photo is clicked, and shows the same picture", () => {
    page();
    expect(document.querySelector("img.avatar-viewer__img")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem ảnh lớn" })[0]!);
    const big = document.querySelector("img.avatar-viewer__img") as HTMLImageElement;
    expect(big.src).toBe(AVATAR);
    expect(big.alt).toBe("Linh");
  });

  it("closes with the close button, with Escape, and with a click outside the picture", () => {
    page();
    const open = () => fireEvent.click(screen.getAllByRole("button", { name: "Xem ảnh lớn" })[0]!);

    open();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(document.querySelector("img.avatar-viewer__img")).toBeNull();

    open();
    fireEvent(document.querySelector("dialog.avatar-viewer")!, new Event("cancel", { cancelable: true }));
    expect(document.querySelector("img.avatar-viewer__img")).toBeNull();

    open();
    fireEvent.click(document.querySelector(".avatar-viewer__inner")!);
    expect(document.querySelector("img.avatar-viewer__img")).toBeNull();

    open();
    fireEvent.click(document.querySelector(".avatar-viewer__img")!); // the picture itself keeps it open
    expect(document.querySelector("img.avatar-viewer__img")).toBeTruthy();
  });

  it("keeps the camera for changing the photo: it opens the file picker, not the viewer", () => {
    page();
    const click = vi.spyOn(picker(), "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getAllByRole("button", { name: "Đổi ảnh đại diện" })[0]!);
    expect(click).toHaveBeenCalled();
    expect(document.querySelector("img.avatar-viewer__img")).toBeNull();
  });

  it("has nothing to enlarge without a photo: the picture picks a file instead", () => {
    avatar = undefined;
    page();
    expect(screen.queryByRole("button", { name: "Xem ảnh lớn" })).toBeNull();
    const click = vi.spyOn(picker(), "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getAllByRole("button", { name: "Đổi ảnh đại diện" })[0]!);
    expect(click).toHaveBeenCalled();
  });
});
