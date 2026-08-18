# Versioning

Walle is distributed **copy-based**: consumers receive a verbatim copy of the `@walle/`
namespaces into their own repo. There is no npm package to bump, so versioning is expressed
as **git tags** on this repo and a pinned `walleVersion` in each consumer's
`.harness-walle/manifest.json`.

## `walleVersion` in `.harness-walle/manifest.json`

Every consumer manifest pins an explicit walle release via `walleVersion`:

```json
{
  "schemaVersion": 3,
  "walleVersion": "v0.2.0",
  ...
}
```

`walleVersion` must be a semver tag (`vX.Y.Z`, optionally with a `-prerelease` suffix) or the
special value `"local"` (for development with `--source`). Any other value fails `cli.sh check`.

The pin ensures `walle update` fetches a deterministic source — walle never silently pulls from
`main` for the design-system content (the CLI script itself is resolved from the same tag as of
v0.2.0 — see [CLI reference](cli.md)).

## Release line and pre-1.0 policy

Every release has an entry in [`CHANGELOG.md`](../CHANGELOG.md) classifying its changes
(added / changed / fixed / removed). `v0.1.0` was the first published release; the current line
is **`v0.x`**. While the major version stays `0`:

- **MINOR** (`v0.1.0` → `v0.2.0`) — new components, variants, props, tokens, or modules, all
  backward compatible (e.g. adding an optional key to a schema). The MAJOR-boundary warning in
  `update` is silent across `0.x`.
- **PATCH** (`v0.2.0` → `v0.2.1`) — fixes that do not change any contract.

`v1.0.0` is the **first stable release** — the point where the MAJOR-boundary check in `update`
starts enforcing `--yes` and breaking changes require migration notes.

### What counts as a breaking change (MAJOR)

A change is **breaking** when it requires an action in the consumer project after an update.
Because the contracts live in (or at the border of) the consumer zones, breaking means:

- A config key renamed, removed, or with changed semantics (`app.json`, `navbar.json`,
  `footer.json`, `theme.json`).
- A component slot, prop, or variant removed or renamed.
- A path belonging to a **consumer zone** moved (see the consumer-zone invariant in
  [`AGENTS.md`](../AGENTS.md)).
- A raised runtime requirement (Node major, Yarn major).

A MAJOR release **must** ship migration notes in the changelog describing the required steps.

**Rule of thumb:** anything that lives only inside a `@walle/` namespace and does not change the
contract border (props / slots / config / output) is **never** MAJOR — including moving files
around inside the walle repo itself (the v0.2.0 reorganization into `walle/` changed nothing on
the consumer side, so it shipped as MINOR).

## Updating the version

```bash
just walle-update
# equivalent: cli.sh update
```

This resolves the **latest published stable `vX.Y.Z` tag** on the walle repo (never `main`) and
re-syncs MANAGED paths. The manifest is updated with the new `walleVersion` and `updatedAt`.

To pin a specific version:

```bash
cli.sh update --walle-version v0.2.0
```

To preview what would change without writing:

```bash
cli.sh update --dry-run
```

Crossing a MAJOR boundary stops the update, surfaces the breaking changes, and points at the
migration notes; re-run with `--yes` to proceed:

```
Update v0.9.3 -> v1.0.0 crosses a MAJOR boundary (breaking changes).
Review the migration notes in CHANGELOG.md, then re-run with --yes to proceed.
```

## `schemaVersion`

`schemaVersion: 3` is the current manifest format (it groups the `files` map by module rather
than by dest path, and lives in `.harness-walle/` — see [modules](modules.md)). It is a fixed
constant, not a user-managed value. A `schemaVersion: 2` manifest — including one still in the old
`.walle/` folder or the pre-folder root `.walle.config.json` — is migrated automatically by any CLI
command (dir renamed, `files` reshaped, version bumped); no manual action needed. An older,
unversioned manifest is blocked by all CLI commands — re-scaffold with `cli.sh init`.

## Local-source mode (dev / test exemption)

The init/update tools accept `--source <local-path>` for development and the e2e harness. This
is the **only** exemption to the tag-pin rule:

- The manifest records `walleVersion: "local"` plus an informational `sourceRef`.
- The tool warns that the project is **not** on a release.
- Sync happens from the local working tree — no tag, no network required.

## Release process (walle maintainers)

Tags follow `vX.Y.Z` or `vX.Y.Z-<prerelease>` (e.g. `v0.1.0-beta`). The `resolve_latest_tag`
function in `cli.sh` resolves the highest `sort -V` **stable** tag from the repo via
`git ls-remote` (falling back to the latest prerelease only if no stable tag exists yet).

Before cutting a release:

1. Land all changes on the release branch.
2. Update `CHANGELOG.md` under the new version heading — the `just release` target refuses to
   proceed if that section is empty, and `release.yml` refuses to publish a GitHub release
   without real notes. MAJOR releases include migration notes.
3. Confirm `just e2e` and `yarn test` are green.

Cut the release:

```bash
just release v0.2.0   # bumps package.json, commits CHANGELOG, tags, pushes
```

`release.yml` then extracts the matching CHANGELOG section to a file and publishes the GitHub
release via [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release)
(auto-marked prerelease for `-alpha`/`-beta`/`-rc` tags). The notes are passed as a file
(`body_path`), never as a shell string — CHANGELOG prose routinely contains backticks and
`$(...)`, which broke the release job when handled with `gh release create --notes` (even via
`env:`, since GitHub Actions renders `env:` values as literal `export VAR="..."` in the step
script, so backticks in the value are still evaluated as command substitution — see the fix in
this workflow's git history for the incident). Don't reintroduce a shell-string path for the
notes; always thread them through as a file. Consumers pick it up via `cli.sh update` (default:
latest stable tag).

Do not push tags from a devcontainer session where git-write is blocked.

## Keeping dependencies current

`package.json` is a **seed** file: Walle writes it once at `init`, and from then on it belongs to
the consumer (who adds their own dependencies to it). `walle update` only rewrites MANAGED
`@walle/` paths, so it deliberately **never touches `package.json`** — otherwise it would erase the
deps a consumer added. The trade-off is that npm dependency bumps do not arrive with `walle update`.

How to stay current:

1. **`walle update` tells you.** After it syncs the managed paths, it compares your `package.json`
   against the release's seed and prints any Walle-owned dependency that is behind (disable with
   `--no-deps-check`):
   ```
   ⚠ 2 Walle dependency(ies) in your package.json are behind the tested set
        package   yours     walle
        astro     ^7.0.6    ^7.1.3
        vitest    ^3.2.7    ^4.1.10   ⚠ major — check breaking changes
   ```
2. **Align them** — either apply Walle's tested ranges automatically (only the Walle-owned deps; your
   own dependencies are never touched)…
   ```bash
   just walle-deps --apply   # then:
   just yarn install
   ```
   …or bump the ones you want by hand (majors flagged above deserve a changelog read first):
   ```bash
   just yarn up astro@^7.1.3 vitest@^4.1.10
   ```
3. **CI actions are different** — the GitHub Actions used by the `ci` module (e.g.
   `actions/setup-node`) live under MANAGED paths, so those **do** update on `just walle-update`.

`just walle-deps` (without `--apply`) is a read-only report you can run any time; the reference is always
the seed `package.json` of the resolved release. Dependabot/Renovate on the consumer repo remains a
good complement between Walle releases, and each release's [CHANGELOG](../CHANGELOG.md) `Dependencies`
section records the exact set Walle validated.

## Tag format

```
v0.1.0        first published release
v0.2.0        backward-compatible feature release
v0.2.1        backward-compatible fix
v1.0.0        first stable release (MAJOR — ships migration notes)
v2.0.0        breaking release (ships migration notes)
```
