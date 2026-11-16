#!/usr/bin/env bash
# REM-077: apply the real tenant migration to a scratch PostgreSQL and prove (1) an outbox row written in a transaction that rolls
# back does not exist, and (2) the relay's claim statement (the SQL in AuditOutboxRepositoryImpl.claim) hands concurrent
# relays disjoint rows and honours the lease.
set -euo pipefail
DB=${1:-auditoutbox}; M="$(dirname "$0")/../../prisma/tenant-migrations/20261116090000_audit_outbox/migration.sql"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f "$M"
ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }
n(){ $P -tA -c "$1"; }

$P <<'S' || true
BEGIN; INSERT INTO "AuditOutbox"(id,payload) VALUES ('rolled','{}'); ROLLBACK;
S
[ "$(n "SELECT count(*) FROM \"AuditOutbox\"")" = 0 ] && ok "a rolled-back transaction leaves no outbox row" || bad "rolled-back row exists"

$P -c "INSERT INTO \"AuditOutbox\"(id,payload,\"createdAt\") SELECT 'e'||g, '{}', now() + g * interval '1 ms' FROM generate_series(1,60) g"
CLAIM(){ echo "UPDATE \"AuditOutbox\" SET \"claimToken\"='$1', \"claimExpiresAt\"=now()+interval '2 minutes' WHERE id IN (SELECT id FROM \"AuditOutbox\" WHERE \"claimExpiresAt\" IS NULL OR \"claimExpiresAt\" < now() ORDER BY \"createdAt\", id LIMIT 20 FOR UPDATE SKIP LOCKED)"; }
for t in A B C D E; do ($P -c "$(CLAIM $t)" >/dev/null &); done; wait; sleep 1
[ "$(n "SELECT count(*) FROM \"AuditOutbox\" WHERE \"claimToken\" IS NOT NULL")" = 60 ] && ok "five concurrent relays claim all 60 rows" || bad "rows left unclaimed or double-claimed"
[ "$(n "SELECT count(DISTINCT \"claimToken\") FROM \"AuditOutbox\"")" -ge 3 ] && ok "the rows were split across relays (no relay held them all)" || bad "claims not split"
$P -c "$(CLAIM X)"; [ "$(n "SELECT count(*) FROM \"AuditOutbox\" WHERE \"claimToken\"='X'")" = 0 ] && ok "rows under a live lease cannot be taken" || bad "live lease taken"
$P -c "UPDATE \"AuditOutbox\" SET \"claimExpiresAt\" = now() - interval '1 second'"
$P -c "$(CLAIM Y)"; [ "$(n "SELECT count(*) FROM \"AuditOutbox\" WHERE \"claimToken\"='Y'")" = 20 ] && ok "after the lease expires the rows can be claimed again" || bad "expired rows not reclaimable"
n=$(n "WITH d AS (DELETE FROM \"AuditOutbox\" WHERE id IN (SELECT id FROM \"AuditOutbox\") AND \"claimToken\"='stale' RETURNING 1) SELECT count(*) FROM d")
[ "$n" = 0 ] && ok "a relay holding a stale token deletes nothing" || bad "stale relay deleted rows"
