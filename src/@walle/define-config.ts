// Build-time walle config resolution. Imported only by astro.config.mjs (via the
// `defineWalleConfig` re-export in ./config). Kept out of the runtime config module
// so components importing `config` don't pull astro/config into their graph.
import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import appConfig from "../configs/app.json";

/**
 * Registry of component variants available in this walle version. A consumer that
 * selects a variant outside this set gets an explicit build error (no silent fallback).
 * Each component currently supports `standard` and `minimal`.
 */
const AVAILABLE_VARIANTS: Record<string, string[]> = {
  navbar: ["standard", "minimal"],
  footer: ["standard", "minimal"],
};

function assertVariants(components: Record<string, string> = {}): void {
  for (const [component, variant] of Object.entries(components)) {
    const available = AVAILABLE_VARIANTS[component] ?? ["standard"];
    if (!available.includes(variant)) {
      throw new Error(
        `[walle] Unknown variant "${variant}" for component "${component}". ` +
          `Available variants: ${available.join(", ")}.`
      );
    }
  }
}

/**
 * Deterministic token → CSS var mapping.
 *   palette.<name>               → --walle-color-<name>
 *   typography.fontFamilyBase    → --walle-font-body
 *   typography.fontFamilyHeading → --walle-font-heading
 *   typography.fontFamilyMono    → --walle-font-mono
 *   typography.scale.<name>      → --walle-font-size-<name>
 *   spacing.<name>               → --walle-space-<name>
 *   radii.<name>                 → --walle-radius-<name>
 *
 * global.css bridges each --walle-* var to the component-facing var (e.g. --primary,
 * --space-sm, --radius-sm) so theme.json overrides work without touching consumer files.
 * Absent or empty theme.json yields an empty string — output is identical to defaults.
 */
function generateThemeCss(): string {
  const themeUrl = new URL("../configs/theme.json", import.meta.url);
  if (!existsSync(fileURLToPath(themeUrl))) return "";

  let theme: {
    palette?: Record<string, unknown>;
    typography?: {
      fontFamilyBase?: string;
      fontFamilyHeading?: string;
      fontFamilyMono?: string;
      scale?: Record<string, string>;
    };
    spacing?: Record<string, unknown>;
    radii?: Record<string, unknown>;
  };
  try {
    theme = JSON.parse(readFileSync(themeUrl, "utf8"));
  } catch {
    return "";
  }

  const lines: string[] = [];

  for (const [name, value] of Object.entries(theme?.palette ?? {})) {
    if (typeof value === "string" && value.length > 0)
      lines.push(`  --walle-color-${name}: ${value};`);
  }

  const typo = theme?.typography;
  if (typo?.fontFamilyBase) lines.push(`  --walle-font-body: ${typo.fontFamilyBase};`);
  if (typo?.fontFamilyHeading) lines.push(`  --walle-font-heading: ${typo.fontFamilyHeading};`);
  if (typo?.fontFamilyMono) lines.push(`  --walle-font-mono: ${typo.fontFamilyMono};`);
  for (const [name, value] of Object.entries(typo?.scale ?? {})) {
    if (typeof value === "string") lines.push(`  --walle-font-size-${name}: ${value};`);
  }

  for (const [name, value] of Object.entries(theme?.spacing ?? {})) {
    if (typeof value === "string" && value.length > 0)
      lines.push(`  --walle-space-${name}: ${value};`);
  }

  for (const [name, value] of Object.entries(theme?.radii ?? {})) {
    if (typeof value === "string" && value.length > 0)
      lines.push(`  --walle-radius-${name}: ${value};`);
  }

  return lines.length ? `:root {\n${lines.join("\n")}\n}\n` : "";
}

/**
 * Vite plugin exposing the generated theme tokens as a virtual CSS module. Imported by
 * AbstractLayout between the walle base styles and the consumer `global.css`, so the
 * cascade is: walle defaults < generated tokens < consumer global.css (consumer wins).
 */
function walleThemePlugin() {
  const virtualId = "virtual:walle-theme.css";
  const resolvedId = "\0" + virtualId;
  return {
    name: "walle-theme",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      return id === resolvedId ? generateThemeCss() : null;
    },
  };
}

type AstroConfigSection = {
  baseUrl?: string;
  basePath?: string;
  trailingSlash?: "always" | "never" | "ignore";
  ssr?: { enabled?: boolean; adapter?: "node" };
};

/**
 * Resolve the Astro config from the consumer's app.json plus optional native overrides.
 * Override semantics (additive merge): scalar keys from the consumer win over the
 * walle-resolved values; `integrations` are concatenated onto the walle defaults
 * (mdx, sitemap, icon), never replaced.
 */
export function defineWalleConfig(overrides: Record<string, any> = {}) {
  const astro = (appConfig.astro ?? {}) as AstroConfigSection;
  assertVariants((appConfig as { components?: Record<string, string> }).components);

  const ssrEnabled = astro.ssr?.enabled === true;
  const walleIntegrations = [mdx(), sitemap(), icon()];

  const {
    integrations: consumerIntegrations = [],
    vite: consumerVite = {},
    ...consumerScalars
  } = overrides;

  return defineConfig({
    site: astro.baseUrl,
    base: astro.basePath,
    trailingSlash: astro.trailingSlash,
    // SSR off (default) => static output identical to today; on => node adapter.
    ...(ssrEnabled ? { output: "server", adapter: node({ mode: "standalone" }) } : {}),
    // Consumer scalar keys override the walle-resolved values.
    ...consumerScalars,
    integrations: [...walleIntegrations, ...consumerIntegrations],
    vite: {
      ...consumerVite,
      plugins: [walleThemePlugin(), ...(consumerVite.plugins ?? [])],
      build: {
        ...consumerVite.build,
        rollupOptions: {
          ...consumerVite.build?.rollupOptions,
          // Astro's opt-in rust compiler (experimental.rustCompiler, off by default)
          // dynamically imports @astrojs/compiler-rs, which is intentionally not
          // installed. Externalize it so the build doesn't try to bundle it. Still
          // required on astro 6.4.x; safe to drop once astro externalizes it itself.
          external: [
            "@astrojs/compiler-rs",
            ...toExternalArray(consumerVite.build?.rollupOptions?.external),
          ],
        },
      },
    },
  });
}

function toExternalArray(external: unknown): string[] {
  if (Array.isArray(external)) return external.filter((e): e is string => typeof e === "string");
  if (typeof external === "string") return [external];
  return [];
}
