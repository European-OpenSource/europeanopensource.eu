---
title: SEO
order: 8
---

# SEO

Everything that shapes how a page is described to a browser tab, a search engine, a social
share, or a crawler.

## Head

`Head.astro` renders every `<head>` metadata tag: charset, viewport, favicon, canonical URL,
title and description, Open Graph and Twitter card tags, the sitemap pointer, and (when
enabled) the PWA manifest link and RSS alternate links.

### Title and description

Both accept an opt-in length budget (`website.titleMaxLength`/`descriptionMaxLength`); absent,
today's title and description pass through byte for byte.

A title over budget drops the `" | " + website.title` suffix rather than truncating: the page's
own title is the actual content, the site name is boilerplate repeated on every page. On a real
site whose page titles are event or product names, most over-budget titles were only over budget
because of that fixed brand suffix; the name itself already fit. Truncating a meaningful title
to make room for a repeated brand suffix would trade the useful half for the redundant one.
Search engines truncate the SERP display around 60 characters but still rank on the full title,
so this is a click-through concern, not a ranking one: a title that stays long because the
page's own name is long is left alone, no ellipsis, no cut, it just loses the suffix first.

The description gets the opposite treatment: prose has no boilerplate half to drop, so an
over-budget description is cut at the last word boundary that fits and gets an ellipsis. Search
engines truncate it anyway past roughly 155 characters; cutting on a word boundary just means it
ends on a word instead of mid-syllable, and the full text is still on the page regardless.

### Open Graph image fallback chain

An explicit `ogImage` prop wins, then a layout's own per-entry image (e.g. `BlogPostLayout`
passing `ogImageUrl("posts", id)`), then the site-wide generated default (only when
`seo.ogImage.enabled`), then the plain `image` config value.

## Structured data

`StructuredData.astro` renders one `<script type="application/ld+json">` from a plain object or
array (`@context` added automatically). `@walle/utils/structured-data` exports builders for the
common shapes: `websiteJsonLd`, `organizationJsonLd`, `articleJsonLd`, `productJsonLd`.
`AbstractLayout` emits `WebSite` + `Organization` from config on every page; `BlogPostLayout`
emits `Article`; `DetailLayout` emits `Product`/`Offer` when given a product, so a page only
ever adds its own extra shapes on top. The payload's `<`, `>` and `&` are escaped to their JSON
unicode forms before being embedded: a plain JSON payload can only break out of the `<script>`
element through a literal `</script>` string inside untrusted data (e.g. a synced product
description), and this neutralizes exactly that.

## Sitemap

Astro's own `@astrojs/sitemap` integration, filtered by `isSitemapExcluded()`. The exclude list
merges `astro.sitemapExclude`, every `astro.redirects` source (a redirect's source is never
listed next to its own destination), the `/offline` path when `pwa.offline` is set, and every
enabled `seo.feeds` item's path (a feed is a machine-readable alternate of a listing page, never
content of its own). You never need to list a redirect source or an enabled feed path in
`sitemapExclude` yourself.

## Robots and llms.txt

`src/pages/robots.txt.ts` and `src/pages/llms.txt.ts` are seed files (consumer-owned after
scaffold), not part of the managed engine, but demonstrate the pattern: both read `@walle/config`
so the site URL, base path, and indexing intent (`website.robots` containing `noindex`) stay
correct without a hardcoded string. `llms.txt` ([llmstxt.org](https://llmstxt.org)) is a
build-time markdown index of the site for AI crawlers; it gates its Products section on
`commerce.mode` the same way the injected commerce routes do, since the collection doesn't exist
when commerce is off. Extend either file's `lines` array for your own site structure.

## Redirects

`astro.redirects` passes straight through to Astro's own native `redirects` config; Astro's
static-output redirect page already emits `refresh`/`noindex`/`canonical` on the source path, so
walle only adds the sitemap exclusion described above. Destinations are written as bare paths,
same convention as every other walle path, and get the site's base path prefixed automatically.

## OG images

`seo.ogImage.enabled` injects `/og/[...slug].png`: `default` for the site-wide image,
`<collection>/<id>` for one per entry of every collection listed in `seo.ogImage.collections`.
Rendering (`src/@walle/og/render.ts`) uses [satori](https://github.com/vercel/satori) to lay out
a plain-object element tree to SVG, then [`@resvg/resvg-js`](https://github.com/thx/resvg-js) to
rasterize it to PNG; both are dynamically imported, so a site that never enables `seo.ogImage`
never pulls either native binary into its build graph. Template precedence is
`seo.ogImage.templates[collection] ?? templates.default ?? walle's own default template`, each
resolved and cached once per absolute path per build.

Fonts (`og/fonts.ts`) resolve in order: `seo.ogImage.fonts` (explicit for OG rendering), then the
site's `typography.fonts` local sources in a format satori accepts (`ttf`, `otf`, `woff`, never
`woff2`: satori's font parser can't inflate brotli), then a bundled Inter fallback (SIL OFL
1.1). Resolution never touches the network. Theme (`og/theme.ts`) resolves palette, fonts, site
title and logo fully from the parsed config, no arguments needed at the call site; `theme.json`'s
palette and fonts reach it through a virtual module filled at config time, since the prerender
chunk cannot read the file from disk.

## RSS feeds

`seo.feeds.items[]` each get an injected route (`src/@walle/feeds/route.ts`, one entrypoint per
configured item) built on `@astrojs/rss`. `fields` maps a feed's own vocabulary
(`title`/`description`/`date`/`categories`) onto the collection's actual schema keys, so a
collection using e.g. `publishDate` instead of `date` doesn't need renaming just to feed one.
Drafts are excluded when `excludeDrafts` is set, entries sort by date descending, `limit` caps
the result (50 when unset), and a missing mapped field on a kept entry fails the build naming the feed,
collection, and field. `Head.astro` emits one `<link rel="alternate" type="application/rss+xml">`
per enabled feed item; disabled means no route and no link at all.

## Alternate feed discovery

`seo.alternates[]` renders a `<link rel="alternate">` for a feed the site serves itself (a route
`seo.feeds` can't express, e.g. custom filtering or shaping logic beyond a collection dump). Each
entry is `{ href, type, title? }`, `type` one of `application/rss+xml`, `application/atom+xml`,
`application/feed+json`. No route is injected: `href` must already resolve to a route the site
provides. `title` falls back to `website.title`. Renders alongside, not instead of, the
`seo.feeds` links above.
