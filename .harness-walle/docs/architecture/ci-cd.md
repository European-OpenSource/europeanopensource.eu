---
title: CI/CD
order: 6
---

# CI/CD

The `ci` module ships two GitHub Actions composite actions (MANAGED, re-synced on every
`walle update`) plus two starter workflows (SEED, written once and yours from then on). See
[managed vs seed](../develop/managed-vs-seed.md) for the general model.

## Composite actions

Both live under `.github/workflows/actions/@walle/` and enable Corepack before Node setup: the
runner's global Yarn 1.x refuses once `package.json` pins a version via `packageManager`, so
Corepack has to resolve `yarn` to the pinned version first.

**`website-tests`** checks out, sets up Node from `.nvmrc`, installs with
`yarn install --immutable`, and runs `yarn lint`.

**`deploy-github-pages`** does the same setup, then `yarn build` and deploys `dist/` (or a
configured `publish_dir`) to the `gh-pages` branch via
[`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages), with an optional
custom domain (`cname` input).

Both accept a `working_dir` input (default `.`) for a consumer whose Astro site isn't at the
repo root.

## Starter workflows

```
.github/workflows/test.yml     # on push and pull_request: calls website-tests
.github/workflows/deploy.yml   # on push to main, or workflow_dispatch: calls deploy-github-pages
```

Both are seeded once, edit them freely: add jobs, change triggers, wire your own deploy target.
The managed composite actions they call keep improving on every `walle update`, without your
workflow files ever being touched.

## This repo's own CI

Not shipped to consumers, but the same shape: `.github/workflows/test.yml` runs the demo site's
own lint/unit suite on every push and pull request; `release.yml` (triggered by a `vX.Y.Z` tag
push) extracts the matching `CHANGELOG.md` section to a file and publishes a GitHub release
through it, never through a shell string, since release notes are free-form Markdown. See
[versioning](../develop/versioning.md#release-process).
