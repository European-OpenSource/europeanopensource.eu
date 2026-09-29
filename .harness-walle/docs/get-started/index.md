---
title: Get started
order: 1
---

# Get started

Walle is a copy-based Astro design system. It is not installed as an npm package: its CLI copies
the engine into your project under `@walle/` paths, and you update it by running the CLI again. You
own everything else in the project: pages, content, configuration and your own styles.

## Why walle exists

Walle is the one source many sites are built from and maintained from. An improvement (a new
component, an accessibility fix, a design refinement) lands once in this repo, ships in a release,
and every site that runs an update picks it up without redoing its own work. Each site owns its
content and configuration; walle owns the `@walle/` engine underneath.

## Use cases

| You want to | Do this |
|---|---|
| Start a new site | `cli.sh init -n my-site -m website,ci,ai`, then [your first site](first-site.md) |
| Add walle to an existing project | run `cli.sh init` inside that directory; it asks for confirmation first |
| Make the site look like your brand | follow [the customization ladder](customize.md) |
| Move to a new walle release | `just walle-update`, then read [updating](updating.md) |
| Add CI, backend or AI support later | `cli.sh add <module>` |
| Check a project is valid | `just walle-check` |

## How it works

1. `cli.sh init` sets up the base environment, copies the starter site once, and syncs the modules
   you asked for.
2. Files under `@walle/` paths are **managed**: walle owns them and rewrites them on every update.
   Never edit them.
3. Everything else is yours. Starter files that walle copies once (pages, `src/configs/*.json`,
   `src/styles/global.css`) are **seed** files: walle never touches them again.
4. `.harness-walle/manifest.json` records the project name, the active modules and the pinned
   `walleVersion`.

The full model is in [managed vs seed](../develop/managed-vs-seed.md).

## Next

- [Your first site](first-site.md): from zero to a deployed site.
- [Customize](customize.md): every supported way to change how walle looks and behaves.
- [Updating](updating.md): release updates and migration guides.
