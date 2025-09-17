#!/bin/bash

container_name="flexspotff-postgres-1"
# This takes the backup files that Chris is creating, just ask him for a fresh copy.
fileToUpdate=$1

# This switches the working directory to root directory of the project
scriptDir=$(dirname -- "$(readlink -f -- "$BASH_SOURCE")")
cd "$scriptDir"/..

# Gets the environmental variables so we can parse it and sync
source .env

# Get the database name
database=$(echo "$DATABASE_URL" | awk -F'/' '{print $NF}')

# These need to be separate because drop database can't be in a transaction
docker exec -i $container_name psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$database' AND pid <> pg_backend_pid();"
docker exec -i $container_name psql -U postgres -c "DROP DATABASE IF EXISTS $database;"
docker exec -i $container_name psql -U postgres -c "CREATE DATABASE $database OWNER postgres;"
if [[ "$fileToUpdate" == *.gz ]]; then
  gunzip -c "$fileToUpdate" | docker exec -i flexspotff-postgres-1 psql -U postgres -d "$database"
else
  cat "$fileToUpdate" | docker exec -i flexspotff-postgres-1 psql -U postgres -d "$database"
fi