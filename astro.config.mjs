// @ts-check
import { defineWalleConfig } from "./src/@walle/config";

// https://astro.build/config
// Walle resolves site/base/integrations and the PWA from src/configs/app.json.
export default defineWalleConfig({
  pwa: {
    workbox: {
      // Merged onto walle's own globPatterns (which already cover the hashed build output
      // and self-hosted @font-face fonts through the Astro Fonts API). These three are
      // outside that: raw brand fonts and images served from public/, needed offline by
      // BaseLayout's header on the /offline fallback page.
      globPatterns: [
        "img/logo/light/logo-standard-version.svg",
        "img/favicon/favicon.svg",
        "fonts/*.woff2",
      ],
    },
  },
  vite: {
    ssr: {
      external: ["@resvg/resvg-js", "satori"],
    },
  },
});
