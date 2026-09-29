import type { OgTheme } from "./theme";

export type OgEntry = { title: string; subtitle?: string; data: Record<string, unknown> };

/**
 * A satori-compatible element tree. Satori's own input type is `ReactNode` (from "react",
 * which this project never installs; satori itself only needs an object shaped like this,
 * no React runtime involved), so templates are written against this narrower, self-contained
 * type instead and cast at the one point they actually reach satori (`renderOgImage` below).
 */
export type SatoriElement = {
  type: string;
  props: {
    children?: SatoriElement | SatoriElement[] | string | null | (SatoriElement | null)[];
    style?: Record<string, string | number>;
    [key: string]: unknown;
  };
};

export type OgTemplate = (_entry: OgEntry, _theme: OgTheme) => SatoriElement;

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Renders one OG image: satori lays the element tree out to SVG, resvg rasterizes it to a PNG
 * buffer. Both are imported dynamically so a site that never enables `seo.ogImage` never pulls
 * satori/resvg's native binary into its build graph at all.
 */
export async function renderOgImage(
  entry: OgEntry,
  options: { template: OgTemplate; theme: OgTheme }
): Promise<Buffer> {
  const { template, theme } = options;
  const [{ default: satori }, { Resvg }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
  ]);

  const element = template(entry, theme);
  // Both casts land on the one boundary where our own narrower types (SatoriElement, OgFont)
  // meet satori's: it needs `react`'s ReactNode type for `element` (never installed; satori
  // itself only needs the plain object shape) and a fixed Weight union for `fonts[].weight`
  // (walle's own config leaves this a plain number, validated loosely by design).
  const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: theme.fonts.map((font) => ({
      name: font.name,
      data: font.data,
      weight: font.weight ?? 400,
      style: font.style ?? "normal",
    })) as unknown as Parameters<typeof satori>[1]["fonts"],
  });

  return new Resvg(svg).render().asPng();
}
