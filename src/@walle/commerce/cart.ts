/**
 * Client-side Shopify cart (browser only). Storefront Cart API + nanostores for state
 * shared across islands; the cart id is persisted in localStorage. Checkout is the hosted
 * Shopify checkout (redirect to `cart.checkoutUrl`). No server, no payment data here.
 *
 * This module is the ecommerce layer: it is only loaded when `commerce.showBuyButton`
 * is true (see CartMount.astro / BaseLayout). A vetrina build never imports it.
 */
import { persistentAtom } from "@nanostores/persistent";
import { atom } from "nanostores";
import { shopifyEnabled, shopifyFetch } from "./shopify";
import { mockAdd, mockCheckoutUrl, mockInit, mockRemove, mockUpdate } from "./cart-mock";

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    image: { url: string; altText: string | null } | null;
    product: { title: string; handle: string };
    price: { amount: string; currencyCode: string };
  };
};
export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { totalAmount: { amount: string; currencyCode: string } };
  lines: { nodes: CartLine[] };
} | null;

const CART_FRAGMENT = `
  id checkoutUrl totalQuantity
  cost { totalAmount { amount currencyCode } }
  lines(first: 100) {
    nodes {
      id quantity
      merchandise {
        ... on ProductVariant {
          id title
          image { url altText }
          product { title handle }
          price { amount currencyCode }
        }
      }
    }
  }
`;

export const cartId = persistentAtom<string>("shopify:cartId", "");
export const cart = atom<Cart>(null);
export const cartOpen = atom<boolean>(false);

async function loadCart(): Promise<Cart> {
  if (!cartId.get()) return null;
  const data: any = await shopifyFetch(`query ($id: ID!) { cart(id: $id) { ${CART_FRAGMENT} } }`, {
    id: cartId.get(),
  });
  if (!data.cart) cartId.set(""); // cart expired (~10 days inactivity)
  cart.set(data.cart);
  return data.cart;
}

// Dedup creation: two concurrent adds without a cartId must not create two carts.
let creating: Promise<void> | null = null;

async function createCart(variantId: string, quantity: number) {
  const data: any = await shopifyFetch(
    `mutation ($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { ${CART_FRAGMENT} } userErrors { message } } }`,
    { lines: [{ merchandiseId: variantId, quantity }] }
  );
  assertNoErrors(data.cartCreate.userErrors);
  cartId.set(data.cartCreate.cart.id);
  cart.set(data.cartCreate.cart);
}

export async function addToCart(variantId: string, quantity = 1): Promise<void> {
  if (!shopifyEnabled()) {
    cart.set(mockAdd(variantId, quantity));
    return;
  }
  if (creating) await creating;

  if (!cartId.get()) {
    creating = createCart(variantId, quantity).finally(() => (creating = null));
    return creating;
  }

  const data: any = await shopifyFetch(
    `mutation ($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FRAGMENT} } userErrors { message } } }`,
    { cartId: cartId.get(), lines: [{ merchandiseId: variantId, quantity }] }
  );

  // Stale cartId (checkout done elsewhere, expired, deleted): reset and recreate.
  if (!data.cartLinesAdd.cart) {
    cartId.set("");
    return addToCart(variantId, quantity);
  }

  assertNoErrors(data.cartLinesAdd.userErrors);
  cart.set(data.cartLinesAdd.cart);
}

export async function updateLine(lineId: string, quantity: number): Promise<void> {
  if (!shopifyEnabled()) {
    cart.set(mockUpdate(lineId, quantity));
    return;
  }
  const data: any = await shopifyFetch(
    `mutation ($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FRAGMENT} } userErrors { message } } }`,
    { cartId: cartId.get(), lines: [{ id: lineId, quantity }] }
  );
  assertNoErrors(data.cartLinesUpdate.userErrors);
  cart.set(data.cartLinesUpdate.cart);
}

export async function removeLine(lineId: string): Promise<void> {
  if (!shopifyEnabled()) {
    cart.set(mockRemove(lineId));
    return;
  }
  const data: any = await shopifyFetch(
    `mutation ($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FRAGMENT} } userErrors { message } } }`,
    { cartId: cartId.get(), lineIds: [lineId] }
  );
  assertNoErrors(data.cartLinesRemove.userErrors);
  cart.set(data.cartLinesRemove.cart);
}

function assertNoErrors(userErrors: Array<{ message: string }>) {
  if (userErrors?.length) throw new Error(userErrors.map((e) => e.message).join("; "));
}

export async function goToCheckout(): Promise<void> {
  if (!shopifyEnabled()) {
    window.location.href = mockCheckoutUrl();
    return;
  }
  const c = await loadCart(); // checkoutUrl can go stale; fetch it fresh
  if (c?.checkoutUrl) window.location.href = c.checkoutUrl;
}

// Load any persisted cart on first import (browser, live mode only). Errors (offline,
// adblocker) leave the cart empty rather than throwing an unhandled rejection. In mock
// mode there is nothing to load — the cart starts empty in memory.
if (typeof window !== "undefined") {
  if (shopifyEnabled()) loadCart().catch(() => cart.set(null));
  else cart.set(mockInit()); // rehydrate the persisted mock cart
}
