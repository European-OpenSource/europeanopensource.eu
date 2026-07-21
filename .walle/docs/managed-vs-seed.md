# Managed vs Seed

Every file that walle installs into a consumer belongs to one of two classes: **MANAGED** or **SEED**. The distinction determines what happens on `walle update`.

---

## MANAGED files

Walle owns MANAGED files and re-syncs them on every `init`, `update`, and `add`. In a consumer
project, they are **read-only** — any hand-edit is overwritten on the next update.

**Identifying MANAGED paths:**

A path is MANAGED if it's listed in `module_managed_map()` in `cli.sh` — most, but not all, live
under a `@walle` segment. Three MANAGED paths are not whole files at all but marker blocks
injected into files walle doesn't own outright (see below):

- `src/@walle/` — the full design system source
- `schemas/` — JSON schemas
- `scripts/@walle/` — the CLI and validators
- `.github/workflows/actions/@walle/` — CI composite actions (`ci` module)
- `.claude/skills/@walle/` — managed AI skills (`ai` module)

**MANAGED marker blocks** — `[walle:START]`/`[walle:END]` blocks rewritten in place inside a file
the consumer (or another tool) owns; only the content between the markers changes, everything
else in the file stays:

- `AGENTS.md` (`ai` module) — CLI guide, active-modules map
- `justfile.project` (`website` module) — `just` targets (`walle`, `walle-update`, `dev`, `build`,
  etc.); replaces the old `walle.justfile` + `import` layout, migrated automatically on `update`
- `.devcontainer/scripts/setup-devcontainer.project.sh`, `.devcontainer/docker-compose.project.yml`
  (`devcontainer` module) — walle's own extensions (corepack+yarn, build-arg overrides) injected
  into files harness-coding already seeds write-once. Walle vendors none of harness-coding's
  own BASE files (`Dockerfile`, `docker-compose.yml`, the setup script) — those stay exclusively
  harness-coding's to own and update.
- `.vscode/settings.json`, `.vscode/extensions.json` (`website` module) — Astro/Prettier/ESLint/MDX
  editor settings and recommended extensions, injected with `//` (JSONC) comment markers instead
  of `#`/`<!-- -->` (HTML comments would break JSON parsing). Created containing just the block if
  the file doesn't exist yet; existing consumer content stays outside the markers.

**Never hand-edit MANAGED files in a consumer.** Apply customizations through the consumer zones described in the next section.

---

## SEED files

SEED files are consumer-owned scaffolding. Walle writes them **once** at `init`/`add` if they don't already exist. After that first write, `update` never touches them — not even if the source template changes.

**Examples:**

| Module           | SEED path                              | Description                                                                                |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `website`        | `README.md`                            | Starter readme                                                                             |
| `ci`             | `.github/workflows/test.yml`           | Test workflow wired to managed composite action                                            |
| `ci`             | `.github/workflows/deploy.yml`         | Deploy workflow shell                                                                      |
| `backend`        | `src/pages/api/health.ts`              | Example API route                                                                          |
| `infrastructure` | `infrastructure/main.tf`               | Terraform/OpenTofu entry point                                                             |
| `infrastructure` | `infrastructure/variables.tf`          | Input variables                                                                            |
| `infrastructure` | `infrastructure/README.md`             | Infrastructure starter docs                                                                |
| `infrastructure` | `infrastructure/.gitignore`            | IaC gitignore                                                                              |
| `devcontainer`   | `.devcontainer/devcontainer.json`      | Consumer devcontainer entrypoint (seeded by default at init; see [modules.md](modules.md)) |
| `website`        | `.husky/pre-commit`, `.husky/pre-push` | Git hooks (`yarn lint`, `yarn format`, `yarn test:unit`), matching this repo's own hooks   |

`.devcontainer/docker-compose.project.yml` and `.devcontainer/scripts/setup-devcontainer.project.sh`
are **not** SEED paths of the `devcontainer` module — they're harness-coding's own SEED files;
walle only injects a marker block into them (see MANAGED marker blocks above).

SEED files are intentionally thin — they're durable starters that wire into walle's MANAGED logic (e.g. the test workflow calls a managed composite action). The consumer is responsible for evolving them.

**Re-adding a module:** `cli.sh add <module>` on an already-declared module re-syncs MANAGED paths but skips SEED paths that already exist. SEED files already present are always left intact.

---

## How `check` distinguishes the two

`cli.sh check` reports SEED file presence as informational only — a missing SEED is never an error (the consumer may have removed it on purpose):

```
· seed present (ci): .github/workflows/test.yml
· seed absent (website, consumer-owned): README.md
```

MANAGED paths are not individually listed by `check`; they're verified implicitly through the schema validation. If MANAGED files are missing, a subsequent `update` will restore them.

---

## Consumer zones

These paths belong entirely to the consumer. `update` must not create, modify, or delete them (with the exception of the marker blocks listed under MANAGED marker blocks above — `AGENTS.md`, `justfile.project`, `.vscode/settings.json`, `.vscode/extensions.json`, the devcontainer `.project` files):

| Path                    | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `src/configs/`          | JSON config files: `app.json`, `navbar.json`, `footer.json`, `theme.json` |
| `src/styles/global.css` | Font declarations, CSS variable overrides                                 |
| `src/components/`       | Consumer-specific components                                              |
| `src/pages/`            | All routes                                                                |
| `src/content/`          | Blog and other content collections                                        |
| `astro.config.mjs`      | Thin `defineWalleConfig({})` shell with native Astro overrides            |
| `package.json`          | Consumer dependencies and scripts                                         |
| `.vscode/`              | Editor settings (content outside the `// [walle:START/END]` block only)   |
| `*.project`, `*.local`  | Consumer-local files                                                      |

Customize behavior through these zones: edit configs, override CSS variables, add components, and extend layouts via slots. Never fork `src/@walle/` directly.

---

## Practical examples

**I want to change the navbar logo:** edit `src/configs/navbar.json`. This is a consumer zone. It is never touched by `update`.

**I want to change the navbar layout:** create `src/components/MyNavbar.astro` and use the `navbar` slot in `BaseLayout`. The `@walle` Navbar source under `src/@walle/` is MANAGED and read-only.

**I added a column to my CI test workflow:** edit `.github/workflows/test.yml`. It's a SEED file — `update` will never overwrite it. The managed composite action it calls will still improve on the next `walle update`.

**Walle released a security fix to the CLI:** run `just walle-update`. Only MANAGED paths change (`scripts/@walle/cli.sh`). Your SEED workflows, configs, and pages are untouched.
