import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFetch } from "../api";
import { TrafficChart } from "./TrafficChart";

vi.mock("../api", () => ({ adminFetch: vi.fn(), errorText: () => "Không kết nối được máy chủ." }));
const fetchTraffic = vi.mocked(adminFetch);
const today = "2026-11-11";
const traffic = (date = today, total = 10) => ({
  date, total, timeZone: "Asia/Ho_Chi_Minh",
  series: Array.from({ length: 24 }, (_, hour) => ({ hour, views: hour === 9 ? total : 0 })),
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-11-10T17:30:00Z").getTime());
  fetchTraffic.mockReset().mockResolvedValue(traffic());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("TrafficChart", () => {
  it("uses today's Vietnam date and shows hourly details on hover, focus and tap", async () => {
    render(<TrafficChart />);
    const bar = await screen.findByRole("button", { name: "09:00 – 10:00: 10 lượt truy cập" });
    expect(fetchTraffic).toHaveBeenCalledWith("/traffic", { query: { date: today } });
    expect(screen.getByText("Tổng: 10 lượt truy cập")).toBeTruthy();
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(bar);
    expect(screen.getByRole("tooltip").textContent).toContain("09:00 – 10:00");
    expect(screen.getByRole("tooltip").textContent).toContain("100,0% tổng ngày");
    fireEvent.mouseLeave(bar.parentElement!);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(bar, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "23:00 – 24:00: 0 lượt truy cập" }));
    expect(screen.getByRole("tooltip").textContent).toContain("0% tổng ngày");
  });

  it("hides the old day's chart while another day loads and displays an empty day", async () => {
    render(<TrafficChart />);
    await screen.findByText("Tổng: 10 lượt truy cập");
    let resolve!: (value: ReturnType<typeof traffic>) => void;
    fetchTraffic.mockImplementationOnce(() => new Promise((done) => { resolve = done as typeof resolve; }));
    fireEvent.change(screen.getByLabelText("Ngày thống kê truy cập"), { target: { value: "2026-11-10" } });
    expect(screen.queryByText("Tổng: 10 lượt truy cập")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
    resolve(traffic("2026-11-10", 0));
    await screen.findByText("Chưa ghi nhận lượt truy cập trong ngày này.");
    fireEvent.click(screen.getByRole("button", { name: "00:00 – 01:00: 0 lượt truy cập" }));
    expect(screen.getByRole("tooltip").textContent).toContain("0% tổng ngày");
  });

  it("displays errors and lets the admin retry", async () => {
    fetchTraffic.mockRejectedValueOnce(new Error("offline"));
    render(<TrafficChart />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await screen.findByText("Tổng: 10 lượt truy cập");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(fetchTraffic).toHaveBeenCalledTimes(2);
  });
});
