#!/usr/bin/env bash
# REM-037: apply the real migration to a scratch PostgreSQL and prove (1) a duplicate live run is refused, (2) a cancelled run
# can be replaced, (3) two concurrent inserts leave exactly one, (4) existing duplicates make the migration stop with a clear message.
set -euo pipefail
DB=${1:-rununiq}; M="$(dirname "$0")/../../prisma/tenant-migrations/20261115090000_payroll_run_one_live_per_month/migration.sql"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -c "CREATE TYPE st AS ENUM ('DRAFT','CANCELLED','PAID'); CREATE TABLE \"PayrollRun\"(id serial primary key, \"periodYear\" int, \"periodMonth\" int, \"status\" text)"
$P -c "ALTER TABLE \"PayrollRun\" ALTER COLUMN status TYPE text"
ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }
# 4 first: duplicates present -> migration refuses
$P -c "INSERT INTO \"PayrollRun\"(\"periodYear\",\"periodMonth\",status) VALUES (2026,9,'DRAFT'),(2026,9,'PAID')"
if out=$($P -f "$M" 2>&1); then bad "migration should refuse existing duplicates"; else echo "$out" | grep -q "duplicates exist for 2026-09" && ok "migration stops on existing duplicates, naming the month" || bad "wrong message: $out"; fi
$P -c "DELETE FROM \"PayrollRun\""
$P -f "$M"; ok "migration applies on clean data"
$P -c "INSERT INTO \"PayrollRun\"(\"periodYear\",\"periodMonth\",status) VALUES (2026,9,'DRAFT')"
if $P -c "INSERT INTO \"PayrollRun\"(\"periodYear\",\"periodMonth\",status) VALUES (2026,9,'DRAFT')" 2>/dev/null; then bad "duplicate live run accepted"; else ok "second live run for the month refused"; fi
$P -c "UPDATE \"PayrollRun\" SET status='CANCELLED'" -c "INSERT INTO \"PayrollRun\"(\"periodYear\",\"periodMonth\",status) VALUES (2026,9,'DRAFT')"; ok "cancelled run replaced; history kept (2 rows)"
[ "$($P -tA -c 'SELECT count(*) FROM "PayrollRun"')" = 2 ] || bad "history lost"
$P -c "DELETE FROM \"PayrollRun\""
for i in 1 2 3 4 5 6; do ($P -c "INSERT INTO \"PayrollRun\"(\"periodYear\",\"periodMonth\",status) VALUES (2026,10,'DRAFT')" >/dev/null 2>&1 &) ; done; wait; sleep 1
[ "$($P -tA -c 'SELECT count(*) FROM "PayrollRun" WHERE "periodMonth"=10')" = 1 ] && ok "6 concurrent inserts leave exactly one live run" || bad "concurrent inserts leaked"
