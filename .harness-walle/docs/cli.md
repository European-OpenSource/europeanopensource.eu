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
2. **Exists with a `.harness-walle/manifest.json`** → refuses to run: "already a walle project — use
   `cli.sh update` or `cli.sh add <module>` instead." Nothing is written.
3. **Exists without a `.harness-walle/manifest.json`** ("adoption") → prints a warning and the sync plan
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
6. Writes `.harness-walle/manifest.json`, `.harness-walle/config.yml` (if absent), `.harness-walle/lock`, and (unless
   `config.yml`'s `docs: false`) `.harness-walle/docs/`.

**`website` is always required.** Omit `--modules` to get just `website`.

**Output:** `Project <name> initialized in <dir>.`

**Common errors:**

| Error                             | Cause                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `already a walle project`         | Target has a `.harness-walle/manifest.json` already — use `update`/`add` instead              |
| `aborted — no files were written` | Adoption prompt declined                                                              |
| `'website' is a mandatory module` | `--modules` specified without `website`                                               |
| `unknown module '<m>'`            | Module name not in `website`, `ci`, `ai`, `backend`, `devcontainer` |

---

## `update`

Re-sync MANAGED paths in an existing consumer from a new walle release.

```bash
cli.sh update \
  [-p | --project-path <path>] \
  [--walle-version vX.Y.Z | --source <path>] \
  [--dry-run] \
  [--yes] \
  [--no-deps-check]
```

**Default project path:** current directory.

**What it does:**

1. Migrates any older layout first (see [Migration](#migration-from-older-layouts) below): a root
   `.walle.config.json` or an old `.walle/` folder becomes `.harness-walle/`, and a `schemaVersion: 2`
   `files` map is reshaped to v3.
2. Reads `.harness-walle/manifest.json` (stops if missing or unversioned).
3. Resolves the source.
4. Checks for a MAJOR version boundary — stops unless `--yes`.
5. Re-syncs MANAGED paths for all declared modules, including the `.vscode/settings.json` and
   `.vscode/extensions.json` marker blocks.
6. **Does not touch** SEED files, consumer configs, styles, pages, or content outside the
   `.vscode/` marker blocks.
7. Rewrites `.harness-walle/manifest.json` with the new `walleVersion` and `updatedAt`, refreshes
   `.harness-walle/lock` and `.harness-walle/docs/` (unless disabled).
8. Reports any **Walle-owned dependency drift** in `package.json` (which is seed-owned and never
   rewritten) so you can align it — see [`deps`](#deps). Disable with `--no-deps-check`.

### Migration from older layouts

A consumer on any older layout is migrated automatically, before anything else — idempotent, no
data lost, no manual action:

- a root `.walle.config.json` file → `.harness-walle/manifest.json`;
- an old `.walle/` state folder → `.harness-walle/` (dir renamed);
- a `schemaVersion: 2` `files` map (keyed by dest path → module) → v3 (keyed by module → array of
  dest paths), and `schemaVersion` bumped to 3.

**In a consumer, prefer:**

```bash
just walle-update
```

**Common errors:**

| Error                               | Cause                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `no .harness-walle/manifest.json found`     | Not a walle consumer or wrong `--project-path`                         |
| `unsupported manifest schemaVersion` | Manifest has no `schemaVersion` (v2/v3 are supported; v2 auto-migrates) — re-scaffold with `init` |
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

1. Reads `.harness-walle/manifest.json`.
2. Syncs the new module's MANAGED paths.
3. Writes the module's SEED paths if they don't exist yet (re-add leaves them intact).
4. Appends the module to `modules` in `.harness-walle/manifest.json`.

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

1. `.harness-walle/manifest.json` exists and is `schemaVersion: 2`.
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

## `deps`

Report — and optionally align — **Walle-owned dependency drift** in a consumer's `package.json`.
Inside a consumer the canonical form is `just walle-deps` (`just walle-deps --apply` to align); the
direct `cli.sh` invocation below is for more control.

```bash
cli.sh deps \
  [-p | --project-path <path>] \
  [--walle-version vX.Y.Z | --source <path>] \
  [--apply]
```

**Why it exists:** `package.json` is a SEED file (see [managed vs seed](managed-vs-seed.md)) — the
consumer owns it and adds their own dependencies, so `update` never rewrites it. `deps` bridges that
gap: it treats the resolved release's seed `package.json` as the reference for **Walle-owned**
dependencies and compares the consumer's versions against it. Dependencies the consumer added (absent
from the seed) are never reported or changed.

**What it does:**

- Without `--apply` (default) — read-only report. Prints each Walle-owned dependency whose declared
  floor is **below** the seed's, flags **major** gaps (which may carry breaking changes), and lists any
  Walle deps absent from your `package.json`. Runs automatically at the end of `update` (unless
  `--no-deps-check`).
- With `--apply` — rewrites only the behind Walle-owned entries in `package.json` to the seed's ranges,
  preserving key order and leaving your own dependencies untouched. Then run `yarn install` to update
  the lockfile.

```
$ cli.sh deps --source /path/to/harness-walle

 ⚠ 2 Walle dependency(ies) in your package.json are behind the tested set
   (Walle never rewrites package.json — it's yours):

     package   yours     walle
     astro     ^7.0.6    ^7.1.3
     vitest    ^3.2.7    ^4.1.10   ⚠ major — check breaking changes

   Align them:  yarn up astro@^7.1.3 vitest@^4.1.10
   Or run:      walle deps --apply
```

The comparison uses the version **floor** of each range (`^7.1.3` → `7.1.3`), so it flags only genuine
downgrades, never cosmetic range differences. Each release also records its validated dependency set in
the [CHANGELOG](../CHANGELOG.md) `Dependencies` section.
