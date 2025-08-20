WEBSITE_DIR = lib/website

.PHONY: yarn
yarn:
	@cd $(WEBSITE_DIR) && yarn $(ARGS)

.PHONY: dev
dev:
	@$(MAKE) yarn ARGS_FROM_TARGET="dev --host"

.PHONY: build
build: import
	@$(MAKE) yarn ARGS_FROM_TARGET=install
	@$(MAKE) yarn ARGS_FROM_TARGET=build
