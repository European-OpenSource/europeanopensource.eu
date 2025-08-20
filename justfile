import 'walle.justfile'

# Default recipe that lists available commands
default:
    just --list

import:
    chmod +x ./lib/scripts/import-database.sh
    ./lib/scripts/import-database.sh
