#!/bin/sh
# Usage: sh sql.sh -c "SQL"  |  sh sql.sh -f file.sql
# PSQL and E2E_DATABASE_URL override the defaults (see db.mjs); never point them at production.
if [ -z "$PSQL" ]; then
  if [ -x "/c/Program Files/PostgreSQL/17/bin/psql.exe" ]; then PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe"; else PSQL=psql; fi
fi
URL="${E2E_DATABASE_URL:-postgresql://postgres:devangar_local@localhost:5432/devangar_matrimony}"
"$PSQL" -d "$URL" -q -t "$@"
