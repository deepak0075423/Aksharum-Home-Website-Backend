#!/usr/bin/env bash
# Sets up the Aksharum backend for local development:
# installs deps, generates the Prisma client, pushes the schema, and seeds the DB.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  echo "No .env found — copying .env.example. Edit it with your local DB credentials before continuing."
  cp .env.example .env
  exit 1
fi

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Generating Prisma client"
npm run prisma:generate

echo "==> Pushing schema to the database"
npm run prisma:push

echo "==> Seeding the database"
npm run seed

echo "==> Done. Start the dev server with: npm run dev"
