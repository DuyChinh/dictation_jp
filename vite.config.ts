import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@jd/evaluation": path.resolve(
          rootDir,
          "../packages/evaluation/src/index.ts",
        ),
        "@jd/shared-types": path.resolve(
          rootDir,
          "../packages/shared-types/src/index.ts",
        ),
        "@jd/content-schema": path.resolve(
          rootDir,
          "../packages/content-schema/src/index.ts",
        ),
      },
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
