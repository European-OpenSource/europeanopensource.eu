import 'walle.justfile'

# Default recipe that lists available commands
default:
    just --list

sync-database:
    chmod +x ./lib/scripts/sync-database.sh
    ./lib/scripts/sync-database.sh
