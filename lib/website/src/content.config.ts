import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const project = defineCollection({
  // Load Markdown and MDX files in the `src/content/project/` directory.
  loader: glob({ base: "./src/content/project", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    name: z.string(),
    description: z.string(),
    tags: z.array(z.string().max(24)).min(1).max(10).optional(),
    category: z.string(),
    country: z.string(),
    source: z.object({
      platform: z.string(),
      url_repository: z.string().url(),
      url_documentation: z.string().url().optional(),
      license: z.string(),
      language: z.string(),
    }),
    owner: z
      .object({
        name: z.string(),
        type: z.enum(["individual", "organization", "community"]),
        description: z.string().nullable().default(""),
        tags: z.array(z.string().max(24)).min(1).max(10).optional(),
        url_website: z.string().url().nullable().optional().default(null),
        is_a_startup: z.boolean().optional().default(false),
      })
      .optional(),
    metadata: z
      .object({
        filename: z.string(),
        created_at: z.coerce.date(),
      })
      .catchall(z.any()),
  }),
});

export const collections = { project };
