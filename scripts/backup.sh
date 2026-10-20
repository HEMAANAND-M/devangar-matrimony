#!/usr/bin/env bash
# Dumps the database to backups/devangar-YYYYMMDD-HHMMSS.sql.gz and keeps the newest 14 copies.
# Usage: DATABASE_URL=postgresql://... scripts/backup.sh [backup-dir]
# Schedule daily with cron, e.g.  30 2 * * *  cd /srv/devangar && DATABASE_URL=... scripts/backup.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
DIR="${1:-backups}"
KEEP=14
mkdir -p "$DIR"

# pg_dump does not understand Prisma's ?schema= parameter.
URL="${DATABASE_URL%%\?*}"
FILE="$DIR/devangar-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump --no-owner --no-privileges "$URL" | gzip -9 > "$FILE.partial"
mv "$FILE.partial" "$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

ls -1t "$DIR"/devangar-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
