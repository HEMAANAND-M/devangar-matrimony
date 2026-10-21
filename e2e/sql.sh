#!/bin/sh
# Usage: sh sql.sh "SQL" | sh sql.sh -f file.sql
PGPASSWORD=devangar_local "/c/Program Files/PostgreSQL/17/bin/psql.exe" -U postgres -d devangar_matrimony -q -t "$@"
