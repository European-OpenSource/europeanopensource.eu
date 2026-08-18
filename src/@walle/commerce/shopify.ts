/**
 * Shopify headless integration (build-time catalog).
 *
 * Architecture:
 *   - Products are read at BUILD TIME via the Storefront API and become a
 *     type-safe content collection (see src/content.config.ts).
 *   - The site stays fully static (no SSR, no adapter).
 *   - The cart is client-side only (src/@walle/commerce/cart.ts), never here.
 *
 * Offline / vetrina fallback: when the Storefront env vars are absent, the loader
 * serves a bundled fixture (src/@walle/commerce/fixture.ts) so the demo builds with
 * zero credentials. A real consumer sets the two PUBLIC_ vars and gets the live catalog
 * with no code change.
 *
 * Env (public by design — the Storefront public token is meant for the client):
 *   PUBLIC_SHOPIFY_STORE            e.g. "my-store" from my-store.myshopify.com
 *   PUBLIC_SHOPIFY_STOREFRONT_TOKEN Headless channel public access token
 */
import type { Loader } from "astro/loaders";
import { fixtureProducts } from "./fixture";

const API_VERSION = "2026-07";

export function shopifyEnabled(): boolean {
  return (
    !!import.meta.env.PUBLIC_SHOPIFY_STORE && !!import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN
  );
}

/** Shared GraphQL client. Used by the build-time loader and by the browser cart. */
export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const store = import.meta.env.PUBLIC_SHOPIFY_STORE;
  const token = import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  const endpoint = `https://${store}.myshopify.com/api/${API_VERSION}/graphql.json`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  // 429/430 = Storefront throttling; 402 = store suspended.
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title descriptionHtml updatedAt productType tags
        seo { title description }
        options { name optionValues { name } }
        featuredImage { url altText width height }
        images(first: 20) { nodes { url altText width height } }
        variants(first: 100) {
          nodes {
            id title availableForSale
            selectedOptions { name value }
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            image { url altText }
          }
        }
      }
    }
  }
`;

const RECS_QUERY = `
  query Recs($handle: String!) {
    productRecommendations(productHandle: $handle, intent: RELATED) { handle }
  }
`;

type RawProduct = Record<string, any>;

/**
 * Content Layer loader. Live catalog when the Storefront env vars are set, otherwise
 * the bundled fixture. Uses the object form so `digest` gives incremental rebuilds:
 * unchanged products are not re-parsed/re-stored (Astro processing saved, not API calls).
 */
export function shopifyLoader(): Loader {
  return {
    name: "shopify-products",
    load: async ({ store, parseData, generateDigest, logger }) => {
      const upsert = async (raw: RawProduct) => {
        const data = await parseData({ id: raw.handle, data: raw });
        store.set({ id: raw.handle, data, digest: generateDigest(raw) });
      };

      if (!shopifyEnabled()) {
        logger.info(`Shopify env not set — loading ${fixtureProducts.length} fixture products`);
        store.clear();
        for (const p of fixtureProducts) await upsert(p);
        return;
      }

      const seen = new Set<string>();
      let cursor: string | null = null;
      let count = 0;
      do {
        const data: any = await shopifyFetch(PRODUCTS_QUERY, { cursor });
        for (const p of data.products.nodes) {
          // One extra sequential call per product for RELATED recommendations.
          const recs: any = await shopifyFetch(RECS_QUERY, { handle: p.handle });
          await upsert({
            ...p,
            recommended: (recs.productRecommendations ?? []).map((r: any) => r.handle),
          });
          seen.add(p.handle);
          count++;
        }
        cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
      } while (cursor);

      // Drop products deleted on Shopify (snapshot keys first — no delete mid-iteration).
      for (const id of [...store.keys()]) if (!seen.has(id)) store.delete(id);
      logger.info(`Loaded ${count} Shopify products`);
    },
  };
}

/* ---------------------------------------------------------------------------
 * Presentation helpers (shared by the product pages)
 * ------------------------------------------------------------------------- */

export type ShopifyImage = { url: string; altText: string | null; width?: number; height?: number };
export type ShopifyMoney = { amount: string; currencyCode: string };
export type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
  image: { url: string; altText: string | null } | null;
};
export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  updatedAt: string;
  productType: string;
  tags: string[];
  seo: { title: string | null; description: string | null };
  options: { name: string; optionValues: { name: string }[] }[];
  featuredImage: ShopifyImage | null;
  images: { nodes: ShopifyImage[] };
  variants: { nodes: ShopifyVariant[] };
  recommended: string[];
};

/** First available variant, else the first variant. Never start on "unavailable". */
export function defaultVariant(product: ShopifyProduct): ShopifyVariant | undefined {
  return product.variants.nodes.find((v) => v.availableForSale) ?? product.variants.nodes[0];
}

/** A product is a single-variant product when its only option is the implicit "Title". */
export function isSingleVariant(product: ShopifyProduct): boolean {
  return (
    product.options.length === 0 ||
    (product.options.length === 1 && product.options[0].name === "Title")
  );
}

/** Format Storefront money (amount is a decimal string) — never concatenate by hand. */
export function formatMoney(money: ShopifyMoney, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currencyCode,
  }).format(Number(money.amount));
}
