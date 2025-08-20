FROM ghcr.io/opentofu/opentofu:minimal AS tofu

FROM mcr.microsoft.com/devcontainers/javascript-node:22-bullseye

# Copy the tofu binary
COPY --from=tofu /usr/local/bin/tofu /usr/local/bin/tofu

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \
    && chmod +x /usr/local/bin/yq

WORKDIR /app

COPY lib/website/package.json lib/website/yarn.lock ./lib/website/

RUN yarn install --frozen-lockfile && \
    npm install -g rust-just

COPY . .

EXPOSE 4321

USER node

CMD ["yarn", "dev"]
