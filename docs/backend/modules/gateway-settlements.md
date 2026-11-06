# Gateway Settlements Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents Paystack payout reconciliation for confirmed school online payments. Test sources were not found in the inspected tree; no runtime checks were executed.

## Responsibility and boundaries

Gateway Settlements records the payout of individual confirmed online fee payments from the provider to the school's bank account. It owns:
- Unsettled online payment list and Online Clearing control balance.
- CSV settlement report parsing and payment-reference matching.
- Manual selection of payment rows when no CSV report is available.
- One settlement record and item rows per provider payout.
- Ledger settlement journal creation.
- Reversal of a settlement, which releases its payment rows for re-settlement.

Payments owns payment collection, confirmation and student allocations. Ledger owns journals and accounts. Gateway Settlements calls the shared PostingService and reads confirmed online payments from the tenant Payments table.

This module is distinct from the legacy POST /api/v1/payments/online/settlements endpoint. Both currently post the same ledger idempotency source type/purpose, but only Gateway Settlements records individual GatewaySettlementItem rows. This duplicate workflow is a critical integrity conflict; see REM-074.

## Runtime composition and route mount

Mounted at /api/v1/finance/settlements. Registered in apps/api/src/routes/index.ts.

Dependencies:
- SettlementRepository for payment facts, settlement records/items and Online Clearing balance.
- LedgerAccountRepository for destination account.
- PostingService for balanced settlement/reversal journals.
- AuditService.
- Shared bank CSV parser/date/amount helpers.

Every route authenticates, establishes school tenant context, enforces payment permission and requires modules.fees feature.

## HTTP endpoints

All paths below are relative to /api/v1/finance/settlements.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | /unsettled | payments.view | Paginated confirmed online payments not in a settlement, plus clearing control difference |
| GET | / | payments.view | List recorded settlements |
| GET | /:id | payments.view | One settlement with payment items |
| POST | /report/preview | payments.settle | Parse CSV and preview matching; no writes |
| POST | /report | payments.settle | Record every clean settlement group; report skipped groups |
| POST | / | payments.settle | Manually settle selected payment IDs |
| POST | /:id/reverse | payments.settle | Reverse settlement and release payment items |

## Settlement report parsing

The report endpoint accepts CSV text up to 8 MB, optional fallback settlementReference, optional settledOn, optional bank account, skipUnreadableRows and note. The parser:
- Searches the first 40 rows for reference and amount headers.
- Supports comma, semicolon or tab.
- Accepts optional settlement ID, date, fee and net columns.
- Parses naira amounts into exact BigInt kobo using shared bank CSV helpers.
- If fee is blank but net exists, derives fee = gross - net.
- If no settlement ID column exists, requires fallback settlementReference.
- Returns row-level problems; unreadable rows block recording unless skipUnreadableRows=true.
- Limits parsed report to 5,000 rows.

Rows are grouped by settlement reference. Every transaction reference must map to one known online payment; payment must be CONFIRMED, unreversed, not already settled and have the exact same gross amount. Fee must be known and less than gross. A group is clean only if it has at least one matched item and no problems.

Preview returns matched items, problems, gross/fee/net and whether the group can be recorded. Record processes each clean settlement independently; one group failure does not roll back previously recorded groups.

## Manual settlement

Manual request includes a stable gateway reference, 1–500 unique payment IDs, aggregate fee, optional settled date, bank account and note.

Each payment must be a confirmed Paystack payment, unreversed and not already in a GatewaySettlementItem. The aggregate fee is allocated proportionally by payment amount; the final item absorbs rounding remainder.

Settlement date cannot be in the future in finance timezone. Destination must be an active money account other than ONLINE_CLEARING; default is the system bank account.

## Ledger and persistence behavior

For each settlement:
- Gross = sum of selected online payment amounts.
- Fee = sum of allocated gateway fees.
- Net = gross - fee.
- Debit destination bank for net.
- Debit BANK_CHARGES for fee.
- Credit ONLINE_CLEARING for gross.

Posting uses sourceType TRANSFER, sourceId settlement reference and purpose SETTLE. The settlement record and all item rows are created in the same tenant transaction as the journal. The same provider/reference cannot post twice. A payment can be in at most one settlement because the item table has a unique paymentId constraint.

The unsettled control returns:
- UnsettledKobo = sum of confirmed, unreversed Paystack payments with no settlement item.
- ClearingBalanceKobo = ledger balance of ONLINE_CLEARING.
- Difference = clearing balance - unsettled total.

When a settlement is reversed, the journal is reversed, settlement gets reversedAt/reason/by, and item rows are deleted so the original payments become unsettled again. Payment rows themselves remain confirmed; only their payout status changes.

## Persistence and migration

Models: GatewaySettlement and GatewaySettlementItem. Amount columns are BigInt. GatewaySettlement stores provider/reference, date, gross/fee/net, bank account, journal, count, note, actor and reversal metadata. Item rows link each payment to its settled gross and fee.

The migration for this module is present in the tenant migration tree and defines unique provider/reference, unique paymentId per settlement item, journal uniqueness and account/journal/payment foreign keys. Migration SQL was not executed in this review.

## Tests and verification status

No dedicated gateway-settlements test file was found in apps/api/tests. The module's report parser and matching function are pure, but no test coverage was found for:
- CSV header variants, invalid fee/net, duplicate refs and unreadable rows.
- Matching clean/problem groups.
- Journal posting and settlement item uniqueness.
- Reversal/release and re-settlement.
- Clearing-balance reconciliation.
- HTTP route permissions and feature gate.

Not executed: tests, typecheck, build, migration, PostgreSQL concurrency, CSV HTTP upload or live settlement operations.

## Open implementation and verification items

1. **Legacy Payments settlement endpoint conflicts with this module.** POST /api/v1/payments/online/settlements remains mounted and accepts aggregate gross/fee/reference without payment IDs. It posts sourceType TRANSFER/sourceId reference/purpose SETTLE but does not create GatewaySettlement or GatewaySettlementItem records. Gateway Settlements uses the same posting idempotency key and is the only path that marks individual payments settled. The legacy route can therefore make Online Clearing decrease while unsettled payment rows remain; using a different reference in the newer module can settle those payments a second time. Remove/deprecate the legacy route or make it delegate to this module with explicit payment IDs and persisted settlement items.
2. **No module-specific tests were found.** Add pure parser/matcher tests, PostgreSQL unique/concurrency tests, HTTP permission tests and ledger/settlement reversal integration tests.
3. **Preview can report canRecord for invalid/future dates.** Preview checks only that a date string is present; recordOne later parses and rejects invalid/future dates. Validate the effective date in preview and return the same eligibility decision as record.
4. **Audit follows the settlement transaction.** If audit persistence fails after journal/settlement commit, the API can return an error even though funds were posted. Align with the shared audit policy and expose failed audit delivery operationally.
5. **Run settlement tests, typecheck/build and migration checks** against a disposable tenant database before rollout.

## Source paths reviewed

- apps/api/src/modules/gateway-settlements/routes/settlement.routes.ts
- apps/api/src/modules/gateway-settlements/controllers/settlement.controller.ts
- apps/api/src/modules/gateway-settlements/dtos/settlement.dto.ts
- apps/api/src/modules/gateway-settlements/domain/settlement-report.ts
- apps/api/src/modules/gateway-settlements/domain/settlement.entity.ts
- apps/api/src/modules/gateway-settlements/usecases/settlement.usecases.ts
- apps/api/src/modules/gateway-settlements/repositories/settlement.repository.impl.ts
- apps/api/src/modules/payments/usecases/online-payment.usecases.ts
- apps/api/src/modules/ledger/services/posting.service.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/tenant.prisma
