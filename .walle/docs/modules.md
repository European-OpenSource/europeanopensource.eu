# Modules

A walle consumer declares which modules it uses in `.walle/manifest.json` (part of the `.walle/` metadata folder — see below). Each module has two file classes:

- **MANAGED** — paths that walle re-syncs on every `init`/`update`/`add`. They live under `@walle/` namespaces. Do not hand-edit them; changes are overwritten on the next update.
- **SEED** — files written once at `init`/`add` if absent, and **never touched again by `update`**. They are yours to edit freely from the first write.

`website` is mandatory. All other modules are opt-in. See [managed-vs-seed.md](managed-vs-seed.md) for a full explanation of the model.

## `.walle/` metadata folder

Every consumer has a `.walle/` folder holding walle's own metadata — not a module, always
present:

| Path                   | What it is                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.walle/manifest.json` | The consumer manifest (schemaVersion, name, walleVersion, modules, etc.) — same schema previously at the root `.walle.config.json`                                                   |
| `.walle/config.yml`    | Consumer-facing setup config (currently just `docs: true/false`). Created with defaults if absent, **NEVER-TOUCH** after — yours to edit freely                                      |
| `.walle/lock`          | Single line: the resolved source ref (a tag, or `local` when `--source` is used). Written on every `init`/`update`                                                                   |
| `.walle/docs/`         | Curated copy of `cli.md`, `modules.md`, `managed-vs-seed.md`, `versioning.md` from the pinned release. Refreshed on every `init`/`update` unless `.walle/config.yml`'s `docs: false` |

A consumer still on the pre-`.walle/` layout (root `.walle.config.json`) is migrated
automatically on the next `update`: content moved verbatim into `.walle/manifest.json`, the old
file removed. No manual action needed.

---

## `website` (mandatory)

The core design system: layout, components, configs, CLI scripts, and schemas.

**Activate:** always active; cannot be omitted.

**MANAGED paths:**

| Path                                     | What it contains                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/@walle/`                            | Components, layouts, scripts, styles, utils, config                                                                            |
| `schemas/`                               | JSON schemas for `app.json`, `navbar.json`, `footer.json`, `theme.json`, manifest                                              |
| `scripts/@walle/`                        | `cli.sh`, `validate-configs.mjs`                                                                                               |
| `justfile.project` (marker block)        | `[walle:START]`/`[walle:END]` block: `just` targets `dev`, `build`, `walle`, `walle-update`, `walle-check`, `validate-configs` |
| `.vscode/settings.json` (marker block)   | `// [walle:START]`/`// [walle:END]` block: Prettier/ESLint/Astro/MDX editor settings                                           |
| `.vscode/extensions.json` (marker block) | `// [walle:START]`/`// [walle:END]` block: recommended extensions (Astro, MDX, Prettier, ESLint)                               |

**SEED paths:**

| Path                                   | Purpose                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                            | Starter readme for the consumer project; edit freely                                                                                                        |
| `justfile.project`                     | Consumer's own recipes live here alongside the injected walle block; created once, then yours (the walle block itself is re-synced by `update` — see above) |
| `.husky/pre-commit`, `.husky/pre-push` | Git hooks (`yarn lint`, `yarn format`, `yarn test:unit`), matching this repo's own hooks — written once at init, yours to customize freely after            |

**`.vscode/` marker blocks:** injected via the same `inject_marker_block()` mechanism as
`AGENTS.md` and `justfile.project`, using `//` (JSONC) comment markers instead of `#`/`<!-- -->`.
A fresh `init` creates either file containing just the block if it doesn't exist yet; an existing
consumer file gets the block inserted (as JSON object members for `settings.json`, as array items
under `recommendations` for `extensions.json`) and only that content is rewritten on `update` —
everything else in the file is preserved. Anywhere `cli.sh` needs to parse these files
programmatically, it strips `//` comment lines before `JSON.parse`.

**How the marker block works:** `walle.justfile` doesn't exist — its recipes are injected
directly into the consumer's own `justfile.project` between `[walle:START]`/`[walle:END]`
markers, the same non-destructive mechanism used for `AGENTS.md`. If `justfile.project` doesn't
exist yet, it's created with just the block; if it exists without markers, the block is appended;
content outside the markers is never touched. A consumer still on the old `walle.justfile` +
`import` layout is migrated automatically on the next `update` (old file removed, `import` line
removed, block injected in its place).

---

## `ci`

CI/CD starter: GitHub Actions workflows wired to walle's reusable composite actions.

**Activate:**

```bash
cli.sh add ci
# or at init: cli.sh init -n <name> -m website,ci
```

**MANAGED paths:**

| Path                                | What it contains                                                           |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `.github/workflows/actions/@walle/` | Reusable composite actions (build, test) — updated with each walle release |

**SEED paths** (created once, consumer-owned):

| Path                           | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `.github/workflows/test.yml`   | Test workflow; calls the managed `website-tests` composite action |
| `.github/workflows/deploy.yml` | Deploy workflow; wire your deploy steps here                      |

Edit `test.yml` and `deploy.yml` freely — they're yours. The managed composite actions under `actions/@walle/` receive improvements on each `walle update` without touching your workflows.

---

## `backend`

Astro API routes for server-side logic. **Requires SSR** — enable it in `src/configs/app.json` before or after adding the module.

**Activate:**

```bash
cli.sh add backend
```

Then enable SSR in `src/configs/app.json`:

```json
{
  "astro": {
    "ssr": { "enabled": true, "adapter": "node" }
  }
}
```

**MANAGED paths:** none. The module seeds a starter route; the rest is consumer-owned.

**SEED paths:**

| Path                      | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `src/pages/api/health.ts` | Example health-check API route (`GET /api/health`)                       |
| `src/pages/api/echo.ts`   | Example POST echo endpoint (`POST /api/echo`) — returns the request body |
| `src/middleware.ts`       | Request-ID middleware stub — attaches `X-Request-Id` to every response   |

Seed files have `export const prerender = false` so they remain server-rendered even in hybrid output. Add your own routes under `src/pages/api/` following the same pattern. Edit `src/middleware.ts` freely — `walle update` never touches it.

**Check warning:** `cli.sh check` warns if `backend` is active but `astro.ssr.enabled` is not `true`.

---

## `infrastructure`

Terraform/OpenTofu scaffolding. Seeds the starter IaC files.

**Activate:**

```bash
cli.sh add infrastructure
```

**MANAGED paths:** none. All infrastructure files are consumer-owned from the first write.

**SEED paths:**

| Path                          | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `infrastructure/main.tf`      | Entry point; declare providers and resources here         |
| `infrastructure/variables.tf` | Input variables (`project_name`, `region`, `environment`) |
| `infrastructure/providers.tf` | Provider declarations and version constraints             |
| `infrastructure/outputs.tf`   | Exported values for CI or other modules                   |
| `infrastructure/README.md`    | Starter docs for the infrastructure directory             |
| `infrastructure/.gitignore`   | Ignores `.terraform/`, plan files, `*.tfvars`             |

The scaffold is Terraform ≥ 1.5.0 and OpenTofu compatible. Edit all files freely.

---

## `ai`

AI harness: syncs an `AGENTS.md` marker block and managed Claude Code skills into the consumer.

**Activate:**

```bash
cli.sh add ai
# or at init: cli.sh init -n <name> -m website,ai
```

**MANAGED paths:**

| Path                       | What it contains                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/@walle/`   | Managed walle skills (`walle-update`, `walle-customize`)                                                         |
| `AGENTS.md` (marker block) | `[walle:START]`/`[walle:END]` block: CLI guide, active-modules map with MANAGED/SEED boundaries, `just` commands |

**SEED paths:** none.

**How the marker block works:** on every `update`, the CLI rewrites only the content between the `[walle:START]` and `[walle:END]` markers in `AGENTS.md`. Content outside the markers (including other tools' blocks) is never touched. If the markers are absent, the CLI appends the full block at the end of the file. Consumer-owned skills outside `.claude/skills/@walle/` are left intact.

The marker block is generated from the manifest `modules` — it lists only the modules the consumer has declared, with their correct MANAGED/SEED paths.

---

## `devcontainer`

Injects walle's own extensions into harness-coding's devcontainer scaffold. Unlike the other
modules, it is **not** tracked in the manifest `modules` array — it is a standalone flag
(`devcontainer.enabled`) because it is opt-out at `init` (seeded by default) rather than opt-in.

Walle vendors no devcontainer BASE file — `Dockerfile`, `docker-compose.yml`, the setup script,
`justfile`, and harness-coding's own CLI stay exclusively harness-coding's to own and update.
Instead, `init` **runs harness-coding's CLI first** (`update --force`) to establish that base,
then injects walle's own small extensions into the files harness-coding just created. So a single
`init` yields a complete, current base — no separate harness-coding step. The base is fetched from
harness-coding `main` over the network; override the source with the `WALLE_HARNESS_CODING_CLI`
env var (path to a local `cli.sh`) for offline or e2e runs.

**Activate:**

```bash
cli.sh init -n <name>                       # runs harness-coding + injects, by default
cli.sh init -n <name> --no-harness-coding   # skip it (stub justfile fallback, no base)
cli.sh add devcontainer                     # re-inject later on a consumer that skipped it
```

**MANAGED paths (marker blocks, injected — not whole files):**

| Path                                                  | What the injected block contains                             |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `.devcontainer/scripts/setup-devcontainer.project.sh` | `corepack enable` + `yarn install`                           |
| `.devcontainer/docker-compose.project.yml`            | Walle's build-arg overrides (e.g. `CLAUDE_CLI_ENABLE=false`) |

Both are injected via the same `[walle:START]/[walle:END]` marker contract used for `AGENTS.md`
and the `website` module's `justfile.project` block: if the target file doesn't exist yet
(consumer never ran harness-coding), it's created containing just the walle block — reduced
functionality (no full devcontainer boot), with an explicit warning naming the exact
harness-coding bootstrap command to run. If the file exists, the block is appended (no markers
yet) or rewritten in place (markers present); the rest of the file is never touched.

**SEED paths:**

| Path                              | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `.devcontainer/devcontainer.json` | Consumer-owned devcontainer entrypoint |

`docker-compose.project.yml` and `setup-devcontainer.project.sh` are **not** SEED paths of this
module — they're harness-coding's own SEED files; walle only injects into them (see above).
Local-only overrides (`docker-compose.local.yml`, `setup-devcontainer.local.sh`, `justfile.local`,
`.harness-coding/lock`) are gitignored — never committed, freely customizable per developer.

**Check coverage:** `cli.sh check` reports the SEED path's presence when `devcontainer.enabled` is
`true`, and warns (not just informs, unlike other modules' seeds) if it's missing — it's expected
to exist from `init`, so absence usually means something was deleted.
