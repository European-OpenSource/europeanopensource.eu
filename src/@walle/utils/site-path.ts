import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

/**
 * Resolves a `./`-prefixed site override to an absolute file path that must exist, as a file
 * (not a directory), under the project's `src/`. Throws naming `label` and the offending value
 * otherwise (never a silent fallback), so an invalid override fails the build instead of
 * surfacing as a missing file at request time. Shared by every "built-in name or site path"
 * override walle exposes (`components.*`, `commerce.pages.*`, `pwa.offline`,
 * `seo.ogImage.templates.*`): kept dependency-free (no astro/config imports) so both
 * `define-config.ts` (astro.config authoring) and application code like `og/route.ts` (which
 * must never drag astro/config's own toolchain into a request-time render) can import it.
 */
export function resolveSitePath(value: string, root: string, label: string): string {
  const abs = resolve(root, value);
  const srcRoot = resolve(root, "src") + sep;
  if (!abs.startsWith(srcRoot)) {
    throw new Error(
      `[walle] ${label} points to "${value}", which is outside src/. ` +
        `Overrides must live under the project's src/ directory.`
    );
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error(`[walle] ${label} points to "${value}", but that file does not exist.`);
  }
  return abs;
}
