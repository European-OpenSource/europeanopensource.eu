#!/usr/bin/env node
// Validates the consumer config files in src/configs/ against the JSON Schemas in schemas/.
// Run from the project root (e.g. `just validate-configs`). Consumers keep the default
// schemas/ location; the walle repo itself dogfoods with --schemas-dir walle/schemas.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const flagIndex = process.argv.indexOf("--schemas-dir");
const schemasDir =
  (flagIndex !== -1 && process.argv[flagIndex + 1]) || process.env.WALLE_SCHEMAS_DIR || "schemas";

const root = process.cwd();
const pairs = [
  { config: "src/configs/app.json", schema: `${schemasDir}/app.schema.json`, required: true },
  { config: "src/configs/navbar.json", schema: `${schemasDir}/navbar.schema.json`, required: true },
  { config: "src/configs/footer.json", schema: `${schemasDir}/footer.schema.json`, required: true },
  { config: "src/configs/theme.json", schema: `${schemasDir}/theme.schema.json`, required: false },
];

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const readJson = (rel) => JSON.parse(readFileSync(resolve(root, rel), "utf8"));

let failed = false;
for (const { config, schema, required } of pairs) {
  if (!existsSync(resolve(root, config))) {
    if (required) {
      console.error(`✗ ${config} — missing (required)`);
      failed = true;
    } else {
      console.log(`· ${config} — absent (optional), skipped`);
    }
    continue;
  }
  const validate = ajv.compile(readJson(schema));
  const data = readJson(config);
  if (validate(data)) {
    console.log(`✓ ${config}`);
  } else {
    failed = true;
    console.error(`✗ ${config}`);
    for (const err of validate.errors) {
      console.error(
        `    ${err.instancePath || "/"} ${err.message}${err.params?.additionalProperty ? ` ('${err.params.additionalProperty}')` : ""}`
      );
    }
  }
}

if (failed) {
  console.error("\nConfig validation failed.");
  process.exit(1);
}
console.log("\nAll configs valid.");
