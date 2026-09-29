/**
 * Base-path helpers shared by build-time config (`define-config.ts`) and request-time
 * application code (`og/url.ts`, `feeds/route.ts`): kept dependency-free (no astro/config
 * imports), same reasoning and same pattern as `site-path.ts`.
 */

/**
 * Strips `base` off the front of `pathname` at a path-segment boundary: "/harness-walle-docs/x"
 * must not lose "/harness-walle" just because it happens to start with the same characters.
 * Returns `pathname` unchanged when `base` is absent, `"/"`, or doesn't actually prefix it.
 */
export function stripBase(pathname: string, base: string | undefined): string {
  const stripped = base && base !== "/" ? base.replace(/\/$/, "") : "";
  if (stripped && (pathname === stripped || pathname.startsWith(`${stripped}/`))) {
    return pathname.slice(stripped.length) || "/";
  }
  return pathname;
}

/**
 * Prefixes `base` onto a root-relative destination. Astro's `redirects` config applies `base`
 * to the route's source pattern but passes the destination straight through, so an internal
 * target written the same bare way as every other walle path (e.g. `/products/x`, same
 * convention as `sitemapExclude`/`redirects` keys) would 404 once the site sits under a base
 * path. Leaves external (`http(s):`/`//`) destinations and one already written with the base
 * untouched (idempotent: a site that already wrote it with the base doesn't get it doubled).
 */
export function withBase(destination: string, base?: string): string {
  if (!base || base === "/") return destination;
  if (!destination.startsWith("/") || destination.startsWith("//")) return destination;
  const strippedBase = base.replace(/\/$/, "");
  if (destination === strippedBase || destination.startsWith(`${strippedBase}/`)) {
    return destination;
  }
  return `${strippedBase}${destination}`;
}
