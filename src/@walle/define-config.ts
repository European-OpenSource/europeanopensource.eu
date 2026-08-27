// Build-time walle config resolution. Imported only by astro.config.mjs (via the
// `defineWalleConfig` re-export in ./config). Kept out of the runtime config module
// so components importing `config` don't pull astro/config into their graph.
import AstroPWA from "@vite-pwa/astro";
import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
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
function readThemeJson(): Record<string, any> {
  const themeUrl = new URL("../configs/theme.json", import.meta.url);
  if (!existsSync(fileURLToPath(themeUrl))) return {};
  try {
    return JSON.parse(readFileSync(themeUrl, "utf8"));
  } catch {
    return {};
  }
}

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

/**
 * Barrel modules (`@walle/components`, `@walle/layouts`) are a DX win and a payload bug:
 * Astro collects a page's CSS from its module graph, not from what the page renders, so one
 * `import { Section } from "@walle/components"` drags every component's <style> onto every
 * page — carousel, cart, blog and product CSS included on a site that has none of them.
 * (Measured on eventialatina.it: 79 kB shared stylesheet, 35 kB of it for components no page
 * ever rendered.)
 *
 * This plugin rewrites each barrel at load time down to the exports the project actually
 * imports from it, scanning the consumer's own sources for the named imports. Nothing about
 * how consumers write imports changes; what changes is what ends up in the graph.
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
          const exported = line.match(/export\s+\{\s*default\s+as\s+(\w+)\s*\}/);
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
};

/**
 * Progressive web app support, off unless `pwa.enabled` is true in app.json. Disabled means
 * the integration is never mounted: no manifest, no service worker, no registration script,
 * nothing added to any page.
 *
 * Everything the manifest needs already exists elsewhere in a walle project, so the defaults
 * read from there (website title/description/language, theme palette, base path) and a
 * consumer only writes what actually differs. The Astro-side knobs (`workbox`, `registerType`,
 * …) are deliberately NOT in app.json: they are code-shaped, not content-shaped, so they are
 * overridden natively from astro.config via `defineWalleConfig({ pwa: { workbox: … } })` and
 * merged one level deep over the defaults below.
 *
 * `injectRegister: "script-defer"` on purpose: vite-plugin-pwa cannot inject anything into
 * Astro's static HTML output (it relies on a transformIndexHtml pass Astro's build doesn't
 * run — the generated file lands in dist/ but no page ever references it), so Head.astro
 * emits the tag itself. The generated registerSW.js already registers inside a `load`
 * listener, which keeps the worker off the critical path and avoids pulling workbox-window
 * into the page bundle at all.
 */
function wallePwaIntegration(
  app: { website?: Record<string, any>; astro?: Record<string, any>; pwa?: PwaConfigSection },
  overrides: Record<string, any> = {}
) {
  const pwa = app.pwa ?? {};
  if (pwa.enabled !== true) return [];

  const palette = (readThemeJson().palette ?? {}) as Record<string, string>;
  const base = app.astro?.basePath || "/";
  const name = pwa.name ?? app.website?.title ?? "";

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
      // while the network is available.
      globPatterns: ["_astro/**/*.{js,css}"],
      // Explicitly off. vite-plugin-pwa defaults this to "/", which emits a NavigationRoute
      // bound to a URL that is not in the precache above: it throws `non-precached-url` at
      // module evaluation, before any runtimeCaching rule is registered, and the worker
      // silently caches nothing at all (vite-pwa/vite-plugin-pwa#731, #400).
      navigateFallback: null,
      runtimeCaching: [
        {
          urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
          handler: "NetworkFirst",
          options: { cacheName: "html-pages", networkTimeoutSeconds: 3 },
        },
      ],
    },
  };

  return [
    AstroPWA({
      ...defaults,
      ...overrides,
      manifest: { ...defaults.manifest, ...(overrides.manifest ?? {}) },
      workbox: {
        ...defaults.workbox,
        ...(overrides.workbox ?? {}),
        // Consumer rules first, then walle's: Workbox takes the first route that matches,
        // so a consumer can both add rules and override a default one without having to
        // restate the defaults it still wants.
        runtimeCaching: [
          ...((overrides.workbox?.runtimeCaching ?? []) as unknown[]),
          ...defaults.workbox.runtimeCaching,
        ],
      },
    } as Parameters<typeof AstroPWA>[0]),
  ];
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
    // SSR off (default) => static output identical to today; on => node adapter.
    ...(ssrEnabled ? { output: "server", adapter: node({ mode: "standalone" }) } : {}),
    // Consumer scalar keys override the walle-resolved values.
    ...consumerScalars,
    integrations: [...walleIntegrations, ...pwaIntegrations, ...consumerIntegrations],
    vite: {
      ...consumerVite,
      plugins: [
        walleThemePlugin(),
        wallePwaHeadPlugin(pwaHead),
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
