import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { apiUrl } from "../env";

export function PageViewTracker() {
  const { pathname } = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    // Prevent StrictMode's effect replay from counting the same opening twice.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    void fetch(apiUrl("/api/traffic/view"), { method: "POST", keepalive: true }).catch(() => {
      // Analytics must never interrupt navigation, including when offline.
    });
  }, [pathname]);

  return null;
}
