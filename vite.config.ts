// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const previewClientEntry = "client";
const previewClientEntryFile = resolve(process.cwd(), "src/client.tsx");

if (!existsSync(previewClientEntryFile)) {
  throw new Error(
    `Preview bootstrap entry missing: ${previewClientEntryFile}. ` +
      "Do not remove src/client.tsx; hosted previews need an app-owned client entry.",
  );
}

export default defineConfig({
  tanstackStart: {
    // Keep the browser entry inside src/ instead of relying on TanStack's
    // package-internal default entry. Hosted previews can fail when the
    // bootstrapper dynamically imports deep /node_modules paths, which shows
    // up as: "Preview has not been built yet". This stable app-owned entry
    // makes the preview bundle deterministic across rebuilds.
    client: { entry: previewClientEntry },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pre-bundle deps that Vite would otherwise discover lazily on first
    // navigation. When that lazy discovery happens, Vite logs
    // "optimized dependencies changed. reloading" and tears down the module
    // graph mid-session — during that brief window the hosted preview proxy
    // shows "Preview has not been built yet". Listing them here keeps the
    // optimizer output stable from cold-start and prevents that reload.
    optimizeDeps: {
      include: [
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "seroval",
      ],
    },
  },
});
