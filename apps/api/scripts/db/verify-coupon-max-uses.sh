#!/usr/bin/env bash
# REM-069: prove with concurrent PostgreSQL sessions that the conditional UPDATE in BillingEngine.reserveCoupon admits exactly maxUses uses.
set -euo pipefail
DB=${1:-couponuses}
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -c "CREATE TABLE \"Coupon\"(id text primary key, \"maxUses\" int, \"usedCount\" int not null default 0)" -c "INSERT INTO \"Coupon\" VALUES ('c1', 3, 0), ('c2', NULL, 0)"
U(){ echo "UPDATE \"Coupon\" SET \"usedCount\" = \"usedCount\" + 1 WHERE id = '$1' AND (\"maxUses\" IS NULL OR \"usedCount\" < \"maxUses\") RETURNING 1"; }
mkdir -p /tmp/cu_$$; for i in $(seq 1 12); do ($P -tA -c "$(U c1)" > /tmp/cu_$$/$i.txt &); done; wait; sleep 1
won=$(cat /tmp/cu_$$/*.txt | grep -c '^1$' || true)
[ "$won" = 3 ] && [ "$($P -tA -c "SELECT \"usedCount\" FROM \"Coupon\" WHERE id='c1'")" = 3 ] && echo "ok - twelve concurrent uses of a 3-use coupon: exactly 3 admitted" || { echo "FAIL - admitted $won"; exit 1; }
for i in $(seq 1 12); do ($P -c "$(U c2)" >/dev/null &); done; wait; sleep 1
[ "$($P -tA -c "SELECT \"usedCount\" FROM \"Coupon\" WHERE id='c2'")" = 12 ] && echo "ok - an unlimited coupon counts every use" || { echo "FAIL - unlimited"; exit 1; }
rm -rf /tmp/cu_$$
