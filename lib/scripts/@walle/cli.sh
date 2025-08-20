#!/usr/bin/env bash

set -Ee
set -o pipefail
set -o functrace

trap 'catch $? $LINENO ${BASH_SOURCE[0]}' EXIT
catch() {
  if [ "$1" != "0" ]; then
    echo "[ERROR] in $(basename "$3") at line $2 (error code $1)"
  fi
  if [ -d "${TEMP_DIR}" ]; then
    rm -rf "${TEMP_DIR}"
  fi
}

SCRIPT_PATH="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
PROJECT_ROOT="${SCRIPT_PATH%%/lib/*}"

usage_init() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -h, --help                    Show this help message"
  echo "  -n, --project-name <name>     Specify the project name (Required)"
  echo "  -d, --dir-path <path>         Specify the directory path for the project (Defaults to current directory)"
  echo
}

usage_update() {
  echo "Usage: $0 update [options]"
  echo
  echo "Options:"
  echo "  -h, --help                    Show this help message"
  echo "  -s, --source-version <version> Specify the source version to update from (Defaults to 'main')"
  echo "  -p, --project-path <path>     Specify the project path to update (Defaults to current directory)"
  echo
}

print_info() {
  echo -e " [INFO] ${*}"
}

print_error() {
  echo -e " [ERROR] ${*}"
  exit 1
}

GITHUB_WALLE_REPO="https://github.com/FabrizioCafolla/walle-design-system"
GITHUB_WALLE_VERSION_BRANCH="main"
GITHUB_WALLE_VERSION_SHA="" # Is set during the download process
TEMP_DIR="$(mktemp -d)"

function download_project() {
  local dir_path="$1"
  local source_version="${2:-main}"

  if [ -z "${dir_path}" ]; then
    print_error "Directory path is required for downloading the project."
  fi

  # Download the project from GitHub
  git clone -b "${source_version}" "${GITHUB_WALLE_REPO}" "${dir_path}" &> /dev/null
  if [ $? -ne 0 ]; then
    print_error "Failed to download the project from ${GITHUB_WALLE_REPO}."
  fi

  cd "${dir_path}"
  local sha
  sha=$(git rev-parse --short HEAD)
  export GITHUB_WALLE_VERSION_SHA="${sha}"
  cd -
}

function create_project_directory() {
  local project_name="$1"

  if [ -z "$project_name" ]; then
    print_error "Project name is required."
  fi

  mkdir -p "$project_name" || print_error "Failed to create project directory: $project_name"
}

function create_config_file() {
  local project_name="$1"
  local config_filepath="${2:-"."}/.walle.config.json"
  local source_version="${3-main}"

  # Create a configuration file with project details
  echo "{
  \"name\": \"${project_name}\",
  \"walleVersion\": \"${source_version}\",
  \"updatedAt\": \"$(date +%Y-%m-%dT%H:%M:%S)\"
}" >"${config_filepath}" || print_error "Failed to create configuration file: ${config_filepath}"

  print_info "Configuration file updated ${config_filepath}"
}

function sync_files() {
  local source_path="$1"
  local target_path="$2"

  if [ -z "$source_path" ] || [ -z "$target_path" ]; then
    print_error "Source and target paths are required for synchronization."
  fi

  if [ -d "$source_path" ]; then
    # Remove existing target directory if it exists
    if [ -d "${target_path}" ]; then
      rm -rf "${target_path}"
    fi

    if [ $? -ne 0 ]; then
      print_error "Failed to create parent directory for: $target_path"
    fi

    # Copy the entire directory
    cp -r "${source_path}" "${target_path}"
  elif [ -f "$source_path" ]; then
    # Create parent directory if it doesn't exist
    rm -f "${target_path}" || true
    cp "${source_path}" "${target_path}"
  else
    print_error "Error synchronizing files from $source_path to $target_path."
  fi

  print_info "Synchronized from ${source_path} to ${target_path}."
}
function sync_walle_files() {
  local temp_dir="$1"
  local project_name="$2"

  sync_files "${temp_dir}/.devcontainer/@walle" "${project_name}/.devcontainer/@walle"
  sync_files "${temp_dir}/.vscode" "${project_name}/.vscode"
  sync_files "${temp_dir}/lib/infrastructure/@walle" "${project_name}/lib/infrastructure/@walle"
  sync_files "${temp_dir}/lib/scripts/@walle" "${project_name}/lib/scripts/@walle"
  sync_files "${temp_dir}/lib/website/src/@walle" "${project_name}/lib/website/src/@walle"
  sync_files "${temp_dir}/.github/workflows/actions" "${project_name}/.github/workflows/actions"
  sync_files "${temp_dir}/walle.justfile" "${project_name}/walle.justfile"
}

function init() {
  local PROJECT_NAME DIR_PATH

  DIR_PATH="$(pwd)" # Default to current directory

  while [[ $# -gt 0 ]]; do
    case "$1" in
    -n | --project-name)
      PROJECT_NAME="${2}"
      shift 2
      ;;
    -d | --dir-path)
      DIR_PATH="${2}"
      shift 2
      ;;
    -h | --help)
      usage_init
      exit 0
      ;;
    *)
      usage_init
      print_error "Unknown command: $1"
      ;;
    esac
  done

  if [ -z "${PROJECT_NAME}" ]; then
    print_error "Project name is required for initialization."
  fi

  if [ ! -d "${DIR_PATH}" ]; then
    mkdir -p "${DIR_PATH}"
  fi
  print_info "Start initialize project ${PROJECT_PATH} to version in ${DIR_PATH} directory."

  download_project "${DIR_PATH}/${PROJECT_NAME}"
  create_config_file "${PROJECT_NAME}" "${DIR_PATH}/${PROJECT_NAME}"

  print_info "Project ${PROJECT_NAME} initialized successfully in ${DIR_PATH} directory."
}

function update() {
  local PROJECT_PATH

  PROJECT_PATH="$(pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
    -w | --walle-version)
      export GITHUB_WALLE_VERSION_BRANCH="${2}"
      shift 2
      ;;
    -p | --project-path)
      PROJECT_PATH="${2}"
      shift 2
      ;;
    -h | --help)
      usage_init
      exit 0
      ;;
    *)
      usage_update
      print_error "Unknown command: $1"
      ;;
    esac
  done

  if [ -z "${GITHUB_WALLE_VERSION_BRANCH}" ]; then
    print_error "Source version is required for update."
  fi

  if [ ! -d "${PROJECT_PATH}" ]; then
    print_error "Project path does not exist: ${PROJECT_PATH}"
  fi

  print_info "Start update project in ${PROJECT_PATH} to version ${GITHUB_WALLE_VERSION_BRANCH}"

  download_project "${TEMP_DIR}" "${GITHUB_WALLE_VERSION_BRANCH}"
  sync_walle_files "${TEMP_DIR}" "${PROJECT_PATH}"
  create_config_file "$(basename "${PROJECT_PATH}")" "${PROJECT_PATH}" "${GITHUB_WALLE_VERSION_SHA}"

  print_info "Project updated successfully"
}

main() {
  local command
  local args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
    init)
      command="init"
      shift
      ;;
    update)
      command="update"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      args+=("$1")
      shift
      ;;
    esac
  done

  cd "${PROJECT_ROOT}" || print_error "Failed to change directory to ${PROJECT_ROOT}"

  if ! ${command} "${args[@]}"; then
    print_error "Command '$command' failed."
  fi

  rm -rf "${TEMP_DIR}"
}

main "$@"
