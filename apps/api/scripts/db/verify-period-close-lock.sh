#!/usr/bin/env bash
# REM-028: real PostgreSQL proof that a close (FOR UPDATE on the period row) waits for postings in flight (FOR SHARE) and that a
# posting started after the close then sees CLOSED. The two SELECTs are the statements FinancePeriodRepositoryImpl issues.
set -euo pipefail
DB=${1:-perlock}
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -tA -d $DB"
$P -c "CREATE TABLE \"FinancePeriod\"(id text primary key, status text not null); CREATE TABLE \"JournalEntry\"(id serial primary key, \"periodId\" text references \"FinancePeriod\"(id)); INSERT INTO \"FinancePeriod\" VALUES ('p1','OPEN')"
ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }

T=$(mktemp -d); trap 'rm -rf $T' EXIT
cat > $T/poster.sql <<'S'
BEGIN;
SELECT "status"::text AS status FROM "FinancePeriod" WHERE "id" = 'p1' FOR SHARE;
SELECT pg_sleep(1.5);
INSERT INTO "JournalEntry"("periodId") VALUES ('p1');
COMMIT;
S
cat > $T/close.sql <<'S'
BEGIN;
SELECT "id" FROM "FinancePeriod" WHERE "id" = 'p1' FOR UPDATE;
SELECT count(*) FROM "JournalEntry" WHERE "periodId" = 'p1';
UPDATE "FinancePeriod" SET status = 'CLOSED' WHERE id = 'p1';
COMMIT;
S
cat > $T/slowclose.sql <<'S'
BEGIN;
SELECT "id" FROM "FinancePeriod" WHERE "id" = 'p1' FOR UPDATE;
SELECT pg_sleep(1.2);
UPDATE "FinancePeriod" SET status = 'CLOSED' WHERE id = 'p1';
COMMIT;
S
cat > $T/late.sql <<'S'
BEGIN;
SELECT "status"::text AS status FROM "FinancePeriod" WHERE "id" = 'p1' FOR SHARE;
COMMIT;
S

# 1. a posting in flight (shared lock, slow insert) vs a close: the close must wait, then count that journal
$P -f $T/poster.sql >/dev/null &
sleep 0.4; start=$(date +%s%3N)
seen=$($P -f $T/close.sql | grep -v '^BEGIN\|^COMMIT\|^UPDATE\|^$' | tail -1)
waited=$(( $(date +%s%3N) - start )); wait
[ "$seen" = 1 ] && [ "$waited" -ge 800 ] && ok "the close waited ${waited} ms and counted the journal that was in flight" || bad "seen=$seen waited=$waited"

# 2. a posting that starts after the close reads CLOSED
st=$($P -f $T/late.sql | grep -v '^BEGIN\|^COMMIT\|^$' | head -1)
[ "$st" = CLOSED ] && ok "a posting after the close reads CLOSED" || bad "poster read $st"

# 3. a posting that arrives while the close holds the lock waits, then reads CLOSED: no journal lands in a closed month
$P -c "UPDATE \"FinancePeriod\" SET status='OPEN'; DELETE FROM \"JournalEntry\"" >/dev/null
$P -f $T/slowclose.sql >/dev/null &
sleep 0.4; start=$(date +%s%3N)
st=$($P -f $T/late.sql | grep -v '^BEGIN\|^COMMIT\|^$' | head -1)
waited=$(( $(date +%s%3N) - start )); wait
[ "$st" = CLOSED ] && [ "$waited" -ge 600 ] && ok "a posting that arrives during the close waited ${waited} ms and read CLOSED" || bad "poster read $st after ${waited} ms"

# 4. postings share the lock: four at once take about one second together, not four
$P -c "UPDATE \"FinancePeriod\" SET status='OPEN'" >/dev/null
cat > $T/share.sql <<'S'
BEGIN;
SELECT status FROM "FinancePeriod" WHERE id = 'p1' FOR SHARE;
SELECT pg_sleep(1);
COMMIT;
S
start=$(date +%s%3N); for i in 1 2 3 4; do $P -f $T/share.sql >/dev/null & done; wait
took=$(( $(date +%s%3N) - start )); [ "$took" -lt 2500 ] && ok "four postings held the shared lock together (${took} ms)" || bad "postings serialised (${took} ms)"
