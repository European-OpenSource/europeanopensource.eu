// @ts-check
import { defineWalleConfig } from "./src/@walle/config";

// https://astro.build/config
// Walle resolves site/base/integrations and the PWA from src/configs/app.json.
export default defineWalleConfig({
  pwa: {
    workbox: {
      runtimeCaching: [
        // Walle's NetworkFirst rule plus the offline page as fallback. Not `navigateFallback`:
        // its route is registered first and would serve the offline page even when online.
        {
          urlPattern: ({ request }) => request.mode === "navigate",
          handler: "NetworkFirst",
          options: {
            cacheName: "html-pages",
            networkTimeoutSeconds: 3,
            plugins: [
              {
                // Precached as `/offline?__WB_REVISION__=...`, hence ignoreSearch.
                handlerDidError: async () =>
                  (await caches.match("/offline", { ignoreSearch: true })) || Response.error(),
              },
            ],
          },
        },
      ],
      // Replaces walle's default glob, so it restates `_astro/**`.
      globPatterns: [
        "_astro/**/*.{js,css}",
        "offline/index.html",
        "img/logo/light/logo-standard-version.svg",
        "img/favicon/favicon.svg",
        "fonts/NectoMono-Regular.woff2",
      ],
      globIgnores: ["_astro/CartMount*"],
    },
  },
  vite: {
    ssr: {
      external: ["@resvg/resvg-js", "satori"],
    },
  },
});
