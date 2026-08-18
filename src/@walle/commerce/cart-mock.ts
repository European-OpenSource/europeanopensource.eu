/**
 * In-memory mock of the Storefront cart. Used when commerce is enabled (`showBuyButton`)
 * but no Storefront env vars are set — so the demo (and any consumer) can exercise the
 * full add-to-cart / drawer / checkout flow with zero credentials. Line data comes from
 * the bundled fixture. When real env vars are present, cart.ts uses the live API instead.
 */
import { fixtureProducts } from "./fixture";
import type { Cart, CartLine } from "./cart";

const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const img = (url: string) => (url.startsWith("http") ? url : `${base}${url}`);

// variantId -> { product, variant }
const index = new Map<string, { productTitle: string; handle: string; variant: any }>();
for (const p of fixtureProducts) {
  for (const v of p.variants.nodes) {
    index.set(v.id, { productTitle: p.title, handle: p.handle, variant: v });
  }
}

// lineId === variantId in the mock (one line per variant). Persisted to localStorage
// so the mock cart survives page navigation, mirroring the real cart (which persists
// its cartId). Degrades to in-memory when localStorage is unavailable (private mode).
const STORAGE_KEY = "walle:mock-cart";

function load(): Map<string, number> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return new Map<string, number>(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Map<string, number>();
}

function save() {
  try {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...lines]));
  } catch {
    /* ignore */
  }
}

const lines = load();

function buildCart(): Cart {
  const nodes: CartLine[] = [];
  let total = 0;
  let currency = "EUR";
  let quantity = 0;

  for (const [variantId, qty] of lines) {
    const hit = index.get(variantId);
    if (!hit) continue;
    const price = hit.variant.price;
    currency = price.currencyCode;
    total += Number(price.amount) * qty;
    quantity += qty;
    nodes.push({
      id: variantId,
      quantity: qty,
      merchandise: {
        id: variantId,
        title: hit.variant.title,
        image: hit.variant.image ? { url: img(hit.variant.image.url), altText: null } : null,
        product: { title: hit.productTitle, handle: hit.handle },
        price,
      },
    });
  }

  if (nodes.length === 0) return null;
  return {
    id: "mock-cart",
    checkoutUrl: `${base}/checkout-demo`,
    totalQuantity: quantity,
    cost: { totalAmount: { amount: total.toFixed(2), currencyCode: currency } },
    lines: { nodes },
  };
}

/** Rebuild the cart from persisted lines (called on page load in mock mode). */
export function mockInit(): Cart {
  return buildCart();
}

export function mockAdd(variantId: string, quantity = 1): Cart {
  lines.set(variantId, (lines.get(variantId) ?? 0) + quantity);
  save();
  return buildCart();
}

export function mockUpdate(lineId: string, quantity: number): Cart {
  if (quantity <= 0) lines.delete(lineId);
  else lines.set(lineId, quantity);
  save();
  return buildCart();
}

export function mockRemove(lineId: string): Cart {
  lines.delete(lineId);
  save();
  return buildCart();
}

export function mockCheckoutUrl(): string {
  return `${base}/checkout-demo`;
}
