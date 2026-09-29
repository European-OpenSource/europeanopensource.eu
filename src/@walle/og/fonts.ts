import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// `?inline` embeds the file's bytes as a base64 data URI directly in this module's own build
// output, immune to Vite relocating the compiled chunk elsewhere (unlike a runtime
// `readFileSync(new URL("./fonts/Inter-Bold.woff", import.meta.url))`, which resolves against
// wherever THIS code physically ends up after bundling, not its original source location.
// See the ambient declaration in env.d.ts for why this import needs one.
import bundledFontDataUri from "./fonts/Inter-Bold.woff?inline";

export type OgFont = {
  name: string;
  data: Buffer;
  weight?: number;
  style?: "normal" | "italic";
};

export type OgImageFontConfig = {
  name: string;
  path: string;
  weight?: number;
  style?: "normal" | "italic";
};

// A `typography.fonts` entry (schema.ts's fontEntrySchema): only its `provider: "local"` shape
// is usable here, since satori renders fully offline and google/fontsource fonts are fetched
// from a CDN by Astro's Fonts API at build time.
export type TypographyFontConfig = {
  name: string;
  provider: "local" | "google" | "fontsource";
  src?: string[];
  weights?: (string | number)[];
};

// satori accepts ttf, otf and woff, never woff2: its font parser can't inflate brotli.
const SUPPORTED_EXTENSIONS = [".ttf", ".otf", ".woff"];

function isSupportedFontFile(path: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

// Read-once-per-path cache: a build renders many OG images (one per collection entry) and
// would otherwise re-read the same font file from disk for every single one.
const siteFontCache = new Map<string, Buffer>();

function readCached(absPath: string): Buffer {
  let data = siteFontCache.get(absPath);
  if (!data) {
    data = readFileSync(absPath);
    siteFontCache.set(absPath, data);
  }
  return data;
}

let bundledDefault: OgFont | null = null;

/** The last-resort fallback: bundled, open-licensed (SIL OFL 1.1), never fetched. */
function bundledDefaultFont(): OgFont {
  if (!bundledDefault) {
    const base64 = bundledFontDataUri.slice(bundledFontDataUri.indexOf(",") + 1);
    bundledDefault = {
      name: "Inter",
      data: Buffer.from(base64, "base64"),
      weight: 700,
      style: "normal",
    };
  }
  return bundledDefault;
}

/**
 * Resolution order: `seo.ogImage.fonts` (site-configured, explicit for OG rendering) →
 * the site's `typography.fonts` local sources in a supported format → the bundled fallback.
 * Never touches the network.
 */
export function resolveOgFonts(
  ogImageFonts: OgImageFontConfig[] | undefined,
  typographyFonts: TypographyFontConfig[] | undefined,
  root: string
): OgFont[] {
  if (ogImageFonts && ogImageFonts.length > 0) {
    return ogImageFonts.map((f) => ({
      name: f.name,
      data: readCached(resolve(root, f.path)),
      weight: f.weight,
      style: f.style,
    }));
  }

  for (const font of typographyFonts ?? []) {
    if (font.provider !== "local") continue;
    const src = (font.src ?? []).find(isSupportedFontFile);
    if (!src) continue;
    const weight = font.weights?.[0];
    return [
      {
        name: font.name,
        data: readCached(resolve(root, src)),
        weight: weight !== undefined ? Number(weight) : undefined,
      },
    ];
  }

  return [bundledDefaultFont()];
}
