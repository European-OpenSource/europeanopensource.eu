/* eslint-disable no-console -- CLI report script, console output is the point */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const pages = [
  "/",
  "/projects",
  "/projects/mastodon-739d2b",
  "/form",
  "/privacy-policy",
  "/terms-and-conditions",
];

const browser = await chromium.launch();
let totalViolations = 0;

for (const path of pages) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://localhost:4321${path}`, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  console.log(`\n=== ${path} ===`);
  if (results.violations.length === 0) {
    console.log("  no violations");
  } else {
    totalViolations += results.violations.length;
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      for (const n of v.nodes.slice(0, 5)) {
        console.log(`    - ${n.target.join(" ")}`);
        console.log(`      ${n.failureSummary?.replace(/\n/g, " ")}`);
      }
    }
  }
  await context.close();
}

await browser.close();
console.log(`\nTotal violations: ${totalViolations}`);
process.exit(totalViolations > 0 ? 1 : 0);
