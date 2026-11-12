#!/usr/bin/env bash
# Verifies the custom event type CAP under concurrency on a THROWAWAY database: the same lock + count + insert sequence the create use case runs
# (pg_advisory_xact_lock per school, count custom types, insert) is started from many parallel sessions; exactly the free slots may succeed.
# A control run WITHOUT the lock must overrun the cap, which proves the check can fail.
# Usage: PSQL="psql -X -q -v ON_ERROR_STOP=1 -d <scratch_db>" ./scripts/db/verify-event-types-cap.sh     (creates and drops schema evtype_cap)
set -uo pipefail
: "${PSQL:?set PSQL, e.g. PSQL='psql -X -q -v ON_ERROR_STOP=1 -d scratch_db'}"
M="$(cd "$(dirname "$0")/../../prisma/tenant-migrations" && pwd)"
CAP=50; PRE=44; PARALLEL=12
sql() { PGOPTIONS="-c search_path=evtype_cap" $PSQL -At -c "$1"; }
fail() { echo "FAIL: $*"; exit 1; }

$PSQL -c "SET client_min_messages=warning; DROP SCHEMA IF EXISTS evtype_cap CASCADE; CREATE SCHEMA evtype_cap;"
for d in $(ls "$M" | grep -v toml); do PGOPTIONS="-c search_path=evtype_cap" $PSQL -1 -f "$M/$d/migration.sql" >/dev/null || fail "migration $d"; done

attempt() {   # $1 = with|without lock, $2 = n
    local lock=""; [ "$1" = with ] && lock="SELECT pg_advisory_xact_lock(hashtext('evtypes:' || current_schema()));"
    PGOPTIONS="-c search_path=evtype_cap" $PSQL -At -c "BEGIN; $lock
      DO \$\$ BEGIN
        IF (SELECT count(*) FROM \"CalendarEventType\" WHERE NOT \"isSystem\") >= $CAP THEN RAISE EXCEPTION 'EVENT_TYPE_LIMIT'; END IF;
        PERFORM pg_sleep(0.3);   -- widen the window between the count and the insert
        INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") VALUES ('burst-$1-$2','burst-$1-$2','Burst $1 $2','burst $1 $2',now());
      END \$\$; COMMIT;" >/dev/null 2>&1 && echo ok || echo limit
}
preload() { sql "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") SELECT 'pre-'||g,'pre-'||g,'Pre '||g,'pre '||g,now() FROM generate_series(1,$PRE) g;" >/dev/null; }

run() {   # $1 = with|without
    sql "DELETE FROM \"CalendarEventType\" WHERE NOT \"isSystem\"" >/dev/null; preload
    local out; out=$(for i in $(seq 1 $PARALLEL); do attempt "$1" "$i" & done; wait)
    echo "$(echo "$out" | grep -c '^ok$') $(sql "SELECT count(*) FROM \"CalendarEventType\" WHERE NOT \"isSystem\"")"
}

read -r ok total <<<"$(run with)"
[ "$ok" = "$((CAP - PRE))" ] && [ "$total" = "$CAP" ] || fail "with the lock: $ok creations succeeded, $total custom types (wanted $((CAP - PRE)) and $CAP)"
read -r ok2 total2 <<<"$(run without)"
[ "$total2" -gt "$CAP" ] || fail "control: without the lock the cap was not overrun ($total2), so this check proves nothing"
echo "OK: with the lock $ok of $PARALLEL parallel creations succeeded (total $total); without it the cap was overrun ($total2 > $CAP)"
