// Build-time walle config resolution. Imported only by astro.config.mjs (via the
// `defineWalleConfig` re-export in ./config). Kept out of the runtime config module
// so components importing `config` don't pull astro/config into their graph.
import AstroPWA from "@vite-pwa/astro";
import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";
import type { AstroIntegration, AstroUserConfig, HookParameters } from "astro";
import icon from "astro-icon";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import appConfig from "../configs/app.json";
import footerConfigJson from "../configs/footer.json";
import navbarConfigJson from "../configs/navbar.json";

import { appSchema, footerSchema, navbarSchema, parseConfig, themeSchema } from "./config/schema";
import { resolveSitePath } from "./utils/site-path";
import { stripBase, withBase } from "./utils/base-path";
import { contrastRatio } from "./utils/contrast";

export { withBase };

/**
 * Components a site can replace, once, from `app.json`'s `components` block: each key's
 * built-in name → walle source file, resolved relative to this file's own directory. A value
 * can also be a `./`-prefixed path to a site component under `src/`. Absent keys default to
 * `"standard"`. The keys of each inner record are also the available built-in names for that
 * component, so this is the one place both are defined.
 */
const WALLE_COMPONENT_PATHS: Record<string, Record<string, string>> = {
  navbar: {
    standard: "./components/features/Navbar/Navbar.astro",
    minimal: "./components/features/Navbar/Navbar.minimal.astro",
  },
  footer: {
    standard: "./components/features/Footer.astro",
    minimal: "./components/features/Footer.minimal.astro",
  },
  card: { standard: "./components/features/Card/BasicCard.astro" },
  breadcrumbs: { standard: "./components/features/Breadcrumbs.astro" },
  pageHeader: { standard: "./components/features/Sections/HeaderStandard.astro" },
  toc: { standard: "./components/features/Blog/BlogTableOfContents.astro" },
};

/**
 * Resolves one `components.<key>` entry to an absolute file path: a recognized built-in name
 * to its walle source file, or a `./`-prefixed value to a site file (`resolveSitePath`). The
 * caller has already rejected an unrecognized `key`, so `WALLE_COMPONENT_PATHS[key]` is always
 * defined here.
 */
function resolveEmbeddedComponent(key: string, value: string, root: string): string {
  const available = WALLE_COMPONENT_PATHS[key];
  if (value.startsWith("./")) {
    return resolveSitePath(value, root, `components.${key}`);
  }
  if (!(value in available)) {
    throw new Error(
      `[walle] Unknown value "${value}" for components.${key}. ` +
        `Available: ${Object.keys(available).join(", ")}.`
    );
  }
  return fileURLToPath(new URL(available[value], import.meta.url));
}

/** Validates every key of `components` (rejecting one that names no embeddable at all) and
 * resolves each embeddable's entry, defaulting an absent key to `"standard"`. */
function resolveEmbeddedComponents(
  components: Record<string, string> = {},
  root: string
): Record<string, string> {
  for (const key of Object.keys(components)) {
    if (!(key in WALLE_COMPONENT_PATHS)) {
      throw new Error(
        `[walle] Unknown embeddable component "${key}" in app.json "components". ` +
          `Available: ${Object.keys(WALLE_COMPONENT_PATHS).join(", ")}.`
      );
    }
  }
  const resolved: Record<string, string> = {};
  for (const key of Object.keys(WALLE_COMPONENT_PATHS)) {
    resolved[key] = resolveEmbeddedComponent(key, components[key] ?? "standard", root);
  }
  return resolved;
}

/**
 * Vite plugin exposing `virtual:walle-components`: one `export { default as <key> }` per
 * embeddable, from whichever file `resolveEmbeddedComponents` resolved it to. Layouts import
 * from this module instead of a per-component resolver, so only the selected implementation
 * ever enters a page's module graph.
 */
function walleComponentsPlugin(root: string, components: Record<string, string> = {}) {
  const virtualId = "virtual:walle-components";
  const resolvedId = "\0" + virtualId;
  return {
    name: "walle-components",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      if (id !== resolvedId) return null;
      const resolved = resolveEmbeddedComponents(components, root);
      return Object.entries(resolved)
        .map(([key, path]) => `export { default as ${key} } from ${JSON.stringify(path)};`)
        .join("\n");
    },
  };
}

/**
 * Gates commerce UI at the module-graph level: when commerce is off the virtual module exports
 * `null`, so Rollup never emits a chunk for CartMount/CartBadge (a guarded dynamic `import()`
 * would still emit one, because Vite resolves the literal specifier statically).
 */
function walleFeaturesPlugin(commerceMode: string | undefined) {
  const virtualId = "virtual:walle-features";
  const resolvedId = "\0" + virtualId;
  const commerceOn = commerceMode === "shop";
  return {
    name: "walle-features",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      if (id !== resolvedId) return null;
      if (!commerceOn) {
        return "export const CartMount = null;\nexport const CartBadge = null;";
      }
      const cartMountPath = fileURLToPath(new URL("./commerce/CartMount.astro", import.meta.url));
      const cartBadgePath = fileURLToPath(new URL("./commerce/CartBadge.astro", import.meta.url));
      return [
        `export { default as CartMount } from ${JSON.stringify(cartMountPath)};`,
        `export { default as CartBadge } from ${JSON.stringify(cartBadgePath)};`,
      ].join("\n");
    },
  };
}

/**
 * Injects `/products` and `/products/[handle]` when `commerce.mode` is "catalog" or "shop"; a
 * site with commerce off gets neither route. `commerce.pages.*` swaps either entrypoint for a
 * site file, with the same `./`-prefixed site-path contract as `components.*`.
 */
function walleCommerceRoutesIntegration(
  commerceMode: string | undefined,
  pages: { list?: string; detail?: string } = {},
  root: string
): AstroIntegration {
  const enabled = commerceMode === "catalog" || commerceMode === "shop";
  return {
    name: "walle-commerce-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }: HookParameters<"astro:config:setup">) => {
        if (!enabled) return;
        const listEntry = pages.list
          ? resolveSitePath(pages.list, root, "commerce.pages.list")
          : fileURLToPath(new URL("./commerce/pages/index.astro", import.meta.url));
        const detailEntry = pages.detail
          ? resolveSitePath(pages.detail, root, "commerce.pages.detail")
          : fileURLToPath(new URL("./commerce/pages/[handle].astro", import.meta.url));
        injectRoute({ pattern: "/products", entrypoint: listEntry });
        injectRoute({ pattern: "/products/[handle]", entrypoint: detailEntry });
      },
    },
  };
}

/**
 * Deterministic token → CSS var mapping.
 *   palette.<name>               → --walle-color-<name>   (includes *-contrast, heading)
 *   typography.fontFamilyBase    → --walle-font-body
 *   typography.fontFamilyHeading → --walle-font-heading
 *   typography.fontFamilyMono    → --walle-font-mono
 *   typography.scale.<name>      → --walle-font-size-<name>
 *   spacing.<name>               → --walle-space-<name>
 *   radii.<name>                 → --walle-radius-<name>
 *   neutral.<name>                → --walle-gray-<name>
 *   shadow.<name>                 → --walle-shadow-<name>
 *
 * tokens.css bridges each --walle-* var to the component-facing var (e.g. --primary,
 * --space-sm, --radius-sm, --gray-light, --shadow-md) so theme.json overrides work without
 * touching consumer files. Absent or empty theme.json yields an empty string: output is
 * identical to defaults.
 */
function readThemeJson(): Record<string, any> {
  const themeUrl = new URL("../configs/theme.json", import.meta.url);
  if (!existsSync(fileURLToPath(themeUrl))) return {};
  const raw = readFileSync(themeUrl, "utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `src/configs/theme.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Per variant, returns the dark shade or the contrast token, whichever has the higher
 * contrast ratio against palette.background.
 */
export function resolveOutlineFgOverrides(palette: Record<string, unknown>): string[] {
  const surface = typeof palette.background === "string" ? palette.background : "#fefefe";
  const lines: string[] = [];
  for (const variant of ["primary", "secondary", "alternative"] as const) {
    const dark = palette[`${variant}-dark`];
    const contrast = palette[`${variant}-contrast`];
    if (typeof dark !== "string" || typeof contrast !== "string") continue;
    const winner =
      contrastRatio(dark, surface) >= contrastRatio(contrast, surface) ? dark : contrast;
    lines.push(`  --walle-outline-fg-${variant}: ${winner};`);
  }
  return lines;
}

export function generateThemeCss(): string {
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
    neutral?: Record<string, unknown>;
    shadow?: Record<string, unknown>;
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
  lines.push(...resolveOutlineFgOverrides(theme?.palette ?? {}));

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

  for (const [name, value] of Object.entries(theme?.neutral ?? {})) {
    if (typeof value === "string" && value.length > 0)
      lines.push(`  --walle-gray-${name}: ${value};`);
  }

  for (const [name, value] of Object.entries(theme?.shadow ?? {})) {
    if (typeof value === "string" && value.length > 0)
      lines.push(`  --walle-shadow-${name}: ${value};`);
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

/**
 * Rewrites the `@walle/components` and `@walle/layouts` barrels at load time down to the
 * exports the project imports, so a page's module graph only pulls the CSS of the components
 * the site actually uses (Astro collects CSS from the module graph, not from what renders).
 */
function walleSlimBarrelsPlugin(root: string) {
  const BARRELS: Record<string, string> = {
    "src/@walle/components/index.js": "@walle/components",
    "src/@walle/layouts/index.js": "@walle/layouts",
  };
  const targets = Object.entries(BARRELS).map(([rel, spec]) => [resolve(root, rel), spec] as const);
  const barrelFiles = new Set(targets.map(([file]) => file));
  const used = new Map<string, Set<string>>();

  function collect(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        collect(full);
        continue;
      }
      if (!/\.(astro|ts|js|mjs|md|mdx)$/.test(entry.name) || barrelFiles.has(full)) continue;
      const source = readFileSync(full, "utf8");
      for (const [, spec] of targets) {
        const pattern = new RegExp(
          `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+["']${spec}["']`,
          "g"
        );
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source)) !== null) {
          for (const name of match[1].split(",")) {
            const clean = name
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0];
            if (clean) used.get(spec)!.add(clean);
          }
        }
      }
    }
  }

  return {
    name: "walle-slim-barrels",
    enforce: "pre" as const,
    buildStart() {
      for (const [, spec] of targets) used.set(spec, new Set());
      collect(resolve(root, "src"));
    },
    load(id: string) {
      const hit = targets.find(([file]) => id.split("?")[0] === file);
      if (!hit) return null;
      const keep = used.get(hit[1])!;
      return readFileSync(hit[0], "utf8")
        .split("\n")
        .filter((line) => {
          // Two re-export shapes: a walle source file (`default as X`) and a virtual-module
          // export (`navbar as Navbar` from `virtual:walle-components`, the embeddable
          // components). Both are filtered by the barrel's own exported name, one per line.
          const exported =
            line.match(/export\s+\{\s*default\s+as\s+(\w+)\s*\}/) ||
            line.match(
              /export\s+\{\s*\w+\s+as\s+(\w+)\s*\}\s+from\s+["']virtual:walle-components["']/
            );
          return !exported || keep.has(exported[1]);
        })
        .join("\n");
    },
  };
}

type PwaConfigSection = {
  enabled?: boolean;
  name?: string;
  shortName?: string;
  description?: string;
  lang?: string;
  themeColor?: string;
  backgroundColor?: string;
  display?: string;
  startUrl?: string;
  scope?: string;
  icons?: Record<string, unknown>[];
  appleTouchIcon?: string;
  offline?: true | string;
};

/**
 * Pure resolver, exported so a unit test can inspect the resolved `workbox` config without
 * going through `AstroPWA` (which closes its options up inside the returned integration's
 * hooks: not introspectable from outside). Returns `null` when the PWA is disabled, the same
 * signal `wallePwaIntegration` uses to skip mounting the integration at all.
 */
export function resolvePwaOptions(
  app: {
    website?: Record<string, any>;
    astro?: Record<string, any>;
    pwa?: PwaConfigSection;
    commerce?: { mode?: string };
  },
  overrides: Record<string, any> = {}
): Record<string, any> | null {
  const pwa = app.pwa ?? {};
  if (pwa.enabled !== true) return null;

  const palette = (readThemeJson().palette ?? {}) as Record<string, string>;
  const base = app.astro?.basePath || "/";
  const name = pwa.name ?? app.website?.title ?? "";

  // `${base}/offline`, collapsing the double slash a trailing-slash base would otherwise leave
  // (base "/" + "/offline" => "//offline").
  const offlineUrl = pwa.offline ? `${base}/offline`.replace(/\/{2,}/g, "/") : null;
  // /offline is not a hashed URL, so it needs a real revision (null means "already versioned"):
  // a per-build id makes returning visitors refetch it after every deploy.
  const offlineRevision = offlineUrl ? Date.now().toString(36) : null;

  // Cart UI ships no chunk at all when off (virtual:walle-features nulls the module
  // before Rollup ever sees it), so these normally match nothing. Listed anyway as a safety
  // net: if that guarantee ever regresses, a stray cart-named chunk still never gets swept into
  // the precache instead of silently shipping working "Add to cart" UI to an offline visitor
  // of a site that turned commerce off.
  const commerceChunkGlobIgnores =
    app.commerce?.mode !== "shop"
      ? ["**/_astro/Cart*", "**/_astro/VariantPicker*", "**/_astro/ProductBuyCard*"]
      : [];

  // Chunks not needed to render the offline shell, excluded from every site's precache.
  const enhancementChunkGlobIgnores = ["**/_astro/BlogTableOfContents*"];

  const defaults = {
    registerType: "autoUpdate" as const,
    injectRegister: "script-defer" as const,
    manifest: {
      name,
      short_name: pwa.shortName ?? name,
      description: pwa.description ?? app.website?.description ?? "",
      lang: pwa.lang ?? app.website?.language,
      theme_color: pwa.themeColor ?? palette.primary,
      background_color: pwa.backgroundColor ?? palette.background,
      display: pwa.display ?? "standalone",
      start_url: pwa.startUrl ?? base,
      scope: pwa.scope ?? base,
      icons: pwa.icons ?? [],
    },
    workbox: {
      // Only the hashed, immutable build output is precached; HTML is handled by the
      // network-first rule below instead, so a page is never served from a stale cache
      // while the network is available. The offline fallback is the one static HTML page
      // that IS precached by URL (below), since it must be servable with no network at all.
      // Self-hosted fonts are build output like any other asset, so
      // they precache alongside the JS/CSS they're never worth loading a page without.
      globPatterns: ["_astro/**/*.{js,css}", "_astro/fonts/**/*.woff2"],
      globIgnores: [...commerceChunkGlobIgnores, ...enhancementChunkGlobIgnores],
      // Explicitly off. vite-plugin-pwa defaults this to "/", which emits a NavigationRoute
      // bound to a URL that is not in the precache above: it throws `non-precached-url` at
      // module evaluation, before any runtimeCaching rule is registered, and the worker
      // silently caches nothing at all (vite-pwa/vite-plugin-pwa#731, #400).
      navigateFallback: null,
      additionalManifestEntries: offlineUrl ? [{ url: offlineUrl, revision: offlineRevision }] : [],
      runtimeCaching: [
        {
          urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
          handler: "NetworkFirst",
          options: {
            cacheName: "html-pages",
            networkTimeoutSeconds: 3,
            ...(offlineUrl
              ? {
                  plugins: [
                    {
                      // `new Function`, not a closure: workbox-build serializes this handler into the standalone
                      // sw.js with toString(), which keeps no lexical scope, so the URL is inlined as a literal.
                      handlerDidError: new Function(
                        `return caches.match(${JSON.stringify(offlineUrl)}, { ignoreSearch: true });`
                      ) as () => Promise<Response | undefined>,
                    },
                  ],
                }
              : {}),
          },
        },
      ],
    },
  };

  return {
    ...defaults,
    ...overrides,
    manifest: { ...defaults.manifest, ...(overrides.manifest ?? {}) },
    workbox: {
      ...defaults.workbox,
      ...(overrides.workbox ?? {}),
      globPatterns: [
        ...defaults.workbox.globPatterns,
        ...((overrides.workbox?.globPatterns ?? []) as unknown[]),
      ],
      globIgnores: [
        ...defaults.workbox.globIgnores,
        ...((overrides.workbox?.globIgnores ?? []) as unknown[]),
      ],
      additionalManifestEntries: [
        ...defaults.workbox.additionalManifestEntries,
        ...((overrides.workbox?.additionalManifestEntries ?? []) as unknown[]),
      ],
      // Consumer rules first, then walle's: Workbox takes the first route that matches,
      // so a consumer can both add rules and override a default one without having to
      // restate the defaults it still wants.
      runtimeCaching: [
        ...((overrides.workbox?.runtimeCaching ?? []) as unknown[]),
        ...defaults.workbox.runtimeCaching,
      ],
    },
  };
}

/**
 * Progressive web app support, off unless `pwa.enabled` is true: disabled means the integration
 * is never mounted. Manifest defaults come from the website and theme config; the Astro-side
 * knobs (`workbox`, `registerType`) are overridden from astro.config, merged one level deep.
 */
function wallePwaIntegration(
  app: { website?: Record<string, any>; astro?: Record<string, any>; pwa?: PwaConfigSection },
  overrides: Record<string, any> = {}
) {
  const options = resolvePwaOptions(app, overrides);
  return options
    ? [AstroPWA(options as Parameters<typeof AstroPWA>[0]), walleDedupePrecacheIntegration()]
    : [];
}

/**
 * Removes a duplicate `{url, revision}` precache entry for the same URL from a built `sw.js`
 * source string, keeping the first occurrence; returns the input unchanged when there is
 * nothing to remove or the file has no `precacheAndRoute([...])` call.
 */
export function dedupePrecacheManifest(source: string): string {
  // Precache entries never contain nested arrays, so the first "]" after
  // "precacheAndRoute([" always closes this array.
  const arrayMatch = source.match(/precacheAndRoute\((\[.*?\])/);
  if (!arrayMatch) return source;
  const [, arrayText] = arrayMatch;
  const entryPattern = /\{url:"((?:[^"\\]|\\.)*)",revision:(?:null|"[0-9a-fA-F]*")\}/g;
  const seen = new Set<string>();
  const dedupedArray = arrayText
    .replace(entryPattern, (entry, url) => {
      if (seen.has(url)) return "";
      seen.add(url);
      return entry;
    })
    .replace(/,+/g, ",")
    .replace(/\[,/g, "[")
    .replace(/,\]/g, "]");
  if (dedupedArray === arrayText) return source;
  return source.replace(arrayText, dedupedArray);
}

/**
 * Rewrites the built `sw.js` with `dedupePrecacheManifest`. `@vite-pwa/astro` adds one
 * `manifest.webmanifest` entry per Vite build environment. Registered after AstroPWA.
 */
function walleDedupePrecacheIntegration(): AstroIntegration {
  return {
    name: "walle-pwa-dedupe-precache",
    hooks: {
      "astro:build:done": ({ dir }: HookParameters<"astro:build:done">) => {
        const swPath = fileURLToPath(new URL("sw.js", dir));
        if (!existsSync(swPath)) return;
        const original = readFileSync(swPath, "utf8");
        const deduped = dedupePrecacheManifest(original);
        if (deduped !== original) writeFileSync(swPath, deduped);
      },
    },
  };
}

/**
 * Injects `/offline` when `pwa.enabled` and `pwa.offline` are both set: `true` uses the
 * managed default (`M/pwa/Offline.astro`), a `./`-prefixed string swaps in a site file, same
 * contract as `commerce.pages.*`. Nested under `pwa` because the route is meaningless without
 * the service worker it falls back through: `resolvePwaOptions` wires the matching
 * `additionalManifestEntries`/`handlerDidError` for the same flag.
 */
function walleOfflineRouteIntegration(pwa: PwaConfigSection = {}, root: string): AstroIntegration {
  const enabled = pwa.enabled === true && !!pwa.offline;
  return {
    name: "walle-offline-route",
    hooks: {
      "astro:config:setup": ({ injectRoute }: HookParameters<"astro:config:setup">) => {
        if (!enabled) return;
        const entrypoint =
          typeof pwa.offline === "string"
            ? resolveSitePath(pwa.offline, root, "pwa.offline")
            : fileURLToPath(new URL("./pwa/Offline.astro", import.meta.url));
        injectRoute({ pattern: "/offline", entrypoint });
      },
    },
  };
}

/**
 * Injects `/og/[...slug].png` when `seo.ogImage.enabled` is true: a single fixed
 * entrypoint (`M/og/route.ts`) whose own `getStaticPaths` enumerates "default" plus every
 * configured collection, and resolves each one's `seo.ogImage.templates` override itself
 * (a per-slug template needs a site-path resolved per param, which `injectRoute`'s one static
 * `entrypoint` per pattern can't express: unlike `commerce.pages.*`, which swaps the whole
 * page).
 */
function walleOgRouteIntegration(seo: { ogImage?: { enabled?: boolean } } = {}): AstroIntegration {
  const enabled = seo.ogImage?.enabled === true;
  return {
    name: "walle-og-route",
    hooks: {
      "astro:config:setup": ({ injectRoute }: HookParameters<"astro:config:setup">) => {
        if (!enabled) return;
        const entrypoint = fileURLToPath(new URL("./og/route.ts", import.meta.url));
        injectRoute({ pattern: "/og/[...slug].png", entrypoint });
      },
    },
  };
}

/**
 * Injects one route per configured feed item when `seo.feeds.enabled`: a fixed pattern
 * per item (no dynamic segment, unlike `/og/[...slug].png`), all sharing the same entrypoint;
 * `M/feeds/route.ts` finds its own item back out of config by matching the request's own path.
 */
function walleFeedsRouteIntegration(
  seo: { feeds?: { enabled?: boolean; items?: Array<{ path: string }> } } = {}
): AstroIntegration {
  const enabled = seo.feeds?.enabled === true;
  const items = seo.feeds?.items ?? [];
  return {
    name: "walle-feeds-route",
    hooks: {
      "astro:config:setup": ({ injectRoute }: HookParameters<"astro:config:setup">) => {
        if (!enabled) return;
        const entrypoint = fileURLToPath(new URL("./feeds/route.ts", import.meta.url));
        for (const item of items) {
          injectRoute({ pattern: item.path, entrypoint });
        }
      },
    },
  };
}

/**
 * The three tags Head.astro emits for a PWA, resolved once here rather than re-derived at
 * render time: the manifest link, the browser-chrome color and the iOS icon. Head.astro reads
 * them from `virtual:walle-pwa`, so the theme palette stays a single source of truth (a
 * consumer's `src/configs/index.js` is seed-owned and may not expose `theme` at all) and a
 * disabled PWA is simply `{ enabled: false }`.
 */
function wallePwaHeadPlugin(head: Record<string, unknown>) {
  const virtualId = "virtual:walle-pwa";
  const resolvedId = "\0" + virtualId;
  return {
    name: "walle-pwa-head",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      return id === resolvedId ? `export default ${JSON.stringify(head)};` : null;
    },
  };
}

/**
 * Exposes the resolved font list to components at runtime: Head.astro needs to know
 * every configured font's `cssVariable` and `preload` filter to render one `<Font>` per entry,
 * but it can't read theme.json itself (only ever parsed at build time, here). Same
 * resolveId/load pattern as `wallePwaHeadPlugin`.
 */
function walleFontsPlugin(entries: WalleFontEntry[] | undefined) {
  const virtualId = "virtual:walle-fonts";
  const resolvedId = "\0" + virtualId;
  const fonts = (entries ?? []).map((entry) => ({
    cssVariable: `--walle-font-${entry.role}`,
    preload: entry.preload ?? true,
  }));
  return {
    name: "walle-fonts",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      return id === resolvedId ? `export const fonts = ${JSON.stringify(fonts)};` : null;
    },
  };
}

/**
 * The theme values OG rendering needs (palette and `typography.fonts`), embedded as data.
 * `og/theme.ts` runs from a prerender chunk whose `import.meta.url` is nowhere near
 * `src/configs/`, so it cannot read theme.json from disk itself.
 */
function walleThemeDataPlugin(theme: Record<string, any>) {
  const virtualId = "virtual:walle-theme-data";
  const resolvedId = "\0" + virtualId;
  const data = { palette: theme.palette ?? {}, fonts: theme.typography?.fonts ?? [] };
  return {
    name: "walle-theme-data",
    resolveId(id: string) {
      return id === virtualId ? resolvedId : null;
    },
    load(id: string) {
      return id === resolvedId ? `export default ${JSON.stringify(data)};` : null;
    },
  };
}

function resolvePwaHead(
  app: { astro?: Record<string, any>; pwa?: PwaConfigSection },
  overrides: Record<string, any> = {}
) {
  const pwa = app.pwa ?? {};
  if (pwa.enabled !== true) return { enabled: false };
  const base = (app.astro?.basePath || "/").replace(/\/$/, "");
  const palette = (readThemeJson().palette ?? {}) as Record<string, string>;
  return {
    enabled: true,
    manifestHref: `${base}/manifest.webmanifest`,
    registerHref: `${base}/registerSW.js`,
    themeColor: overrides.manifest?.theme_color ?? pwa.themeColor ?? palette.primary ?? null,
    appleTouchIcon: pwa.appleTouchIcon ? `${base}${pwa.appleTouchIcon}` : null,
  };
}

type AstroConfigSection = {
  baseUrl?: string;
  basePath?: string;
  trailingSlash?: "always" | "never" | "ignore";
  /** Adds the node adapter (`output` stays Astro's default, `"static"`): only routes that
   * declare `prerender = false` render on demand, everything else stays a static file. */
  adapter?: "node";
  /** Path prefixes to keep out of sitemap.xml. For pages that exist as a routable URL but must
   * not be indexed (a `noindex` status page such as an offline fallback): listing one in the
   * sitemap while its own meta says `noindex` is the "Submitted URL marked noindex" conflict
   * Search Console reports. Absent key = every page is listed, as before. */
  sitemapExclude?: string[];
  /** Passed straight through to Astro's native `redirects` config. Astro's own static-output
   * redirect page already emits refresh/noindex/canonical; walle additionally excludes every
   * redirect source from sitemap.xml, same as `sitemapExclude`. */
  redirects?: Record<string, string | { destination: string; status: 301 | 302 | 307 | 308 }>;
  /** `false` opts out entirely; otherwise maps to Astro's own `prefetch` config, defaulting to
   * `{ prefetchAll: true, defaultStrategy: "hover" }` when absent (walle's default; Astro's
   * own default is off). */
  prefetch?: false | { strategy?: "hover" | "tap" | "viewport" | "load"; all?: boolean };
};

/**
 * True when `pathname` (as `new URL(page).pathname` hands it: includes the site's base path)
 * falls under one of `excludes` (bare paths, written without the base, e.g. `"/old-page"`).
 * Strips `base` off the front and normalizes a trailing slash on both sides before comparing,
 * so a site with `astro.basePath` set (any GitHub Pages project site) and an exclude/redirect
 * entry written with or without a trailing slash both still match. Exported and pure so it's
 * unit-testable without going through the sitemap integration's own hook lifecycle.
 */
export function isSitemapExcluded(pathname: string, excludes: string[], base?: string): boolean {
  const normalize = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p) || "/";
  const path = normalize(stripBase(pathname, base));
  return excludes.some((exclude) => {
    const p = normalize(exclude);
    // "/" as an exclude only ever matches the root itself: as a prefix it would swallow
    // every path on the site (a redirect from "/" is a real case, e.g. to "/it/").
    return path === p || (p !== "/" && path.startsWith(`${p}/`));
  });
}

type WalleFontEntry = {
  role: "body" | "heading" | "mono";
  name: string;
  provider: "local" | "google" | "fontsource";
  weights?: (string | number)[];
  styles?: ("normal" | "italic" | "oblique")[];
  src?: string[];
  preload?: boolean | Array<{ weight?: string | number; style?: string; subset?: string }>;
  fallback?: "serif" | "sans-serif" | "monospace" | "system-ui";
  display?: "auto" | "block" | "fallback" | "optional" | "swap";
};

/**
 * Maps walle's simplified `typography.fonts` entries to Astro's native `fonts` config:
 * one entry per role, `cssVariable` fixed to `--walle-font-<role>`, provider resolved from the
 * three options walle exposes. A local font gets a single @font-face variant covering the
 * whole `weights`/`styles` range from one file (the variable-font case): see the schema
 * comment on `src` for what a per-weight static local font would need instead.
 */
function resolveWalleFonts(
  entries: WalleFontEntry[] | undefined
): NonNullable<AstroUserConfig["fonts"]> {
  // Built as a plain heterogeneous array (each entry's `options` shape depends on its own
  // provider) and cast once here to Astro's own `fonts` type: the per-provider generic
  // correlation `FontFamily<T>` expects isn't expressible for an array resolved dynamically
  // from config, only for a literal astro.config.mjs.
  const resolved = (entries ?? []).map((entry) => ({
    provider:
      entry.provider === "google"
        ? fontProviders.google()
        : entry.provider === "fontsource"
          ? fontProviders.fontsource()
          : fontProviders.local(),
    name: entry.name,
    cssVariable: `--walle-font-${entry.role}`,
    // Astro already defaults this to ["sans-serif"], which is why optimizedFallbacks (on by
    // default) was already running; the CLS this fixes came from the wrong generic, not a
    // missing one, e.g. a serif body font swapping in over an Arial-metric placeholder. Every
    // font gets an explicit, metric-appropriate fallback instead of silently inheriting Astro's
    // sans-serif default.
    fallbacks: [entry.fallback ?? "sans-serif"],
    // Absent means "don't touch it": Astro's own default ("swap") applies unchanged. Only an
    // explicit display gets passed through, same opt-in shape as weights/styles below.
    ...(entry.display ? { display: entry.display } : {}),
    ...(entry.weights?.length ? { weights: entry.weights } : {}),
    ...(entry.styles?.length ? { styles: entry.styles } : {}),
    ...(entry.provider === "local"
      ? {
          options: {
            variants: [
              {
                src: entry.src ?? [],
                weight: entry.weights?.join(" "),
                style: entry.styles?.[0],
              },
            ],
          },
        }
      : {}),
  }));
  return resolved as unknown as NonNullable<AstroUserConfig["fonts"]>;
}

/**
 * Resolve the Astro config from the consumer's app.json plus optional native overrides.
 * Override semantics (additive merge): scalar keys from the consumer win over the
 * walle-resolved values; `integrations` are concatenated onto the walle defaults
 * (mdx, sitemap, icon), never replaced.
 */
export function defineWalleConfig(overrides: Record<string, any> = {}) {
  // Single build-time gate for all four config files: a malformed or outdated config
  // fails here, loudly, instead of surfacing later as a runtime import error or a silently
  // wrong page.
  parseConfig(appSchema, appConfig, "app.json");
  parseConfig(navbarSchema, navbarConfigJson, "navbar.json");
  parseConfig(footerSchema, footerConfigJson, "footer.json");
  parseConfig(themeSchema, readThemeJson(), "theme.json");

  const astro = (appConfig.astro ?? {}) as AstroConfigSection;
  const components = (appConfig as { components?: Record<string, string> }).components;
  const commerce = (
    appConfig as { commerce?: { mode?: string; pages?: { list?: string; detail?: string } } }
  ).commerce;
  const pwa = (appConfig as { pwa?: PwaConfigSection }).pwa ?? {};
  const seo =
    (
      appConfig as {
        seo?: {
          ogImage?: { enabled?: boolean };
          feeds?: { enabled?: boolean; items?: Array<{ path: string }> };
        };
      }
    ).seo ?? {};
  // Fail fast, at config-build time, the same as the parseConfig calls above: an invalid
  // override surfaces here, not as a missing component the first time a page renders.
  resolveEmbeddedComponents(components, process.cwd());

  // Redirect sources and the offline fallback never belong in the sitemap alongside their own
  // destination / next to no real content: same exclusion mechanism, two sources.
  const redirectSources = Object.keys(astro.redirects ?? {});
  const offlineExclude = pwa.enabled === true && pwa.offline ? ["/offline"] : [];
  // A feed is a machine-readable alternate of a listing page, never content of its own:
  // same exclusion reasoning as the offline fallback.
  const feedsExclude =
    seo.feeds?.enabled === true ? (seo.feeds.items ?? []).map((i) => i.path) : [];
  const sitemapExclude = [
    ...(astro.sitemapExclude ?? []),
    ...redirectSources,
    ...offlineExclude,
    ...feedsExclude,
  ];

  // Destinations are written bare, same convention as every other walle path: prefix the
  // base path here so a redirect still lands on a real route once the site has one.
  const redirects = astro.redirects
    ? Object.fromEntries(
        Object.entries(astro.redirects).map(([source, target]) => [
          source,
          typeof target === "string"
            ? withBase(target, astro.basePath)
            : { ...target, destination: withBase(target.destination, astro.basePath) },
        ])
      )
    : undefined;

  const walleFontEntries: WalleFontEntry[] | undefined = readThemeJson().typography?.fonts;
  const fonts = resolveWalleFonts(walleFontEntries);

  // Astro's own `prefetch` is off by default; walle turns it on with the hover strategy
  // unless a site opts out entirely with `astro.prefetch: false`.
  const prefetch =
    astro.prefetch === false
      ? false
      : {
          prefetchAll: astro.prefetch?.all ?? true,
          defaultStrategy: astro.prefetch?.strategy ?? ("hover" as const),
        };
  const walleIntegrations = [
    mdx(),
    sitemap(
      sitemapExclude.length > 0
        ? {
            filter: (page: string) =>
              !isSitemapExcluded(new URL(page).pathname, sitemapExclude, astro.basePath),
          }
        : undefined
    ),
    icon(),
    walleCommerceRoutesIntegration(commerce?.mode, commerce?.pages, process.cwd()),
    walleOfflineRouteIntegration(pwa, process.cwd()),
    walleOgRouteIntegration(seo),
    walleFeedsRouteIntegration(seo),
  ];

  const {
    integrations: consumerIntegrations = [],
    vite: consumerVite = {},
    // Not an Astro key: native overrides for the PWA integration walle mounts itself.
    pwa: consumerPwa = {},
    ...consumerScalars
  } = overrides;

  const pwaIntegrations = wallePwaIntegration(appConfig as Record<string, any>, consumerPwa);
  const pwaHead = resolvePwaHead(appConfig as Record<string, any>, consumerPwa);

  return defineConfig({
    site: astro.baseUrl,
    base: astro.basePath,
    trailingSlash: astro.trailingSlash,
    // No adapter (default) => fully static, identical to today. `adapter: "node"` adds the
    // node adapter without setting `output`, so it stays Astro's default ("static") and only
    // `prerender = false` routes render on demand through the adapter.
    ...(astro.adapter === "node" ? { adapter: node({ mode: "standalone" }) } : {}),
    redirects,
    prefetch,
    ...(fonts.length > 0 ? { fonts } : {}),
    // Consumer scalar keys override the walle-resolved values.
    ...consumerScalars,
    integrations: [...walleIntegrations, ...pwaIntegrations, ...consumerIntegrations],
    vite: {
      ...consumerVite,
      plugins: [
        walleThemePlugin(),
        walleComponentsPlugin(process.cwd(), components),
        wallePwaHeadPlugin(pwaHead),
        walleFontsPlugin(walleFontEntries),
        walleThemeDataPlugin(readThemeJson()),
        walleFeaturesPlugin(commerce?.mode),
        walleSlimBarrelsPlugin(process.cwd()),
        ...(consumerVite.plugins ?? []),
      ],
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
