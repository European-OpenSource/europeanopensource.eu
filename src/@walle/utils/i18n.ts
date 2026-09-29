import config from "@walle/config";

// English defaults for every user-facing/screen-reader string walle emits. Keyed by the
// same dotted path a site would set under `app.json`'s `labels` block. A leaf here is the
// fallback when neither a component prop nor a site label supplies one.
const DEFAULTS = {
  skipLink: "Skip to content",
  scrollableRegion: "Scrollable content",
  logo: "Logo",
  "card.read": "Read {title}",
  "breadcrumbs.nav": "Breadcrumb",
  "breadcrumbs.back": "Back",
  "breadcrumbs.home": "Home",
  "carousel.previous": "Previous slide",
  "carousel.next": "Next slide",
  "carousel.zoom": "View image full screen",
  "carousel.close": "Close",
  "carousel.slide": "{i} of {n}",
  "filters.searchPlaceholder": "Search…",
  "filters.searchLabel": "Search items",
  "filters.clear": "Clear filters",
  "filters.status": "{n} items shown",
  "filters.facetSelect": "Select {label}",
  "filters.facetSelected": "{n} selected",
  "cart.ariaLabel": "Shopping cart",
  "cart.open": "Open cart",
  "cart.title": "Your cart",
  "cart.close": "Close cart",
  "cart.empty": "Your cart is empty.",
  "cart.subtotal": "Subtotal",
  "cart.checkout": "Checkout",
  "cart.add": "Add to cart",
  "cart.decreaseQuantity": "Decrease quantity",
  "cart.increaseQuantity": "Increase quantity",
  "cart.remove": "Remove",
  "cart.inStock": "In stock",
  "cart.outOfStock": "Out of stock",
  "cart.unavailable": "Combination not available",
  "price.discounted": "Discounted price",
  "price.original": "Original price",
  "offline.title": "You're offline",
  "offline.message": "Check your connection and try again.",
  "notFound.title": "Not Found.",
  "notFound.message": "The content you're looking for is not available.",
  "toc.heading": "Contents",
  "toc.nav": "Table of contents navigation",
  "toc.loading": "Loading...",
  "toc.expanded": "Table of contents expanded",
  "toc.collapsed": "Table of contents collapsed",
  "toc.toggle": "Toggle table of contents",
  "toc.navigateTo": "Navigate to: {title}",
  "toc.navigated": "Navigated to section",
  // `{duration}` is filled by the caller with a fully localized `Intl.NumberFormat` unit
  // string (e.g. "5 minutes" / "5 minuti"), so the pluralization is never English-only.
  readingTime: "{duration} read",
  "nav.main": "Main navigation",
  "nav.toggle": "Toggle navigation menu",
  "footer.nav": "Footer navigation",
  "footer.social": "Social links",
  "blog.publishedOn": "Published on {date}",
  "blog.readingProgress": "Article reading progress",
  "blog.articleNavigation": "Article navigation",
  "blog.previousArticle": "Previous Article",
  "blog.nextArticle": "Next Article",
  "blog.info": "Article information",
  "blog.tags": "Article tags",
  "blog.empty": "No posts found.",
  "products.title": "Products",
  "products.type": "Type",
  "products.searchPlaceholder": "Search products…",
  "products.status": "{n} products shown",
  "products.empty": "No products found.",
  "products.related": "You might also like",
  "products.galleryHeading": "Product gallery and details",
  "products.gallery": "{title} gallery",
  "map.region": "Map",
  "map.directions": "Get directions",
} as const;

export type LabelPath = keyof typeof DEFAULTS;

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      obj
    );
}

/**
 * Resolves a user-facing string with the precedence prop override > site `labels` config >
 * English default. `override` is whatever a component's own prop received (usually
 * `undefined`, meaning "no per-instance override").
 */
export function label(path: LabelPath, override?: string): string {
  if (override !== undefined) return override;
  const site = getByPath(config.app.labels, path);
  return typeof site === "string" ? site : DEFAULTS[path];
}

/** The site's locale for every date/number/currency formatter: the one fallback lives here. */
export function locale(): string {
  return config.app.website.language || "en-US";
}
