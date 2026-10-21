#!/bin/sh
# Clears test data between runs and restores the seeded demo state.
cd "$(dirname "$0")"
sh sql.sh -f reset.sql >/dev/null
(cd .. && npx prisma db seed >/dev/null 2>&1)
