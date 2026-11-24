import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LevelProvider, useLevel } from "../../shared/context/LevelContext";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import { parseLevel, saveAccountLevel, useAccountLevelSync } from "./accountLevel";

type U = { _id: string; jlptLevel?: string } | null;
const fetchMock = vi.fn();
let api: ReturnType<typeof useLevel>;

function Probe({ user }: { user: U }) {
  useAccountLevelSync(user);
  api = useLevel();
  return null;
}
const mount = (user: U) =>
  render(
    <UiLanguageProvider>
      <LevelProvider>
        <Probe user={user} />
      </LevelProvider>
    </UiLanguageProvider>,
  );
const rerenderWith = (view: ReturnType<typeof mount>, user: U) =>
  view.rerender(
    <UiLanguageProvider>
      <LevelProvider>
        <Probe user={user} />
      </LevelProvider>
    </UiLanguageProvider>,
  );
const sent = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).level);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("token", "t");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("parseLevel", () => {
  it("accepts ALL and N1 to N5 only", () => {
    for (const ok of ["ALL", "N1", "N5"]) expect(parseLevel(ok)).toBe(ok);
    for (const bad of ["n2", "N6", "", null, undefined, 3]) expect(parseLevel(bad)).toBeNull();
  });
});

describe("saveAccountLevel", () => {
  it("puts the level with the sign-in token, and does nothing when signed out", async () => {
    expect(await saveAccountLevel("N2")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/api/auth/level")).toBe(true);
    expect(init).toMatchObject({ method: "PUT", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ level: "N2" }) });
    localStorage.removeItem("token");
    fetchMock.mockClear();
    expect(await saveAccountLevel("N2")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refused or unreachable save", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await saveAccountLevel("N2")).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await saveAccountLevel("N2")).toBe(false);
  });
});

describe("the level on the account", () => {
  it("starts a new device from the account's level instead of all levels", () => {
    mount({ _id: "u1", jlptLevel: "N2" });
    expect(api.level).toBe("N2");
    expect(api.chosen).toBe(true);
    expect(localStorage.getItem("jd.selected_level")).toBe("N2");
    expect(fetchMock).not.toHaveBeenCalled(); // nothing to upload: it came from the account
  });

  it("takes over the account's level even when this device had another", () => {
    localStorage.setItem("jd.selected_level", "N5");
    mount({ _id: "u1", jlptLevel: "N1" });
    expect(api.level).toBe("N1");
  });

  it("gives an account that has none this device's choice", async () => {
    localStorage.setItem("jd.selected_level", "N3");
    mount({ _id: "u1" });
    expect(api.level).toBe("N3");
    await waitFor(() => expect(sent()).toEqual(["N3"]));
  });

  it("changes nothing when neither the account nor the device has chosen", () => {
    mount({ _id: "u1" });
    expect(api.level).toBe("ALL");
    expect(api.chosen).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a level picked later, once per change", async () => {
    mount({ _id: "u1", jlptLevel: "N2" });
    act(() => api.setLevel("N4"));
    await waitFor(() => expect(sent()).toEqual(["N4"]));
    act(() => api.setLevel("N4"));
    expect(sent()).toEqual(["N4"]);
  });

  it("saves nothing while signed out, and starts again for the next account", async () => {
    const view = mount(null);
    act(() => api.setLevel("N5"));
    expect(fetchMock).not.toHaveBeenCalled();
    rerenderWith(view, { _id: "u2", jlptLevel: "N1" });
    expect(api.level).toBe("N1");
    rerenderWith(view, null);
    rerenderWith(view, { _id: "u3", jlptLevel: "N3" });
    expect(api.level).toBe("N3");
  });

  it("keeps the same account's level when only the profile object changes", () => {
    const view = mount({ _id: "u1", jlptLevel: "N2" });
    act(() => api.setLevel("N5"));
    rerenderWith(view, { _id: "u1", jlptLevel: "N2" }); // e.g. the name was edited: same account, same reconciliation
    expect(api.level).toBe("N5");
  });
});
