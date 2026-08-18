/**
 * Offline demo catalog. Served by the Shopify loader when the Storefront env vars are
 * absent, so the vetrina demo builds with zero credentials. Shape matches the live
 * Storefront response exactly, so the product pages render identically either way.
 *
 * Image URLs are local (/img/...); the product pages base-prefix non-http URLs, while
 * real Shopify CDN URLs (https://cdn.shopify.com/...) pass through untouched.
 */
import type { ShopifyProduct } from "./shopify";

const EUR = "EUR";

function variant(
  handle: string,
  size: string,
  available: boolean,
  amount: string,
  compareAt: string | null,
  imageUrl: string
) {
  return {
    id: `gid://demo/ProductVariant/${handle}-${size.toLowerCase()}`,
    title: size,
    availableForSale: available,
    selectedOptions: [{ name: "Size", value: size }],
    price: { amount, currencyCode: EUR },
    compareAtPrice: compareAt ? { amount: compareAt, currencyCode: EUR } : null,
    image: { url: imageUrl, altText: null },
  };
}

export const fixtureProducts: ShopifyProduct[] = [
  {
    id: "gid://demo/Product/aurora-merino-overshirt",
    handle: "aurora-merino-overshirt",
    title: "Aurora Merino Overshirt",
    updatedAt: "2026-01-10T09:00:00Z",
    productType: "Tops",
    tags: ["Merino", "Layering", "Unisex"],
    seo: {
      title: "Aurora Merino Overshirt",
      description: "A midweight merino overshirt built for everyday layering.",
    },
    descriptionHtml:
      "<p>A midweight merino overshirt built for layering. Breathable and temperature regulating, it works over a tee on cool mornings and under a coat when the weather turns.</p><h3>Details</h3><ul><li>100% traceable merino wool, mulesing free</li><li>Midweight 240 gsm, holds its shape all day</li><li>Reinforced chest pockets and horn effect buttons</li><li>Relaxed fit, take your usual size</li></ul><h3>Materials and care</h3><p>Merino resists odour, so it needs washing less often than cotton. Machine wash cold on a wool cycle, reshape, and dry flat.</p>",
    options: [{ name: "Size", optionValues: [{ name: "S" }, { name: "M" }, { name: "L" }] }],
    featuredImage: {
      url: "/img/product-demo-1.jpg",
      altText: "Aurora Merino Overshirt",
      width: 1200,
      height: 800,
    },
    images: {
      nodes: [
        {
          url: "/img/product-demo-1.jpg",
          altText: "Aurora Merino Overshirt",
          width: 1200,
          height: 800,
        },
      ],
    },
    variants: {
      nodes: [
        variant(
          "aurora-merino-overshirt",
          "S",
          true,
          "129.00",
          "159.00",
          "/img/product-demo-1.jpg"
        ),
        variant(
          "aurora-merino-overshirt",
          "M",
          true,
          "129.00",
          "159.00",
          "/img/product-demo-1.jpg"
        ),
        variant(
          "aurora-merino-overshirt",
          "L",
          false,
          "129.00",
          "159.00",
          "/img/product-demo-1.jpg"
        ),
      ],
    },
    recommended: ["cirrus-packable-jacket"],
  },
  {
    id: "gid://demo/Product/cirrus-packable-jacket",
    handle: "cirrus-packable-jacket",
    title: "Cirrus Packable Jacket",
    updatedAt: "2026-01-18T09:00:00Z",
    productType: "Outerwear",
    tags: ["Shell", "Packable", "Recycled"],
    seo: {
      title: "Cirrus Packable Jacket",
      description: "A featherweight shell that folds into its own pocket.",
    },
    descriptionHtml:
      "<p>A featherweight shell that folds into its own pocket. Wind and water resistant with taped seams, it stays out of the way in a bag until the weather turns.</p><h3>Details</h3><ul><li>15 denier ripstop shell, under 180g in size M</li><li>Fully taped seams and a water resistant front zip</li><li>Packs into its own chest pocket with a carabiner loop</li><li>Adjustable hood and hem for three season use</li></ul><h3>Materials and care</h3><p>Made from recycled ripstop nylon with a PFC free water repellent finish. Machine wash cold and hang to dry.</p>",
    options: [{ name: "Size", optionValues: [{ name: "S" }, { name: "M" }, { name: "L" }] }],
    featuredImage: {
      url: "/img/product-demo-2.jpg",
      altText: "Cirrus Packable Jacket, front view",
      width: 1200,
      height: 800,
    },
    images: {
      nodes: [
        {
          url: "/img/product-demo-2.jpg",
          altText: "Cirrus Packable Jacket, front view",
          width: 1200,
          height: 800,
        },
        {
          url: "/img/product-demo-2-alternative.jpg",
          altText: "Cirrus Packable Jacket, packed into its pocket",
          width: 1200,
          height: 800,
        },
      ],
    },
    variants: {
      nodes: [
        variant("cirrus-packable-jacket", "S", true, "189.00", null, "/img/product-demo-2.jpg"),
        variant("cirrus-packable-jacket", "M", true, "189.00", null, "/img/product-demo-2.jpg"),
        variant("cirrus-packable-jacket", "L", true, "189.00", null, "/img/product-demo-2.jpg"),
      ],
    },
    recommended: ["aurora-merino-overshirt"],
  },
];
