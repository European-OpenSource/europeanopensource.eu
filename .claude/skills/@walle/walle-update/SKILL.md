---
name: walle-update
description: Update the walle design system in a consumer project safely, then remove the workarounds the new release makes unnecessary. Use when pulling a new walle release, resolving drift in @walle/ paths, or before editing files that might be walle-managed.
metadata:
  author: harness-walle
  managed: "true"
---

# Updating walle

This project consumes [walle](https://github.com/FabrizioCafolla/harness-walle), a copy-based
design system. Managed files are overwritten on every update: treat them as read-only.

## Before editing anything

A file is walle-managed when it is under a `@walle/` segment (`src/@walle/`, `scripts/@walle/`,
`.github/workflows/actions/@walle/`, `.claude/skills/@walle/`) or under `schemas/`. The `AGENTS.md`
block between `<!-- [walle:START] -->` and `<!-- [walle:END] -->` is managed too. Edits there are
lost on the next update; make the change in a consumer zone instead (see `walle-customize`).

## Run the update

```bash
just walle-check                 # reports whether a newer release exists
just walle-update                # re-sync managed paths (add -w vX.Y.Z for a specific tag)
just walle-deps                  # report walle-owned dependencies that are behind
just walle-deps --apply          # align them and add missing runtime dependencies
just yarn install
just walle-check
just build
```

Check that `.nvmrc` (and any `node-version` in the site's own workflows) matches the Node major in
walle's `engines` field: `update` never touches seed files, so an old `.nvmrc` stays behind and CI
runs the wrong Node. The same goes for `.prettierignore`: if the site runs `prettier --check .`,
it must list `.vscode/settings.json`, `.vscode/extensions.json`, `AGENTS.md`, `.harness-walle`,
`.harness-coding` and `.claude/skills/@walle` (generated or copied by the CLI; the `AGENTS.md`
marker block must stay byte exact). Do not ignore `src/@walle`: it is prettier-clean. Also list `test-results` and `playwright-report`.
Check `.husky/pre-commit`: `cmd || (fix; exit 1)` exits only the subshell and never blocks a
commit; it must read `cmd || { fix; exit 1; }`, and `.husky/pre-push` must chain with `&&`.

Read the CHANGELOG entry for every release you cross. Releases before 1.0 may break the public API
in a minor version, and the CHANGELOG marks those entries as BREAKING with a migration guide
(`wiki/get-started/updating.md`). If the build stops on a config error, it names the file and the
key; fix `src/configs/*.json`, never `schemas/`.

## What changes and what is preserved

| Category | On update |
|---|---|
| `@walle/` paths and `schemas/` | overwritten |
| `AGENTS.md` marker block | regenerated |
| seed files (pages, configs, `global.css`, API routes, workflow starters) | never touched |
| `package.json` | never touched (use `walle-deps`) |

## After the update: remove old workarounds

A new release often makes site workarounds unnecessary, and leftover workarounds fight the new
version. Search the consumer zones (`src/styles/`, `src/components/`, `src/pages/`) and fix each
hit:

| Search for | Why it is a workaround | Replace with |
|---|---|---|
| repeated classes (`\.(\w[\w-]*)\.\1`, for example `.button.button`) | fighting specificity | the plain selector inside `@layer site` |
| `!important` on a walle class or element | fighting specificity | the component's public custom property |
| selectors on walle inner classes (`__`, `.section-title`, `.header-title`, `.cta-card`) | depends on walle internals | public custom properties, props or slots |
| `:global(.button)` and other `:global()` rules on walle components | depends on walle internals | a `class` on the component plus custom properties |
| palette, gray, shadow, radius or font values defined in CSS (`--primary:`, `--gray-`, `@font-face`, Google Fonts `@import`) | bypasses the theme | `theme.json` (`palette`, `neutral`, `shadow`, `radii`, `typography.fonts`) |
| the site's own class named `prose` on an element that is not rendered markdown | walle's global `.prose` (`styles/prose.css`) now styles it: 40px `h1`, 20px `p`, its colors | rename the class (for example `page-text`) or restyle it in `@layer site` |
| site CSS outside `@layer site` | loses the layer guarantee | wrap it in `@layer site { }` |
| pages at paths walle now provides (`/products`, `/offline`, `/og/`, a configured feed path) | collides with injected routes | the matching `app.json` feature, or a `./src/...` override |

After the cleanup, build and check the affected pages in a browser at desktop and at 320px width.
