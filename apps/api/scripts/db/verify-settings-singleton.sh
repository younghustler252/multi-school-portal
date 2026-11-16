#!/usr/bin/env bash
# REM-083/084: apply the real migrations' dedupe + singleton index to a scratch PostgreSQL and prove: duplicates collapse to the latest row,
# a second row is impossible, and twelve concurrent first-creates leave exactly one row.
set -euo pipefail
DB=${1:-singleton}; D="$(dirname "$0")/../../prisma"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -d $DB"; ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }
$P -c 'CREATE TABLE "PlatformSettings"(id text primary key, "platformName" text, "createdAt" timestamp default now(), "updatedAt" timestamp default now())'
$P -c "INSERT INTO \"PlatformSettings\"(id,\"platformName\",\"updatedAt\") VALUES ('old','Old', now()-interval '2 days'),('new','New', now()),('mid','Mid', now()-interval '1 day')"
$P -f "$D/migrations/20261116110000_platform_settings_singleton/migration.sql"
[ "$($P -tA -c 'SELECT id FROM "PlatformSettings"')" = new ] && ok "duplicates collapse to the most recently updated row" || bad "dedupe"
if $P -c "INSERT INTO \"PlatformSettings\"(id) VALUES ('second')" 2>/dev/null; then bad "a second row was accepted"; else ok "a second row is rejected"; fi
$P -c 'DELETE FROM "PlatformSettings"'
for i in $(seq 1 12); do ($P -c "INSERT INTO \"PlatformSettings\"(id) VALUES ('c$i')" >/dev/null 2>&1 &); done; wait; sleep 1
[ "$($P -tA -c 'SELECT count(*) FROM "PlatformSettings"')" = 1 ] && ok "twelve concurrent first-creates leave exactly one row" || bad "more than one row"
$P -c 'CREATE TABLE "SchoolSettings"(id text primary key, "createdAt" timestamp default now(), "updatedAt" timestamp default now())' -c "INSERT INTO \"SchoolSettings\"(id) VALUES ('a'),('b')"
$P -f "$D/tenant-migrations/20261116110000_school_settings_singleton/migration.sql"
[ "$($P -tA -c 'SELECT count(*) FROM "SchoolSettings"')" = 1 ] && ok "school settings duplicates collapse to one row" || bad "school dedupe"
