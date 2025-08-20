#!/bin/bash
set -eE -o functrace

failure() {
  local lineno=$1
  local msg=$2
  echo "Failed at $lineno: $msg"
}
trap 'failure ${LINENO} "$BASH_COMMAND"' ERR

set -o pipefail

SCRIPT_PATH="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
ROOT_PATH="${SCRIPT_PATH%%/lib/*}"

clean() {
  echo "[INFO] Cleaning up temporary files"
  rm -rf "${ROOT_PATH}/lib/tmp/source"
}

convert_json_to_md() {
  local json_file="$1"

  local name=$(jq -r '.name // ""' "${json_file}")
  local filename=$(jq -r '.metadata.filename // ""' "${json_file}")
  local created_at=$(jq -r '.metadata.created_at // ""' "${json_file}")

  local md_file="${ROOT_PATH}/lib/database/projects/$(basename "${filename}" .json).md"

  echo "[INFO] Converting ${json_file} to ${md_file}"

  # Extract values from JSON using jq
  echo "---" >"${md_file}"

  # Handle basic properties
  description=$(jq -r '.description // ""' "${json_file}")
  category=$(jq -r '.category // ""' "${json_file}")
  country=$(jq -r '.country // ""' "${json_file}")

  echo "name: ${name}" >>"${md_file}"
  echo "description: ${description}" >>"${md_file}"

  # Handle tags array
  if jq -e '.tags' "${json_file}" >/dev/null 2>&1; then
    tags=$(jq -r '.tags | join(", ")' "${json_file}")
    echo "tags: ${tags}" >>"${md_file}"
  fi

  echo "category: ${category}" >>"${md_file}"
  echo "country: ${country}" >>"${md_file}"

  # Handle source object
  echo "source:" >>"${md_file}"
  platform=$(jq -r '.source.platform // ""' "${json_file}")
  url_repository=$(jq -r '.source.url_repository // ""' "${json_file}")
  url_documentation=$(jq -r '.source.url_documentation // ""' "${json_file}")
  license=$(jq -r '.source.license // ""' "${json_file}")
  language=$(jq -r '.source.language // ""' "${json_file}")

  echo "  platform: ${platform}" >>"${md_file}"
  echo "  url_repository: ${url_repository}" >>"${md_file}"

  if [[ "${url_documentation}" != "null" && -n "${url_documentation}" ]]; then
    echo "  url_documentation: ${url_documentation}" >>"${md_file}"
  fi

  echo "  license: ${license}" >>"${md_file}"
  echo "  language: ${language}" >>"${md_file}"

  # Handle owner object if it exists
  if jq -e '.owner' "${json_file}" >/dev/null 2>&1; then
    echo "owner:" >>"${md_file}"
    owner_name=$(jq -r '.owner.name // ""' "${json_file}")
    owner_type=$(jq -r '.owner.type // ""' "${json_file}")
    owner_description=$(jq -r '.owner.description // ""' "${json_file}")
    owner_url=$(jq -r '.owner.url_website // ""' "${json_file}")
    is_startup=$(jq -r '.owner.is_a_startup // ""' "${json_file}")

    echo "  name: ${owner_name}" >>"${md_file}"
    echo "  type: ${owner_type}" >>"${md_file}"

    if [[ "${owner_description}" != "null" && -n "${owner_description}" ]]; then
      echo "  description: ${owner_description}" >>"${md_file}"
    fi

    if [[ "${owner_url}" != "null" && -n "${owner_url}" ]]; then
      echo "  url_website: ${owner_url}" >>"${md_file}"
    fi

    if [[ "${is_startup}" != "null" && -n "${is_startup}" ]]; then
      echo "  is_a_startup: ${is_startup}" >>"${md_file}"
    fi

    # Handle owner tags if they exist
    if jq -e '.owner.tags' "${json_file}" >/dev/null 2>&1; then
      owner_tags=$(jq -r '.compownerany.tags | join(", ")' "${json_file}")
      echo "  tags: ${owner_tags}" >>"${md_file}"
    fi
  fi

  # Handle metadata object
  echo "metadata:" >>"${md_file}"
  echo "  filename: ${filename}" >>"${md_file}"
  echo "  created_at: ${created_at}" >>"${md_file}"

  echo "---" >>"${md_file}"

  # Remove the original JSON file
  rm "${json_file}"
}

main() {
  echo "[INFO] Download awesome-european-opensource data"
  cd "${ROOT_PATH}"

  local tmp_dir="lib/tmp"
  local database_dir="lib/database"

  rm -rf "${tmp_dir}"
  rm -rf "${database_dir}"
  mkdir -p "${database_dir}"

  local arg_commit_sha="${1:-"main"}"
  local arg_source="${2:-"https://github.com/European-OpenSource/awesome-european-opensource"}"

  git clone -b "${arg_commit_sha}" "${arg_source}" "${tmp_dir}"

  # Move files from awesome directory to database directory
  mv "${tmp_dir}/awesome/"* "${database_dir}/"

  # Convert JSON files to Markdown
  echo "[INFO] Converting JSON files to Markdown format"
  find "${database_dir}" -name "*.json" -type f | while read -r json_file; do
    convert_json_to_md "${json_file}"
  done

  rm -Rf lib/website/src/content/project
  mv "${database_dir}"/* lib/website/src/content/project/
  rm -rf "${tmp_dir}" "${database_dir}"

  echo "[INFO] Conversion complete"
}

main "$@"
