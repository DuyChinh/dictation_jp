import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { FeedbackPage } from "../../pages/FeedbackPage";
import { FEEDBACK } from "../../config/feedback";

vi.mock("../../shared/ui/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const listFeedback = vi.fn();
vi.mock("./feedbackApi", async (orig) => ({ ...(await orig<typeof import("./feedbackApi")>()), listFeedback: (...a: unknown[]) => listFeedback(...a) }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  FEEDBACK.comingSoon = true;
});

const page = () => (
  <MemoryRouter>
    <UiLanguageProvider>
      <FeedbackPage />
    </UiLanguageProvider>
  </MemoryRouter>
);

describe("feedback page while switched off", () => {
  it("shows the coming-soon page, with a way home, and never loads any posts", () => {
    render(page());
    expect(screen.getByRole("heading", { level: 1, name: "Cổng góp ý đang được hoàn thiện" })).toBeTruthy();
    expect(screen.getByText("Sắp ra mắt")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Về trang chủ/ }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: /Tiếp tục luyện tập/ }).getAttribute("href")).toBe("/lessons");
    expect(screen.getByRole("list", { name: "Tiến độ" }).querySelector('[aria-current="step"]')?.textContent).toBe("Đang xây dựng");
    expect(listFeedback).not.toHaveBeenCalled();
  });

  it("speaks the reader's language", () => {
    localStorage.setItem("jd_ui_language", "en");
    render(page());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Our feedback board is on its way");
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("opens the board again when the switch is turned off", () => {
    FEEDBACK.comingSoon = false;
    listFeedback.mockResolvedValue({ items: [], total: 0, hasMore: false, stats: { total: 0, today: 0, contributors: 0 } });
    render(page());
    expect(screen.queryByText("Cổng góp ý đang được hoàn thiện")).toBeNull();
    expect(listFeedback).toHaveBeenCalled();
  });
});
