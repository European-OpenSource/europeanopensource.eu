// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import config from "./src/@walle/config";

// https://astro.build/config
export default defineConfig({
  site: config.app.astro.baseUrl,
  base: config.app.astro.basePath,
  trailingSlash: /** @type {"always"|"never"|"ignore"|undefined} */ (
    config.app.astro.trailingSlash
  ),
  integrations: [mdx(), sitemap(), icon()],
});
