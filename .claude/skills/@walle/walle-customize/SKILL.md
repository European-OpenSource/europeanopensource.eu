---
name: walle-customize
description: Customize a walle-based site through the consumer zones and the customization ladder, without touching managed @walle/ paths. Use when changing theme, colors, fonts, component styling, navigation, footer, labels, features, pages or content in a walle project.
metadata:
  author: harness-walle
  managed: "true"
---

# Customizing a walle site

Never edit `@walle/` paths: `just walle-update` overwrites them (see `walle-update`). Every change
goes in a consumer zone, using the first rung of the ladder below that does the job.

## The customization ladder

1. **`src/configs/theme.json`**: palette (`primary`, `-light`, `-dark`, `-contrast`, same for
   `secondary`, `alternative`, plus `heading`), `neutral`, `shadow`, `radii`, `spacing`,
   `typography.scale`, `typography.fonts`. Set a `*-contrast` whenever you change a variant color.
   On each `typography.fonts` entry, set `fallback` to the font's own generic family (`"serif"`,
   `"sans-serif"`, `"monospace"`, `"system-ui"`; default `"sans-serif"`) so Astro's
   metric-matched placeholder shrinks the layout shift when the real font swaps in (it reduces
   it, does not eliminate it). Set `display` (`"auto"`, `"block"`, `"fallback"`, `"optional"`,
   `"swap"`; default Astro's own `"swap"`) to trade the swap itself away: `"optional"` removes
   the layout shift entirely but may show only the fallback font on a first visit over a slow
   connection; keep `"swap"` when the font must always eventually show.
2. **Site-wide custom properties** in `src/styles/global.css`, inside `@layer site`, on the
   component root class: `.button { --button-radius: 999px; }`,
   `.site-header { --navbar-bg: var(--surface); }`, `.card { --card-radius: var(--radius-lg); }`.
3. **Props**: `variant` (`primary`, `secondary`, `alternative`, `site`), modifiers (`outline`,
   `inverse`, `filled`, `muted`, `status` on Badge), `size`. Define the `site` variant once in
   `@layer site` with `[data-variant="site"] { --variant-color; --variant-color-hover;
   --variant-bg; --variant-bg-hover; --variant-fg }`.
4. **Instance class plus properties**: `<Button class="donate-cta" />` and
   `@layer site { .donate-cta { --button-bg: #b3261e; } }`.
5. **Slots**: sections take `title`, `subtitle`, `tagline` as props or named slots (the slot wins),
   and a `background` slot.
6. **Wrapper components** in `src/components/` built only from walle's public API.
7. **Embedded component replacement** in `app.json`
   `components`: `navbar`, `footer` (`standard` or `minimal`), `card`, `breadcrumbs`, `pageHeader`,
   `toc`, each a built-in name or a `./src/...` file. To wrap the original, import it by file path
   (`../@walle/components/features/Card/BasicCard.astro`), never from `@walle/components`.

Unsupported, and silently broken by updates: selectors on walle's inner classes (anything with
`__`, `.section-title`, `.cta-card`), `!important` on walle selectors, repeated classes
(`.button.button`), `:global()` rules on walle components, palette values redefined in CSS.

## Where each change goes

| Change | File |
|---|---|
| Site identity, SEO, features, labels, language | `src/configs/app.json` |
| Navigation, footer | `src/configs/navbar.json`, `src/configs/footer.json` |
| Design tokens and fonts | `src/configs/theme.json` |
| Site CSS | `src/styles/global.css`, inside `@layer site` |
| Pages, routes | `src/pages/` |
| Content collections | `src/content/`, `src/content.config.ts` |
| Project components | `src/components/` |
| Native Astro config | `astro.config.mjs`, inside `defineWalleConfig({})` |

## Features

All off unless set in `app.json`; walle injects the routes they need, so never add pages at the
same paths.

- `commerce.mode`: `off` (default), `catalog` (products, no cart), `shop` (cart and checkout).
  Products come from Shopify at build time (`PUBLIC_SHOPIFY_STORE`,
  `PUBLIC_SHOPIFY_STOREFRONT_TOKEN`); with neither set, a demo catalog is used. Walle provides
  `/products` and `/products/[handle]`; `commerce.pages.list` and `commerce.pages.detail` point to
  site replacements. In `content.config.ts`, spread `walleCollections(appConfig.commerce?.mode)`
  from `@walle/content`.
- `pwa.enabled` and `pwa.offline` (`true` or a `./src/...` page).
- `seo.ogImage`: generated social images, `templates` per collection.
- `seo.feeds`: RSS feeds from collections.
- `astro.redirects`: redirects, kept out of the sitemap.
- `astro.adapter: "node"`: on-demand routes (`prerender = false`), the rest stays static.
- `map`: tile server and directions provider for the `Map` component.

## Language

`website.language` (for example `it-IT`) formats every date, price and number. Translate walle's
interface strings in `app.json` `labels` (`skipLink`, `cart.*`, `filters.*`, `notFound.*`,
`readingTime`, ...); a component prop still overrides a label for one instance.

## Validate

```bash
just validate-configs   # config files against their schemas
just build              # an invalid config stops the build with the file and key path
just dev
```

Never edit `schemas/`: it is managed and generated from walle's config schema.
