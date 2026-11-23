import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyMeta } from "./seo";

/** Keeps the page title and search/share tags in step with the route. */
export function SeoManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    applyMeta(pathname);
  }, [pathname]);
  return null;
}
