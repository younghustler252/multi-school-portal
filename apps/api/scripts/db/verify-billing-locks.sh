#!/usr/bin/env bash
# REM-066/067/068/070: apply the real migration to a scratch PostgreSQL and prove, with concurrent sessions:
#  1 one pending checkout per invoice (partial unique index) that frees itself, and old rows (checkoutKey NULL) never conflict
#  2 one exception row per attempt
#  3 a lapse (subscription lock, then re-check) queued behind a payment (subscription lock, then invoice lock) sees the PAID invoice and does nothing
set -euo pipefail
DB=${1:-billlock}; M="$(dirname "$0")/../../prisma/migrations/20261115120000_billing_checkout_and_exceptions/migration.sql"
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 2>/dev/null
P="psql -q -v ON_ERROR_STOP=1 -tA -d $DB"
$P -c 'CREATE TABLE "Subscription"(id text primary key, "planId" text, status text); CREATE TABLE "SubscriptionInvoice"(id text primary key, "subscriptionId" text, status text); CREATE TABLE "PaymentAttempt"(id text primary key, "invoiceId" text, reference text unique, status text not null default '"'"'pending'"'"')'
$P -c "INSERT INTO \"PaymentAttempt\"(id,\"invoiceId\",reference) VALUES ('old1','i1','R-OLD1'),('old2','i1','R-OLD2')"   # two legacy pending attempts for one invoice
$P -f "$M"; ok(){ echo "ok - $1"; }; bad(){ echo "FAIL - $1"; exit 1; }
ok "migration applied with legacy duplicate pending attempts present (no conflict, nothing rewritten)"
$P -c "INSERT INTO \"PaymentAttempt\"(id,\"invoiceId\",reference,\"checkoutKey\") VALUES ('n1','i1','R-N1','i1')"
if $P -c "INSERT INTO \"PaymentAttempt\"(id,\"invoiceId\",reference,\"checkoutKey\") VALUES ('n2','i1','R-N2','i1')" 2>/dev/null; then bad "second live checkout accepted"; else ok "second pending checkout for the invoice refused"; fi
$P -c "UPDATE \"PaymentAttempt\" SET status='abandoned' WHERE id='n1'" -c "INSERT INTO \"PaymentAttempt\"(id,\"invoiceId\",reference,\"checkoutKey\") VALUES ('n3','i1','R-N3','i1')"; ok "the index frees itself once the attempt is no longer pending"
for i in 1 2 3 4 5 6; do ($P -c "INSERT INTO \"PaymentAttempt\"(id,\"invoiceId\",reference,\"checkoutKey\") VALUES ('c$i','i2','R-C$i','i2')" >/dev/null 2>&1 &); done; wait; sleep 1
[ "$($P -c "SELECT count(*) FROM \"PaymentAttempt\" WHERE \"checkoutKey\"='i2'")" = 1 ] && ok "six concurrent checkout inserts leave exactly one live attempt" || bad "concurrent checkouts leaked"
$P -c "INSERT INTO \"CapturedPaymentException\"(id,\"attemptId\",\"invoiceId\",\"schoolId\",kind,reference,\"amountKobo\") VALUES ('x1','a1','i1','s1','duplicate_payment','R',5)"
if $P -c "INSERT INTO \"CapturedPaymentException\"(id,\"attemptId\",\"invoiceId\",\"schoolId\",kind,reference,\"amountKobo\") VALUES ('x2','a1','i1','s1','duplicate_payment','R',5)" 2>/dev/null; then bad "second exception for one attempt accepted"; else ok "one exception row per attempt"; fi

T=$(mktemp -d); trap 'rm -rf $T' EXIT
$P -c "INSERT INTO \"Subscription\" VALUES ('sub1','pro','active'); INSERT INTO \"SubscriptionInvoice\" VALUES ('inv1','sub1','open')"
cat > $T/pay.sql <<'S'
BEGIN;
SELECT id FROM "Subscription" WHERE id = 'sub1' FOR UPDATE;
SELECT id FROM "SubscriptionInvoice" WHERE id = 'inv1' FOR UPDATE;
SELECT pg_sleep(1.5);
UPDATE "SubscriptionInvoice" SET status = 'paid' WHERE id = 'inv1';
COMMIT;
S
cat > $T/lapse.sql <<'S'
BEGIN;
SELECT id FROM "Subscription" WHERE id = 'sub1' FOR UPDATE;
SELECT count(*) FROM "SubscriptionInvoice" WHERE "subscriptionId" = 'sub1' AND status = 'open';
COMMIT;
S
$P -f $T/pay.sql >/dev/null &
sleep 0.4; start=$(date +%s%3N)
open=$($P -f $T/lapse.sql | grep -v '^BEGIN\|^COMMIT\|^$\|^sub1' | tail -1)
waited=$(( $(date +%s%3N) - start )); wait
[ "$open" = 0 ] && [ "$waited" -ge 800 ] && ok "the lapse waited ${waited} ms behind the payment and then found no open invoice" || bad "open=$open waited=$waited"
