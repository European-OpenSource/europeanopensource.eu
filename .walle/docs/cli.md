# CLI Reference

The CLI source lives at `walle/cli/cli.sh` in this repo and is synced into every consumer project (at `scripts/@walle/cli.sh`) by the `website` module. Inside a consumer, the canonical invocation is `just walle-update`; direct `cli.sh` calls are for more control.

## Global flags

| Flag                        | Description                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `-s, --source <path>`       | Use a local walle clone instead of a release tag (dev / test)                                                       |
| `-w, --walle-version <tag>` | Pin a specific release tag (e.g. `v0.1.0-beta`). Default: latest published tag                                      |
| `--dry-run`                 | Show the sync plan without writing anything. Supported by `init`, `update`, `add`                                   |
| `--yes`                     | Skip confirmation prompts: a MAJOR version boundary (`update`) or adopting an existing non-walle directory (`init`) |
| `--no-devcontainer`         | Skip `.devcontainer/` scaffold at init. `init` only                                                                 |
| `-h, --help`                | Show usage                                                                                                          |

---

## `init`

Scaffold a new consumer project, or adopt an existing directory that isn't one yet.

```bash
cli.sh init \
  [--project-name <name>] \
  [--dir-path <path>] \
  [--modules website,ci,ai] \
  [--walle-version vX.Y.Z | --source <path>] \
  [--dry-run] \
  [--yes] \
  [--no-devcontainer]
```

**`--project-name` is optional.** Given, it creates `<dir-path>/<project-name>` (the classic
greenfield flow). Omitted, the target is `--dir-path` itself (default: current directory) — run
`cd my-existing-project && cli.sh init` to add walle to a project you already have.

**Three outcomes depending on the target directory:**

1. **Doesn't exist** → created and scaffolded, no prompt (same as today).
2. **Exists with a `.walle/manifest.json`** → refuses to run: "already a walle project — use
   `cli.sh update` or `cli.sh add <module>` instead." Nothing is written.
3. **Exists without a `.walle/manifest.json`** ("adoption") → prints a warning and the sync plan
   (same shape as `--dry-run`), then asks `Proceed? [y/N]`. Pass `--yes` to skip the prompt
   (for scripts/CI). Declining aborts with nothing written. Seed (starter) files are written
   **only if absent** — an adoption never overwrites a file already in the directory; MANAGED
   module paths (`src/@walle/`, etc.) are always synced as usual.

**What it does (cases 1 and 3):**

1. Establishes the harness-coding base (unless `--no-harness-coding`).
2. Resolves the source (latest published tag by default, or `--source` / `--walle-version`).
3. Seeds the starter site from `walle/website/` — every file not already present in the target.
4. Syncs each declared module's MANAGED paths.
5. Seeds each module's SEED paths (written once if absent).
6. Injects walle's marker-bounded blocks into consumer-owned files.

What is managed, seed, or inject is declared in `walle/walle.yml`.
6. Writes `.walle/manifest.json`, `.walle/config.yml` (if absent), `.walle/lock`, and (unless
   `config.yml`'s `docs: false`) `.walle/docs/`.

**`website` is always required.** Omit `--modules` to get just `website`.

**Output:** `Project <name> initialized in <dir>.`

**Common errors:**

| Error                             | Cause                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `already a walle project`         | Target has a `.walle/manifest.json` already — use `update`/`add` instead              |
| `aborted — no files were written` | Adoption prompt declined                                                              |
| `'website' is a mandatory module` | `--modules` specified without `website`                                               |
| `unknown module '<m>'`            | Module name not in `website`, `ci`, `ai`, `backend`, `infrastructure`, `devcontainer` |

---

## `update`

Re-sync MANAGED paths in an existing consumer from a new walle release.

```bash
cli.sh update \
  [-p | --project-path <path>] \
  [--walle-version vX.Y.Z | --source <path>] \
  [--dry-run] \
  [--yes]
```

**Default project path:** current directory.

**What it does:**

1. Migrates a root `.walle.config.json` to `.walle/manifest.json` first, if found (see
   [Migration](#migration-from-walleconfigjson) below).
2. Reads `.walle/manifest.json` (stops if missing or v1).
3. Resolves the source.
4. Checks for a MAJOR version boundary — stops unless `--yes`.
5. Re-syncs MANAGED paths for all declared modules, including the `.vscode/settings.json` and
   `.vscode/extensions.json` marker blocks.
6. **Does not touch** SEED files, consumer configs, styles, pages, or content outside the
   `.vscode/` marker blocks.
7. Rewrites `.walle/manifest.json` with the new `walleVersion` and `updatedAt`, refreshes
   `.walle/lock` and `.walle/docs/` (unless disabled).

### Migration from `.walle.config.json`

A consumer still on the pre-`.walle/` layout (root `.walle.config.json`, no `.walle/` folder)
is migrated automatically, before anything else: its content is moved verbatim into
`.walle/manifest.json` and the old file is removed. No manual action needed, no data lost.

**In a consumer, prefer:**

```bash
just walle-update
```

**Common errors:**

| Error                               | Cause                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `no .walle/manifest.json found`     | Not a walle consumer or wrong `--project-path`                         |
| `manifest predates schemaVersion 2` | Manifest is missing `schemaVersion: 2` — this format isn't supported   |
| `crosses a MAJOR boundary`          | MAJOR version bump; re-run with `--yes` after reviewing `CHANGELOG.md` |

---

## `add`

Add a new module to an existing consumer project.

```bash
cli.sh add <module> \
  [-p | --project-path <path>] \
  [--walle-version vX.Y.Z | --source <path>] \
  [--dry-run]
```

**What it does:**

1. Reads `.walle/manifest.json`.
2. Syncs the new module's MANAGED paths.
3. Writes the module's SEED paths if they don't exist yet (re-add leaves them intact).
4. Appends the module to `modules` in `.walle/manifest.json`.

If the module is already declared, `add` re-syncs its MANAGED paths without changing the module list.

**Note for `backend`:** API routes require SSR. If `astro.ssr.enabled` is not `true` in `src/configs/app.json`, the CLI emits a warning after adding the module.

**Common errors:**

| Error                     | Cause                          |
| ------------------------- | ------------------------------ |
| `module name is required` | No module name passed          |
| `unknown module '<m>'`    | Module not in the valid set    |
| `manifest v1 detected`    | Consumer needs migration first |

---

## `check`

Read-only validation of a consumer project.

```bash
cli.sh check [-p | --project-path <path>] [-s | --source <path>] [-v | --verbose]
```

**What it checks:**

1. `.walle/manifest.json` exists and is `schemaVersion: 2`.
2. `walleVersion` is a semver tag (`vX.Y.Z` or `vX.Y.Z-prerelease`) or `"local"`.
3. When `walleVersion` is a semver tag (not `"local"`), compares it against the latest published tag on GitHub and emits a warning if the consumer is behind. Silently skipped when the remote is unreachable (no network).
4. Manifest validates against `schemas/walle.config.schema.json`.
5. Consumer configs pass `validate-configs.mjs` (if present).
6. Reports presence/absence of each module's SEED files (informational, never fails).
7. Warns if `backend` is active but SSR is off.

Pass `--source <path>` to also diff the consumer's MANAGED paths against a local walle clone. Files marked `!` are out of sync; a count and a suggested `update` command are shown at the end.

Pass `--verbose` to also print the full module catalog (all available modules, their MANAGED/SEED paths, and available component variants). Useful for onboarding and discovery.

**Output on success:**

```
✓ manifest v2 present (<name>)
✓ walleVersion pinned: v0.1.0-beta
✓ manifest valid against schema
✓ consumer configs valid
· seed present (website): README.md
check passed.
```

With `--verbose`:

```
Available modules:
  website (required) — Astro site — @walle components, layouts, styles, config and CLI scripts
    MANAGED : src/@walle, schemas, scripts/@walle
    SEED    : README.md, justfile.project, .husky/pre-commit, .husky/pre-push
  ci — GitHub Actions workflows (test + deploy) under @walle
    MANAGED : .github/workflows/actions/@walle
    SEED    : .github/workflows/test.yml, .github/workflows/deploy.yml
  devcontainer (opt-out, default on) — DevContainer scaffold — opt-out at init, not tracked in modules[]
    SEED    : .devcontainer/devcontainer.json
  ...

Available component variants:
  navbar  : standard, minimal
  footer  : standard, minimal
```

With `--source`:

```
--- managed path diff (source: /path/to/harness-walle) ---
  ✓ in-sync: src/@walle/
  ! out-of-sync (3 file(s)): schemas/
3 managed path(s) out of sync — run: cli.sh update --source /path/to/harness-walle
```

**Does not write anything.**
