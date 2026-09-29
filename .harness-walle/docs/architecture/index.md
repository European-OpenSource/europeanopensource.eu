---
title: Architecture
order: 1
---

# Architecture

How the website engine (`src/@walle/`) is put together, for anyone extending or customizing it
beyond configs and CSS variables.

## Module map

| Module | Path | Role |
|---|---|---|
| Config | `src/@walle/config/` | Zod schemas and the runtime accessor for `app`, `navbar`, `footer`, `theme` |
| Build config | `src/@walle/define-config.ts` | `defineWalleConfig()`: resolves Astro integrations, vite plugins and virtual modules from the parsed config |
| Components | `src/@walle/components/` | Elements, features and layouts; see [components](components.md) |
| Layouts | `src/@walle/layouts/` | `AbstractLayout`, `BaseLayout`, `DetailLayout`, blog layouts |
| Styles | `src/@walle/styles/` | Cascade layers, tokens, base/prose/utility CSS; see [style](style.md) |
| Content | `src/@walle/content/` | `walleCollections()`: the products content collection, gated by `commerce.mode` |
| Commerce | `src/@walle/commerce/` | Shopify catalog loader, cart, variant picker; see [ecommerce](ecommerce.md) |
| PWA | virtual modules resolved by `define-config.ts` | Manifest, service worker, offline page; see [pwa](pwa.md) |
| CI/CD | `walle/ci/`, `.github/workflows/` | Reusable composite actions and seeded workflows; see [ci-cd](ci-cd.md) |
| OG images | `src/@walle/og/` | satori + resvg rendering behind `/og/[...slug].png`; see [seo](seo.md#og-images) |
| Feeds | `src/@walle/feeds/` | `@astrojs/rss`-backed injected route per configured feed; see [seo](seo.md#rss-feeds) |
| Utils | `src/@walle/utils/` | `label()`/i18n, structured-data builders, site-path resolution, base-path helpers |
| Scripts | `src/@walle/scripts/` | Vanilla client-side behavior for islands that don't need a framework |

## How a page is assembled

1. **`astro.config.mjs`** (consumer-owned, thin) calls `defineWalleConfig({...})`. That function
   parses the four config files, then returns a real Astro config with walle's own integrations,
   vite plugins, and virtual modules layered under any native overrides passed in.
2. **Virtual modules** (`virtual:walle-components`, `virtual:walle-features`,
   `virtual:walle-pwa`, `virtual:walle-fonts`, `virtual:walle-theme.css`) are how the parsed
   config reaches component code without every component importing `astro.config.mjs` itself.
   They also gate what enters the module graph: `virtual:walle-components` resolves only the
   selected embeddable implementation (see [components](components.md#overrides));
   `virtual:walle-features` exports `null` for commerce UI when `commerce.mode` isn't `"shop"`,
   so a site that sells nothing never bundles cart code at all.
3. **A layout** (`BaseLayout` in the common case) renders `Head`, the resolved navbar/footer,
   and the page content, wrapped in the declared cascade layers.
4. **Components** read only their own props and the shared `--variant-*`/semantic tokens; none
   of them read `theme.json`, `app.json` or any other config file directly at runtime.

## Barrels and the module graph

`@walle/components` and `@walle/layouts` are convenient barrels, but Astro collects a page's CSS
from its whole module graph, not from what the page actually renders: one
`import { Section } from "@walle/components"` would otherwise drag every component's `<style>`
onto every page that imports anything from the barrel. A build-time plugin rewrites each barrel
down to only the exports a project's sources actually import, so nothing changes in how imports
are written, only in what ends up in the graph. See [configuration](configuration.md) for where
this plugin is wired in.
