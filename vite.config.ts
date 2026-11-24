import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { staticPages } from "./tools/staticPages";

/**
 * For working offline: lists the built files the service worker should save when it installs, and stamps a build
 * number into it, because a browser only installs a new service worker when the file itself has changed.
 */
function offlineFiles(): Plugin {
  let outDir = "dist";
  return {
    name: "offline-files",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      // the admin pages are not studied offline
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|mp3|woff2?|webp|png|svg)$/.test(f) && !/^assets\/AdminApp/.test(f))
        .map((f) => `/${f}`);
      this.emitFile({ type: "asset", fileName: "asset-manifest.json", source: JSON.stringify(files) });
    },
    closeBundle() {
      const file = path.join(outDir, "sw.js");
      try {
        writeFileSync(file, readFileSync(file, "utf8").replace('const BUILD = "__BUILD__"', `const BUILD = "${Date.now()}"`));
      } catch {
        // no service worker file in the output
      }
    },
  };
}

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
    plugins: [
      react(),
      offlineFiles(),
      // Exams for the sitemap and the per-page HTML: SEO_LESSONS (a URL or a JSON file) or the API itself.
      staticPages({
        lessonsSource:
          env.SEO_LESSONS ?? (env.VITE_API_BASE_URL ? `${env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/content/lessons` : ""),
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // React and the router change rarely, so keeping them in their own file lets visitors reuse the cached copy after a release.
          manualChunks(id) {
            if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "vendor";
            return undefined;
          },
        },
      },
    },
    // Only lazy pages import these, so pre-bundle them at startup instead of mid-session.
    optimizeDeps: {
      include: ["qrcode"],
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
