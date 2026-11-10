import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageViewTracker } from "./PageViewTracker";
import { apiUrl } from "../env";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Navigation() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate("/dictionary?q=secret")}>Dictionary</button>
    <button onClick={() => navigate("/dictionary?q=other")}>Search</button>
    <button onClick={() => navigate("/admin")}>Admin</button>
    <button onClick={() => navigate("/admin/users")}>Users</button>
    <button onClick={() => navigate("/")}>Home</button>
    <button onClick={() => navigate(-1)}>Back</button>
  </>;
}

describe("PageViewTracker", () => {
  it("counts the opening once under StrictMode, navigation and back, excluding admin and query changes", () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    render(<StrictMode><MemoryRouter><PageViewTracker /><Navigation /></MemoryRouter></StrictMode>);
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Dictionary"));
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Search"));
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Admin"));
    fireEvent.click(screen.getByText("Users"));
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Dictionary"));
    fireEvent.click(screen.getByText("Back"));
    expect(fetch).toHaveBeenCalledTimes(5);
    for (const [url, options] of fetch.mock.calls) {
      expect(url).toBe(apiUrl("/api/traffic/view"));
      expect(options).toEqual({ method: "POST", keepalive: true });
    }
  });

  it("does not block navigation when recording fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MemoryRouter initialEntries={["/admin/login"]}><PageViewTracker /><Navigation /></MemoryRouter>);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Home"));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
