import 'walle.justfile'

# Default recipe that lists available commands
default:
    just --list

sync-database:
    ./lib/scripts/sync-database.sh
