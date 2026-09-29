---
title: Repo guide
order: 2
---

# How this repo works

Three things live in this repository, each with a different audience. Knowing which one you're
touching tells you where to work and what breaks if you get it wrong.

## The three zones

```
harness-walle/
├── walle/                    ← THE PRODUCT: everything shipped to consumers (except website's src/@walle/),
│                                grouped by module: each answers "what does module X ship" on its own
│   ├── walle.yml                 the config: declares every managed/seed/inject path per module
│   ├── website/                  MANAGED source (website/src/@walle/, website/schemas/) AND the
│   │                                write-once seed for a fresh consumer (the whole site, minus the
│   │                                excludes in walle.yml's website-seed-exclude)
│   ├── ci/                       managed/ (composite actions), seed/ (starter workflows)
│   ├── ai/                       managed/skills/ (managed Claude Code skills)
│   ├── backend/                  seed/ (starter API routes, middleware)
│   ├── harness-coding/           seed/ (docker-compose.project.yml, justfile.project, .husky/),
│   │                                inject/ (setup-devcontainer.project.block.sh): no managed/: nothing
│   │                                vendored from harness-coding itself, see below
│   └── cli/                      cli.sh, generate-schemas.mjs, validate-configs.mjs: cross-module engine
├── walle/website/               ← DEV TOOLING'S FIRST CONSUMER: the demo/showcase Astro site
│   ├── src/@walle/                 the design system source (also shipped; stays outside `walle/`: see below)
│   ├── schemas/                    JSON Schemas for consumer configs + manifest: cross-module
│   └── astrobook/, tests/          component stories + unit/playwright specs (dogfoods the product)
├── tests/e2e/                ← DEV TOOLING: never shipped, only for building/verifying walle itself
├── wiki/, CONTRIBUTING.md    ← repo docs (this section, the CLI/module/versioning references)
└── justfile*, .github/       ← repo meta (CI, dev commands)
```

**Placement rule inside `walle/`:** if a file is re-synced on every `walle update` → declare it
under `managed:` in `walle.yml`. If it's written once and then belongs to the consumer →
`seed:`. If it's a block injected into a file walle doesn't own outright (a file that
harness-coding or the consumer's own `justfile.project` created) → `inject:`. The CLI reads
only this one config file, so adding a path never needs a code change. `cli/` and the
`website/` seed are cross-cutting: shared engine/starter, not tied to one module.

**Why `harness-coding` has no `managed/`:** walle doesn't vendor any BASE devcontainer file
(`Dockerfile`, `docker-compose.yml`, the setup script: all harness-coding's own). It seeds
`docker-compose.project.yml` once (its own file, walle only supplies the starting content) and
injects a small `[walle:START]/[walle:END]` block (corepack + yarn install) into
`setup-devcontainer.project.sh`, a file harness-coding itself seeds write-once. `init` **runs
harness-coding's CLI first** to establish that base, then applies walle's own seed/inject on
top: a single `init` yields a complete, current base, no separate harness-coding step.

**If you're changing what consumers receive**: a component, a schema, a CLI behavior, a seed
file, a CI composite action: you're working in `walle/` or `walle/website/src/@walle/`. Test with
`just e2e` (simulates a real consumer via `--source`) before anything else.

**If you're changing the demo site**: the pages under `walle/website/src/pages/`,
`walle/website/src/configs/`, content: you're customizing walle's own dogfood consumer, same as
any real consumer would. It doesn't ship anywhere except this repo's own gh-pages deploy.

**If you're changing tooling**: a story in `astrobook/`, a Playwright spec in `tests/`, an e2e
scenario: nothing here reaches a consumer. It exists to build confidence in the product.

### Why `src/@walle/` sits outside `walle/`

The design-system source imports the consumer's own configs by relative path
(`src/@walle/config/index.ts` reads `../configs/*.json`), and that resolution happens during
Astro's config-loading phase, before any path alias is available. Every consumer, including
this repo's own demo site, has `src/@walle/` sitting next to `src/configs/`. Moving the core
into `walle/` would break that contract for everyone. It's still part of the product; it just
can't live inside the product root.

## What ships, and how

`walle.yml` is the single source of truth for what gets copied where: see
[managed vs seed](managed-vs-seed.md) for the model and the full per-module breakdown. The short
version: MANAGED paths (`walle/cli` → consumer `scripts/@walle/`, `walle/website/schemas` →
consumer `schemas/`, etc.) are re-synced on every `walle update`; SEED paths are written once and
then belong to the consumer.

**Modules are all optional except `website`.** A consumer can run walle with nothing but the
`website` module: no CI starter, no AI harness, no devcontainer. Concretely: a consumer does
**not** need [harness-coding](https://github.com/FabrizioCafolla/harness-coding) (the
devcontainer setup is opt-out, not a hard dependency: `--no-harness-coding` at init) and does
**not** need [harness-ai](https://github.com/FabrizioCafolla/harness-ai) or Claude Code (the
`ai` module is opt-in, and skipped by default with `--no-ai`). Don't design a module contract
that assumes either is present.

## How to release

Full policy and the maintainer checklist live in [versioning](versioning.md#release-process).
In short: update `CHANGELOG.md`, confirm `just e2e` and `yarn test` are green, then
`just release vX.Y.Z`: it bumps `package.json`, commits, tags, and pushes; `release.yml`
publishes the GitHub release from the changelog entry.

## Verifying a change before it ships

- `just e2e`: the real integration test: scaffolds consumers from your working tree via
  `--source` and exercises init/update/add/check across every module, including a static + node
  adapter build and a live server check.
- `just validate-configs` / `yarn lint` / `yarn test`: this repo's own demo site is consumer
  #1; keep it green the same way any consumer would.
- `just astrobook` / `just astrobook-test`: visual catalog and regression suite for anything in
  `src/@walle/components`.

See [testing](testing.md) for the full suite list and every command.
