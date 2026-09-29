import type { ModifierProps, VariantProps } from "./types";

/**
 * One rel rule for every link-rendering component. The caller resolves "is this host
 * external" (it has `Astro.site`, this function doesn't) and passes the result in.
 */
export function linkAttrs({
  target,
  external = false,
}: {
  target?: "_blank" | "_self";
  external?: boolean;
}): { target: "_blank" | "_self"; rel: string | undefined } {
  const resolvedTarget = target ?? (external ? "_blank" : "_self");
  const rel = external
    ? "noopener noreferrer"
    : resolvedTarget === "_blank"
      ? "noopener"
      : undefined;
  return { target: resolvedTarget, rel };
}

/**
 * Data attributes for the variant model: `data-variant` always present (default
 * "primary"), each modifier attribute present only when its prop is `true`.
 */
export function variantAttrs(
  props: VariantProps & ModifierProps
): Record<string, string | undefined> {
  const { variant = "primary", outline, filled, muted, inverse } = props;
  return {
    "data-variant": variant,
    "data-outline": outline ? "true" : undefined,
    "data-filled": filled ? "true" : undefined,
    "data-muted": muted ? "true" : undefined,
    "data-inverse": inverse ? "true" : undefined,
  };
}

/**
 * Separates a component's own declared props from everything meant to pass through as
 * {...rest}. Generic over `T extends object` and `K extends keyof T` so callers can pass
 * `Astro.props` and an `as const` OWN_KEYS array directly: `own` comes back as `Pick<T, K>` and
 * `rest` as `Omit<T, K>`, so destructuring either needs no cast, and destructuring a key that
 * isn't in `keys` is a real type error (the component forgot to declare that key as its own).
 */
export function splitProps<T extends object, K extends keyof T>(
  props: T,
  keys: readonly K[]
): { own: Pick<T, K>; rest: Omit<T, K> } {
  const own = {} as Pick<T, K>;
  const rest = {} as Omit<T, K>;
  for (const [key, value] of Object.entries(props) as [keyof T, T[keyof T]][]) {
    if ((keys as readonly (keyof T)[]).includes(key)) {
      (own as Record<keyof T, unknown>)[key] = value;
    } else {
      (rest as Record<keyof T, unknown>)[key] = value;
    }
  }
  return { own, rest };
}
