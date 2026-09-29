# AGENTS.md

<!-- [harness-coding:START] managed by harness-coding template, do not edit manually -->

This repository was bootstrapped from the [harness-coding](https://github.com/FabrizioCafolla/harness-coding) template.

Template-managed files are kept in sync with upstream via `just harness-coding check` / `just harness-coding update` — `cli.sh` is never vendored locally, it's always fetched fresh from `main`.

Instructions and context for AI agents (Claude Code, GitHub Copilot, etc.) working in this repository.

## How to behave

Before anything else: you do not know everything, and you should not act like you do.

- **Search before you answer.** If a request touches something you are not certain about a tool, a convention, a file, a decision already made look it up first. Read the relevant files. Check the actual state of the project. Do not reconstruct from memory what you can verify directly.
- **Put yourself in doubt.** Before returning an answer, ask yourself: is this actually correct, or does it just sound correct? If you are not sure, say so explicitly and explain what you are uncertain about.
- **Do not agree by default.** If something Fabrizio says is wrong, incomplete, or heading in a bad direction, say so directly. Explain why. Propose something better. Agreement that is not earned is noise.
- **Behave like a professional in a discussion, not a tool executing commands.** Push back, ask follow-up questions, surface implications he may not have considered. The goal is to reach the best outcome, not to validate whatever was said.
- **Ask when the task is unclear.** Many requests will be generic or underspecified. Before producing output, assess whether you have enough context to do it well. If not, ask specifically, not generically. One focused question is better than a wrong answer.

## Development environment

All work happens inside the DevContainer. Do not assume tools are installed on the host machine. The container builds run `harnessai install` (`postCreateCommand`); every start runs `harnessai sync && just setup` (`postStartCommand`). AWS configuration lives in `.devcontainer/configs/.aws/`, and AI tool caches (Claude, Copilot, OpenCode, LLaMA) are persisted in `.devcontainer/cache/`.

### Three-layer file organization

This project follows a **three-layer model** for configuration:

1. **BASE** (template-managed, auto-updated): `docker-compose.yml`, `setup-devcontainer.sh`, `justfile`, `justfile.tooling` — updated when you run `just harness-coding update`
2. **PROJECT** (versionated, `.project` files): Shared defaults for all team members — `justfile.project`, `setup-devcontainer.project.sh`, `docker-compose.project.yml`, `.env.project`
3. **LOCAL** (dev-specific, `.local` files, gitignored): Personal customizations that are never committed — `justfile.local`, `setup-devcontainer.local.sh`, `docker-compose.local.yml`, `.env`

### Template files and `.project`/`.local` pattern

- **Base template files** (`justfile`, `docker-compose.yml`, etc.) are auto-updated and must not be edited manually
- **`.project` files** (versionated) contain project-wide defaults and are committed to git — all team members share these
- **`.local` files** (gitignored) contain personal/local customizations — never committed, each dev can customize freely

**Examples:**

- `justfile` (base, marker-managed) imports `justfile.project`, `justfile.local`, `justfile.tooling`, `justfile.private`
- `docker-compose.yml` (base) + `docker-compose.project.yml` (project) + `docker-compose.local.yml` (local) merge via Compose
- `.env.project` (versionated, project defaults) + `.env` (gitignored, local overrides) are both loaded at container startup

**Discover available commands with:**

```bash
just help
```

## What agents should avoid

- Do not modify `.devcontainer/` base files (Dockerfile, docker-compose.yml, setup-devcontainer.sh) unless asked — they are auto-updated by the template
- Do not modify `.project` files unless making changes that should be shared with the team — these are versionated
- Do edit `.local` files for personal/local customizations — these are gitignored and won't be committed
- Do not install packages globally inside the container without updating the Dockerfile or devcontainer features

<!-- [harness-coding:END] -->

<!-- [walle:START] -->
## Walle design system (managed block)

This project uses the [Walle](https://github.com/FabrizioCafolla/harness-walle) design system.
Paths under `@walle/` are **read-only**: `just walle-update` overwrites them. Customize only in
the consumer zones below, and follow the customization ladder (skill `walle-customize`).

- **Consumer zones (never overwritten):** `src/configs/`, `src/styles/global.css`,
  `src/components/`, `src/pages/`, `src/content/`, `src/content.config.ts`, `astro.config.mjs`,
  `package.json`, `.vscode/`.
- **Config:** `src/configs/app.json`, `navbar.json`, `footer.json` and the optional `theme.json`
  are validated at build time; an invalid key stops the build with the file and key path
  (`just validate-configs` checks them without building). `theme.json` holds palette, neutral
  scale, shadows, radii, spacing and `typography.fonts`.
- **Styles:** put every site rule in `src/styles/global.css` inside `@layer site { }`, which wins
  over walle's layers. Restyle components through their public custom properties
  (`--button-radius`, `--card-bg`, `--navbar-bg`, ...), never through walle's inner class names,
  `!important` or repeated selectors. Define the `site` variant (`[data-variant="site"]`) for a
  brand color that any component can take with `variant="site"`.
- **Components:** variants are `primary`, `secondary`, `alternative`, `site`; modifiers are
  boolean props (`outline`, `inverse`, `filled`, `muted`). Replace an embedded component (navbar,
  footer, card, breadcrumbs, page header, table of contents) with `app.json` `components`, using a
  built-in name or a `./src/...` path; to wrap the original, import it by file path, not from
  `@walle/components`.
- **Language:** `website.language` drives every date, price and number; translate walle's
  interface strings in `app.json` `labels`.
- **Features (off unless enabled in `app.json`):** `commerce.mode` (`off`, `catalog`, `shop`),
  `pwa.enabled` and `pwa.offline`, `seo.ogImage`, `seo.feeds`, `astro.redirects`,
  `astro.adapter: "node"` for routes with `prerender = false`, `map` defaults for the `Map`
  component. Walle injects the routes these need; do not add pages at the same paths.
- **Astro config:** `astro.config.mjs` is a thin `defineWalleConfig({})` shell for native Astro
  overrides (scalars override, `integrations` merge).
- **Updates:** run `just walle-update`, then `just walle-deps` and `just build`. Only the active
  modules' managed paths are synced, and this block is rewritten between its markers.

Do not edit files inside `@walle/` directories, and do not edit the content between the
`[walle:START]` / `[walle:END]` markers by hand: both are regenerated on update.

### Active walle modules

- **website**: Astro site: @walle components, layouts, styles, config and CLI scripts
  - Managed: src/@walle, schemas, scripts/@walle, scripts/@walle/walle.yml
- **ci**: GitHub Actions workflows (test + deploy) under @walle
  - Managed: .github/workflows/actions/@walle
  - Seeded once: .github/workflows/test.yml, .github/workflows/deploy.yml
- **ai**: AI harness: generated AGENTS.md block and @walle skills
  - Managed: .claude/skills/@walle
- **harness-coding**: Harness coding scaffold
  - Seeded once: justfile.project, .husky/pre-commit, .husky/pre-push, .devcontainer/docker-compose.project.yml

### Working with walle

- Managed `@walle/` zones are regenerated by the CLI.
- Update: `just walle-update`.
- Add: `just walle add <module>`.
- Validate: `just walle-check`.
<!-- [walle:END] -->
