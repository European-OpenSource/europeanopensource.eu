---
title: Components
order: 3
---

# Components

All `@walle` components are MANAGED: they live in `src/@walle/components/` and are re-synced on
every `walle update`. Customize through configs, CSS variables, slots, and the consumer's own
component layer described below, never by editing them in place.

## Authoring template

Every component pulls from `src/@walle/components/shared/`:

- `types.ts`: `BaseProps` (`id?`, `class?`, plus native attribute passthrough), `Variant` (the
  fixed set: `primary` | `secondary` | `alternative` | `site`), `VariantProps` (`variant?`),
  `ModifierProps` (`outline?`, `filled?`, `muted?`, `inverse?`), `Size`.
- `attrs.ts`: `linkAttrs(href, target)` (one `rel` rule, computed once instead of duplicated per
  link-rendering component), `variantAttrs(props)` (data attributes, default `primary`),
  `splitProps(props, keys)` (separates a component's own props from passthrough).

A component only declares the props it adds on top of these; it never redefines `variant`,
`outline`, `id`, or `class` itself.

**Prop order:** `BaseProps` fields, then `VariantProps`, then the `ModifierProps` the component
actually supports, then its own props.

**Style block order:** public properties (with defaults) → structure (layout, box model) →
variant mapping (`--button-bg: var(--variant-bg);`, never a palette token directly) → modifiers
(remapping which variant token feeds a public property, never the variant itself) → responsive →
reduced motion.

**Public vs internal custom properties:** `--<prefix>-*` (e.g. `--button-bg`) is public, part of
the component's contract, meant to be overridden. `--_<prefix>-*` (leading underscore) is
internal scratch state the component's own style block uses between rules, never meant to be set
from outside.

Every visual component root receives `{...rest}` (the passthrough half of `splitProps`) spread
after its own attributes, so a consumer's `data-*`, `aria-*`, or event handler always wins over
the component's own defaults.

## Variants and modifiers

Every component that reads `--variant-*` emits `data-variant` on its own root (default
`primary`), so the nearest definition is always its own; a parent's variant never leaks into a
nested component. Modifiers (`data-outline`, `data-filled`, `data-muted`, `data-inverse`) are
emitted only when their prop is `true` (never `"false"`); they remap which variant tokens feed
the component's public properties, not the variant itself. `site` is a variant like any other,
left empty by default so a consumer defines it once and every component picks it up. See
[style](style.md#the-variant-model) for the token mechanics.

**`Link` is the one exception**: its `variant` prop has no default, and `data-variant` is
emitted only when a caller passes one. With no `variant` prop, a `Link` reads the semantic
`--link`/`--link-hover` tokens (0.7.2), not the primary variant's colors, so a site that
overrides `--link` independently of `--primary` (e.g. for AA contrast on body-text links,
which don't sit on a filled surface the way a `Button` does) reaches every unvaried `Link`.
Passing an explicit `variant` still switches to that variant's own `--variant-color`/
`--variant-color-hover` pair.

| Component | Variant | Modifiers |
|---|---|---|
| `Badge` | ✓ | `outline`, `muted` |
| `Button` | ✓ | `outline`, `inverse` |
| `Link` | ✓ | `muted`, `unstyled` |
| `BasicCard` | ✓ | none |
| `ProductCard` | ✓ | none |
| `Map` (per marker) | ✓ | none |
| `Section`, `SectionColumns`, `SectionFlow`, `Hero`, `CallToAction` | ✓ | `filled`, `muted` |
| `HeaderStandard` | ✓ | `filled`, `muted` |
| `SectionWrapper` (internal, composed by the above) | ✓ | `filled`, `muted` |

A filled `Button` derives its hover state from `--button-bg` (30% toward `--black`), so
overriding `--button-bg` on a class moves the hover with it; `--button-bg-hover` is there for
an exact color. The variant's `*-dark` token still drives link hover and the hover text of
outline and inverse buttons, not the filled background. A light variant (one with a dark
`-contrast`) should also set `--button-bg-hover`, since darkening the background lowers the
contrast against dark text.

Components not listed have no variant or modifier: `Image`, `Price`, `Navbar`, `Footer`,
`Breadcrumbs`, `Carousel`, `CollectionFilters`, the blog components, `Head`, `StructuredData`.

## Public custom properties

Every `--<prefix>-*` a consumer can set, by component. Properties prefixed `--_` are internal
and excluded; see the [customization ladder](../get-started/customize.md#2-site-wide-component-custom-properties)
for how to set these.

**Elements** (`@walle/components/elements/`)

| Component | Properties |
|---|---|
| `Badge` | `--badge-bg`, `--badge-fg`, `--badge-border`, `--badge-radius`, `--badge-padding` |
| `Button` | `--button-bg`, `--button-bg-hover`, `--button-fg`, `--button-border`, `--button-radius`, `--button-padding-x`, `--button-padding-y`, `--button-shadow`, `--button-font-weight` |
| `Image` | `--image-radius` |
| `Link` | `--link-color` (default `--link`, or `--variant-color` when `variant` is set), `--link-color-hover` (default `--link-hover`, or `--variant-color-hover`), `--link-decoration` |
| `Price` | `--price-color`, `--price-compare-color` |

**Features** (`@walle/components/features/`)

| Component | Properties |
|---|---|
| `BasicCard` | `--card-bg`, `--card-border`, `--card-radius`, `--card-padding`, `--card-shadow`, `--card-shadow-hover`, `--card-title-color`, `--card-title-color-hover` |
| `ProductCard` | `--product-card-bg`, `--product-card-border`, `--product-card-radius`, `--product-card-padding`, `--product-card-shadow`, `--product-card-shadow-hover`, `--product-card-title-color`, `--product-card-title-color-hover` |
| `Carousel` | `--carousel-control-bg`, `--carousel-control-fg`, `--carousel-radius`, `--carousel-gap`, `--carousel-height`, `--carousel-arrow-radius`, `--carousel-lightbox-img-shadow`, `--carousel-lightbox-close-radius`, `--carousel-lightbox-close-bg`, `--carousel-lightbox-close-bg-hover` |
| `CollectionFilters` | `--chip-bg`, `--chip-bg-active`, `--chip-fg`, `--chip-radius` |
| `Footer` (standard) | `--footer-bg`, `--footer-fg`, `--footer-link-color`, `--footer-link-color-hover`, `--footer-border`, `--footer-gap`, `--social-icon-radius` |
| `Footer` (minimal) | `--footer-bg`, `--footer-fg`, `--footer-link-color`, `--footer-link-color-hover`, `--footer-border`, `--footer-gap` |
| `Navbar` (standard) | `--navbar-bg`, `--navbar-fg`, `--navbar-border`, `--navbar-shadow`, `--navbar-height`, `--navbar-logo-height`, `--navbar-logo-height-mobile`, `--navbar-link-color`, `--navbar-link-color-hover`, `--navbar-dropdown-bg`, `--navbar-dropdown-radius` |
| `Navbar` (minimal) | `--navbar-bg`, `--navbar-fg`, `--navbar-border`, `--navbar-link-color`, `--navbar-link-color-hover` |
| `Breadcrumbs` | `--breadcrumbs-color`, `--breadcrumbs-current-color`, `--breadcrumbs-separator-color` |
| `BlogArticleNavigation` | `--article-nav-bg`, `--article-nav-border`, `--article-nav-radius`, `--article-nav-link-color`, `--article-nav-link-color-hover` |
| `BlogReadingProgress` | `--progress-color` |
| `BlogTableOfContents` | `--toc-bg`, `--toc-border`, `--toc-radius`, `--toc-link-hover-bg`, `--toc-link-active-bg`, `--toc-link-navigating-bg` |
| `Map` | `--map-height`, `--map-radius`, `--map-border`, `--map-marker-size`, `--map-marker-bg`, `--map-marker-fg`, `--map-marker-radius`, `--map-popup-bg`, `--map-popup-fg`, `--map-popup-radius`, `--map-control-bg`, `--map-control-fg`, `--map-control-radius` |
| `SectionWrapper` (and every section built on it: `Section`, `Hero`, `CallToAction`) | `--wrapper-bg`, `--wrapper-fg`, `--wrapper-title-color`, `--wrapper-padding-y`, `--wrapper-max-width`, `--wrapper-gutter` |
| `SectionFlow` | `--section-flow-step-bg`, `--section-flow-step-fg` (plus `SectionWrapper`'s own) |
| `SectionColumns` | `--section-columns-gap` (plus `SectionWrapper`'s own) |
| `HeaderStandard` | `--header-standard-image-radius` (plus `SectionWrapper`'s own) |
| `BlogPostLayout` tags (`.tag`) | `--blog-tag-radius` |

**Commerce** (`@walle/commerce/`, mounted only when `commerce.mode` is `"shop"`)

| Component | Properties |
|---|---|
| `VariantPicker` | `--cart-add-bg`, `--cart-add-bg-hover` |
| `CartBadge` | `--cart-badge-bg`, `--cart-badge-fg` |
| `CartMount` | `--cart-drawer-bg`, `--cart-drawer-border`, `--cart-backdrop`, `--cart-checkout-bg`, `--cart-checkout-bg-hover` |

`Analytics`, `Head` and `StructuredData` render no visual chrome and publish no custom
properties.

## Overrides

Some features are **embeddable**: a site swaps the whole implementation from `app.json`'s
`components` key, once per key, without editing walle's source:

```json
{
  "components": {
    "navbar": "standard",
    "card": "./src/components/EventCard.astro"
  }
}
```

| Key | Built-in values |
|---|---|
| `navbar` | `standard`, `minimal` |
| `footer` | `standard`, `minimal` |
| `card` | `standard` |
| `breadcrumbs` | `standard` |
| `pageHeader` | `standard` |
| `toc` | `standard` |

An absent key defaults to `standard`. A `./`-prefixed value points at a site file under `src/`;
an unrecognized built-in name fails the build listing the available values. Layouts import from
the virtual module `virtual:walle-components`, resolved to exactly the selected implementation
per key, so only the chosen file ever enters a page's module graph.

**To extend the original instead of replacing it,** import walle's file by its own path, never
through `@walle/components`: the barrel re-exports from the same virtual module the resolver
uses, so importing the embeddable's own key through it would cycle back to your override.

```astro
---
import BasicCard from "../@walle/components/features/Card/BasicCard.astro";
const props = Astro.props;
---

<div class="event-card">
  <BasicCard {...props} />
</div>
```

`Navbar` and `Footer` also expose slots (`brand`, `actions` on `Navbar`) for a smaller
customization than a full swap, and `BaseLayout` exposes `navbar`/`footer` slots that replace
the resolved component outright for one page.

## Breadcrumbs

Each crumb is `white-space: nowrap` (an unbreakable box); `flex-wrap` on the list can only push
a box to the next line, never shrink one that's already wider than the container. A long label
would otherwise push the whole document wider than the viewport and give the page a horizontal
scrollbar, so an overlong label is clipped instead, and every label that fits renders identically
to before.

On a narrow screen the current page's crumb is hidden: it's the visitor's own `<h1>` directly
below it on every page that uses this component, so keeping it would spend a second line on an
ellipsised copy of that heading, while the trail still reads as the actually-navigable parents.
On a two-item trail (`Home / Current`, the shape of a top-level page), `Home` is already the
first visible crumb once hidden, so a trail only loses its last crumb when something is left to
show after it.

## Map

Server HTML is a labelled region wrapping a sized mount container plus an ordered list of
markers: the list is the only visible content without JavaScript, and stays reachable by
assistive technology after the client hides it. Coordinates outside a valid lat/lng range are
dropped; with nothing left to show, the component renders nothing at all.

Leaflet's own stylesheet is not part of any Astro style block: `Map/leaflet.css` holds a single
`@import "leaflet/dist/leaflet.css" layer(walle.components)`, and `leaflet-styles.ts` injects it
as a `<style>` element when the map initializes. Astro links every stylesheet in a page's module
graph, dynamic imports included, so importing it as CSS would link it on every page whose module
graph reaches `Map`, whether or not a map renders; injecting it as text keeps it out until a map
exists, and the layer wrapper keeps walle and site rules winning over leaflet's defaults.
Walle's own marker/popup/control rules live in a `<style is:global>` block, because Astro's
scoped-style compiler would append this component's scope attribute to selectors that leaflet
creates at runtime and can never match. They are prefixed with `.map__container` so they only
ever restyle a walle `Map`; see
[style](style.md#section-wrapper-crossing-the-scoping-boundary) for the general mechanism.
Leaflet, its stylesheet, and the map runtime are all loaded lazily on scroll, in their own
chunk, never in the page's eager bundle.

The public `--map-*` properties are declared on the root `.map` class (the component's own
`<section>`), so a site sets them on `.map`, on its own class passed as `class`, or on any
wrapper, without reaching into `.map__container`.

Each marker takes an optional `variant`, so a map with several locations can color them
independently the same way any other component does.

**Privacy:** tile requests are sent directly to the tile provider and expose the visitor's IP,
though they set no cookies. The default is standard OpenStreetMap tiles; point `map.tiles` (or
the component's own `tiles` prop) at a self-hosted or EU-based provider if that matters for your
site.
