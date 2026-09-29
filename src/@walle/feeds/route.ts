import type { APIRoute } from "astro";
import rss, { type RSSFeedItem } from "@astrojs/rss";
import { getCollection } from "astro:content";
import config from "@walle/config";
import type { AppConfig } from "@walle/config";
import { resolveInternalUrl } from "@walle/utils";
import { stripBase } from "../utils/base-path";

/**
 * One entrypoint file is injected once per configured feed item (define-config.ts);
 * whichever `path` it was registered under is how a request finds its own item back out of
 * `config.app.seo.feeds.items` at request time: `injectRoute` has no way to pass distinct
 * props per pattern for a plain API route the way `getStaticPaths` does for pages.
 */

type FeedsConfig = NonNullable<AppConfig["seo"]>["feeds"];
export type FeedItemConfig = NonNullable<NonNullable<FeedsConfig>["items"]>[number];
export type FeedEntry = { id: string; data: Record<string, unknown> };

export const prerender = true;

const DEFAULT_FEED_LIMIT = 50;

function findFeedItem(pathname: string): FeedItemConfig {
  const items = config.app.seo?.feeds?.items ?? [];
  const path = stripBase(pathname, import.meta.env.BASE_URL || "/");
  const item = items.find((entry) => entry.path === path);
  if (!item) throw new Error(`No feed configured for path "${path}"`);
  return item;
}

function requiredField(
  data: Record<string, unknown>,
  fields: FeedItemConfig["fields"],
  key: "title" | "description" | "date",
  item: FeedItemConfig,
  entryId: string
): unknown {
  const mappedKey = fields?.[key] ?? key;
  const value = data[mappedKey];
  if (value === undefined) {
    throw new Error(
      `Feed "${item.path}" (collection "${item.collection}"): entry "${entryId}" is missing ` +
        `field "${mappedKey}" (mapped from "${key}")`
    );
  }
  return value;
}

/**
 * Drops excluded drafts, maps each entry's fields per `item.fields` (default: identity;
 * "date" reads `data.date` unless overridden), sorts by date descending and applies the
 * configured limit (50 when unset). Pure and side-effect free so a unit test can exercise every case (mapping,
 * draft exclusion, sort, limit, the missing-field error) without astro:content or a real build.
 */
export function buildFeedItems(
  entries: FeedEntry[],
  item: FeedItemConfig,
  site: string | URL
): RSSFeedItem[] {
  const fields = item.fields;
  const kept = entries.filter((entry) => !(item.excludeDrafts && entry.data.draft === true));

  const mapped = kept.map((entry) => {
    const data = entry.data;
    const title = requiredField(data, fields, "title", item, entry.id);
    const description = requiredField(data, fields, "description", item, entry.id);
    const date = requiredField(data, fields, "date", item, entry.id);
    const categories = data[fields?.categories ?? "categories"];

    return {
      title: String(title),
      description: String(description),
      pubDate: date instanceof Date ? date : new Date(date as string),
      categories: Array.isArray(categories) ? (categories as string[]) : undefined,
      link: new URL(resolveInternalUrl(item.link.replace("{id}", entry.id)), site).toString(),
    };
  });

  mapped.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return mapped.slice(0, item.limit ?? DEFAULT_FEED_LIMIT);
}

export const GET: APIRoute = async (context) => {
  const item = findFeedItem(context.url.pathname);
  const entries = (await getCollection(item.collection as never)) as FeedEntry[];
  const items = buildFeedItems(entries, item, context.site!);

  return rss({
    title: item.title ?? config.app.website.title,
    description: item.description ?? config.app.website.description,
    site: context.site!,
    items,
    customData: `<language>${config.app.website.language || "en-US"}</language>`,
  });
};
