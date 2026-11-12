#!/usr/bin/env bash
# Verifies on a THROWAWAY database that an event cannot end up with a type deactivated at the same moment (two real sessions):
#  1. the event is written first (holds the type row, FOR SHARE) -> the deactivation WAITS for it, then succeeds; the event keeps its type
#  2. the deactivation is running first -> the event write WAITS, then is REFUSED with EVENT_TYPE_INACTIVE; no row is left
#  3. control: on a schema WITHOUT the last migration (no isActive check) case 2 lets the event through, so the check can fail.
# Usage: PSQL="psql -X -q -v ON_ERROR_STOP=1 -d <scratch_db>" ./scripts/db/verify-event-types-inactive-race.sh
set -uo pipefail
: "${PSQL:?set PSQL, e.g. PSQL='psql -X -q -v ON_ERROR_STOP=1 -d scratch_db'}"
M="$(cd "$(dirname "$0")/../../prisma/tenant-migrations" && pwd)"
fail() { echo "FAIL: $*"; exit 1; }
now() { date +%s%N; }
ms() { echo $(( ($2 - $1) / 1000000 )); }
sql() { PGOPTIONS="-c search_path=$1" $PSQL -At -c "$2"; }

build() {  # $1 schema, $2 = all | skip-last
    $PSQL -c "SET client_min_messages=warning; DROP SCHEMA IF EXISTS $1 CASCADE; CREATE SCHEMA $1;"
    local list; list=$(ls "$M" | grep -v toml); [ "$2" = skip-last ] && list=$(echo "$list" | sed '$d')
    for d in $list; do PGOPTIONS="-c search_path=$1" $PSQL -1 -f "$M/$d/migration.sql" >/dev/null || fail "migration $d in $1"; done
    sql $1 "INSERT INTO \"CalendarEventType\"(id,key,name,\"nameKey\",\"updatedAt\") VALUES ('rt','race-type','Race type','race type',now())" >/dev/null
}
EV="INSERT INTO \"CalendarEvent\"(id,title,\"startDate\",\"eventTypeId\",\"updatedAt\") VALUES ('ev','race','2031-05-01','rt',now())"
DEACT="UPDATE \"CalendarEventType\" SET \"isActive\"=false WHERE id='rt'"
reset() { sql $1 "DELETE FROM \"CalendarEvent\" WHERE id='ev'; UPDATE \"CalendarEventType\" SET \"isActive\"=true WHERE id='rt'" >/dev/null; }

# 1. event first
build evtype_race all
(PGOPTIONS="-c search_path=evtype_race" $PSQL -At -c "BEGIN; $EV; SELECT pg_sleep(2); COMMIT;" >/dev/null 2>&1) &
sleep 0.6; t0=$(now); sql evtype_race "$DEACT" >/dev/null || fail "case 1: deactivation failed"; t1=$(now); wait
[ "$(ms $t0 $t1)" -ge 1000 ] || fail "case 1: deactivation did not wait for the event's transaction ($(ms $t0 $t1) ms)"
[ "$(sql evtype_race "SELECT count(*) FROM \"CalendarEvent\" WHERE id='ev' AND \"eventTypeId\"='rt'")" = 1 ] || fail "case 1: the event was not kept"
[ "$(sql evtype_race "SELECT \"isActive\" FROM \"CalendarEventType\" WHERE id='rt'")" = f ] || fail "case 1: the type is not deactivated"
echo "ok 1: deactivation waited $(ms $t0 $t1) ms for the in-flight event, then applied; event kept its type"

# 2. deactivation first
reset evtype_race
(PGOPTIONS="-c search_path=evtype_race" $PSQL -At -c "BEGIN; $DEACT; SELECT pg_sleep(2); COMMIT;" >/dev/null 2>&1) &
sleep 0.6; t0=$(now); out=$(PGOPTIONS="-c search_path=evtype_race" $PSQL -At -c "$EV" 2>&1); rc=$?; t1=$(now); wait
[ $rc -ne 0 ] && echo "$out" | grep -q EVENT_TYPE_INACTIVE || fail "case 2: the event was not refused with EVENT_TYPE_INACTIVE (rc=$rc: $out)"
[ "$(ms $t0 $t1)" -ge 1000 ] || fail "case 2: the write did not wait for the deactivation ($(ms $t0 $t1) ms)"
[ "$(sql evtype_race "SELECT count(*) FROM \"CalendarEvent\" WHERE id='ev'")" = 0 ] || fail "case 2: a row was left behind"
echo "ok 2: event write waited $(ms $t0 $t1) ms, then was refused (EVENT_TYPE_INACTIVE); nothing left behind"

# 3. control without the check
build evtype_race_ctl skip-last
(PGOPTIONS="-c search_path=evtype_race_ctl" $PSQL -At -c "BEGIN; $DEACT; SELECT pg_sleep(2); COMMIT;" >/dev/null 2>&1) &
sleep 0.6; PGOPTIONS="-c search_path=evtype_race_ctl" $PSQL -At -c "$EV" >/dev/null 2>&1; wait
[ "$(sql evtype_race_ctl "SELECT count(*) FROM \"CalendarEvent\" e JOIN \"CalendarEventType\" t ON t.id=e.\"eventTypeId\" WHERE NOT t.\"isActive\"")" = 1 ] || fail "control: without the check the event should have got the inactive type"
echo "ok 3 (control): without the check an event is written with an inactive type, so the check proves something"
$PSQL -c "SET client_min_messages=warning; DROP SCHEMA evtype_race CASCADE; DROP SCHEMA evtype_race_ctl CASCADE;" >/dev/null
echo "OK: inactive-type race verified"
