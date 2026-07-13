#!/bin/bash
# setup-test-db.sh — (Re)creates the rateanything_test database from the dev schema.
# Requires: docker exec access to the rateanything-postgres-1 container.
set -euo pipefail

CONTAINER="rateanything-postgres-1"
DB_USER="rateanything"
DEV_DB="rateanything"
TEST_DB="rateanything_test"

echo "🗑️  Dropping existing test DB (if any)..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"

echo "🆕 Creating test DB..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $TEST_DB OWNER $DB_USER;"

echo "📋 Copying schema from $DEV_DB to $TEST_DB..."
docker exec "$CONTAINER" bash -c "pg_dump -U $DB_USER --schema-only $DEV_DB | psql -U $DB_USER -d $TEST_DB" > /dev/null

echo "✅ Test database $TEST_DB is ready."

# Verify tables exist
echo "📊 Tables in $TEST_DB:"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -c "\dt"
