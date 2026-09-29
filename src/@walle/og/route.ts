import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import config from "@walle/config";
import { renderOgImage, type OgEntry, type OgTemplate } from "./render";
import { resolveOgTheme } from "./theme";
import defaultTemplate from "./templates/default";
import { resolveSitePath } from "../utils/site-path";

export const prerender = true;

type OgImageProps = { entry: OgEntry; template: OgTemplate };
type OgImagePath = { params: { slug: string }; props: OgImageProps };

function siteEntry(): OgEntry {
  return { title: config.app.website.title, subtitle: config.app.website.description, data: {} };
}

function entryFromCollectionItem(id: string, data: Record<string, unknown>): OgEntry {
  return {
    title: typeof data.title === "string" ? data.title : id,
    subtitle: typeof data.description === "string" ? data.description : undefined,
    data,
  };
}

/**
 * Template precedence, as a pure function decoupled from the filesystem/dynamic-import side
 * of actually loading one: this is what a unit test exercises directly. `undefined` means
 * "no override configured", leaving `resolveOgTemplate` to fall back to walle's own default
 * template.
 */
export function pickOgTemplatePath(
  collection: string | undefined,
  templates: Record<string, string> | undefined
): string | undefined {
  if (!templates) return undefined;
  return (collection ? templates[collection] : undefined) ?? templates.default;
}

// One import per resolved absolute path per build, not per collection entry.
const templateCache = new Map<string, OgTemplate>();

async function resolveOgTemplate(
  collection: string | undefined,
  templates: Record<string, string> | undefined,
  root: string
): Promise<OgTemplate> {
  const path = pickOgTemplatePath(collection, templates);
  if (!path) return defaultTemplate;

  const abs = resolveSitePath(
    path,
    root,
    collection ? `seo.ogImage.templates.${collection}` : "seo.ogImage.templates.default"
  );
  let template = templateCache.get(abs);
  if (!template) {
    const mod = (await import(/* @vite-ignore */ abs)) as { default?: OgTemplate };
    template = mod.default ?? defaultTemplate;
    templateCache.set(abs, template);
  }
  return template;
}

/**
 * `/og/[...slug].png`: "default" for the site-wide image, `<collection>/<id>` for one per
 * entry of every collection listed in `seo.ogImage.collections`. Each gets its own template:
 * `templates[collection] ?? templates.default ?? walle's own default`.
 */
export async function getStaticPaths(): Promise<OgImagePath[]> {
  const ogImage = config.app.seo?.ogImage;
  if (!ogImage?.enabled) return [];

  const root = process.cwd();
  const templates = ogImage.templates;

  const paths: OgImagePath[] = [
    {
      params: { slug: "default" },
      props: { entry: siteEntry(), template: await resolveOgTemplate(undefined, templates, root) },
    },
  ];

  for (const collectionName of ogImage.collections ?? []) {
    const template = await resolveOgTemplate(collectionName, templates, root);
    const entries = await getCollection(collectionName as never);
    for (const item of entries as { id: string; data: Record<string, unknown> }[]) {
      paths.push({
        params: { slug: `${collectionName}/${item.id}` },
        props: { entry: entryFromCollectionItem(item.id, item.data), template },
      });
    }
  }

  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const { entry, template } = props as OgImageProps;
  const theme = resolveOgTheme();
  const png = await renderOgImage(entry, { template, theme });
  // Node's `Buffer` is a real `Uint8Array` at runtime (a valid Response body), but its type
  // doesn't structurally satisfy DOM's `BodyInit` in this lib config: a type-only mismatch.
  return new Response(png as unknown as BodyInit, { headers: { "Content-Type": "image/png" } });
};
