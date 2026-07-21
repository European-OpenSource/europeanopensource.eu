# [harness-coding:START]
ARG DEVCONTAINER_VERSION=trixie
ARG UV_VERSION=latest
ARG NODE_VERSION=24

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv-src
FROM node:${NODE_VERSION}-slim AS node-src

# ── Base stage: OS packages + language runtimes ───────────────────────────────
FROM mcr.microsoft.com/devcontainers/base:${DEVCONTAINER_VERSION} AS base

USER root

# Docker BuildKit populates TARGETARCH (amd64|arm64) and TARGETOS (linux) at build time.
# No fixed default here: RUN steps that need it derive a fallback from the builder's
# own architecture via `dpkg --print-architecture` when BuildKit doesn't populate it.
ARG TARGETARCH
ARG TARGETOS=linux

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    jq \
    just \
    git \
    cmake \
    build-essential \
    pkg-config \
    ccache \
    htop \
    sysstat \
    procps \
    pciutils \
    hyperfine \
    unzip \
    && arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
    && wget -qO /usr/local/bin/yq \
        "https://github.com/mikefarah/yq/releases/latest/download/yq_${TARGETOS}_${arch}" \
    && chmod +x /usr/local/bin/yq \
    && rm -rf /var/lib/apt/lists/*

ARG PYTHON_VERSION=3.13
# Install interpreters under /opt, not /root: /root is mode 700, so symlinks
# resolving into it (venvs, /usr/local/bin/python3) break for non-root users
# at runtime with "Permission denied". Scoped to this RUN (not ENV) so that
# runtime `uv python install` by devuser falls back to its writable home.
COPY --from=uv-src --chown=root: /uv /uvx /bin/
RUN export UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    && uv python install "${PYTHON_VERSION}" \
    && chmod -R a+rX /opt/uv/python \
    && ln -sf $(uv python find "${PYTHON_VERSION}") /usr/local/bin/python3 \
    && ln -sf /usr/local/bin/python3 /usr/local/bin/python

COPY --from=node-src /usr/local/bin/node /usr/local/bin/node
COPY --from=node-src /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack

# [USER] Create devuser with host-matching UID/GID and passwordless sudo.
# Created here (end of base stage), before any optional tool installs in the
# `tools` stage, so those installs can target this user directly instead of a
# final `chown -R` over shared system paths.
ARG USER_NAME=devuser
ARG USER_GROUP=devuser
ARG USER_UID=1000
ARG USER_GID=1000

RUN set -eux; \
    existing_group="$(getent group "${USER_GID}" | cut -d: -f1 || true)"; \
    if [ -z "${existing_group}" ]; then \
        groupadd -g "${USER_GID}" "${USER_GROUP}"; \
    elif [ "${existing_group}" != "${USER_GROUP}" ]; then \
        groupmod -n "${USER_GROUP}" "${existing_group}"; \
    fi; \
    existing_user="$(getent passwd "${USER_UID}" | cut -d: -f1 || true)"; \
    if [ -z "${existing_user}" ]; then \
        useradd -u "${USER_UID}" -g "${USER_GID}" -m -s /bin/zsh "${USER_NAME}"; \
    elif [ "${existing_user}" != "${USER_NAME}" ]; then \
        usermod -l "${USER_NAME}" -g "${USER_GID}" -d /home/"${USER_NAME}" -m "${existing_user}"; \
    fi; \
    usermod -s /bin/zsh "${USER_NAME}"; \
    echo "${USER_NAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/"${USER_NAME}"; \
    chmod 0440 /etc/sudoers.d/"${USER_NAME}"; \
    chown -R "${USER_NAME}":"${USER_GROUP}" /home/"${USER_NAME}"

ENV PATH=/home/${USER_NAME}/.local/bin:$PATH

# ── Tools stage: optional ARG-gated tools ────────────────────────────────────
FROM base AS tools

USER root

# Redeclare platform args each stage has its own scope in Docker BuildKit
ARG TARGETARCH
ARG TARGETOS=linux

# Redeclare user args each stage has its own scope in Docker BuildKit
ARG USER_NAME=devuser
ARG USER_GROUP=devuser

## [TOOLS] Enable or disable tools with build args
ARG CLAUDE_CLI_ENABLE=false
ARG OPENCODE_ENABLE=false
ARG OPENSPEC_ENABLE=false
ARG AWS_CLI_ENABLE=false
ARG GITHUB_COPILOT_CLI_ENABLE=false
ARG GH_CLI_ENABLE=false
ARG KIND_ENABLE=false
ARG LLAMA_CPP_ENABLE=false
ARG TERRAFORM_ENABLE=false
ARG TERRAFORM_VERSION=1.14.8

ENV CLAUDE_CLI_ENABLE=${CLAUDE_CLI_ENABLE}
ENV GITHUB_COPILOT_CLI_ENABLE=${GITHUB_COPILOT_CLI_ENABLE}
ENV OPENCODE_ENABLE=${OPENCODE_ENABLE}
ENV OPENSPEC_ENABLE=${OPENSPEC_ENABLE}
ENV AWS_CLI_ENABLE=${AWS_CLI_ENABLE}
ENV GH_CLI_ENABLE=${GH_CLI_ENABLE}
ENV KIND_ENABLE=${KIND_ENABLE}
ENV LLAMA_CPP_ENABLE=${LLAMA_CPP_ENABLE}
ENV TERRAFORM_ENABLE=${TERRAFORM_ENABLE}
ENV TFENV_ROOT=/opt/tfenv

# [INSTALL] GitHub CLI
RUN if [ "$GH_CLI_ENABLE" = "true" ]; then \
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
            | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
        && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
            | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
        && apt-get update \
        && apt-get install -y --no-install-recommends gh \
        && rm -rf /var/lib/apt/lists/*; \
    fi
# ---

# [INSTALL] AWS CLI
# TARGETARCH amd64→x86_64, arm64→aarch64
RUN if [ "$AWS_CLI_ENABLE" = "true" ]; then \
        arch="${TARGETARCH:-$(dpkg --print-architecture)}" && \
        case "${arch}" in \
            amd64)  AWS_ARCH="x86_64" ;; \
            arm64)  AWS_ARCH="aarch64" ;; \
            *)      echo "[ERROR] Unsupported arch: ${arch}" >&2; exit 1 ;; \
        esac && \
        curl -fsSL "https://awscli.amazonaws.com/awscli-exe-${TARGETOS}-${AWS_ARCH}.zip" \
            -o /tmp/awscliv2.zip \
        && unzip -q /tmp/awscliv2.zip -d /tmp/awscli \
        && /tmp/awscli/aws/install \
        && rm -rf /tmp/awscliv2.zip /tmp/awscli; \
    fi
# ---

# [INSTALL] Claude Code, GitHub Copilot CLI, OpenCode, OpenSpec
# All four are self-updating and install into ${USER_NAME}'s home as that
# user: Claude/Copilot/OpenCode's own installers target $HOME directly
# (binaries land in ~/.local/bin, already on PATH); OpenSpec is an npm global
# install, so npm's default prefix (/usr/local, root-owned from the base
# stage COPY) is repointed to ~/.local — npm's own documented fix for global
# installs without sudo (https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally),
# landing in the same ~/.local/bin as everything else. No /opt relocation, no
# chown -R anywhere — `claude update`/`copilot update`/`opencode
# upgrade`/`openspec update` all work natively as devuser at runtime.
ARG OPENSPEC_VERSION=latest
ENV NPM_CONFIG_PREFIX=/home/${USER_NAME}/.local
USER ${USER_NAME}
ENV HOME=/home/${USER_NAME}

RUN if [ "$CLAUDE_CLI_ENABLE" = "true" ]; then \
        for i in 1 2 3; do \
            curl -fsSL https://claude.ai/install.sh | bash && break; \
            echo "[WARN] Claude CLI install attempt ${i}/3 failed, retrying in 10s..."; \
            sleep 10; \
        done; \
        command -v claude >/dev/null 2>&1 && claude --version \
        || { echo "[ERROR] Claude CLI not found after install" >&2; exit 1; }; \
    fi
# ---

RUN if [ "$GITHUB_COPILOT_CLI_ENABLE" = "true" ]; then \
        for i in 1 2 3; do \
            curl -fsSL https://gh.io/copilot-install | bash && break; \
            echo "[WARN] Copilot CLI install attempt ${i}/3 failed, retrying in 10s..."; \
            sleep 10; \
        done; \
        command -v copilot >/dev/null 2>&1 \
        || { echo "[ERROR] Copilot CLI not found after install" >&2; exit 1; }; \
    fi
# ---

# The installer places the binary at ~/.opencode/bin/opencode and only wires
# $PATH into ~/.zshrc (not sourced in a non-interactive RUN): symlink into
# ~/.local/bin so `opencode` resolves here and at runtime alike.
RUN if [ "$OPENCODE_ENABLE" = "true" ]; then \
        for i in 1 2 3; do \
            curl -fsSL https://opencode.ai/install | bash && break; \
            echo "[WARN] OpenCode install attempt ${i}/3 failed, retrying in 10s..."; \
            sleep 10; \
        done; \
        mkdir -p "$HOME/.local/bin" \
        && ln -sf "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode" \
        && command -v opencode >/dev/null 2>&1 \
        || { echo "[ERROR] OpenCode not found after install" >&2; exit 1; }; \
    fi
# ---

RUN if [ "$OPENSPEC_ENABLE" = "true" ]; then \
        npm install -g "@fission-ai/openspec@${OPENSPEC_VERSION}" \
        && command -v openspec >/dev/null 2>&1 \
        || { echo "[ERROR] OpenSpec CLI not found after install" >&2; exit 1; }; \
    fi
# ---

USER root

# [INSTALL] Kind
# TARGETARCH matches Kind's naming directly (amd64, arm64)
ARG KIND_VERSION="v0.31.0"
RUN if [ "$KIND_ENABLE" = "true" ]; then \
        arch="${TARGETARCH:-$(dpkg --print-architecture)}" && \
        apt-get update && apt-get install -y --no-install-recommends kubectx \
        && curl -fsSL \
            "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-${TARGETOS}-${arch}" \
            -o /usr/local/bin/kind \
        && chmod +x /usr/local/bin/kind \
        && rm -rf /var/lib/apt/lists/*; \
    fi
# ---

# [INSTALL] LLaMA.cpp
ARG LLAMA_CPP_HOME=/opt/llama.cpp
ARG LLAMA_CPP_REF=master
# Paths must live in the runtime user's home (mounted volume), not /root
ENV LLAMA_ROOT=/home/${USER_NAME}/.llama
ENV LLAMA_CACHE=/home/${USER_NAME}/.llama/cache
ENV LLAMA_MODELS=/home/${USER_NAME}/.llama/models

RUN if [ "$LLAMA_CPP_ENABLE" = "true" ]; then \
        git clone --depth 1 --branch "${LLAMA_CPP_REF}" \
            https://github.com/ggml-org/llama.cpp "${LLAMA_CPP_HOME}" \
        && cmake -S "${LLAMA_CPP_HOME}" -B "${LLAMA_CPP_HOME}/build" \
            -DBUILD_SHARED_LIBS=OFF -DGGML_CUDA=OFF \
        && cmake --build "${LLAMA_CPP_HOME}/build" --config Release \
            -j"$(nproc)" --target llama-cli llama-server \
        && ln -sf "${LLAMA_CPP_HOME}/build/bin/llama-cli" /usr/local/bin/llama-cli \
        && ln -sf "${LLAMA_CPP_HOME}/build/bin/llama-server" /usr/local/bin/llama-server \
        && mkdir -p "${LLAMA_ROOT}" "${LLAMA_CACHE}" "${LLAMA_MODELS}" \
        && chown -R "${USER_NAME}":"${USER_GROUP}" "${LLAMA_ROOT}"; \
    fi
# ---

# [INSTALL] Terraform (via tfenv — allows switching versions inside the container)
RUN if [ "$TERRAFORM_ENABLE" = "true" ]; then \
        git clone --depth=1 https://github.com/tfutils/tfenv.git "${TFENV_ROOT}" \
        && ln -sf "${TFENV_ROOT}/bin/tfenv"     /usr/local/bin/tfenv \
        && ln -sf "${TFENV_ROOT}/bin/terraform" /usr/local/bin/terraform \
        && tfenv install "${TERRAFORM_VERSION}" \
        && tfenv use     "${TERRAFORM_VERSION}" \
        && chown -R "${USER_NAME}":"${USER_GROUP}" "${TFENV_ROOT}"; \
    fi
# ---

USER ${USER_NAME}
# [harness-coding:END]

# ── Your stage: add your own packages, tools, and configuration ───────────────
# This section is never touched by the template.
FROM tools AS workspace
