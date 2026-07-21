#!/bin/bash

set -euo pipefail

# ── Home ownership ────────────────────────────────────────────────────────────
# Docker creates missing mountpoint parents (e.g. ~/.local/share for the
# opencode cache volume) as root: reclaim them or user-level installs fail
# with "Permission denied" (e.g. uv tool install pre-commit).
if command -v sudo &>/dev/null; then
  for dir in "${HOME}/.local" "${HOME}/.local/share" "${HOME}/.local/state" \
             "${HOME}/.local/bin" "${HOME}/.config" "${HOME}/.cache"; do
    if [[ -d "${dir}" && ! -w "${dir}" ]]; then
      echo "[INFO] Reclaiming ownership of ${dir}"
      sudo chown "$(id -u):$(id -g)" "${dir}" \
        || echo "[WARN] Failed to chown ${dir}, continuing"
    fi
  done
fi
mkdir -p "${HOME}/.local/bin" "${HOME}/.local/share" "${HOME}/.config" 2>/dev/null \
  || echo "[WARN] Could not create ~/.local dirs, continuing"

# ── Shell plugins ─────────────────────────────────────────────────────────────

if [[ -d "${ZSH_CUSTOM:-${HOME}/.oh-my-zsh/custom}"/plugins/zsh-autosuggestions ]]; then
  echo "[INFO] zsh-autosuggestions already installed"
else
  echo "[INFO] Installing zsh-autosuggestions"
  git clone https://github.com/zsh-users/zsh-autosuggestions "${ZSH_CUSTOM:-${HOME}/.oh-my-zsh/custom}"/plugins/zsh-autosuggestions
fi

if [[ -d "${ZSH_CUSTOM:-${HOME}/.oh-my-zsh/custom}"/plugins/zsh-syntax-highlighting ]]; then
  echo "[INFO] zsh-syntax-highlighting already installed"
else
  echo "[INFO] Installing zsh-syntax-highlighting"
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "${ZSH_CUSTOM:-${HOME}/.oh-my-zsh/custom}"/plugins/zsh-syntax-highlighting
fi

mkdir -p ~/.zsh/completions

echo "[INFO] Generating just completions from local binary"
just --completions zsh > ~/.zsh/completions/_just

# ── Optional tools (update only; installation is handled by the Dockerfile) ──
# Each update is capped with `timeout` — copilot in particular can otherwise
# hang forever on an interactive auth prompt that `yes` doesn't satisfy.

just tools-update

# ── LLaMA.cpp check ───────────────────────────────────────────────────────────

if [[ "${LLAMA_CPP_ENABLE:-false}" == "true" ]]; then
  if command -v llama-cli &>/dev/null; then
    echo "[INFO] llama-cli available: $(llama-cli --version 2>&1 | head -1)"
  else
    echo "[WARN] LLAMA_CPP_ENABLE=true but llama-cli not found rebuild the container"
  fi
fi

# ── Pre-commit ────────────────────────────────────────────────────────────────

if [[ -f "${WORKSPACE_DIR:-/workspace}/.pre-commit-config.yaml" ]]; then
  if ! command -v pre-commit >/dev/null 2>&1; then
    echo "[INFO] pre-commit not found, installing"

    if command -v uv >/dev/null 2>&1; then
      uv tool install pre-commit || uv tool upgrade pre-commit
      export PATH="$HOME/.local/bin:$PATH"
    elif command -v pipx >/dev/null 2>&1; then
      pipx install pre-commit || pipx upgrade pre-commit
    elif command -v pip3 >/dev/null 2>&1; then
      pip3 install --user pre-commit
      export PATH="$HOME/.local/bin:$PATH"
    else
      echo "[ERROR] No installer available (uv, pipx, or pip3)" >&2
      exit 1
    fi
  fi

  if ! command -v pre-commit >/dev/null 2>&1; then
    echo "[ERROR] pre-commit installed but not found in PATH" >&2
    echo "[INFO] Add ~/.local/bin to PATH and run again" >&2
    exit 1
  fi

  echo "[INFO] Installing pre-commit hooks"
  pre-commit install --install-hooks \
    || echo "[WARN] pre-commit install failed, continuing"

  echo "[INFO] Running hooks for the first time"
  # A failing hook exits non-zero (e.g. formatters fixing files on first run);
  # it must not abort the setup before the project-specific section runs.
  pre-commit run --all-files \
    || echo "[WARN] pre-commit hooks reported issues, continuing"
else
  echo "[WARN] .pre-commit-config.yaml not found, skipping pre-commit install"
fi

# ── Project-specific setup ────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_SETUP="${SCRIPT_DIR}/setup-devcontainer.project.sh"
LOCAL_SETUP="${SCRIPT_DIR}/setup-devcontainer.local.sh"

if [[ -f "${PROJECT_SETUP}" ]]; then
  echo "[INFO] Running project setup: ${PROJECT_SETUP}"
  # shellcheck source=/dev/null
  source "${PROJECT_SETUP}"
else
  echo "[INFO] No project setup found (${PROJECT_SETUP}), skipping"
fi

if [[ -f "${LOCAL_SETUP}" ]]; then
  echo "[INFO] Running local setup overrides: ${LOCAL_SETUP}"
  # shellcheck source=/dev/null
  source "${LOCAL_SETUP}"
else
  echo "[INFO] No local setup overrides found (${LOCAL_SETUP}), skipping"
fi
