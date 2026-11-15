#!/usr/bin/env bash
# Verifies on a THROWAWAY database that the per-student credit lock and the compare-and-set predicate used by PaymentRepositoryImpl
# (REM-022 / REM-023) really serialize two concurrent read-then-spend sessions. Real PostgreSQL, two real sessions.
#  1. the lock statement: a second session for the SAME student waits for the first to commit; another student does not wait
#  2. race, WITH the lock: two sessions each take up to 8,000 from 10,000 of credit -> 8,000 + 2,000 taken, 0 left
#  3. control, WITHOUT the lock: both read 10,000 -> 16,000 taken from 10,000 (the lost update the lock prevents)
#  4. compare-and-set: UPDATE ... WHERE id AND amount = expected changes nothing when the amount moved
# Usage: PSQL="psql -X -q -v ON_ERROR_STOP=1 -d <scratch_db>" ./scripts/db/verify-credit-lock.sh
set -uo pipefail
: "${PSQL:?set PSQL, e.g. PSQL='psql -X -q -v ON_ERROR_STOP=1 -d scratch_db'}"
fail() { echo "FAIL: $*"; exit 1; }
now() { date +%s%N; }
ms() { echo $(( ($2 - $1) / 1000000 )); }
S=credit_lock_check
sql() { PGOPTIONS="-c search_path=$S" $PSQL -At -c "$1"; }
LOCK() { echo "SELECT pg_advisory_xact_lock(hashtextextended('student-credit:$1', 0));"; }   # exactly the repository's statement
reset() { sql "DELETE FROM taken; DELETE FROM alloc; INSERT INTO alloc VALUES ('al1', 1000000)" >/dev/null; }

$PSQL -c "SET client_min_messages=warning; DROP SCHEMA IF EXISTS $S CASCADE; CREATE SCHEMA $S;" >/dev/null
sql "CREATE TABLE alloc(id text primary key, \"amountKobo\" bigint not null check (\"amountKobo\" >= 0)); CREATE TABLE taken(n serial, kobo bigint)" >/dev/null

# 1. the lock statement
(PGOPTIONS="-c search_path=$S" $PSQL -At -c "BEGIN; $(LOCK s1) SELECT pg_sleep(2); COMMIT;" >/dev/null 2>&1) &
sleep 0.6; t0=$(now); sql "BEGIN; $(LOCK s1) COMMIT;" >/dev/null || fail "case 1: second session failed"; t1=$(now)
sleep 0.1; t2=$(now); sql "BEGIN; $(LOCK s2) COMMIT;" >/dev/null || fail "case 1: other student failed"; t3=$(now); wait
[ "$(ms $t0 $t1)" -ge 1000 ] || fail "case 1: the same student's second session did not wait ($(ms $t0 $t1) ms)"
[ "$(ms $t2 $t3)" -lt 500 ] || fail "case 1: a different student was blocked ($(ms $t2 $t3) ms)"
echo "ok 1: same student waited $(ms $t0 $t1) ms for the first; a different student did not wait ($(ms $t2 $t3) ms)"

# 1b. the repository's OWN statement, taken from the source file and run as a prepared statement with a bound text parameter, which is how the
#     Prisma driver sends a tagged-template $executeRaw. Proves the SQL in PaymentRepositoryImpl parses, binds and locks the same way.
SRC="$(cd "$(dirname "$0")/../.." && pwd)/src/modules/payments/repositories/payment.repository.impl.ts"
STMT=$(python3 - "$SRC" <<'PY'
import sys
line = next((l for l in open(sys.argv[1]).read().splitlines() if "$executeRaw`SELECT pg_advisory_xact_lock" in l), None)
if line is None: sys.exit(1)
body = line.split("$executeRaw`", 1)[1].rsplit("`;", 1)[0]
print(body.replace("${`student-credit:${studentId}`}", "$1"))
PY
) || fail "case 1b: could not find the lock statement in PaymentRepositoryImpl"
case "$STMT" in "SELECT pg_advisory_xact_lock(hashtextextended(\$1::text, 0))") ;; *) fail "case 1b: unexpected statement: $STMT" ;; esac
REPO_LOCK() { echo "PREPARE lk(text) AS $STMT; EXECUTE lk('student-credit:$1');"; }
(PGOPTIONS="-c search_path=$S" $PSQL -At -c "BEGIN; $(REPO_LOCK s9) SELECT pg_sleep(2); COMMIT;" >/dev/null 2>&1) &
sleep 0.6; t0=$(now); sql "BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('student-credit:s9', 0)); COMMIT;" >/dev/null || fail "case 1b: second session failed"; t1=$(now); wait
[ "$(ms $t0 $t1)" -ge 1000 ] || fail "case 1b: the repository's statement did not hold the same lock ($(ms $t0 $t1) ms)"
echo "ok 1b: the statement in PaymentRepositoryImpl ('$STMT'), bound as text, holds the same lock ($(ms $t0 $t1) ms wait)"

# a session that reads the credit, thinks (pg_sleep), then takes up to 8,000, recording what it took
session() {  # $1 = lock line (or empty); fed through stdin because \gset is a psql meta-command
    PGOPTIONS="-c search_path=$S" $PSQL -At >/dev/null 2>&1 <<SQL
BEGIN;
$1
SELECT "amountKobo" AS amt FROM alloc WHERE id='al1' \gset
SELECT pg_sleep(1);
INSERT INTO taken(kobo) SELECT LEAST(:amt, 800000);
UPDATE alloc SET "amountKobo" = :amt - LEAST(:amt, 800000) WHERE id='al1';
COMMIT;
SQL
}
# 2. with the lock
reset; session "$(LOCK s1)" & session "$(LOCK s1)" & wait
[ "$(sql "SELECT sum(kobo) FROM taken")" = 1000000 ] || fail "case 2: expected 1,000,000 taken in total, got $(sql "SELECT sum(kobo) FROM taken")"
[ "$(sql "SELECT \"amountKobo\" FROM alloc WHERE id='al1'")" = 0 ] || fail "case 2: credit left should be 0"
echo "ok 2: with the lock, two takers of 8,000 got $(sql "SELECT string_agg(kobo::text, ' + ' ORDER BY kobo DESC) FROM taken") from 10,000; 0 left"

# 3. control without the lock
reset; session "" & session "" & wait
TOOK=$(sql "SELECT sum(kobo) FROM taken")
[ "$TOOK" = 1600000 ] || fail "control: without the lock both should have read 10,000 and taken 8,000 each (took $TOOK)"
echo "ok 3 (control): without the lock $TOOK kobo were taken from 1,000,000 held (lost update), so the lock proves something"

# 4. compare-and-set
reset
[ "$(sql "WITH u AS (UPDATE alloc SET \"amountKobo\" = 1 WHERE id='al1' AND \"amountKobo\" = 999999 RETURNING 1) SELECT count(*) FROM u")" = 0 ] || fail "case 4: a stale expected amount still updated the row"
[ "$(sql "SELECT \"amountKobo\" FROM alloc WHERE id='al1'")" = 1000000 ] || fail "case 4: the row changed"
[ "$(sql "WITH u AS (UPDATE alloc SET \"amountKobo\" = 200000 WHERE id='al1' AND \"amountKobo\" = 1000000 RETURNING 1) SELECT count(*) FROM u")" = 1 ] || fail "case 4: the matching expected amount did not update"
echo "ok 4: compare-and-set refuses a stale amount and applies a matching one"
$PSQL -c "SET client_min_messages=warning; DROP SCHEMA $S CASCADE;" >/dev/null
echo "OK: credit lock and compare-and-set verified"
