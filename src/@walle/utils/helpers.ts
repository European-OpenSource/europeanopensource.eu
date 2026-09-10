export function getPlatformIcon(platform: string): string {
  const platform_lc = platform.toLowerCase();
  if (platform_lc.includes("github")) return "fa:github";
  if (platform_lc.includes("gitlab")) return "fa:gitlab";
  if (platform_lc.includes("bitbucket")) return "fa:bitbucket";
  return "fa:code-fork";
}

export function calculateTimeAgo(dateString: string): string | null {
  if (!dateString) return null;
  const creationDate = new Date(dateString);
  const currentDate = new Date();
  const diffTime = currentDate.getTime() - creationDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function formatDate(dateString: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function calculateReadingTime(content: string): {
  text: string;
  minutes: number;
  words: number;
} {
  const wordsPerMinute = 200;
  const imageReadingTime = 12; // seconds per image
  const codeReadingTime = 25; // seconds per code block

  // Remove HTML/Markdown and count words
  const cleanText = content
    .replace(/<[^>]*>/g, "") // Remove HTML
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]*`/g, "") // Remove inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove markdown images
    .replace(/\[.*?\]\(.*?\)/g, "$1") // Convert links to text
    .trim();

  const words = cleanText.split(/\s+/).filter((word) => word.length > 0).length;

  // Count images and code blocks
  const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;

  // Calculate total time
  const totalMinutes = Math.ceil(
    words / wordsPerMinute + (images * imageReadingTime) / 60 + (codeBlocks * codeReadingTime) / 60
  );

  return {
    text: `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""} read`,
    minutes: totalMinutes,
    words: words,
  };
}

function getBasePath(): string {
  return (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
}

export function resolveInternalUrl(url: string): string {
  if (!url) return url;

  const isExternalLike = /^(?:[a-z]+:)?\/\//i.test(url);
  if (
    isExternalLike ||
    url.startsWith("#") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return url;
  }

  const basePath = getBasePath();

  if (url === "/") {
    return basePath || "/";
  }

  if (url.startsWith("/")) {
    return `${basePath}${url}`;
  }

  return url;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  if (path === "/") return "/";
  return path.replace(/\/$/, "");
}

/**
 * Meta-description budget. Returns `text` untouched when it fits, otherwise cuts it at the last
 * word boundary that fits and appends an ellipsis.
 *
 * The `cut > 0` guard is not defensive noise: `lastIndexOf(" ", n)` returns -1 for a string with
 * no space in its first n characters (a long unbroken token, a URL, an agglutinated title), and
 * `slice(0, -1)` would then drop exactly one character instead of truncating — producing an
 * almost-full-length string that silently defeats the whole function. In that case there is no
 * word boundary to respect, so the cut falls back to a hard one at the limit.
 */
export function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf(" ", maxLength - 1);
  return text.slice(0, cut > 0 ? cut : maxLength - 1).trimEnd() + "…";
}
