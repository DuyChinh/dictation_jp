/** Whether the desktop sidebar is shrunk to icons. Shared so signing in can reopen it. */
export const COLLAPSED_KEY = "jd.sidebar_collapsed.v1";

export function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode: the preference just isn't remembered */
  }
}

/** After a successful sign-in the menu starts open, whatever it was left as before. */
export function expandSidebar(): void {
  saveCollapsed(false);
}
