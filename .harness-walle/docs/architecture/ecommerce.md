---
title: Ecommerce
order: 5
---

# Ecommerce

An optional Shopify-headless catalog read at build time, a client-side cart, and the hosted
Shopify checkout. The site stays fully static: no SSR, no adapter, no own backend, no payment
data ever touches it.

## Modes

`commerce.mode` in `app.json` picks one of three states; the default is `"off"`.

| Mode | Products route | Cart, add-to-cart, checkout |
|---|---|---|
| `off` | Neither `/products` nor `/products/[handle]` is injected | None: `CartMount`/`CartBadge` resolve to `null` at the module-graph level, so no cart code reaches the bundle at all |
| `catalog` | Both routes injected | None: a browsable catalog with no buy controls |
| `shop` | Both routes injected | Full: variant picker's add-to-cart, cart drawer, hosted checkout |

`commerce.pages.list` / `.detail` swap either injected route's entrypoint for a site file
(`./`-prefixed, same contract as `components.*`); absent, walle's own `commerce/pages/index.astro`
and `commerce/pages/[handle].astro` are used. `commerce.cartInNavbar` puts the cart trigger in
the navbar's `actions` slot instead of the default floating badge.
`commerce.showAddToCartOnCards` controls whether the listing's cards carry their own add-to-cart
control in `shop` mode.

Every string the two routes render (page title, filter labels, empty state, "You might also
like", gallery labels) comes from the `labels.products.*` keys, with English defaults; the
add-to-cart text is `labels.cart.add`. The pages show no demo copy: the note about the bundled
demo catalog appears only while the Shopify env vars are unset.

## Catalog: build time

`shopifyLoader()` (`src/@walle/commerce/shopify.ts`) is an Astro Content Layer loader. With
`PUBLIC_SHOPIFY_STORE` and `PUBLIC_SHOPIFY_STOREFRONT_TOKEN` set, it fetches the live catalog
from the Storefront API (paginated, cursor-based) plus one `RELATED` recommendations query per
product. Without them, it serves a bundled fixture (`fixture.ts`) so `catalog`/`shop` mode
builds and demos with zero credentials. `walleCollections(commerceMode)` in
`src/@walle/content/` wires the loader into the `products` collection only when commerce isn't
off, so the collection (and its `shopifyLoader` import) doesn't exist in the module graph at all
on a site that sells nothing.

## Cart: browser only

`src/@walle/commerce/cart.ts` is loaded only when `commerce.mode === "shop"`. It holds
nanostores state (`cart`, `cartOpen`), persists the cart id in `localStorage`, and talks to the
Storefront Cart API directly from the browser (`cartCreate`, `cartLinesAdd`, `cartLinesUpdate`,
`cartLinesRemove`). With no Storefront env vars set, it falls back to an in-memory mock
(`cart-mock.ts`, built from the same fixture) so the full add/update/remove/checkout flow works
end to end with no store connected; the mock cart also persists to `localStorage`, and switches
to the live API automatically the moment real env vars are present, with no code change.
Checkout is a redirect to `cart.checkoutUrl`, the hosted Shopify checkout: no payment data is
ever handled by the site.

## Components

| Component | Role |
|---|---|
| `VariantPicker` | Vanilla option chips (sold-out values disabled), live price/availability, optional quantity stepper, add-to-cart |
| `ProductBuyCard` | Listing card composing the visual with a compact `VariantPicker` |
| `CartBadge` | Cart trigger, floating or in the navbar |
| `CartMount` | Cart drawer (`<dialog>`) plus the wiring; mounted only in `shop` mode |

`formatMoney()` requires an explicit `locale` (site language from config), never a silent
fallback: this module is also loaded inside the Content Layer loader's own build graph, a
separate one from regular components, and importing `@walle/config` into it drags
`vite-plugin-pwa` along and breaks the build.

## Setting up Shopify

1. In Shopify Admin, add products with a title, description (synced verbatim as the product
   page body), media, and variants (options like `Size: S / M / L`, each with its own price,
   compare-at price, and stock).
2. Install the **Headless** channel (Settings → Apps and sales channels), open it, and copy the
   Storefront API **public** access token. Only products published to the Headless channel
   appear in the Storefront API.
3. Set `PUBLIC_SHOPIFY_STORE` (the `my-store` in `my-store.myshopify.com`) and
   `PUBLIC_SHOPIFY_STOREFRONT_TOKEN` locally and in CI/host secrets. Both are read in the
   browser by the cart, hence the `PUBLIC_` prefix; the Storefront public token is designed to
   be exposed there, and can read the catalog and manage carts, nothing else. Never use the
   Admin API token or any private/secret token in the site.
4. Set `commerce.mode: "catalog"` or `"shop"` in `app.json`, install the cart runtime deps
   (`yarn add nanostores @nanostores/persistent`, `shop` mode only).
5. The catalog is baked at build time, so a product change needs a rebuild: wire a Shopify
   webhook (`products/create`/`update`/`delete`) to a build hook on your host.

## Security

- Only the public Storefront token ever reaches the bundle; the Admin API is never involved.
- The cart id is persisted in `localStorage` but never put in a shareable URL.
- `checkoutUrl` is fetched fresh at checkout time, never cached.
- No payment data touches the site; checkout is entirely hosted by Shopify.
