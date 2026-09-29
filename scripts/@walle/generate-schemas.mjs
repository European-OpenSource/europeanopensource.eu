#!/usr/bin/env node
// Regenerates walle/website/schemas/*.schema.json from the zod schemas in
// walle/website/src/@walle/config/schema.ts, the single source of truth for config shape.
// Those zod schemas are the real, build-time gate (define-config.ts); the JSON Schema
// files here exist only so walle/cli/validate-configs.mjs (ajv, shipped to consumers) keeps
// working without needing a Node runtime that can import zod/TypeScript.
//
// Run via `just schemas`, or `node walle/cli/generate-schemas.mjs` from anywhere (paths below
// are resolved relative to this file, not the caller's cwd).
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `z` comes through this relative import rather than a direct `import "astro/zod"`: Node's
// ESM resolver looks for bare specifiers starting from the *importing file's own* location,
// and walle/cli has no node_modules of its own (astro is a devDependency of walle/website
// only). Going through schema.ts's own re-export lets that lookup resolve from inside
// walle/website, where it succeeds.
import {
  appSchema,
  footerSchema,
  navbarSchema,
  themeSchema,
  z,
} from "../website/src/@walle/config/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(__dirname, "../website/schemas");

// $id/title aren't produced by z.toJSONSchema (it has no equivalent zod concept), so they're
// carried here to keep the metadata style of the files this replaces. `io: "input"` matches
// what ajv actually validates: the raw config file before any zod default is applied, so a
// field with `.default()` (e.g. commerce.mode) must stay optional here, not "required".
const targets = [
  {
    schema: appSchema,
    file: "app.schema.json",
    id: "https://walle.dev/schemas/app.schema.json",
    title: "Walle app config (src/configs/app.json)",
  },
  {
    schema: navbarSchema,
    file: "navbar.schema.json",
    id: "https://walle.dev/schemas/navbar.schema.json",
    title: "Walle navbar config (src/configs/navbar.json)",
  },
  {
    schema: footerSchema,
    file: "footer.schema.json",
    id: "https://walle.dev/schemas/footer.schema.json",
    title: "Walle footer config (src/configs/footer.json)",
  },
  {
    schema: themeSchema,
    file: "theme.schema.json",
    id: "https://walle.dev/schemas/theme.schema.json",
    title: "Walle theme tokens (src/configs/theme.json)",
  },
];

/**
 * Regenerates all four schema files in memory, keyed by file name. Exported so both the CLI
 * entrypoint below and tests/unit/schemas-sync.test.ts share one code path instead of the
 * test re-implementing the generation logic.
 *
 * @returns {Record<string, object>}
 */
export function generateSchemas() {
  const result = {};
  for (const { schema, file, id, title } of targets) {
    const { $schema, ...jsonSchema } = z.toJSONSchema(schema, { target: "draft-7", io: "input" });
    result[file] = { $schema, $id: id, title, ...jsonSchema };
  }
  return result;
}

function main() {
  const schemas = generateSchemas();
  for (const [file, content] of Object.entries(schemas)) {
    writeFileSync(resolve(schemasDir, file), `${JSON.stringify(content, null, 2)}\n`, "utf8");
    console.log(`✓ ${file}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
