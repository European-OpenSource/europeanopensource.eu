import { defineCollection, z } from "astro:content";
import { shopifyLoader } from "../commerce/shopify";

/**
 * Products, sourced from the Shopify Storefront API at build time (or a bundled
 * fixture when the store env vars are absent). See @walle/commerce/shopify.ts.
 */
const image = z.object({
  url: z.string(),
  altText: z.string().nullable(),
  width: z.number().optional(),
  height: z.number().optional(),
});
const money = z.object({ amount: z.string(), currencyCode: z.string() });

const products = defineCollection({
  loader: shopifyLoader(),
  schema: z.object({
    id: z.string(),
    handle: z.string(),
    title: z.string(),
    descriptionHtml: z.string(),
    updatedAt: z.string(),
    productType: z.string().default(""),
    tags: z.array(z.string()).default([]),
    seo: z.object({ title: z.string().nullable(), description: z.string().nullable() }),
    options: z.array(
      z.object({ name: z.string(), optionValues: z.array(z.object({ name: z.string() })) })
    ),
    featuredImage: image.nullable(),
    images: z.object({ nodes: z.array(image) }),
    variants: z.object({
      nodes: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          availableForSale: z.boolean(),
          selectedOptions: z.array(z.object({ name: z.string(), value: z.string() })),
          price: money,
          compareAtPrice: money.nullable(),
          image: z.object({ url: z.string(), altText: z.string().nullable() }).nullable(),
        })
      ),
    }),
    recommended: z.array(z.string()).default([]),
  }),
});

/**
 * Collections gated by a walle feature: the products collection only exists when
 * commerce is on, mirroring `virtual:walle-features`'s "nothing shipped when off" contract at
 * the content layer instead of the module graph. `commerceMode` is passed in rather than read
 * from `@walle/config` here: this module loads inside Astro's content-layer graph (it's a
 * dependency of content.config.ts), and importing `@walle/config` there drags in
 * vite-plugin-pwa via `defineWalleConfig` and breaks the build: see the note on this
 * restriction in commerce/shopify.ts's `formatMoney`.
 *
 * Return type claims `products` is always present: an optional or unioned shape here breaks
 * `ContentConfig['collections']['products']`'s schema inference for every caller of
 * `getCollection("products")` (Astro's generated `content.d.ts` indexes it with `Required<>`,
 * which silently collapses to `unknown` across an optional/union key once `skipLibCheck` hides
 * the underlying error). This is safe because every caller that runs regardless of commerce
 * mode (a seed page, e.g. llms.txt.ts) must check the mode itself before calling
 * `getCollection("products")`: the two commerce pages that don't check are only ever rendered
 * when this returned `products`, since walle injects them for exactly the same condition.
 */
export function walleCollections(commerceMode: string | undefined): { products: typeof products } {
  return (commerceMode === "catalog" || commerceMode === "shop" ? { products } : {}) as {
    products: typeof products;
  };
}
