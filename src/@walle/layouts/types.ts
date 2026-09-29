// The layout Props chain, as a plain TS module: each `.astro` layout re-exports its own type
// from here (`export type { XProps as Props } from "./types"`), so the chain is checkable by
// plain `tsc` (an `.astro` file's own frontmatter type is only resolvable through Astro's own
// TypeScript language-service plugin, which bare `tsc` does not have).
import type { CollectionEntry } from "astro:content";

export interface AbstractLayoutProps {
  /** Document `<title>`. @default "" */
  headerTitle?: string;
  /** Meta description. @default config.app.website.description */
  headerDescription?: string;
  /** Open Graph / social preview image URL. @default config.app.website.image */
  headerImage?: string | null;
  /** Open Graph image, when different from `headerImage`. */
  headerOgImage?: string | null;
  /** A layout's own per-entry OG image, e.g. `ogImageUrl("posts", id)` from
   * BlogPostLayout. Lower priority than `headerOgImage`, higher than the site default. */
  headerEntryOgImage?: string | null;
  /** Meta robots directive. @default config.app.website.robots */
  headerRobots?: string;
  /** Document `lang` attribute. @default config.app.website.language */
  headerLanguage?: string;
  /** Article `published_time`, for pages with one (blog posts). */
  headerPublishedTime?: string | Date | null;
  /** Accessible label of the skip-to-content link. @default "Skip to content" */
  skipLinkLabel?: string;
}

// BaseLayout adds no props of its own; it forwards everything to AbstractLayout unchanged.
export type BaseLayoutProps = AbstractLayoutProps;

export interface BlogPostLayoutProps extends BaseLayoutProps {
  title: string;
  description: string;
  author?: string;
  publishDate?: Date;
  readingTime?: string;
  image?: string | null;
  tags?: string[];
  draft?: boolean;
  /** The `posts` collection entry id, for deriving its own OG image when enabled. */
  id?: string;
}

export interface BlogPostsLayoutProps extends BaseLayoutProps {
  /** Posts to list, bypassing the collection query below. */
  posts?: CollectionEntry<"posts">[];
  /** Content collection to query when `posts` is not given. @default "posts" */
  postsCollection?: string;
  /** Only list posts carrying at least one of these tags. */
  filterTags?: string[];
  /** Show the tag/search filter bar above the list. @default true */
  showFilters?: boolean;
}

export interface DetailLayoutProps extends BaseLayoutProps {
  /** Page title (header + document title) */
  title: string;
  /** Meta description */
  description?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Breadcrumb trail (last item should be the current page) */
  breadcrumbs?: { label: string; href?: string; icon?: string }[];
  /** Optional back link above the breadcrumbs */
  backLink?: {
    href: string;
    /** @default "Back" */
    label?: string;
  };
  /**
   * Product rendered by this page, for JSON-LD. Shaped like `ProductCard`'s `ProductData`, kept
   * loose here rather than duplicated: that type is declared in ProductCard.astro's own
   * frontmatter, unreachable from a plain `.ts` module the same way `.astro` types generally are.
   */
  product?: Record<string, unknown>;
  /**
   * Alignment of the badges row inside the header.
   * @default "start"
   */
  badgesAlign?: "start" | "center" | "end";
}
