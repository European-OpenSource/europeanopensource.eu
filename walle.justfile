cli_filename := "./lib/scripts/@walle/cli.sh"
website_dir := "./lib/website"
infrastructure_dir := "./lib/infrastructure"
scripts_dir := "./lib/scripts"

# Setup the project
setup:
    just yarn install

# Walle cli
walle *args:
    {{cli_filename}} {{args}}

# Walle update design system
walle-update *args:
    curl -fsSL https://raw.githubusercontent.com/FabrizioCafolla/walle-design-system/main/lib/scripts/@walle/cli.sh -o {{cli_filename}}
    chmod +x {{cli_filename}}
    just walle update {{args}}

# Run yarn commands in the website directory
yarn *args:
    cd {{website_dir}} && yarn {{args}}

# Start development server
dev:
    just yarn "dev --host"

# Build the project
build:
    just yarn install
    just yarn build
