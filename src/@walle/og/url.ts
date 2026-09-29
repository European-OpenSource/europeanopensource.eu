import config from "@walle/config";
import { withBase } from "../utils/base-path";

/**
 * The URL an injected OG image is served at: `/og/default.png` for the site default,
 * `/og/<collection>/<id>.png` for a collection entry, matching `route.ts`'s
 * `/og/[...slug].png` pattern and its own `getStaticPaths`.
 */
export function ogImageUrl(collection?: string, id?: string): string {
  const segments = collection
    ? [collection, id].filter((s): s is string => Boolean(s))
    : ["default"];
  return withBase(`/og/${segments.join("/")}.png`, config.app.astro.basePath);
}
