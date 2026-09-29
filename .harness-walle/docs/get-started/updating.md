---
title: Updating
order: 4
---

# Updating

## The update flow

```bash
just walle-update          # re-sync the @walle/ engine to the pinned or latest release
just walle-deps            # report dependency drift against walle's package.json
just walle-deps --apply    # align walle-owned dependencies and add missing runtime ones
just walle-check           # validate the manifest, the version pin and the configs
just build
```

`walle-update` rewrites managed files only (everything under `@walle/` paths, the JSON schemas and
the managed CI actions). Your pages, content, configs and styles are never touched. The pinned
release lives in `.harness-walle/manifest.json` as `walleVersion`; to move to a specific release,
pass it explicitly (`just walle-update -w v0.7.0`). To roll back, update again with the previous
tag.

Before updating across a minor version, read the migration guide for that release below. Releases
before 1.0 may break the public API in a minor version; the [CHANGELOG](../../CHANGELOG.md) marks
those entries as BREAKING.

## Migrating to 0.7.0

0.7.0 turns walle's styling and configuration into a public, documented extension model: cascade
layers, public custom properties, one variant vocabulary, embedded component overrides, and a
config that is validated at build time. Most sites need a few config edits and can then delete
their CSS workarounds. Work through the steps in order and build after each one.

### 1. Prerequisites

Sites below 0.6 apply the intermediate CHANGELOG entries first, then update to 0.7.0. Then run
`just walle-deps --apply`: 0.7.0 adds `leaflet`, `satori` and `@resvg/resvg-js` and moves several
dependencies to new majors.

One of those majors is `vitest` 4 to 5, a walle-owned dependency: if your site has no
`vitest.config.ts`, vitest falls back to its own default include glob (`**/*.{test,spec}.*`),
which also matches any Playwright `*.spec.ts` file and fails `yarn test:unit` with something
like `test.describe() not expected here`. Add a `vitest.config.ts` scoped to your real unit
specs, the same convention walle's own website uses:

```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

Set the site's Node version to 24, which the 0.7.0 `engines` field requires: `.nvmrc`, plus any
`node-version` in your own workflows (the walle test action reads `.nvmrc`). `update` never
touches `.nvmrc`, a seed file, so change it yourself.

If your pre-commit hook or CI runs `prettier --check .`, add the paths walle writes to your
`.prettierignore` (also a seed file, so `update` leaves it alone). Walle's own source under
`src/@walle` is prettier-clean, but these are generated or copied by the CLI, and the marker block
in `AGENTS.md` must stay byte exact:

```text
.vscode/settings.json
.vscode/extensions.json
AGENTS.md
.harness-walle
.harness-coding
.claude/skills/@walle
test-results
playwright-report
```

Also fix `.husky/pre-commit` if it came from an older seed. `cmd || (fix; exit 1)` only exits the
subshell, so a lint or format error never stopped the commit. Use braces:

```sh
yarn lint || { yarn lint:fix; exit 1; }
yarn format || { yarn format:fix; exit 1; }
```

and `yarn lint && yarn test:unit` in `.husky/pre-push`.

### 2. Config

The build now validates every config file and stops on an error that names the file and the key.

| Before | After |
|---|---|
| `astro.ssr.enabled: true` | `astro.adapter: "node"` (the site stays static; only routes with `prerender = false` render on demand) |
| `commerce.showBuyButton: true` | `commerce.mode: "shop"` |
| `commerce.showBuyButton: false` with a catalog | `commerce.mode: "catalog"` |
| a `commerce` block on a site that sells nothing | delete the block: commerce is off by default |
| `commerce.locale` | `website.language` (drives every date, price and number) |
| `commerce.addToCartLabel` | `labels.cart.add` |
| redirect pages or a catch-all redirect route | `astro.redirects`; redirect sources leave the sitemap automatically, so drop their `sitemapExclude` entries |
| unknown keys | removed: the build names them |

Dates follow `website.language`: with `en-US` a date reads "Jul 31, 2025", with `en-GB` it keeps the
day month year order ("31 Jul 2025"). Set the language that matches the format your site showed
before.

Add `labels` for every walle interface string you want in your own language: skip link,
breadcrumbs, carousel, filters, cart, price, offline page, 404, table of contents, navigation,
footer, blog, products and reading time. Anything missing stays in English.

Commerce pages and collections are now provided by walle:

- Delete the seeded `src/pages/products/index.astro`, `src/pages/products/[handle].astro` and any
  `src/pages/products/example*.astro` demo pages from 0.6.x: walle injects `/products` and
  `/products/[handle]` when `commerce.mode` is `catalog` or `shop`, and a local file on the same
  path collides with it. To keep a customized page, move it outside `src/pages/` and point
  `commerce.pages.list` or `commerce.pages.detail` at it.
- In `src/content.config.ts`, replace your own products collection (and its `shopifyLoader`
  import) with walle's:

  ```ts
  import { walleCollections } from "@walle/content";
  import appConfig from "./configs/app.json";

  export const collections = { posts, ...walleCollections(appConfig.commerce?.mode) };
  ```

- Guard any page of yours that reads the products collection (for example `llms.txt.ts`) on
  `commerce.mode`, since the collection does not exist when commerce is off.

RSS: `Head` no longer emits an `rss.xml` alternate link by default; it emits one per enabled
`seo.feeds` item. If you have your own `src/pages/rss.xml.*`, either move the feed to `seo.feeds`
(walle then provides the route and the link) or keep your page and add the link yourself. Delete
your page if it uses the same path as a configured feed.

### 3. Theme

Move design values defined in your CSS into `theme.json`:

| In your CSS | In `theme.json` |
|---|---|
| brand colors | `palette.primary`, `-light`, `-dark` (same for `secondary`, `alternative`) |
| text color on filled brand backgrounds | `palette.primary-contrast` (and `secondary-`, `alternative-`) |
| heading color | `palette.heading` |
| gray scale | `neutral.light`, `base`, `medium`, `dark`, `darker` |
| shadows | `shadow.sm`, `md`, `lg` |
| radii | `radii.sm`, `md`, `lg`, `xl` |
| `@font-face` rules or a Google Fonts import | `typography.fonts` (self-hosted at build time) |

Fonts from the `google` provider are served through Astro's Fonts API and can carry different
metrics than Google's own CSS API returns, so text may set slightly wider or narrower than before.
If a site must match its old rendering exactly, use the `fontsource` provider for that family and
compare in a browser.

Token renames:

| Before | After |
|---|---|
| `--box-shadow` | `--shadow-md` |
| `--box-shadow-hover` | `--shadow-lg` |
| `--transition-smooth` | `--transition` or `--transition-normal` |
| `--gray-gradient` | removed |
| `palette.accent`, `palette.muted` | removed (they were never used) |

Default values that changed and are visible on a site without its own `theme.json` palette:

| Token | Before | After |
|---|---|---|
| `--alternative` | `#c99a3f` | `#8a6423` |
| `--alternative-dark` | `#a97f2c` | `#73531d` |
| `--alternative-contrast` | `--black` | `--white` |
| `--status-success` | `#1f874b` | `#1b7a43` |

These clear WCAG AA as both text and fill. Set your own values in `theme.json` to keep the old
look.

### 4. CSS

Wrap all of your CSS in `@layer site { }`. It then beats walle without any specificity tricks, and
most workarounds can be deleted. Replace each pattern with a supported rung of
[the customization ladder](customize.md):

| Pattern in your CSS | Replace with |
|---|---|
| repeated classes to win specificity (`.button.button.button`) | the plain selector inside `@layer site` |
| `!important` on walle selectors | the component's public custom property |
| radius overrides on walle components | `theme.json` `radii` or `--<component>-radius` |
| selectors on walle inner classes (`.section-title`, `.header-title`, `.text-container`) | `--heading`, the component's properties, or a slot |
| `:global(.button)` or other `:global()` rules on walle components | a `class` on the component plus custom properties |
| a footer wrap fix | nothing: the footer navigation wraps by default |
| colors for a one-off brand variant | the `site` variant |

Walle ships a global `.prose` class (`styles/prose.css`) for rendered markdown. Any element of
yours that uses the class name `prose` now inherits its font size, line height, colors, paragraph,
heading and list rules. Rename your own class (for example `page-text`), or restyle the element in
`@layer site`.

Removed global helpers:

| Before | After |
|---|---|
| spacing utility classes | your own CSS in `@layer site`, or component props |
| `visible-xs`, `visible-sm` | your own media queries |
| `container-centered`, `text-centered` | the `centered` prop on sections |
| `ul.meta-info`, `ul.tags` global styles | styled inside the components that use them |
| global `section` padding | the section components own their spacing (`--wrapper-padding-y`) |

A plain `<section>` element of your own no longer gets vertical padding from walle. If one relied
on it, give it padding in `@layer site`, or use a walle section component.

### 5. Components

| Component | Before | After |
|---|---|---|
| Button | `variant="white"` | `inverse` |
| Button | `variant="white"` with `outline` | `inverse outline` |
| Button | `effects` | removed |
| Badge | `variant="gray"` | `muted` |
| Badge | `variant="success"`, `"warning"`, `"danger"` | `status="success"`, `"warning"`, `"danger"` |
| Link | `variant="default"` | no prop |
| Link | `variant="muted"`, `variant="unstyled"` | `muted`, `unstyled` |
| Section, SectionFlow, SectionColumns | `variant="gray"` | `muted` |
| Section, SectionFlow, SectionColumns | `variant="primary"` | `filled` (plus `variant` for another color) |
| HeaderStandard | `variant="white"` | no prop (the default) |
| HeaderStandard | `variant="primary"` | `filled` |
| HeaderStandard | `variant="secondary"` (the light band) | `muted` |
| DetailLayout | CSS on `.detail-badges` | `badgesAlign` |

Visible changes in components:

- HeaderStandard: `imageRight` used to have no effect, so the image always rendered after the text.
  It now works as documented: the image comes first by default and `imageRight` puts it after. If
  your header relied on the old behavior, add `imageRight`.
- Section content keeps a 16px gutter at 640px and below (it was 24px). To restore the old
  gutter: `@layer site { @media (max-width: 640px) { .section-wrapper { --wrapper-gutter: var(--space-lg); } } }`.
- Blog post tags use the theme radius instead of a pill. For the old pill:
  `@layer site { .tag { --blog-tag-radius: 2rem; } }`.

### 6. Features

Replace site code that walle now provides:

| Your site has | Use |
|---|---|
| an offline page plus a workbox rule for it | `pwa.offline: true` (or a `./` path to your own page); remove the page, the rule and its `sitemapExclude` entry |
| custom workbox `globIgnores` for cart chunks, `BlogTableOfContents`, or a glob for font files | remove them: walle ignores commerce chunks when commerce is not `shop`, ignores `BlogTableOfContents` by default, and precaches self-hosted fonts |
| a preload filter set outside walle for a font with many weights or styles | `typography.fonts[].preload` also accepts an array of `{ weight, style, subset }` to preload only those |
| an Open Graph image endpoint | `seo.ogImage`, with a custom template per collection if needed |
| a local leaflet map component | `Map` |
| a collection-based RSS endpoint | `seo.feeds` (keep your own if it filters entries, emits other formats, or reads a nested field: `fields` maps top-level entry fields only) |
| your own feed endpoint (custom filtering/shaping `seo.feeds` can't express) | keep the route, add it to `seo.alternates` so `Head` still emits its `<link rel="alternate">` |
| a Google Fonts import or `@font-face` rules | `theme.json` `typography.fonts` |
| a local hero or call-to-action section | compare with `Hero` and `CallToAction` |

### 7. Verify

```bash
just validate-configs
just build
```

Then check the pages that had CSS overrides in a browser, at desktop and at 320px width.
