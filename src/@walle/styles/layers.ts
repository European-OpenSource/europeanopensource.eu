// Single source of truth for the cascade layer order, shared by Head.astro (inline
// declaration) and the CSS files under styles/ (each declares its own layer membership).
export const WALLE_LAYERS = ["walle.base", "walle.components", "walle.utilities", "site"] as const;

export const WALLE_LAYER_DECLARATION = `@layer ${WALLE_LAYERS.join(", ")};`;
