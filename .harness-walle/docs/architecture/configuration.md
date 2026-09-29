---
title: Configuration
order: 2
---

# Configuration

Four JSON files in `src/configs/`, each validated at build time against a zod schema in
`src/@walle/config/schema.ts`, the single source of truth both `define-config.ts` (build) and
`config/index.ts` (runtime) parse against. An unknown key, a wrong type, or a removed key fails
the build naming the file and the key path; a removed key's error also names its replacement.

## `app.json`

| Key | Type | Notes |
|---|---|---|
| `website.title`, `.description` | `string` | Required. Used in `<title>`, meta tags, PWA manifest fallbacks |
| `website.favicon`, `.image`, `.robots`, `.language` | `string` | Optional; `language` drives dates, prices, and `og:locale` |
| `website.titleMaxLength`, `.descriptionMaxLength` | `number` | Opt-in SEO truncation budgets; see [seo](seo.md#title-and-description) |
| `astro.baseUrl`, `.basePath` | `string` | Required. Site origin and base path |
| `astro.trailingSlash` | `"always" \| "never" \| "ignore"` | Passed to Astro's own setting |
| `astro.adapter` | `"node"` | Adds the node adapter; output stays `"static"`, only routes with `prerender = false` render on demand |
| `astro.redirects` | record | Passed straight through to Astro's native `redirects`; sources are excluded from the sitemap automatically |
| `astro.sitemapExclude` | `string[]` | Extra path prefixes to keep out of `sitemap.xml` |
| `astro.prefetch` | `false` or `{ strategy, all }` | On by default (`hover` strategy); `false` opts out entirely |
| `astro.analyticsScriptContent` | `string` | Injected by the `Analytics` component in production only |
| `components` | record | Site overrides for embeddable components; see [components](components.md#overrides) |
| `pwa` | object | See [pwa](pwa.md) |
| `commerce` | object | See [ecommerce](ecommerce.md) |
| `seo.ogImage`, `seo.feeds`, `seo.alternates` | object | See [seo](seo.md) |
| `map` | object | Default tiles and directions provider for every `Map` instance; see [components](components.md#map) |
| `labels` | object | Every user-facing/screen-reader string walle emits, grouped by area (skip link, logo and scrollable-region names, card, breadcrumbs, carousel, filters, cart, price, offline, not-found, table of contents, nav, footer, blog, products, map). Each leaf has an English default; anything you don't set stays in English |

## `navbar.json` / `footer.json`

Both share the same shape: a `logo` object (`src`, `title`, `url`, `width`, `height`, `alt`,
`cssClasses`, `license`) and an `items` array of navigation links (`name`, `url`, `icon`,
`target`). `navbar.json` items may additionally carry a `dropdown` array of the same link shape
(footer links do not support dropdowns).

## `theme.json`

Optional. Every key falls back to walle's own default when absent.

| Key | Feeds |
|---|---|
| `palette` | Brand colors and their `*-contrast` text colors → `--walle-*` CSS variables |
| `neutral` | Gray scale → semantic tokens |
| `shadow`, `radii` | Elevation and corner-radius tokens |
| `typography.fontFamilyBase/-Heading/-Mono`, `.scale` | Font stacks and a type scale |
| `typography.fonts[]` | Self-hosted font entries (`role`, `name`, `provider`, `weights`, `src`, `fallback`, `display`); resolved to an Astro Fonts API entry with `cssVariable: "--walle-font-<role>"`, a metric-matched fallback for `fallback`'s generic family (default `sans-serif`), and `display` passed through only when set (default: Astro's own `swap`) |
| `spacing` | Spacing scale tokens |

See [style](style.md) for how these become CSS.

## How it's wired: `defineWalleConfig()`

`src/@walle/define-config.ts` is imported only from `astro.config.mjs`. It parses all four
config files, then builds a real Astro config: native integrations (`mdx`, `sitemap`, `icon`,
conditionally `@astrojs/node` and `@vite-pwa/astro`), and a handful of vite plugins that expose
parsed config to component code through virtual modules (`virtual:walle-components`,
`virtual:walle-features`, `virtual:walle-pwa`, `virtual:walle-fonts`, `virtual:walle-theme.css`).
Scalar keys passed to `defineWalleConfig({...})` override walle's resolved values; an
`integrations` array is merged additively onto walle's defaults.

### The slim-barrel plugin

`@walle/components` and `@walle/layouts` are convenient barrels, but Astro collects a page's CSS
from its whole module graph, not from what the page renders: a single
`import { Section } from "@walle/components"` would otherwise drag every component's `<style>`
onto every page that imports anything from the barrel at all, including carousel, cart, blog and
product CSS on a site that uses none of them. On a real site this measured 79 KB of shared
stylesheet, 35 KB of it for components no page rendered. `walleSlimBarrelsPlugin` rewrites each
barrel at load time down to the exports the project's own sources actually import (it scans the
consumer's sources for named imports), so nothing changes in how imports are written, only in
what ends up in the graph.
