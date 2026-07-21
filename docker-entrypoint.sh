#!/bin/sh
set -e

echo "Running database migrations..."

# Run prisma db push to sync schema with database (adds new columns/tables)
DATABASE_URL="file:/app/data/custom.db" npx prisma db push --schema=/app/prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null || echo "Schema push skipped or already up to date"

# Backfill NULL roles to empty JSON array
DATABASE_URL="file:/app/data/custom.db" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/app/data/custom.db' } } });
prisma.\$executeRawUnsafe(\"UPDATE OrganizationMember SET roles = '[]' WHERE roles IS NULL\")
  .then(r => { if (r > 0) console.log('Backfilled', r, 'NULL roles'); process.exit(0); })
  .catch(() => process.exit(0));
" 2>/dev/null || true

echo "Starting application..."
exec node server.js
