// @ts-check
import { defineWalleConfig } from "./src/@walle/config";

// https://astro.build/config
// site/base/trailingSlash and the mdx/sitemap/icon integrations come from walle
// defaults (resolved from src/configs/app.json). Only the OG-image SSR externals
// are project-specific overrides.
export default defineWalleConfig({
  vite: {
    ssr: {
      external: ["@resvg/resvg-js", "satori"],
    },
  },
});
