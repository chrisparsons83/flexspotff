#!/bin/bash
set -e

scriptDir=$(dirname -- "$(readlink -f -- "$BASH_SOURCE")")
cd "$scriptDir"/..

source .env

url="$DATABASE_URL"
DB_USER=$(echo "$url" | sed 's|postgresql://||' | awk -F'[:@]' '{print $1}')
PROD_DB=$(echo "$url" | awk -F'/' '{print $NF}' | awk -F'?' '{print $1}')
TEST_DB="flexspotff_test"

echo "Syncing $PROD_DB → $TEST_DB..."

docker exec -i postgres psql -U "$DB_USER" -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB' AND pid <> pg_backend_pid();"
docker exec -i postgres psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $TEST_DB;"
docker exec -i postgres psql -U "$DB_USER" -c "CREATE DATABASE $TEST_DB OWNER $DB_USER;"
docker exec -i postgres bash -c "pg_dump -U $DB_USER $PROD_DB | psql -U $DB_USER -d $TEST_DB"

echo "Sync complete."
