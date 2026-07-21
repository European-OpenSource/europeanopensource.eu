# Versioning

Walle is distributed **copy-based**: consumers receive a verbatim copy of the `@walle/`
namespaces into their own repo. There is no npm package to bump, so versioning is expressed
as **git tags** on this repo and a pinned `walleVersion` in each consumer's
`.walle/manifest.json`.

## `walleVersion` in `.walle/manifest.json`

Every consumer manifest pins an explicit walle release via `walleVersion`:

```json
{
  "schemaVersion": 2,
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

`schemaVersion: 2` is the current and only supported manifest format. It is a fixed constant, not
a user-managed value. Consumers on an older, unversioned manifest are blocked by all CLI
commands — re-scaffold with `cli.sh init` against the current release.

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

## Tag format

```
v0.1.0        first published release
v0.2.0        backward-compatible feature release
v0.2.1        backward-compatible fix
v1.0.0        first stable release (MAJOR — ships migration notes)
v2.0.0        breaking release (ships migration notes)
```
