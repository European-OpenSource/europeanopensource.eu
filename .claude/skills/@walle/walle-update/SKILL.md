---
name: walle-update
description: Update walle design system in consumer project safely. Use when pulling a new walle release, resolving drift in @walle/ paths, or before editing files that might be walle-managed.
metadata:
  author: harness-walle
  managed: "true"
---

# Updating walle

This project consumes [walle](https://github.com/FabrizioCafolla/harness-walle), a copy-based design system. Managed paths under `@walle/` namespaces are overwritten on every update — treat them as read-only.

## Before editing anything

Check whether a file is walle-managed. Most managed paths live under a `@walle/` segment
(`src/@walle/`, `scripts/@walle/`, `.github/workflows/actions/@walle/`, `.claude/skills/@walle/`)
but two do not: `schemas/` and `walle.justfile` are managed too, and so are the devcontainer
BASE files (`.devcontainer/Dockerfile`, `docker-compose.yml`, `scripts/setup-devcontainer.sh`,
`configs/.zshrc`, `configs/.aws/.gitignore`) if the project has the `devcontainer` module. The
`AGENTS.md` marker block between `<!-- [walle:START] -->` and `<!-- [walle:END] -->` is also
managed.

Anything matching the above is overwritten on the next update — edits will be lost. To get different behavior, change the consumer zones instead (configs, styles, components, pages, content, `astro.config.mjs`, `package.json`). See `walle-customize` for patterns.

## Check for a newer release first

```bash
just walle-check
```

If it reports "latest published is vX.Y.Z", there is a newer release. Running `walle-update` will pull it.

## Run the update

```bash
just walle-update
```

This re-syncs all MANAGED paths for the project's active modules at the pinned walle release, and regenerates the `AGENTS.md` marker block. SEED files (write-once consumer scaffolding: API routes, Terraform scaffold, workflow starters) and all consumer zones are never touched.

### Crossing a MAJOR version boundary

If the new release is a MAJOR bump (e.g. v0.x → v1.0), the CLI stops and prints migration notes. To proceed after reviewing the notes:

```bash
just walle-update --yes
```

## What changes vs. what is preserved

| Category                                                 | Behavior                         |
| -------------------------------------------------------- | -------------------------------- |
| `@walle/`-namespaced paths                               | Overwritten — every managed file |
| `AGENTS.md` marker block                                 | Regenerated from the manifest    |
| SEED files (api routes, infra, ci workflows, middleware) | Never touched                    |
| Consumer zones (configs, pages, styles, content)         | Never touched                    |

## After the update

Validate the project and build:

```bash
just walle-check   # manifest v2, version pin, configs — also checks for further staleness
just build         # production build
```

If `walle-check` reports a manifest or version mismatch, fix the pin in `.walle/manifest.json` rather than hand-editing managed files.
