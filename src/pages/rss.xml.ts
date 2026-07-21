import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const projects = await getCollection("project");

  const sorted = projects
    .sort((a, b) => {
      const dateA = a.data.metadata?.created_at ?? new Date(0);
      const dateB = b.data.metadata?.created_at ?? new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 50);

  return rss({
    title: "European Open Source",
    description: "Discover open source projects from Europe",
    site: context.site!,
    customData: `<language>en-us</language>`,
    items: sorted.map((project) => ({
      title: project.data.name,
      description: project.data.description,
      link: `/projects/${project.id}`,
      pubDate: project.data.metadata?.created_at ?? new Date(),
      categories: [project.data.category],
    })),
  });
}
