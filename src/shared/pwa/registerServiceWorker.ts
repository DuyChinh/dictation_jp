/**
 * Installs the service worker that lets the site open without a network. Only in the built site: the development
 * server changes files all the time, and a saved copy would hide those changes.
 */
export function registerServiceWorker(opts: { enabled?: boolean } = {}): void {
  const enabled = opts.enabled ?? import.meta.env.PROD;
  if (!enabled || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  };
  // after the page has loaded, so saving the files does not slow down the first visit
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
