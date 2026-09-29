---
title: CLI reference
order: 3
---

# CLI reference

The CLI source lives at `walle/cli/cli.sh` in this repo and is synced into every consumer
project (at `scripts/@walle/cli.sh`) by the `website` module. Inside a consumer, the canonical
invocation is `just walle-update` (and friends); direct `cli.sh` calls are for more control.

## Global usage

```bash
cli.sh <command> [options]
```

| Command  | Purpose                                                          |
| -------- | ----------------------------------------------------------------- |
| `init`   | Scaffold a new consumer, or adopt an existing directory           |
| `update` | Re-sync the declared modules of an existing consumer              |
| `add`    | Add a module to an existing consumer and sync it                  |
| `check`  | Validate a consumer (manifest, version pin, configs)              |
| `deps`   | Report Walle-owned dependency drift; `--apply` aligns and adds missing runtime deps |

Common options shared across commands:

| Flag                        | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------- |
| `-s, --source <path>`       | Use a local walle clone instead of a release tag (dev / test)             |
| `-w, --walle-version <tag>` | Pin a specific release tag (e.g. `v0.1.0-beta`). Default: latest published |
| `--dry-run`                 | Show the sync plan without writing anything                               |
| `--yes`                     | Skip confirmation prompts (a MAJOR boundary on `update`, or adoption on `init`) |
| `-h, --help`                | Show usage                                                                 |

---

## `init`

Scaffold a new consumer project, or adopt an existing directory that isn't one yet.

```bash
cli.sh init \
  [-n | --project-name <name>] \
  [-d | --dir-path <path>] \
  [-m | --modules website,ai,ci] \
  [-w | --walle-version vX.Y.Z | -s | --source <path>] \
  [--dry-run] \
  [--yes] \
  [--no-harness-coding] \
  [--no-ai] \
  [--no-ci]
```

`--modules` defaults to `website,ai,ci`. Valid values: `website`, `ci`, `ai`, `backend`,
`harness-coding`/`devcontainer` (the last two are aliases for the same module).

**`--project-name` is optional.** Given, it creates `<dir-path>/<project-name>` (the classic
greenfield flow). Omitted, the target is `--dir-path` itself (default: current directory): run
`cd my-existing-project && cli.sh init` to add walle to a project you already have.

**Three outcomes depending on the target directory:**

1. **Doesn't exist** → created and scaffolded, no prompt.
2. **Exists with a manifest already** (`.harness-walle/manifest.json` or an older layout) →
   refuses to run: "already a walle project. Use update or add." Nothing is written.
3. **Exists without a manifest** ("adoption") → prints the sync plan (same shape as
   `--dry-run`), then asks `Proceed with adoption? [y/N]`. Pass `--yes` to skip the prompt (for
   scripts/CI). Declining aborts with nothing written ("aborted"). Seed files are written
   **only if absent**: an adoption never overwrites a file already in the directory; MANAGED
   paths are always synced as usual.

**What it does (cases 1 and 3):**

1. Establishes the harness-coding base (unless `--no-harness-coding`): runs harness-coding's own
   CLI first, so `.devcontainer/`, the base `justfile`, and its own seeds exist before walle
   touches anything.
2. Resolves the source (latest published tag by default, or `--source` / `--walle-version`).
3. Seeds the starter site from `walle/website/`: every file not already present in the target,
   minus `walle.yml`'s `website-seed-exclude` paths.
4. Syncs each declared module's MANAGED paths, then seeds each module's SEED paths (written once
   if absent), then applies the marker-bounded INJECT blocks.
5. Injects walle's own extensions into the harness-coding files (unless skipped).
6. Writes `.harness-walle/manifest.json`, `.harness-walle/config.yml` (if absent),
   `.harness-walle/lock`, and (unless `config.yml`'s `docs: false`) `.harness-walle/docs/`.

`website` is always required: omitting it from `--modules` fails with `'website' is a
mandatory module`. `devcontainer` in `--modules` just re-affirms the (already-on-by-default)
harness-coding base; it is never tracked in the manifest's `modules` array.

**Output:** `Project <name> initialized.`

**Common errors:**

| Error                                | Cause                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| `already a walle project`            | Target already has a manifest: use `update`/`add` instead          |
| `aborted`                            | Adoption prompt declined                                            |
| `'website' is a mandatory module`    | `--modules` given without `website`                                 |
| `unknown module '<m>'`               | Module name not in `website`, `ci`, `ai`, `backend`, `harness-coding` |

---

## `update`

Re-sync MANAGED paths in an existing consumer from a new walle release.

```bash
cli.sh update \
  [-p | --project-path <path>] \
  [-w | --walle-version vX.Y.Z | -s | --source <path>] \
  [--dry-run] \
  [--yes] \
  [--no-deps-check]
```

**Default project path:** current directory.

**What it does:**

1. Migrates any older layout first (see [Migration](#migration-from-older-layouts) below): a root
   `.walle.config.json` or an old `.walle/` folder becomes `.harness-walle/`, and a
   `schemaVersion: 2` `files` map is reshaped to v3.
2. Reads `.harness-walle/manifest.json` (stops if missing or unversioned).
3. Resolves the source.
4. Checks for a MAJOR version boundary: stops unless `--yes`.
5. Re-syncs MANAGED paths for all declared modules, re-applies the INJECT blocks (including
   `.vscode/settings.json`, `.vscode/extensions.json`, and the harness-coding extensions), and
   re-syncs the harness-coding base.
6. **Does not touch** SEED files, consumer configs, styles, pages, or content outside the marker
   blocks.
7. Rewrites `.harness-walle/manifest.json` with the new `walleVersion` and `updatedAt`, refreshes
   `.harness-walle/lock` and `.harness-walle/docs/` (unless disabled).
8. Reports any **Walle-owned dependency drift** in `package.json` (which is seed-owned and never
   rewritten) so you can align it: see [`deps`](#deps). Disable with `--no-deps-check`.

### Migration from older layouts

A consumer on any older layout is migrated automatically, before anything else, idempotent, no
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

| Error                                 | Cause                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `no .harness-walle/manifest.json found` | Not a walle consumer or wrong `--project-path`                            |
| `unsupported manifest schemaVersion`    | Manifest has neither `2` nor `3`: re-scaffold with `init`                |
| `crosses a MAJOR boundary`              | MAJOR version bump; re-run with `--yes` after reviewing `CHANGELOG.md`    |

---

## `add`

Add a new module to an existing consumer project.

```bash
cli.sh add <module> \
  [-p | --project-path <path>] \
  [-w | --walle-version vX.Y.Z | -s | --source <path>] \
  [--dry-run]
```

**What it does:**

- For `devcontainer`: syncs the harness-coding base and its injected extensions, and records
  `devcontainer.enabled: true` in the manifest. Useful for a consumer that skipped it at init
  with `--no-harness-coding`.
- For any other module: syncs its MANAGED paths, writes its SEED paths if absent (a re-add on an
  already-declared module re-syncs MANAGED and leaves SEED files that already exist intact), and
  appends it to `modules` in the manifest.

**Note for `backend`:** API routes render server-side only on a route with
`export const prerender = false`, which needs `astro.adapter: "node"` in
`src/configs/app.json`. The CLI warns after adding the module if that adapter isn't set.

**Common errors:**

| Error                     | Cause                          |
| ------------------------- | ------------------------------- |
| `module required`        | No module name passed          |
| `unknown module '<m>'`   | Module not in the valid set    |

---

## `check`

Read-only validation of a consumer project.

```bash
cli.sh check [-p | --project-path <path>] [-s | --source <path>] [-v | --verbose]
```

**What it checks:**

1. `.harness-walle/manifest.json` exists (migrating an older layout first, same as `update`).
2. `walleVersion` is a semver tag (`vX.Y.Z` or `vX.Y.Z-prerelease`) or `"local"`.
3. When on a tagged release (not `"local"`), compares it against the latest published tag and
   warns if the consumer is behind. Silently skipped when the remote is unreachable.
4. The manifest validates against `schemas/walle.config.schema.json` (skipped with a warning if
   `ajv` isn't installed in the project).
5. Reports presence/absence of each declared module's SEED files, and the devcontainer's SEED
   file if enabled (informational, never fails).

**Does not write anything.**

## `deps`

Reports, and optionally aligns, **Walle-owned dependency drift** in a consumer's `package.json`.
Inside a consumer the canonical form is `just walle-deps` (`just walle-deps --apply` to align);
the direct `cli.sh` invocation below is for more control.

```bash
cli.sh deps \
  [-p | --project-path <path>] \
  [-w | --walle-version vX.Y.Z | -s | --source <path>] \
  [--apply]
```

**Why it exists:** `package.json` is a SEED file (see [managed vs seed](managed-vs-seed.md)):
the consumer owns it and adds their own dependencies, so `update` never rewrites it. `deps`
bridges that gap: it treats the resolved release's seed `package.json` as the reference for
**Walle-owned** dependencies and compares the consumer's versions against it. Dependencies the
consumer added (absent from the seed) are never reported or changed.

**What it does:**

- Without `--apply` (default): read-only report. Prints each Walle-owned dependency whose
  declared floor is **below** the seed's, flags **major** gaps (which may carry breaking
  changes), and lists any Walle deps missing from your `package.json`. Runs automatically at
  the end of `update` (unless `--no-deps-check`).
- With `--apply`: rewrites the behind Walle-owned entries and adds missing required runtime
  dependencies in `package.json`, preserving key order and leaving your own dependencies
  untouched. Missing `devDependencies` are only reported, never forced. Then run
  `yarn install` to update the lockfile.

```
$ cli.sh deps --source /path/to/harness-walle

 ⚠ 2 Walle dependency(ies) in your package.json are behind the tested set
   (Walle never rewrites package.json; it's yours):

     package   yours     walle
     astro     ^7.0.6    ^7.1.3
     vitest    ^3.2.7    ^4.1.10   ⚠ major: check breaking changes

   Align them:  yarn up astro@^7.1.3 vitest@^4.1.10
   Or run:      walle deps --apply
```

The comparison uses the version **floor** of each range (`^7.1.3` → `7.1.3`), so it flags only
genuine downgrades, never cosmetic range differences. Each release also records its validated
dependency set in the [CHANGELOG](../../CHANGELOG.md) `Dependencies` section.
