---
title: Testing
order: 6
---

# Testing

Every suite that gates a change, what it covers, and the exact command to run it. Verified
against this repo's own `justfile.project` and `walle/website/package.json`: if a command below
stops working, one of those two moved and this page is stale.

## Unit (Vitest)

```bash
cd walle/website && yarn test:unit
```

Runs every `tests/unit/**/*.test.ts` file (Astro's Container API for component render tests,
plain Vitest for everything else). Covers, among others:

| Area | Files | What it asserts |
|---|---|---|
| Component render | `tests/unit/components/<Name>.test.ts` | Behavior only, via `experimental_AstroContainer` |
| CSS layering | `tests/unit/css-layers.test.ts` | No rule outside a `walle.*` (or `site`) layer under `M/**/*.{astro,css}` |
| CSS tokens | `tests/unit/css-tokens.test.ts` | No literal color, radius, shadow or px font size outside `tokens.css` |
| Config schema | `tests/unit/config-schema.test.ts` | Parse success/error paths for `app`, `navbar`, `footer`, `theme` |
| Schema sync | `tests/unit/schemas-sync.test.ts` | Committed `schemas/*.schema.json` equal a fresh `generate-schemas.mjs` run |
| Contrast | `tests/unit/contrast.test.ts` | Every variant fg/bg, inverse and status pair clears WCAG 2.2 AA |
| OG images | `tests/unit/og-render.test.ts` | 1200x630 PNG, template lookup, title truncation, font resolution with zero network |
| Feeds | `tests/unit/feeds.test.ts` | Field mapping, draft exclusion, sort, missing-field error |
| Wiki loader | `tests/unit/wiki.test.ts` | Section grouping, title/order resolution, relative-link rewriting |

`yarn lint` and `yarn check` (ESLint and `astro check`) run alongside unit tests in CI and in
the pre-commit/pre-push hooks; run them locally the same way:

```bash
cd walle/website && yarn lint && yarn check
```

## Browser (Playwright)

Two configs, because the suites need different dev servers.

```bash
just playwright-setup   # once per container: installs the pinned Chromium build
```

**Against the plain `yarn dev` site** (`playwright.config.ts`):

```bash
just playwright-test-navbar
```

Runs `navbar.test.ts`, `links.spec.ts` and `fonts.spec.ts`.

**Against the Astrobook-served site** (`playwright.astrobook.config.ts`, same webServer for all
of these):

```bash
just a11y-test                    # a11y.spec.ts: axe-core + 320px reflow check
just astrobook-test               # *.visual.spec.ts: screenshot regression
just astrobook-update-snapshots   # regenerate baselines after an intentional visual change
cd walle/website && yarn playwright test --config playwright.astrobook.config.ts cascade.spec.ts
cd walle/website && yarn playwright test --config playwright.astrobook.config.ts map.spec.ts
```

`cascade.spec.ts` and `map.spec.ts` have no dedicated `just` recipe; run them by filename against
the astrobook config as shown. `cascade.spec.ts` asserts the layer declaration is the first
`<head>` child and that a `@layer site` story override wins; `map.spec.ts` asserts leaflet stays
out of the eager bundle, loads lazily on scroll, and the no-JS fallback list is reachable.

## e2e (`tests/e2e/`)

Slow: scaffolds real consumer sandboxes from the working tree via `--source` and runs the actual
CLI against them. Run the single scenario a task names while developing; run the full suites
only before merging a change that touches the CLI's sync/inject logic, or before a release.

```bash
just e2e             # fast core: tests/e2e/scenarios/*.sh
just e2e-extended    # everything, including tests/e2e/scenarios-extended/*.sh
just e2e-clean        # remove the accumulated .sandbox/ tree
```

To run one scenario in isolation while iterating, source the harness and call its function
directly:

```bash
cd tests/e2e && source lib/common.sh && source scenarios/24_commerce_off.sh && scenario_commerce_off
```

Core scenarios cover init/update/add/check across every module, component overrides, commerce
off, and config validation. Extended scenarios cover marker-injection edge cases, migration
paths, schema-version enforcement, devcontainer sync details, the adapter, redirects, OG images,
site variants, RSS feeds, and the Map page.

## Config validation

```bash
just validate-configs
```

Validates this repo's own `src/configs/*.json` against `schemas/*.schema.json` with the same
`validate-configs.mjs` a consumer runs.

## The full gate

```bash
just e2e && just e2e-extended
cd walle/website && yarn lint && yarn check && yarn test:unit
just a11y-test && just astrobook-test && just playwright-test-navbar
```

This is what a release is cut against. Day to day, run only what the change you're making could
plausibly break: unit tests, lint, check and build every time; the browser suite filtered to
what changed; the single e2e scenario a task names. Never run the whole browser or e2e surface
speculatively.
