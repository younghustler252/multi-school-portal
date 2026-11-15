#!/usr/bin/env bash
# REM-102: apply the real migration to a scratch PostgreSQL and prove the claim rule with concurrent sessions. The UPDATE
# below is the SQL shape Prisma's updateMany generates for WebhookEventRepositoryImpl.claimable() (a single conditional UPDATE).
set -euo pipefail
DB=${1:-whlease}; M="$(dirname "$0")/../../prisma/migrations/20261115100000_webhook_event_lease/migration.sql"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -c "CREATE TYPE \"WebhookEventStatus\" AS ENUM ('received','processed','ignored','failed'); CREATE TABLE \"WebhookEvent\"(id text primary key, status \"WebhookEventStatus\" not null, attempts int not null default 0)"
$P -f "$M"
ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }
CLAIM(){ echo "UPDATE \"WebhookEvent\" SET status='processing', attempts=attempts+1, \"claimToken\"='$1', \"claimExpiresAt\"=now()+interval '5 min' WHERE id='e1' AND (status='failed' OR (status='processing' AND (\"claimExpiresAt\"<now() OR \"claimExpiresAt\" IS NULL)))"; }
$P -c "INSERT INTO \"WebhookEvent\"(id,status) VALUES ('e1','failed')"
for t in A B C D E F; do ($P -c "$(CLAIM $t)" >/dev/null &); done; wait; sleep 1
[ "$($P -tA -c "SELECT attempts FROM \"WebhookEvent\" WHERE id='e1'")" = 1 ] && ok "six concurrent claims of a failed event: exactly one wins" || bad "several claims won"
$P -c "$(CLAIM X)"; [ "$($P -tA -c "SELECT attempts FROM \"WebhookEvent\"")" = 1 ] && ok "a live lease cannot be taken" || bad "live lease taken"
$P -c "UPDATE \"WebhookEvent\" SET \"claimExpiresAt\"=now()-interval '1 sec'"
for t in G H I; do ($P -c "$(CLAIM $t)" >/dev/null &); done; wait; sleep 1
[ "$($P -tA -c "SELECT attempts FROM \"WebhookEvent\"")" = 2 ] && ok "after expiry exactly one of three concurrent claims wins" || bad "expired lease claim wrong"
TOK=$($P -tA -c "SELECT \"claimToken\" FROM \"WebhookEvent\"")
n=$($P -tA -c "WITH u AS (UPDATE \"WebhookEvent\" SET status='processed',\"claimToken\"=NULL WHERE id='e1' AND \"claimToken\"='stale' AND status='processing' RETURNING 1) SELECT count(*) FROM u")
[ "$n" = 0 ] && ok "a finisher holding a stale token writes nothing" || bad "stale finisher wrote"
n=$($P -tA -c "WITH u AS (UPDATE \"WebhookEvent\" SET status='processed',\"claimToken\"=NULL WHERE id='e1' AND \"claimToken\"='$TOK' AND status='processing' RETURNING 1) SELECT count(*) FROM u")
[ "$n" = 1 ] && ok "the current holder records the outcome" || bad "holder could not finish"
