#!/bin/sh
# Runs every browser suite against http://localhost:3000, resetting test data between suites.
# Usage: sh run-all.sh <server-log-path> [suite ...]
# The server must run with STAFF_2FA=off, except for f-auth which needs STAFF_2FA=on.
# Exits non-zero if any suite fails, crashes or times out.
LOG="$1"; shift
# Resolve a relative log path before changing directory (pwd -W gives a Windows path in Git Bash).
case "$LOG" in
  /*|[A-Za-z]:*) ;;
  *) LOG="$(pwd -W 2>/dev/null || pwd)/$LOG" ;;
esac
cd "$(dirname "$0")"
BASE=http://localhost:3000
SUITES="${*:-smoke features session-cache admin-core admin-roles b-moderation c-business d-member chat tamil notme pwa secactivity emergency growth}"
total_fail=0
for s in $SUITES; do
  sh reset.sh
  sh sql.sh -c "DELETE FROM \"User\" WHERE phone LIKE '+9198765%'" >/dev/null
  [ "$s" = chat ] && sh sql.sh -f chat-setup.sql >/dev/null
  case "$s" in
    smoke|features) out=$(timeout 600 node "$s.mjs" "$LOG" 2>&1) ;;
    *) out=$(timeout 600 node "$s.mjs" "$BASE" "$LOG" 2>&1) ;;
  esac
  summary=$(printf '%s\n' "$out" | grep -E "[0-9]+/[0-9]+ .*passed" | tail -1)
  fails=$(printf '%s\n' "$out" | grep -E "^FAIL")
  printf '%-14s %s\n' "$s" "${summary:-NO SUMMARY (crashed or timed out)}"
  if [ -n "$fails" ]; then
    printf '%s\n' "$fails" | sed 's/^/    /'
    total_fail=1
  fi
  # A missing summary, or "N/M passed" with N != M, also counts as a failure.
  passed=$(printf '%s' "$summary" | sed -n 's/^\([0-9][0-9]*\)\/\([0-9][0-9]*\).*/\1/p')
  total=$(printf '%s' "$summary" | sed -n 's/^\([0-9][0-9]*\)\/\([0-9][0-9]*\).*/\2/p')
  if [ -z "$passed" ] || [ "$passed" != "$total" ]; then
    total_fail=1
    [ -z "$summary" ] && printf '%s\n' "$out" | tail -15 | sed 's/^/    | /'
  fi
done
sh reset.sh
exit $total_fail
