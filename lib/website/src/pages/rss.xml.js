import rss from "@astrojs/rss";
import config from "@walle/config";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = await getCollection("projects");
  return rss({
    title: config.app.website.title,
    description: config.app.website.description,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/projects/${post.id}/`,
    })),
  });
}
