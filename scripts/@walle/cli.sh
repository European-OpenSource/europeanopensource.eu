#!/usr/bin/env bash
#
# Walle CLI. Scaffolds/updates a consumer: seeds the starter site from walle/website/ and
# syncs the declared modules' @walle paths. What is managed/seed/inject is declared in
# walle/walle.yml. Supports --dry-run, `add <module>`, and `walle check`.

set -Ee
set -u
set -o pipefail
set -o functrace

# =============================================================================
# 1. GLOBAL STATE & CONFIGURATIONS
# =============================================================================

GITHUB_WALLE_REPO="https://github.com/FabrizioCafolla/harness-walle"
HARNESS_CODING_CLI_URL="https://raw.githubusercontent.com/FabrizioCafolla/harness-coding/main/cli.sh"

# Markers
WALLE_START="<!-- [walle:START] -->"
WALLE_END="<!-- [walle:END] -->"
WALLE_START_SH="# [walle:START]"
WALLE_END_SH="# [walle:END]"
WALLE_START_JS="// [walle:START]"
WALLE_END_JS="// [walle:END]"

# Execution State
INTENTIONAL_EXIT=0
DRY_RUN=0
ASSUME_YES=0
SEED_ENABLED=0
HARNESS_CODING_ENABLED=1
AGENTS_MODULES=""
TEMP_DIR=""
FILES_LOG=""

# Error Handling Trap
trap 'catch_error $? $LINENO ${BASH_SOURCE[0]}' EXIT
catch_error() {
  local exit_code=$1
  local line_no=$2
  local file_name=$3
  if [ "$exit_code" != "0" ] && [ "${INTENTIONAL_EXIT}" != "1" ]; then
    echo "[ERROR] in $(basename "$file_name") at line $line_no (error code $exit_code)"
  fi
  if [ -n "${TEMP_DIR:-}" ] && [ -d "${TEMP_DIR}" ]; then
    rm -rf "${TEMP_DIR}"
  fi
  if [ -n "${FILES_LOG:-}" ] && [ -f "${FILES_LOG}" ]; then
    rm -f "${FILES_LOG}"
  fi
}

# Record a written path for the manifest's files map: <category> <dest> <module>.
record_file() {
  [ -n "${FILES_LOG:-}" ] || return 0
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$FILES_LOG"
}

# =============================================================================
# 2. LOGGING & UTILITIES
# =============================================================================

print_info()  { echo -e " [INFO] ${*}"; }
print_warn()  { echo -e " [WARN] ${*}"; }
print_plan()  { echo -e " [PLAN] ${*}"; }
print_error() {
  echo -e " [ERROR] ${*}"
  INTENTIONAL_EXIT=1
  exit 1
}

usage() {
  cat <<EOF
Usage: cli.sh <command> [options]

Commands:
  init      Scaffold a new consumer, or adopt an existing directory
  update    Re-sync the declared modules of an existing consumer
  add       Add a module to an existing consumer and sync it
  check     Validate a consumer (manifest, version pin, configs)

Common options:
  -s, --source <path>         Use a local walle clone instead of a release
  -w, --walle-version <tag>   Release tag (e.g. v0.1.0-beta). Default: latest
      --dry-run               Show the sync plan without writing anything
      --yes                   Skip confirmation prompts
      --no-harness-coding     Skip .devcontainer/ scaffold at init
      --no-ai                 Skip AGENTS.md + skills at init (default: on)
      --no-ci                 Skip GitHub Actions workflows at init (default: on)
  -h, --help                  Show this help
EOF
}

# =============================================================================
# 3. DOMAIN: MODULES & CONTRACTS
# =============================================================================

validate_module() {
  case "$1" in
    website|ci|ai|backend|infrastructure|harness-coding|devcontainer) : ;;
    *) print_error "unknown module '$1'. Valid: website, ci, ai, backend, infrastructure, harness-coding" ;;
  esac
}

ssr_enabled() {
  node -e "try{const a=require('$1/src/configs/app.json');process.exit(a&&a.astro&&a.astro.ssr&&a.astro.ssr.enabled===true?0:1)}catch(e){process.exit(1)}" 2>/dev/null
}

# --- Config-driven paths (walle/walle.yml is the single source of truth) -------------
# The config is real YAML but every entry is pipe-delimited, so awk alone parses it — no
# YAML runtime dep (the CLI must run as `curl | bash`).
# ponytail: purpose-built reader for our flat schema, not a general YAML parser.

# Config location: the source tree during init/update, or the copy shipped beside cli.sh
# (scripts/@walle/walle.yml) when the consumer runs `check` standalone.
walle_config() {
  if [ -n "${SOURCE_DIR:-}" ] && [ -f "${SOURCE_DIR}/walle/walle.yml" ]; then
    echo "${SOURCE_DIR}/walle/walle.yml"
  else
    echo "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)/walle.yml"
  fi
}

# Print a section's entries as TAB-separated columns (pipe fields, trimmed).
# No-op when the config isn't reachable (e.g. `check` with no resolved source).
config_section() {
  local cfg; cfg="$(walle_config)"
  [ -f "$cfg" ] || return 0
  awk -v sec="$1" '
    /^[A-Za-z_-]+:[[:space:]]*$/ { insec = ($0 ~ ("^" sec ":[[:space:]]*$")); next }
    insec && /^[[:space:]]*-[[:space:]]/ {
      line = $0; sub(/^[[:space:]]*-[[:space:]]*/, "", line)
      n = split(line, f, /[[:space:]]*\|[[:space:]]*/)
      out = f[1]; for (i = 2; i <= n; i++) out = out "\t" f[i]
      print out
    }
  ' "$cfg"
}

# devcontainer is the CLI flag name; harness-coding is the module id used in the config.
norm_module() { [ "$1" = "devcontainer" ] && echo "harness-coding" || echo "$1"; }

# Dest column (3rd field) for a section+module, space-joined on one line.
# Pure-pipe (no `while read`) so it stays exit-0 under `set -o pipefail`.
config_dests() {
  local module; module="$(norm_module "$2")"
  config_section "$1" | awk -F'\t' -v m="$module" '$1==m{print $3}' | tr '\n' ' ' | sed 's/ *$//'
}

module_managed_paths() { config_dests managed "$1"; }
module_seed_paths()    { config_dests seed "$1"; }

module_purpose() {
  case "$1" in
    website) echo "Astro site — @walle components, layouts, styles, config and CLI scripts" ;;
    ci) echo "GitHub Actions workflows (test + deploy) under @walle" ;;
    ai) echo "AI harness — generated AGENTS.md block and @walle skills" ;;
    backend) echo "API routes (requires SSR enabled in src/configs/app.json)" ;;
    infrastructure) echo "Terraform infrastructure under infrastructure/" ;;
    harness-coding|devcontainer) echo "Harness coding scaffold" ;;
    *) echo "walle module" ;;
  esac
}

# =============================================================================
# 4. RESOLUTION: VERSIONS & SOURCE
# =============================================================================

resolve_latest_tag() {
  local tags
  tags="$(git ls-remote --tags --refs "$GITHUB_WALLE_REPO" 2>/dev/null |
    sed -n 's#.*refs/tags/\(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*[-a-zA-Z0-9.]*\)$#\1#p' | sort -V)"
  [ -n "$tags" ] || return 0

  local stable
  stable="$(printf '%s\n' "$tags" | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | tail -1)"
  if [ -n "$stable" ]; then
    printf '%s\n' "$stable"
  else
    printf '%s\n' "$tags" | tail -1
  fi
}

major_of() {
  case "$1" in
    v[0-9]*) echo "${1#v}" | cut -d. -f1 ;;
    *) echo "" ;;
  esac
}

check_major_jump() {
  local cm tm
  cm="$(major_of "$1")"
  tm="$(major_of "$2")"
  [ -n "$cm" ] && [ -n "$tm" ] || return 0

  if [ "$tm" -gt "$cm" ]; then
    if [ "$ASSUME_YES" = "1" ]; then
      print_warn "Crossing a MAJOR boundary ($1 -> $2). Review CHANGELOG.md."
    else
      print_error "Update $1 -> $2 crosses a MAJOR boundary. Review CHANGELOG.md, use --yes to proceed."
    fi
  fi
}

resolve_source() {
  local source_path="$1" version="$2"
  if [ -n "$source_path" ]; then
    [ -d "$source_path" ] || print_error "source path does not exist: ${source_path}"
    SOURCE_DIR="$(cd "$source_path" && pwd)"
    WALLE_VERSION="local"
    SOURCE_REF="$SOURCE_DIR"
    print_warn "Using local source ${SOURCE_DIR}: this project is NOT on a tagged release."
  else
    if [ -z "$version" ]; then
      version="$(resolve_latest_tag)"
      [ -n "$version" ] || print_error "no published release tags found."
      print_info "Resolved latest release tag: ${version}"
    fi
    TEMP_DIR="$(mktemp -d)"
    git clone --depth 1 -b "$version" "$GITHUB_WALLE_REPO" "$TEMP_DIR" &>/dev/null ||
      print_error "failed to clone ${GITHUB_WALLE_REPO} at ${version}"
    SOURCE_DIR="$TEMP_DIR"
    WALLE_VERSION="$version"
    SOURCE_REF=""
  fi
}

# =============================================================================
# 5. FILE SYNC & MANIPULATION PRIMITIVES
# =============================================================================

sync_path() {
  local src="$1" dst="$2"
  if [ -d "$src" ]; then
    rm -rf "$dst"
    mkdir -p "$(dirname "$dst")"
    cp -r "$src" "$dst"
  elif [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
}

plan_path() {
  local src="$1" dst="$2" f rel
  [ -e "$src" ] || return 0
  if [ -d "$src" ]; then
    while IFS= read -r f; do
      rel="${f#"$src"/}"
      if [ ! -e "${dst}/${rel}" ]; then print_plan "+ ${dst}/${rel}"
      elif ! cmp -s "$f" "${dst}/${rel}"; then print_plan "~ ${dst}/${rel}"; fi
    done < <(find "$src" -type f)
    if [ -d "$dst" ]; then
      while IFS= read -r f; do
        rel="${f#"$dst"/}"
        case "$f" in *@walle/LICENSE) continue ;; esac
        [ -e "${src}/${rel}" ] || print_plan "- ${f}"
      done < <(find "$dst" -type f)
    fi
  elif [ -f "$src" ]; then
    if [ ! -e "$dst" ]; then print_plan "+ ${dst}"
    elif ! cmp -s "$src" "$dst"; then print_plan "~ ${dst}"; fi
  fi
}

seed_path() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0
  [ -e "$dst" ] && return 0
  mkdir -p "$(dirname "$dst")"
  if [ -d "$src" ]; then cp -r "$src" "$dst"
  else cp "$src" "$dst"; fi
}

plan_seed_path() {
  local src="$1" dst="$2"
  [ -e "$src" ] || return 0
  [ -e "$dst" ] && return 0
  print_plan "+ ${dst} (seed, once)"
}

inject_marker_block() {
  local target_path="$1" block_file="$2" start_marker="$3" end_marker="$4"
  if [ -f "$target_path" ] && grep -qF "$start_marker" "$target_path" && grep -qF "$end_marker" "$target_path"; then
    awk -v start="$start_marker" -v end="$end_marker" -v block="$block_file" '
      $0 == start { print; while ((getline line < block) > 0) print line; skip=1; next }
      $0 == end { print; skip=0; next }
      skip != 1 { print }
    ' "$target_path" >"${target_path}.tmp"
    mv "${target_path}.tmp" "$target_path"
  else
    mkdir -p "$(dirname "$target_path")"
    {
      [ -s "$target_path" ] && echo ""
      echo "$start_marker"
      cat "$block_file"
      echo "$end_marker"
    } >>"$target_path"
  fi
}

plan_inject_marker_block() {
  local target_path="$1" block_file="$2" start_marker="$3" end_marker="$4"
  if [ ! -f "$target_path" ] || ! grep -qF "$start_marker" "$target_path"; then
    print_plan "+ ${target_path} (walle marker block appended)"
    return 0
  fi
  local current
  current="$(awk -v s="$start_marker" -v e="$end_marker" '$0==s{f=1;next} $0==e{f=0} f' "$target_path")"
  if ! diff -q <(printf '%s\n' "$current") "$block_file" >/dev/null 2>&1; then
    print_plan "~ ${target_path} (walle marker block content)"
  fi
}

ensure_json_object_markers() {
  local target="$1"
  if [ ! -f "$target" ]; then
    mkdir -p "$(dirname "$target")"
    printf '{\n%s\n%s\n}\n' "$WALLE_START_JS" "$WALLE_END_JS" >"$target"
    return 0
  fi
  grep -qF "$WALLE_START_JS" "$target" && return 0
  WALLE_JSON_TARGET="$target" WALLE_JSON_START="$WALLE_START_JS" WALLE_JSON_END="$WALLE_END_JS" node -e '
    const fs = require("fs");
    const path = process.env.WALLE_JSON_TARGET;
    const start = process.env.WALLE_JSON_START;
    const end = process.env.WALLE_JSON_END;
    let raw = fs.readFileSync(path, "utf8");
    const idx = raw.lastIndexOf("}");
    if (idx === -1) throw new Error("not a JSON object: " + path);
    let before = raw.slice(0, idx).replace(/\s+$/, "");
    const after = raw.slice(idx);
    const needsComma = /[^{,\s]$/.test(before);
    before = before + (needsComma ? "," : "") + "\n" + start + "\n" + end + "\n";
    fs.writeFileSync(path, before + after);
  '
}

ensure_json_array_markers() {
  local target="$1" array_key="$2"
  if [ ! -f "$target" ]; then
    mkdir -p "$(dirname "$target")"
    printf '{\n  "%s": [\n%s\n%s\n  ]\n}\n' "$array_key" "$WALLE_START_JS" "$WALLE_END_JS" >"$target"
    return 0
  fi
  grep -qF "$WALLE_START_JS" "$target" && return 0
  WALLE_JSON_TARGET="$target" WALLE_JSON_KEY="$array_key" WALLE_JSON_START="$WALLE_START_JS" WALLE_JSON_END="$WALLE_END_JS" node -e '
    const fs = require("fs");
    const path = process.env.WALLE_JSON_TARGET;
    const key = process.env.WALLE_JSON_KEY;
    const start = process.env.WALLE_JSON_START;
    const end = process.env.WALLE_JSON_END;
    let raw = fs.readFileSync(path, "utf8");
    const keyIdx = raw.indexOf(`"${key}"`);
    if (keyIdx === -1) {
      const idx = raw.lastIndexOf("}");
      let before = raw.slice(0, idx).replace(/\s+$/, "");
      const after = raw.slice(idx);
      const needsComma = /[^{,\s]$/.test(before);
      before = before + (needsComma ? "," : "") + `\n  "${key}": [\n${start}\n${end}\n  ]\n`;
      fs.writeFileSync(path, before + after);
    } else {
      const arrOpen = raw.indexOf("[", keyIdx);
      const arrClose = raw.indexOf("]", arrOpen);
      let before = raw.slice(0, arrClose).replace(/\s+$/, "");
      const after = raw.slice(arrClose);
      const needsComma = /[^\[,\s]$/.test(before);
      before = before + (needsComma ? "," : "") + `\n${start}\n${end}\n  `;
      fs.writeFileSync(path, before + after);
    }
  '
}

# =============================================================================
# 6. DOMAIN SYNCING LOGIC
# =============================================================================

# Seed the starter site straight from walle/website/ (the source of truth), minus the
# paths in `website-seed-exclude` (managed zones, dev tooling) and build artifacts. Each
# file is written once (seed_path skips anything already present).
seed_from_website() {
  local src_dir="$1" tgt_dir="$2"
  local web="${src_dir}/walle/website"
  [ -d "$web" ] || print_error "missing walle/website source: ${web}"
  local had_app=0
  [ -f "${tgt_dir}/src/configs/app.json" ] && had_app=1
  local excludes; excludes="$(config_section website-seed-exclude)"
  local f rel skip e
  while IFS= read -r f; do
    rel="${f#"$web"/}"
    skip=0
    while IFS= read -r e; do
      [ -n "$e" ] || continue
      case "$rel" in "$e"|"$e"/*) skip=1; break ;; esac
    done <<EOF
${excludes}
EOF
    [ "$skip" = "1" ] && continue
    if [ "$DRY_RUN" = "1" ]; then
      plan_seed_path "$f" "${tgt_dir}/${rel}"
    else
      seed_path "$f" "${tgt_dir}/${rel}"
      record_file seed "$rel" website
    fi
  done < <(find "$web" -type f \
    -not -path '*/node_modules/*' -not -path '*/.astro/*' \
    -not -path '*/.yarn/*' -not -name 'yarn.lock')

  # app.json in website/ carries Walle's own GH-Pages deployment identity; reset it to neutral
  # defaults for a fresh consumer (only when we just created the file, never on a re-seed).
  local app="${tgt_dir}/src/configs/app.json"
  if [ "$had_app" = "0" ] && [ "$DRY_RUN" != "1" ] && [ -f "$app" ]; then
    APP_JSON="$app" node -e '
      const fs = require("fs"), p = process.env.APP_JSON;
      const c = JSON.parse(fs.readFileSync(p, "utf8"));
      if (c.astro) { c.astro.baseUrl = "http://localhost:4321"; c.astro.basePath = "/"; }
      if (c.website) { c.website.title = "My Walle Site"; }
      fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
    '
  fi
}

# harness-coding module: inject walle's blocks into files harness-coding already created,
# and seed its once-only files (justfile.project stub, .husky/ hooks). Injects/seeds run in
# update too; both are idempotent (marker-bounded / seed-once).
sync_harness_coding() {
  local src_dir="$1" tgt_dir="$2"
  [ "$HARNESS_CODING_ENABLED" = "1" ] || return 0

  if [ ! -d "${tgt_dir}/.devcontainer" ]; then
    print_warn "no .devcontainer/ at ${tgt_dir}. Run: curl -fsSL ${HARNESS_CODING_CLI_URL} | bash -s -- update --force --workspace ${tgt_dir}"
  fi

  run_injects "$src_dir" "$tgt_dir" harness-coding
  seed_module_files "$src_dir" "$tgt_dir" harness-coding
}

generate_agents_block() {
  local src_dir="$1"
  local preamble="${src_dir}/walle/ai/agents.block.md"
  [ -f "$preamble" ] || print_error "missing AGENTS preamble source: ${preamble}"

  cat "$preamble"
  echo -e "\n### Active walle modules\n"

  for m in ${AGENTS_MODULES}; do
    echo "- **${m}** — $(module_purpose "$m")"
    local managed seed
    managed="$(module_managed_paths "$m")"
    seed="$(module_seed_paths "$m")"
    [ -n "$managed" ] && echo "  - Managed: $(echo "$managed" | sed 's/ /, /g')"
    [ -n "$seed" ] && echo "  - Seeded once: $(echo "$seed" | sed 's/ /, /g')"
  done

  if [ "${HARNESS_CODING_ENABLED:-0}" = "1" ]; then
    echo "- **harness-coding** — $(module_purpose "devcontainer")"
    local m_dc s_dc
    m_dc="$(module_managed_paths "devcontainer")"
    s_dc="$(module_seed_paths "devcontainer")"
    [ -n "$m_dc" ] && echo "  - Managed: $(echo "$m_dc" | sed 's/ /, /g')"
    [ -n "$s_dc" ] && echo "  - Seeded once: $(echo "$s_dc" | sed 's/ /, /g')"
  fi

  echo -e "\n### Working with walle\n"
  echo "- Managed \`@walle/\` zones are regenerated by the CLI."
  echo "- Update: \`just walle-update\`."
  echo "- Add: \`just walle add <module>\`."
  echo "- Validate: \`just walle-check\`."
}

sync_agents_marker() {
  local src_dir="$1" tgt_dir="$2"
  local block_file
  block_file="$(mktemp)"
  generate_agents_block "$src_dir" >"$block_file"

  if [ "$DRY_RUN" = "1" ]; then
    plan_inject_marker_block "${tgt_dir}/AGENTS.md" "$block_file" "$WALLE_START" "$WALLE_END"
  else
    inject_marker_block "${tgt_dir}/AGENTS.md" "$block_file" "$WALLE_START" "$WALLE_END"
    print_info "AGENTS.md walle block synced."
  fi
  rm -f "$block_file"
}

# MANAGED: overwrite each of a module's src→dest mappings from the config.
sync_managed_map() {
  local src_dir="$1" tgt_dir="$2" module="$3" mod src dest
  while IFS=$'\t' read -r mod src dest; do
    [ "$mod" = "$module" ] || continue
    if [ "$DRY_RUN" = "1" ]; then
      plan_path "${src_dir}/walle/${src}" "${tgt_dir}/${dest}"
    else
      sync_path "${src_dir}/walle/${src}" "${tgt_dir}/${dest}"
      record_file managed "$dest" "$module"
      if [ -d "${tgt_dir}/${dest}" ] && [[ "$dest" == *"@walle"* ]] && [ -f "${src_dir}/LICENSE" ]; then
        cp "${src_dir}/LICENSE" "${tgt_dir}/${dest}/LICENSE"
      fi
    fi
  done < <(config_section managed)
}

# SEED: write a module's once-only files from the config (skips anything present).
seed_module_files() {
  local src_dir="$1" tgt_dir="$2" module="$3" mod src dest
  while IFS=$'\t' read -r mod src dest; do
    [ "$mod" = "$module" ] || continue
    if [ "$DRY_RUN" = "1" ]; then
      plan_seed_path "${src_dir}/walle/${src}" "${tgt_dir}/${dest}"
    else
      seed_path "${src_dir}/walle/${src}" "${tgt_dir}/${dest}"
      record_file seed "$dest" "$module"
    fi
  done < <(config_section seed)
}

# One-time migration: older consumers had a separate walle.justfile + import line.
migrate_legacy_justfile() {
  local tgt_dir="$1"
  local tgt="${tgt_dir}/justfile.project" old="${tgt_dir}/walle.justfile"
  local imp="import 'walle.justfile'"
  [ "$DRY_RUN" = "1" ] && return 0
  if [ -f "$old" ]; then rm -f "$old"; print_info "removed legacy walle.justfile."; fi
  if [ -f "$tgt" ] && grep -qF "$imp" "$tgt"; then
    sed -i.bak "\#^${imp}\$#d" "$tgt" && rm -f "${tgt}.bak"
  fi
}

# INJECT: apply one marker-bounded block. `kind` picks the marker style and any JSON
# scaffolding; `agents` is the generated AGENTS.md block rather than a copied file.
apply_inject() {
  local src_dir="$1" tgt_dir="$2" src="$3" dest="$4" kind="$5" module="$6"
  local tgt="${tgt_dir}/${dest}"

  if [ "$kind" = "agents" ]; then
    sync_agents_marker "$src_dir" "$tgt_dir"
    [ "$DRY_RUN" = "1" ] || record_file inject "$dest" "$module"
    return 0
  fi

  local blk="${src_dir}/walle/${src}" start end
  case "$kind" in
    sh)                    start="$WALLE_START_SH"; end="$WALLE_END_SH" ;;
    json-object|json-array:*) start="$WALLE_START_JS"; end="$WALLE_END_JS" ;;
    *) print_error "unknown inject kind '${kind}' for ${dest}" ;;
  esac

  if [ "$DRY_RUN" = "1" ]; then
    plan_inject_marker_block "$tgt" "$blk" "$start" "$end"
  else
    case "$kind" in
      json-object)  ensure_json_object_markers "$tgt" ;;
      json-array:*) ensure_json_array_markers "$tgt" "${kind#json-array:}" ;;
    esac
    inject_marker_block "$tgt" "$blk" "$start" "$end"
    record_file inject "$dest" "$module"
  fi
}

run_injects() {
  local src_dir="$1" tgt_dir="$2" module="$3" mod src dest kind
  while IFS=$'\t' read -r mod src dest kind; do
    [ "$mod" = "$module" ] || continue
    apply_inject "$src_dir" "$tgt_dir" "$src" "$dest" "$kind" "$module"
  done < <(config_section inject)
}

sync_module() {
  local src_dir="$1" tgt_dir="$2" mod="$3"
  sync_managed_map "$src_dir" "$tgt_dir" "$mod"
  [ "$SEED_ENABLED" = "1" ] && seed_module_files "$src_dir" "$tgt_dir" "$mod"
  [ "$mod" = "website" ] && migrate_legacy_justfile "$tgt_dir"
  run_injects "$src_dir" "$tgt_dir" "$mod"
  [ "$DRY_RUN" = "1" ] || print_info "Module '${mod}' synced."
}

# Establish the harness-coding base (real justfile with markers, justfile.tooling,
# .devcontainer/*, .pre-commit-config.yaml, AGENTS.md base block) BEFORE walle seeds and
# injects. Walle owns none of these — it only injects its own blocks into files harness-coding
# already created. Runs harness-coding's own CLI so the base is always current, not a stale
# copy vendored here. Override the source with WALLE_HARNESS_CODING_CLI (path to a local
# cli.sh) for offline/e2e runs; defaults to fetching main over the network.
establish_harness_coding_base() {
  local tgt_dir="$1"
  [ "$HARNESS_CODING_ENABLED" = "1" ] || return 0

  if [ "$DRY_RUN" = "1" ]; then
    print_plan "run harness-coding update --force (establishes justfile, .devcontainer/, base files)"
    return 0
  fi

  print_info "Establishing harness-coding base (justfile, .devcontainer/, hooks)..."
  local local_cli="${WALLE_HARNESS_CODING_CLI:-}"
  if [ -n "$local_cli" ]; then
    [ -f "$local_cli" ] || print_error "WALLE_HARNESS_CODING_CLI not a file: ${local_cli}"
    bash "$local_cli" update --force --workspace "$tgt_dir" ||
      print_error "harness-coding base setup failed"
  else
    command -v curl >/dev/null 2>&1 ||
      print_error "curl required to fetch harness-coding base (or set WALLE_HARNESS_CODING_CLI)"
    curl -fsSL "$HARNESS_CODING_CLI_URL" | bash -s -- update --force --workspace "$tgt_dir" ||
      print_error "harness-coding base setup failed"
  fi
}

run_init_sync() {
  local src_dir="$1" tgt_dir="$2"; shift 2
  local mods=("$@")
  establish_harness_coding_base "$tgt_dir"
  seed_from_website "$src_dir" "$tgt_dir"
  for m in "${mods[@]}"; do sync_module "$src_dir" "$tgt_dir" "$m"; done
  sync_harness_coding "$src_dir" "$tgt_dir"
}

# =============================================================================
# 7. MANIFEST & CONFIGURATIONS
# =============================================================================

# Writes .walle/manifest.json. The `files` map records every path walle wrote, grouped by
# class (managed | seed | inject) → module — same idea as harness-coding's manifest. Node
# assembles the JSON from the FILES_LOG the sync functions accumulate (single parser: awk
# reads the config, node only groups what was recorded).
write_manifest() {
  local tgt_dir="$1" name="$2"; shift 2
  local mods=("$@")
  mkdir -p "${tgt_dir}/.walle"
  WM_NAME="$name" \
  WM_VERSION="$WALLE_VERSION" \
  WM_REF="${SOURCE_REF:-}" \
  WM_MODULES="${mods[*]}" \
  WM_DC="$([ "$HARNESS_CODING_ENABLED" = "1" ] && echo true || echo false)" \
  WM_FILES="${FILES_LOG:-}" \
  WM_OUT="${tgt_dir}/.walle/manifest.json" \
  WM_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  node -e '
    const fs = require("fs");
    const files = { managed: {}, seed: {}, inject: {} };
    // Preload from an existing manifest so `add` (which only re-syncs one module) keeps the
    // other modules files entries; update re-syncs everything, so it self-heals.
    try {
      const prev = JSON.parse(fs.readFileSync(process.env.WM_OUT, "utf8")).files || {};
      for (const c of ["managed", "seed", "inject"]) Object.assign(files[c], prev[c] || {});
    } catch (_) {}
    const log = process.env.WM_FILES;
    if (log && fs.existsSync(log)) {
      for (const line of fs.readFileSync(log, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const [cat, dest, mod] = line.split("\t");
        if (files[cat]) files[cat][dest] = mod;
      }
    }
    const m = {
      "$schema": "../schemas/walle.config.schema.json",
      schemaVersion: 2,
      name: process.env.WM_NAME,
      walleVersion: process.env.WM_VERSION,
      ...(process.env.WM_REF ? { sourceRef: process.env.WM_REF } : {}),
      modules: process.env.WM_MODULES.split(" ").filter(Boolean),
      devcontainer: { enabled: process.env.WM_DC === "true" },
      files,
      updatedAt: process.env.WM_DATE,
    };
    fs.writeFileSync(process.env.WM_OUT, JSON.stringify(m, null, 2) + "\n");
  '
  print_info "Manifest written: ${tgt_dir}/.walle/manifest.json"
}

write_lock() {
  mkdir -p "${1}/.walle"
  printf '%s\n' "${SOURCE_REF:-$WALLE_VERSION}" >"${1}/.walle/lock"
}

# Human-readable consumer config. Lists the enabled modules explicitly (mirrors the manifest,
# which stays authoritative for `update`) plus the editable `docs` toggle. Refreshed on
# init/update; a `docs:` value the user changed is preserved.
write_walle_config_yml() {
  local tgt_dir="$1"; shift
  local mods=("$@") tgt="${tgt_dir}/.walle/config.yml"
  mkdir -p "${tgt_dir}/.walle"
  local docs="true"
  [ -f "$tgt" ] && grep -Eq '^docs:[[:space:]]*false' "$tgt" && docs="false"
  {
    echo "# Walle consumer config. Modules mirror .walle/manifest.json (authoritative)."
    echo "# Add/remove modules with 'walle add <module>' or the init flags, not by hand."
    echo "modules:"
    local m; for m in "${mods[@]}"; do echo "  - ${m}"; done
    echo "# Copy the walle wiki into .walle/docs/ on update. Set false to skip."
    echo "docs: ${docs}"
  } >"$tgt"
}

walle_docs_enabled() {
  local cfg="${1}/.walle/config.yml"
  [ -f "$cfg" ] || return 0
  grep -Eq '^docs:[[:space:]]*false[[:space:]]*$' "$cfg" && return 1
  return 0
}

sync_walle_docs() {
  local src_dir="$1" tgt_dir="$2"
  walle_docs_enabled "$tgt_dir" || return 0
  for f in cli.md modules.md managed-vs-seed.md versioning.md; do
    if [ "$DRY_RUN" = "1" ]; then plan_path "${src_dir}/wiki/${f}" "${tgt_dir}/.walle/docs/${f}"
    else sync_path "${src_dir}/wiki/${f}" "${tgt_dir}/.walle/docs/${f}"; fi
  done
}

migrate_walle_config() {
  local old="${1}/.walle.config.json"
  [ -f "$old" ] || return 0
  mkdir -p "${1}/.walle"
  if [ "$DRY_RUN" = "1" ]; then
    print_plan "~ ${1}/.walle/manifest.json (migrated)"
    print_plan "- ${old}"
  else
    cp "$old" "${1}/.walle/manifest.json"
    rm -f "$old"
    print_info "migrated ${old} -> .walle/manifest.json"
  fi
}

manifest_field() {
  node -e "const m=require('$1');process.stdout.write(String(m['$2']??''))" 2>/dev/null || true
}

read_manifest() {
  local manifest="$1"
  [ -f "$manifest" ] || print_error "no .walle/manifest.json found at ${manifest}"

  local sv; sv="$(manifest_field "$manifest" schemaVersion)"
  [ "$sv" = "2" ] || print_error "manifest predates schemaVersion 2. No files changed."

  MF_NAME="$(manifest_field "$manifest" name)"
  MF_VERSION="$(manifest_field "$manifest" walleVersion)"
  MF_MODULES="$(node -e "const m=require('$manifest');process.stdout.write((m.modules||[]).join(' '))" 2>/dev/null)"

  [ -n "$MF_MODULES" ] || print_error "manifest declares no modules"
  MF_HARNESS_CODING_ENABLED="$(node -e "try{const m=require('$manifest');process.stdout.write(m.devcontainer?.enabled!==false?'1':'0')}catch(e){process.stdout.write('1')}" 2>/dev/null || echo "1")"
}

# =============================================================================
# 8. CLI COMMAND HANDLERS
# =============================================================================

cmd_init() {
  local PROJ_NAME="" DIR_PATH MODULES_CSV="website,ai,ci" SRC_PATH="" VER=""
  local no_ai=0 no_ci=0
  DIR_PATH="$(pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -n|--project-name)  PROJ_NAME="$2"; shift 2 ;;
      -d|--dir-path)      DIR_PATH="$2"; shift 2 ;;
      -m|--modules)       MODULES_CSV="$2"; shift 2 ;;
      -s|--source)        SRC_PATH="$2"; shift 2 ;;
      -w|--walle-version) VER="$2"; shift 2 ;;
      --dry-run)          DRY_RUN=1; shift ;;
      --yes)              ASSUME_YES=1; shift ;;
      --no-harness-coding)HARNESS_CODING_ENABLED=0; shift ;;
      --no-ai)            no_ai=1; shift ;;
      --no-ci)            no_ci=1; shift ;;
      -h|--help)          usage; exit 0 ;;
      *)                  usage; print_error "unknown option: $1" ;;
    esac
  done

  local _raw_mods; IFS=',' read -ra _raw_mods <<<"$MODULES_CSV"
  local mods=() has_web=0

  for m in "${_raw_mods[@]}"; do
    validate_module "$m"
    [ "$m" = "website" ] && has_web=1
    if [ "$m" = "devcontainer" ]; then HARNESS_CODING_ENABLED=1; continue; fi
    [ "$m" = "ai" ] && [ "$no_ai" = "1" ] && continue
    [ "$m" = "ci" ] && [ "$no_ci" = "1" ] && continue
    mods+=("$m")
  done

  [ "$has_web" = "1" ] || print_error "'website' is a mandatory module"

  AGENTS_MODULES="${mods[*]}"
  SEED_ENABLED=1
  resolve_source "$SRC_PATH" "$VER"

  local proj_dir
  if [ -n "$PROJ_NAME" ]; then proj_dir="${DIR_PATH%/}/${PROJ_NAME}"
  else proj_dir="${DIR_PATH%/}"; PROJ_NAME="$(basename "$proj_dir")"; fi

  local adopt=0
  if [ -e "$proj_dir" ]; then
    { [ -f "${proj_dir}/.walle/manifest.json" ] || [ -f "${proj_dir}/.walle.config.json" ]; } &&
      print_error "already a walle project. Use update or add."
    adopt=1
  fi

  if [ "$DRY_RUN" = "1" ]; then
    print_plan "init plan for '${PROJ_NAME}'"
    run_init_sync "$SOURCE_DIR" "$proj_dir" "${mods[@]}"
    sync_walle_docs "$SOURCE_DIR" "$proj_dir"
    print_info "Dry-run: no files written."
    return 0
  fi

  if [ "$adopt" = "1" ] && [ "$ASSUME_YES" != "1" ]; then
    print_warn "target directory exists. Proceed with adoption? [y/N] "
    read -r reply || true
    [[ ! "$reply" =~ ^[Yy](es)?$ ]] && print_error "aborted"
  fi

  mkdir -p "$proj_dir"
  print_info "Scaffolding ${PROJ_NAME}..."
  FILES_LOG="$(mktemp)"
  run_init_sync "$SOURCE_DIR" "$proj_dir" "${mods[@]}"
  write_manifest "$proj_dir" "$PROJ_NAME" "${mods[@]}"
  write_walle_config_yml "$proj_dir" "${mods[@]}"
  sync_walle_docs "$SOURCE_DIR" "$proj_dir"
  write_lock "$proj_dir"
  print_info "Project ${PROJ_NAME} initialized."
}

cmd_update() {
  local PROJ_PATH SRC_PATH="" VER=""
  PROJ_PATH="$(pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -p|--project-path)  PROJ_PATH="$2"; shift 2 ;;
      -s|--source)        SRC_PATH="$2"; shift 2 ;;
      -w|--walle-version) VER="$2"; shift 2 ;;
      --dry-run)          DRY_RUN=1; shift ;;
      --yes)              ASSUME_YES=1; shift ;;
      -h|--help)          usage; exit 0 ;;
      *)                  usage; print_error "unknown option: $1" ;;
    esac
  done

  migrate_walle_config "$PROJ_PATH"
  local manifest="${PROJ_PATH}/.walle/manifest.json"
  [ -f "$manifest" ] || manifest="${PROJ_PATH}/.walle.config.json"

  read_manifest "$manifest"
  local mods; read -ra mods <<<"$MF_MODULES"
  for m in "${mods[@]}"; do validate_module "$m"; done

  AGENTS_MODULES="${mods[*]}"
  HARNESS_CODING_ENABLED="$MF_HARNESS_CODING_ENABLED"

  resolve_source "$SRC_PATH" "$VER"
  check_major_jump "$MF_VERSION" "$WALLE_VERSION"

  if [ "$DRY_RUN" = "1" ]; then
    print_plan "update plan for '${MF_NAME}' (${MF_VERSION} -> ${WALLE_VERSION})"
    for m in "${mods[@]}"; do sync_module "$SOURCE_DIR" "$PROJ_PATH" "$m"; done
    sync_harness_coding "$SOURCE_DIR" "$PROJ_PATH"
    sync_walle_docs "$SOURCE_DIR" "$PROJ_PATH"
    return 0
  fi

  print_info "Updating ${MF_NAME}..."
  FILES_LOG="$(mktemp)"
  for m in "${mods[@]}"; do sync_module "$SOURCE_DIR" "$PROJ_PATH" "$m"; done
  sync_harness_coding "$SOURCE_DIR" "$PROJ_PATH"
  write_manifest "$PROJ_PATH" "$MF_NAME" "${mods[@]}"
  write_walle_config_yml "$PROJ_PATH" "${mods[@]}"
  sync_walle_docs "$SOURCE_DIR" "$PROJ_PATH"
  write_lock "$PROJ_PATH"
  print_info "Project updated."
}

cmd_add() {
  local PROJ_PATH SRC_PATH="" VER="" NEW_MOD=""
  PROJ_PATH="$(pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -p|--project-path)  PROJ_PATH="$2"; shift 2 ;;
      -s|--source)        SRC_PATH="$2"; shift 2 ;;
      -w|--walle-version) VER="$2"; shift 2 ;;
      --dry-run)          DRY_RUN=1; shift ;;
      -h|--help)          usage; exit 0 ;;
      -*)                 usage; print_error "unknown option: $1" ;;
      *)                  NEW_MOD="$1"; shift ;;
    esac
  done

  [ -n "$NEW_MOD" ] || print_error "module required"
  validate_module "$NEW_MOD"

  SEED_ENABLED=1
  read_manifest "${PROJ_PATH}/.walle/manifest.json"

  local mods; read -ra mods <<<"$MF_MODULES"
  HARNESS_CODING_ENABLED="$MF_HARNESS_CODING_ENABLED"
  resolve_source "$SRC_PATH" "$VER"

  if [ "$NEW_MOD" = "devcontainer" ]; then
    HARNESS_CODING_ENABLED=1
    if [ "$DRY_RUN" = "1" ]; then
      print_plan "add plan: devcontainer"
      return 0
    fi
    FILES_LOG="$(mktemp)"
    sync_harness_coding "$SOURCE_DIR" "$PROJ_PATH"
    write_manifest "$PROJ_PATH" "$MF_NAME" "${mods[@]}"
    print_info "devcontainer added."
    return 0
  fi

  local present=0
  for m in "${mods[@]}"; do [ "$m" = "$NEW_MOD" ] && present=1; done
  [ "$present" = "1" ] && print_info "'${NEW_MOD}' already declared — re-syncing."

  if [ "$DRY_RUN" = "1" ]; then
    print_plan "add plan: '${NEW_MOD}'"
    return 0
  fi

  FILES_LOG="$(mktemp)"
  sync_module "$SOURCE_DIR" "$PROJ_PATH" "$NEW_MOD"
  [ "$present" = "1" ] || mods+=("$NEW_MOD")

  write_manifest "$PROJ_PATH" "$MF_NAME" "${mods[@]}"
  write_walle_config_yml "$PROJ_PATH" "${mods[@]}"
  print_info "Module '${NEW_MOD}' added."

  if [ "$NEW_MOD" = "backend" ] && ! ssr_enabled "$PROJ_PATH"; then
    print_warn "backend requires SSR in src/configs/app.json"
  fi
}

cmd_check() {
  local PROJ_PATH SRC_PATH="" VERB=0
  PROJ_PATH="$(pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -p|--project-path) PROJ_PATH="$2"; shift 2 ;;
      -s|--source)       SRC_PATH="$2"; shift 2 ;;
      -v|--verbose)      VERB=1; shift ;;
      -h|--help)         usage; exit 0 ;;
      *)                 usage; print_error "unknown option: $1" ;;
    esac
  done

  local manifest="${PROJ_PATH}/.walle/manifest.json"
  read_manifest "$manifest"
  print_info "✓ manifest present (${MF_NAME})"

  case "$MF_VERSION" in
    local|v[0-9]*.[0-9]*.[0-9]*) print_info "✓ walleVersion pinned: ${MF_VERSION}" ;;
    *) print_error "walleVersion '${MF_VERSION}' invalid" ;;
  esac

  # Version Check
  if [ "$MF_VERSION" != "local" ]; then
    local _lat; _lat="$(resolve_latest_tag 2>/dev/null || true)"
    if [ -n "$_lat" ] && [ "$_lat" != "$MF_VERSION" ]; then
      print_warn "version ${MF_VERSION} pinned; latest published is ${_lat}"
    elif [ -n "$_lat" ]; then
      print_info "✓ version up to date"
    fi
  fi

  # Manifest Validation
  if [ -d "${PROJ_PATH}/node_modules/ajv" ]; then
    node -e "
      const Ajv=require('${PROJ_PATH}/node_modules/ajv').default||require('${PROJ_PATH}/node_modules/ajv');
      const af=require('${PROJ_PATH}/node_modules/ajv-formats').default||require('${PROJ_PATH}/node_modules/ajv-formats');
      const ajv=new Ajv({strict:false}); af(ajv);
      const v=ajv.compile(require('${PROJ_PATH}/schemas/walle.config.schema.json'));
      if(!v(require('${manifest}'))){console.error(v.errors);process.exit(1);}
    " || print_error "manifest failed validation"
    print_info "✓ manifest valid"
  else
    print_warn "skipping schema validation (missing ajv)"
  fi

  # SEED & Missing Checks
  for _m in $MF_MODULES; do
    for _r in $(module_seed_paths "$_m"); do
      [ -e "${PROJ_PATH}/${_r}" ] && print_info "· seed present: ${_r}" || print_info "· seed absent: ${_r}"
    done
  done

  if [ "$MF_HARNESS_CODING_ENABLED" = "1" ]; then
    for _r in $(module_seed_paths "devcontainer"); do
      [ -e "${PROJ_PATH}/${_r}" ] && print_info "· seed present: ${_r}" || print_warn "· seed missing: ${_r}"
    done
  fi

  print_info "check passed."
}

# =============================================================================
# 9. ENTRY POINT
# =============================================================================

main() {
  local cmd="" args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      init|update|add|check) cmd="$1"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) args+=("$1"); shift ;;
    esac
  done

  [ -n "$cmd" ] || { usage; print_error "no command given"; }

  "cmd_${cmd}" "${args[@]}"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
