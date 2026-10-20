#!/usr/bin/env bash
# One-time setup when the Codespace / dev container is created.
set -euo pipefail

if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL="postgresql://postgres:postgres@db:5432/devangar_matrimony?schema=public"
SESSION_SECRET="$(openssl rand -hex 32)"
EOF
  echo "Created .env with a fresh SESSION_SECRET"
fi

npm ci

# The database container can take a few seconds to accept connections.
for i in $(seq 1 30); do
  npx prisma migrate deploy && break
  echo "Waiting for PostgreSQL… ($i)"
  sleep 2
done

npm run db:seed
