// @ts-check
import { defineWalleConfig } from "./src/@walle/config";

// https://astro.build/config
// site/base/trailingSlash and the mdx/sitemap/icon integrations come from walle
// defaults (resolved from src/configs/app.json). Only the OG-image SSR externals
// and the PWA caching rules below are project-specific overrides.
export default defineWalleConfig({
  // The PWA itself is walle's (app.json -> pwa.enabled): manifest, worker, registration and
  // the network-first rule for HTML come from its defaults. Only the offline fallback and the
  // site's own shell assets are declared here.
  pwa: {
    workbox: {
      runtimeCaching: [
        // Same NetworkFirst rule as walle's default, plus the offline page as a last resort.
        // Declared here instead of `navigateFallback`: that registers its NavigationRoute before
        // runtimeCaching, and Workbox serves the first matching route, so every navigation
        // (online too) would land on the offline page. Consumer rules come before walle's, so
        // this one wins over its twin and online behaviour is unchanged.
        //
        // `handlerDidError` fires only when both network and cache failed. The precache stores
        // the page as `/offline` (the Astro PWA integration strips `/index.html` for
        // trailingSlash "never") with a `__WB_REVISION__` query string, hence `ignoreSearch`.
        {
          urlPattern: ({ request }) => request.mode === "navigate",
          handler: "NetworkFirst",
          options: {
            cacheName: "html-pages",
            networkTimeoutSeconds: 3,
            plugins: [
              {
                handlerDidError: async () =>
                  (await caches.match("/offline", { ignoreSearch: true })) || Response.error(),
              },
            ],
          },
        },
      ],
      // Replaces walle's default (`_astro/**/*.{js,css}`), so it restates it. Adds the offline
      // page and the shell assets it needs to render: without the navbar logo and the only
      // self-hosted font actually declared in CSS, an offline page shows a broken image.
      globPatterns: [
        "_astro/**/*.{js,css}",
        "offline/index.html",
        "img/logo/light/logo-standard-version.svg",
        "img/favicon/favicon.svg",
        "fonts/NectoMono-Regular.woff2",
      ],
      // walle's cart chunk is code-split at build time even though this site never renders it
      // (no commerce config), so the glob above would precache it on every device.
      globIgnores: ["_astro/CartMount*"],
    },
  },
  vite: {
    ssr: {
      external: ["@resvg/resvg-js", "satori"],
    },
  },
});
