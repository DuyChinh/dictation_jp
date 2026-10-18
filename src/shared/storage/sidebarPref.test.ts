import { beforeEach, describe, expect, it } from "vitest";
import { COLLAPSED_KEY, expandSidebar, loadCollapsed, saveCollapsed } from "./sidebarPref";

describe("sidebar preference", () => {
  beforeEach(() => localStorage.clear());

  it("starts open and remembers a collapse", () => {
    expect(loadCollapsed()).toBe(false);
    saveCollapsed(true);
    expect(loadCollapsed()).toBe(true);
  });

  it("reopens a collapsed menu after sign-in", () => {
    localStorage.setItem(COLLAPSED_KEY, "1");
    expandSidebar();
    expect(loadCollapsed()).toBe(false);
  });
});
