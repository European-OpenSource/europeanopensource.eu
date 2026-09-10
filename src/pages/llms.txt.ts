import type { APIRoute } from "astro";
import config from "@walle/config";
import { getCollection } from "astro:content";

/**
 * /llms.txt (https://llmstxt.org): a build-time markdown index of the site for LLMs. Site
 * identity, how the catalog works, and every listed project grouped by category. The admission
 * criteria are a summary of the Terms & Conditions (section 10), which stay the source of truth.
 */
export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const repo = "https://github.com/European-OpenSource/awesome-european-opensource";

  const projects = (await getCollection("project")).sort((a, b) =>
    a.data.name.localeCompare(b.data.name)
  );
  const byCategory = Map.groupBy(projects, (p) => p.data.category);
  const categories = [...byCategory.keys()].sort();

  const lines = [
    `# ${config.app.website.title}`,
    "",
    `> ${config.app.website.description}`,
    "",
    `The catalog lists ${projects.length} open source projects built in Europe. Every listing is submitted as a public GitHub Issue, reviewed in the open, and merged into the catalog repository as data: ${repo}`,
    "",
    "Admission criteria (full text in the Terms & Conditions, section 10):",
    "",
    "- Geographic eligibility: a legal entity incorporated in the EU, EEA, UK or Switzerland, or founders/maintainers with citizenship or residency there.",
    "- Values alignment: privacy, accessibility and inclusivity, sustainability, contribution to public good.",
    "",
    "## Pages",
    "",
    `- [Project catalog](${url("/projects")}): all listed projects, filterable by category and country`,
    `- [Submit a project](${url("/form")}): via GitHub Issue or the submission form`,
    `- [Submission template](${repo}/issues/new?template=PROJECT_SUBMISSION.yml): GitHub Issue form used for every submission`,
    `- [Terms & Conditions](${url("/terms-and-conditions")}): admission criteria and submission process`,
    `- [Privacy Policy](${url("/privacy-policy")})`,
    `- [RSS feed](${url("/rss.xml")}): latest projects added`,
    "",
    ...categories.flatMap((category) => [
      `## Projects: ${category}`,
      "",
      ...byCategory.get(category)!.map((p) => {
        const { name, description, country, source } = p.data;
        return `- [${name}](${url(`/projects/${p.id}`)}): ${description} (${country.join(", ")}; ${source.license}; ${source.url_repository})`;
      }),
      "",
    ]),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
