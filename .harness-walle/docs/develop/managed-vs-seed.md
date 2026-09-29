---
title: Managed vs seed
order: 4
---

# Managed vs seed

Every file that walle installs into a consumer belongs to one of two classes: **MANAGED** or
**SEED**. A third, narrower mechanism, **INJECT**, applies a marker-bounded block inside a file
walle doesn't own outright. The class determines what happens on `walle update`. `walle.yml` is
the single source of truth for which path is which: see [repo guide](repo-guide.md).

---

## MANAGED files

Walle owns MANAGED files and re-syncs them on every `init`, `update`, and `add`. In a consumer
project, they are **read-only**: any hand-edit is overwritten on the next update.

| Path                                | Module | What it contains                                             |
| ------------------------------------ | ------ | -------------------------------------------------------------- |
| `src/@walle/`                        | website | The full design-system source                                 |
| `schemas/`                            | website | JSON Schemas for `app.json`, `navbar.json`, `footer.json`, `theme.json`, manifest |
| `scripts/@walle/`                     | website | `cli.sh`, `validate-configs.mjs`, `walle.yml`                 |
| `.github/workflows/actions/@walle/`  | ci      | Reusable composite actions (test, deploy)                     |
| `.claude/skills/@walle/`             | ai      | Managed Claude Code skills                                    |

**Never hand-edit MANAGED files in a consumer.** Apply customizations through the
[consumer zones](#consumer-zones) below, or the [customization ladder](../get-started/customize.md).

---

## INJECT blocks

Three MANAGED paths aren't whole files but `[walle:START]`/`[walle:END]` (or `//`-commented
JSONC) marker blocks rewritten in place inside a file the consumer, or another tool, owns; only
the content between the markers changes, everything else in the file stays:

| File                                                  | Module          | What the block contains                                                     |
| ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------ |
| `AGENTS.md`                                            | ai               | CLI guide, active-modules map with MANAGED/SEED boundaries, `just` commands  |
| `justfile.project`                                     | website          | `just` targets (`walle`, `walle-update`, `dev`, `build`, `validate-configs`, …) |
| `.vscode/settings.json`, `.vscode/extensions.json`     | website          | Astro/Prettier/ESLint/MDX editor settings and recommended extensions          |
| `.devcontainer/scripts/setup-devcontainer.project.sh`  | harness-coding   | Walle's own extensions (`corepack enable` + `yarn install`)                   |

If the target file doesn't exist yet, the injection creates it containing just the block. If it
exists without markers, the block is appended; content outside the markers is never touched on a
later update. `justfile.project`'s block replaces the older `walle.justfile` + `import` layout,
migrated automatically on `update`. `.vscode/` blocks use `//` (JSONC) comment markers instead of
`#`/`<!-- -->`, since HTML comments would break JSON parsing; `cli.sh` strips `//` lines before
`JSON.parse` wherever it needs to read these files back.

---

## SEED files

SEED files are consumer-owned scaffolding. Walle writes them **once** at `init`/`add` if they
don't already exist. After that first write, `update` never touches them again, not even if the
source template changes.

| Path                                       | Module         | Description                                                                     |
| -------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `README.md`                                 | website        | Starter readme for the consumer project; edit freely                              |
| `justfile.project`                          | harness-coding | Consumer's own recipes live here alongside the injected walle block               |
| `.husky/pre-commit`, `.husky/pre-push`      | harness-coding | Git hooks (`yarn lint`, `yarn format`, `yarn test:unit`)                          |
| `.devcontainer/docker-compose.project.yml`  | harness-coding | Walle's starting build-arg overrides; a plain SEED file, not a marker inject      |
| `.devcontainer/devcontainer.json`           | harness-coding | Consumer-owned devcontainer entrypoint (seeded by harness-coding's own CLI)       |
| `.github/workflows/test.yml`                | ci             | Test workflow; calls the managed `website-tests` composite action                 |
| `.github/workflows/deploy.yml`              | ci             | Deploy workflow; wire your deploy steps here                                      |
| `src/pages/api/health.ts`, `src/pages/api/echo.ts`, `src/middleware.ts` | backend | Starter API routes and a request-ID middleware stub |

`docker-compose.project.yml` and `setup-devcontainer.project.sh` are both harness-coding's own
seeded files: the compose file is written once, verbatim, and never touched again; the setup
script is seeded once by harness-coding's own CLI and only ever gets walle's small INJECT block
rewritten inside it (see above): neither is re-synced whole.

**Re-adding a module:** `cli.sh add <module>` on an already-declared module re-syncs MANAGED
paths but skips SEED paths that already exist. SEED files already present are always left intact.

---

## How `check` distinguishes the two

`cli.sh check` reports SEED file presence as informational only: a missing SEED is never an
error (the consumer may have removed it on purpose):

```
· seed present: README.md
· seed absent: .github/workflows/test.yml
```

MANAGED paths are not individually listed by `check`; they're verified implicitly through
schema validation. If MANAGED files are missing, a subsequent `update` restores them.

---

## Consumer zones

These paths belong entirely to the consumer. `update` must not create, modify, or delete them
(with the exception of the INJECT blocks listed above):

| Path                    | Purpose                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `src/configs/`          | JSON config files: `app.json`, `navbar.json`, `footer.json`, `theme.json` |
| `src/styles/global.css` | Font declarations, CSS variable overrides                                 |
| `src/components/`       | Consumer-specific components and overrides                                |
| `src/pages/`             | All routes, except the ones walle injects for an enabled feature (products, OG, feeds, offline) |
| `src/content/`           | Blog and other content collections                                       |
| `astro.config.mjs`      | Thin `defineWalleConfig({})` shell with native Astro overrides            |
| `package.json`          | Consumer dependencies and scripts                                         |
| `.vscode/`               | Editor settings (content outside the `// [walle:START/END]` block only)  |
| `*.project`, `*.local`  | Consumer-local files                                                       |

Customize behavior through these zones: edit configs, override CSS variables, add components,
and extend layouts via slots. Never fork `src/@walle/` directly: see the
[customization ladder](../get-started/customize.md).

---

## `.harness-walle/` metadata folder

Every consumer has a `.harness-walle/` folder holding walle's own metadata, not a module,
always present:

| Path                            | What it is                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.harness-walle/manifest.json`  | The consumer manifest (`schemaVersion`, name, `walleVersion`, `modules`, `devcontainer.enabled`, `files`) |
| `.harness-walle/config.yml`     | Consumer-facing setup config (currently just `docs: true/false`). Created with defaults if absent, yours to edit freely after |
| `.harness-walle/lock`           | Single line: the resolved source ref (a tag, or `local` when `--source` is used). Written on every `init`/`update` |
| `.harness-walle/docs/`          | Copy of the wiki sections (Get Started, Develop, Architecture, AI) from the pinned release. Refreshed on `init`/`update` unless `config.yml`'s `docs: false` |

A consumer on an older layout, a root `.walle.config.json` file or the earlier `.walle/` folder,
is migrated automatically on the next CLI command: the folder is renamed to `.harness-walle/`, a
`schemaVersion: 2` `files` map is reshaped to v3 (grouped by module), and the old file is
removed. No manual action needed.

---

## Modules

`website` is mandatory; every other module is opt-in (or, for the devcontainer, opt-out). See
[the CLI reference](cli.md) for the exact flags.

**`website`**: the core design system: layout, components, configs, CLI scripts, and schemas.
Always active.

**`ci`**: CI/CD starter: GitHub Actions workflows wired to walle's reusable composite actions.
Activate with `cli.sh add ci` or `-m website,ci` at init.

**`backend`**: Astro API routes for server-side logic. Needs `astro.adapter: "node"` in
`src/configs/app.json` for any route with `export const prerender = false` to actually render on
demand; `cli.sh check`/`add` warn if it's active without the adapter set. Activate with
`cli.sh add backend`.

**`ai`**: syncs an `AGENTS.md` marker block and the managed Claude Code skills. On by default at
init (`--no-ai` to skip); add later with `cli.sh add ai`.

**`devcontainer`** (opt-out, not tracked in the manifest's `modules[]`): establishes the
harness-coding base at init and injects walle's own extensions into it. Skip at init with
`--no-harness-coding`; re-add later with `cli.sh add devcontainer`, which re-syncs the base and
the injected block without re-seeding files harness-coding's own CLI already created.

## Practical examples

**I want to change the navbar logo:** edit `src/configs/navbar.json`. This is a consumer zone.
It is never touched by `update`.

**I want to change the navbar layout:** point `components.navbar` at your own file in
`app.json`, or pass one via `BaseLayout`'s `navbar` slot. The `@walle` Navbar source under
`src/@walle/` is MANAGED and read-only. See [components](../architecture/components.md#overrides).

**I added a step to my CI test workflow:** edit `.github/workflows/test.yml`. It's a SEED file:
`update` will never overwrite it. The managed composite action it calls still improves on the
next `walle update`.

**Walle released a security fix to the CLI:** run `just walle-update`. Only MANAGED paths change
(`scripts/@walle/cli.sh`). Your SEED workflows, configs, and pages are untouched.
