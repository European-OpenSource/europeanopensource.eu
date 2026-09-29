// Single source of truth for the shape of src/configs/{app,navbar,footer,theme}.json: the
// config types are inferred from these schemas and schemas/*.schema.json is generated from
// them (walle/cli/generate-schemas.mjs). define-config.ts (build) and config/index.ts
// (runtime) both parse with them and throw on a mismatch.
import { z } from "astro/zod";

// Re-exported so walle/cli/generate-schemas.mjs (outside this package's node_modules
// resolution scope) can reach `z.toJSONSchema`/`z.prettifyError` through this file's own
// import instead of importing "astro/zod" directly from a location where it wouldn't resolve.
export { z };

/**
 * Declares a removed key. The key stays a known property
 * (so `.strict()` reports the guidance message below instead of a generic "unrecognized
 * key" error) but only ever validates when absent.
 */
function removedKey(guidance: string) {
  const message = `This key has been removed. Use "${guidance}" instead.`;
  return (
    z
      .unknown()
      .optional()
      .refine((value) => value === undefined, { message })
      // `refine` has no JSON Schema form; `not: {}` makes ajv reject the key whenever present.
      .meta({ not: {}, description: message })
  );
}

const logoSchema = z
  .object({
    src: z.string().optional(),
    title: z.string().optional(),
    url: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    alt: z.string().optional(),
    cssClasses: z.string().optional(),
    license: z.string().optional(),
  })
  .strict();

const navigationTarget = z.enum(["_blank", "_self"]);

const dropdownLinkSchema = z
  .object({
    name: z.string().optional(),
    url: z.string(),
    icon: z.string().optional(),
    target: navigationTarget.optional(),
  })
  .strict();

const navigationLinkSchema = z
  .object({
    name: z.string().optional(),
    url: z.string(),
    icon: z.string().optional(),
    target: navigationTarget.optional(),
    dropdown: z.array(dropdownLinkSchema).optional(),
  })
  .strict();

// Footer links don't support a dropdown (matches today's footer.schema.json definitions.navigationLink).
const footerLinkSchema = z
  .object({
    name: z.string().optional(),
    url: z.string(),
    icon: z.string().optional(),
    target: navigationTarget.optional(),
  })
  .strict();

export const navbarSchema = z
  .object({
    $schema: z.string().optional(),
    logo: logoSchema,
    items: z.array(navigationLinkSchema),
  })
  .strict();

export const footerSchema = z
  .object({
    $schema: z.string().optional(),
    logo: logoSchema,
    items: z.array(footerLinkSchema),
  })
  .strict();

const websiteSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    favicon: z.string().optional(),
    image: z.string().optional(),
    robots: z.string().optional(),
    language: z.string().optional(),
    titleMaxLength: z.number().int().min(20).optional(),
    descriptionMaxLength: z.number().int().min(50).optional(),
  })
  .strict();

const astroSchema = z
  .object({
    baseUrl: z.string(),
    basePath: z.string(),
    trailingSlash: z.enum(["always", "never", "ignore"]).optional(),
    analyticsScriptContent: z.string().optional(),
    sitemapExclude: z.array(z.string()).optional(),
    // Passed straight through to Astro's native `redirects` config; its own static-output
    // redirect page already emits refresh/noindex/canonical, so walle only adds the sitemap
    // exclusion: the redirect source is never listed alongside the destination.
    redirects: z
      .record(
        z.string(),
        z.union([
          z.string(),
          z
            .object({
              destination: z.string(),
              status: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
            })
            .strict(),
        ])
      )
      .optional(),
    // Replaces the old `astro.ssr` shape: a single string toggle rather than a nested
    // { enabled, adapter } object. Adds the node adapter with `output` left at Astro's
    // default ("static"), so only routes that declare `prerender = false` render on demand.
    adapter: z.enum(["node"]).optional(),
    ssr: removedKey("astro.adapter"),
    // Astro's own `prefetch` is opt-in and off by default; walle defaults it ON with the
    // hover strategy: `false` opts a site out entirely. `strategy`/`all` are walle's
    // own friendlier names for Astro's `defaultStrategy`/`prefetchAll`.
    prefetch: z
      .union([
        z.literal(false),
        z
          .object({
            strategy: z.enum(["hover", "tap", "viewport", "load"]).optional(),
            all: z.boolean().optional(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict();

const pwaIconSchema = z
  .object({
    src: z.string(),
    sizes: z.string(),
    type: z.string().optional(),
    purpose: z.string().optional(),
  })
  .strict();

const pwaSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    shortName: z.string().optional(),
    description: z.string().optional(),
    lang: z.string().optional(),
    themeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    display: z.enum(["standalone", "fullscreen", "minimal-ui", "browser"]).optional(),
    startUrl: z.string().optional(),
    scope: z.string().optional(),
    icons: z.array(pwaIconSchema).optional(),
    appleTouchIcon: z.string().optional(),
    // Offline fallback route: `true` uses walle's managed page, a `./`-prefixed string
    // swaps in a site file: same "built-in default or site path" contract as `commerce.pages.*`.
    // Only takes effect when `enabled` is also true (there is no service worker to fall back
    // through otherwise).
    offline: z.union([z.literal(true), z.string()]).optional(),
  })
  .strict();

const commerceSchema = z
  .object({
    // Off by default: no cart UI, no /products gating. "catalog" shows products with no
    // buy controls (a showcase); "shop" is the full cart + checkout flow.
    mode: z.enum(["off", "catalog", "shop"]).default("off"),
    cartInNavbar: z.boolean().optional(),
    showAddToCartOnCards: z.boolean().optional(),
    // Site overrides for the two injected commerce routes: `./`-prefixed paths under
    // src/, same validation as `components.*`. Absent = walle's own managed pages.
    pages: z
      .object({
        list: z.string().optional(),
        detail: z.string().optional(),
      })
      .strict()
      .optional(),
    // Replaced by `commerce.mode === "shop"`.
    showBuyButton: removedKey("commerce.mode"),
    // Replaced by `website.language`: one locale for the whole site, not a commerce-only one.
    locale: removedKey("website.language"),
    // Replaced by the `labels` config.
    addToCartLabel: removedKey("labels"),
  })
  .strict();

const breadcrumbsLabelsSchema = z
  .object({ nav: z.string().optional(), back: z.string().optional(), home: z.string().optional() })
  .strict();

const carouselLabelsSchema = z
  .object({
    previous: z.string().optional(),
    next: z.string().optional(),
    zoom: z.string().optional(),
    close: z.string().optional(),
    slide: z.string().optional(),
  })
  .strict();

const filtersLabelsSchema = z
  .object({
    searchPlaceholder: z.string().optional(),
    searchLabel: z.string().optional(),
    clear: z.string().optional(),
    status: z.string().optional(),
    facetSelect: z.string().optional(),
    facetSelected: z.string().optional(),
  })
  .strict();

const cartLabelsSchema = z
  .object({
    ariaLabel: z.string().optional(),
    open: z.string().optional(),
    title: z.string().optional(),
    close: z.string().optional(),
    empty: z.string().optional(),
    subtotal: z.string().optional(),
    checkout: z.string().optional(),
    add: z.string().optional(),
    decreaseQuantity: z.string().optional(),
    increaseQuantity: z.string().optional(),
    remove: z.string().optional(),
    inStock: z.string().optional(),
    outOfStock: z.string().optional(),
    unavailable: z.string().optional(),
  })
  .strict();

const priceLabelsSchema = z
  .object({
    discounted: z.string().optional(),
    original: z.string().optional(),
  })
  .strict();

const offlineLabelsSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

const notFoundLabelsSchema = z
  .object({
    title: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

const cardLabelsSchema = z.object({ read: z.string().optional() }).strict();

const productsLabelsSchema = z
  .object({
    title: z.string().optional(),
    type: z.string().optional(),
    searchPlaceholder: z.string().optional(),
    status: z.string().optional(),
    empty: z.string().optional(),
    related: z.string().optional(),
    galleryHeading: z.string().optional(),
    gallery: z.string().optional(),
  })
  .strict();

const mapLabelsSchema = z
  .object({
    directions: z.string().optional(),
    region: z.string().optional(),
  })
  .strict();

const tocLabelsSchema = z
  .object({
    heading: z.string().optional(),
    nav: z.string().optional(),
    loading: z.string().optional(),
    expanded: z.string().optional(),
    collapsed: z.string().optional(),
    toggle: z.string().optional(),
    navigateTo: z.string().optional(),
    navigated: z.string().optional(),
  })
  .strict();

const navLabelsSchema = z
  .object({
    main: z.string().optional(),
    toggle: z.string().optional(),
  })
  .strict();

const footerLabelsSchema = z
  .object({
    nav: z.string().optional(),
    social: z.string().optional(),
  })
  .strict();

const blogLabelsSchema = z
  .object({
    publishedOn: z.string().optional(),
    readingProgress: z.string().optional(),
    articleNavigation: z.string().optional(),
    previousArticle: z.string().optional(),
    nextArticle: z.string().optional(),
    info: z.string().optional(),
    tags: z.string().optional(),
    empty: z.string().optional(),
  })
  .strict();

// Every user-facing/screen-reader string walle emits, grouped by area. Each leaf has an
// English default in i18n.ts; a component prop for the same label overrides the site value.
const labelsSchema = z
  .object({
    skipLink: z.string().optional(),
    scrollableRegion: z.string().optional(),
    logo: z.string().optional(),
    card: cardLabelsSchema.optional(),
    breadcrumbs: breadcrumbsLabelsSchema.optional(),
    carousel: carouselLabelsSchema.optional(),
    filters: filtersLabelsSchema.optional(),
    cart: cartLabelsSchema.optional(),
    price: priceLabelsSchema.optional(),
    offline: offlineLabelsSchema.optional(),
    notFound: notFoundLabelsSchema.optional(),
    toc: tocLabelsSchema.optional(),
    readingTime: z.string().optional(),
    nav: navLabelsSchema.optional(),
    footer: footerLabelsSchema.optional(),
    blog: blogLabelsSchema.optional(),
    products: productsLabelsSchema.optional(),
    map: mapLabelsSchema.optional(),
  })
  .strict();

// OG images. `enabled` defaults to false (existing sites unchanged on update); the seeded
// app.json turns it on. `templates`/`fonts` are entirely optional: absent means walle's own
// managed default template and bundled fallback font.
const ogImageFontSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    weight: z.number().optional(),
    style: z.enum(["normal", "italic"]).optional(),
  })
  .strict();

const ogImageSchema = z
  .object({
    enabled: z.boolean().optional(),
    collections: z.array(z.string()).optional(),
    // Site-path overrides, same `./`-prefixed contract as `components.*`/`commerce.pages.*`.
    // Keyed by collection name, plus the reserved "default" key.
    templates: z.record(z.string(), z.string()).optional(),
    fonts: z.array(ogImageFontSchema).optional(),
  })
  .strict();

// RSS feeds. `fields` maps a feed's own vocabulary (title/description/date/categories)
// to the collection's actual schema keys, so a collection with e.g. `publishDate` instead of
// `date` doesn't need to be renamed just to feed one.
const feedFieldsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    categories: z.string().optional(),
  })
  .strict();

const feedItemSchema = z
  .object({
    collection: z.string(),
    path: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    fields: feedFieldsSchema.optional(),
    // `{id}` substituted per entry: the collection entry's own detail page.
    link: z.string(),
    // Newest entries kept; 50 when unset.
    limit: z.number().optional(),
    excludeDrafts: z.boolean().optional(),
  })
  .strict();

const feedsSchema = z
  .object({
    enabled: z.boolean().optional(),
    items: z.array(feedItemSchema).optional(),
  })
  .strict();

// Renders a <link rel="alternate"> for a feed the site serves itself. No route is injected.
const alternateSchema = z
  .object({
    href: z.string(),
    type: z.enum(["application/rss+xml", "application/atom+xml", "application/feed+json"]),
    title: z.string().optional(),
  })
  .strict();

const seoSchema = z
  .object({
    ogImage: ogImageSchema.optional(),
    feeds: feedsSchema.optional(),
    alternates: z.array(alternateSchema).optional(),
  })
  .strict();

// Map. Absent means walle's own defaults: standard OpenStreetMap tiles, "google"
// directions.
const mapTilesSchema = z
  .object({
    url: z.string(),
    attribution: z.string(),
    subdomains: z.string().optional(),
    maxZoom: z.number().optional(),
  })
  .strict();

const mapSchema = z
  .object({
    tiles: mapTilesSchema.optional(),
    directions: z.enum(["google", "osm", "apple", "none"]).optional(),
  })
  .strict();

export const appSchema = z
  .object({
    $schema: z.string().optional(),
    website: websiteSchema,
    astro: astroSchema,
    components: z.record(z.string(), z.string()).optional(),
    pwa: pwaSchema.optional(),
    commerce: commerceSchema.optional(),
    labels: labelsSchema.optional(),
    seo: seoSchema.optional(),
    map: mapSchema.optional(),
  })
  .strict();

const themePaletteSchema = z.record(z.string(), z.string()).optional();
const themeScaleSchema = z.record(z.string(), z.string()).optional();

// One entry per self-hosted/managed font family:
// mapped to an Astro `fonts` config entry with `cssVariable: "--walle-font-<role>"` by
// define-config.ts, and exposed to components at runtime through the `virtual:walle-fonts`
// module (Head.astro can't read theme.json itself: it's only ever parsed at build time).
const fontEntrySchema = z
  .object({
    role: z.enum(["body", "heading", "mono"]),
    name: z.string(),
    provider: z.enum(["local", "google", "fontsource"]),
    weights: z.array(z.union([z.string(), z.number()])).optional(),
    styles: z.array(z.enum(["normal", "italic", "oblique"])).optional(),
    // Local-only: relative font file path(s) for a single @font-face variant (a variable font
    // covering the whole `weights` range in one file is the expected case; per-weight static
    // files are a real Astro feature this schema doesn't expose: add a `variants` array here
    // if a site needs it).
    src: z.array(z.string()).optional(),
    preload: z.boolean().optional(),
    // The generic family Astro falls back to while the real font loads (and permanently if
    // it fails). Astro only generates a metric-matched fallback @font-face (eliminating the
    // layout shift on swap) for a fixed set of generics it has system-font metrics for; the
    // others (cursive, fantasy, ...) are CSS-valid but silently skip that optimization, so
    // this enum only lists the ones that actually get it. Default "sans-serif" matches
    // Astro's own default, but a serif or monospace font should set this explicitly: the
    // wrong generic still shifts layout, just by less than falling all the way to Arial.
    fallback: z.enum(["serif", "sans-serif", "monospace", "system-ui"]).optional(),
    // CSS font-display: how the browser paints text while this font is still downloading.
    // Astro defaults to "swap" (fallback text visible immediately, swaps to the real font,
    // reflowing if its metrics differ from the fallback's). "optional" gives the browser leave
    // to skip the swap on a slow connection or a later paint, trading the reflow for a chance
    // the fallback is what the visitor sees on first load. Left absent, walle passes nothing
    // through and Astro's own default applies unchanged.
    display: z.enum(["auto", "block", "fallback", "optional", "swap"]).optional(),
  })
  .strict();

const themeTypographySchema = z
  .object({
    fontFamilyBase: z.string().optional(),
    fontFamilyHeading: z.string().optional(),
    fontFamilyMono: z.string().optional(),
    scale: themeScaleSchema,
    fonts: z.array(fontEntrySchema).optional(),
  })
  .strict();

export const themeSchema = z
  .object({
    $schema: z.string().optional(),
    palette: themePaletteSchema,
    typography: themeTypographySchema.optional(),
    spacing: z.record(z.string(), z.string()).optional(),
    radii: z.record(z.string(), z.string()).optional(),
    neutral: z.record(z.string(), z.string()).optional(),
    shadow: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type AppConfig = z.infer<typeof appSchema>;
export type NavbarConfig = z.infer<typeof navbarSchema>;
export type FooterConfig = z.infer<typeof footerSchema>;
export type ThemeConfig = z.infer<typeof themeSchema>;
export type NavigationLink = z.infer<typeof navigationLinkSchema>;
export type NavbarLogo = z.infer<typeof logoSchema>;
export type LabelsConfig = z.infer<typeof labelsSchema>;

/** Parses `data` against `schema`, throwing a `z.prettifyError` message prefixed with `fileName`. */
export function parseConfig<T>(schema: z.ZodType<T>, data: unknown, fileName: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid walle config in ${fileName}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
