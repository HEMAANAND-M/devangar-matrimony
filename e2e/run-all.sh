#!/bin/sh
# Runs every browser suite against http://localhost:3000, resetting test data between suites.
# Usage: sh run-all.sh <server-log-path> [suite ...]
# The server must run with STAFF_2FA=off, except for f-auth which needs STAFF_2FA=on.
cd "$(dirname "$0")"
LOG="$1"; shift
BASE=http://localhost:3000
SUITES="${*:-smoke features session-cache admin-core admin-roles b-moderation c-business d-member chat tamil notme pwa secactivity emergency}"
total_fail=0
for s in $SUITES; do
  sh reset.sh
  sh sql.sh -c "DELETE FROM \"User\" WHERE phone LIKE '+9198765%'" >/dev/null
  [ "$s" = chat ] && sh sql.sh -f chat-setup.sql >/dev/null
  case "$s" in
    smoke|features) out=$(timeout 600 node "$s.mjs" "$LOG" 2>&1) ;;
    *) out=$(timeout 600 node "$s.mjs" "$BASE" "$LOG" 2>&1) ;;
  esac
  summary=$(printf '%s\n' "$out" | grep -E "passed" | tail -1)
  fails=$(printf '%s\n' "$out" | grep -E "^FAIL")
  printf '%-14s %s\n' "$s" "${summary:-NO SUMMARY}"
  [ -n "$fails" ] && { printf '%s\n' "$fails" | sed 's/^/    /'; total_fail=1; }
done
sh reset.sh
exit $total_fail
