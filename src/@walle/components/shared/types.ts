import type { HTMLAttributes, HTMLTag } from "astro/types";

/**
 * Every visual component's own `id`/`class` plus native attribute passthrough for the tag
 * it renders as. Defaults to "div" for components with no single natural host tag.
 */
export type BaseProps<Tag extends HTMLTag = "div"> = HTMLAttributes<Tag>;

/** The fixed variant set: no open string variants. */
export type Variant = "primary" | "secondary" | "alternative" | "site";

export interface VariantProps {
  variant?: Variant;
}

export interface ModifierProps {
  outline?: boolean;
  filled?: boolean;
  muted?: boolean;
  inverse?: boolean;
}

export type Size = "small" | "medium" | "large";
