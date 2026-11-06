# Ledger Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide describes the chart of accounts, posting service, journals, periods, integrity checks and current finance reports. Test sources and migration SQL were inspected but not executed during this review.

## Responsibility and boundaries

The Ledger module owns the school's double-entry books:

- Chart of accounts and immutable system-account identities.
- Accounting periods.
- Journal creation, query, reversal and idempotency.
- Opening balances and transfers.
- Period close/reopen checklist.
- Account-balance and cash-book reports.
- Nightly ledger integrity checks and sub-ledger controls.

Fees, Payments, Expenses and Payroll own their source records and call the shared `PostingService` to write journals. No other module should create or mutate journal rows directly. Posted journals and journal lines are immutable; corrections are compensating reversals.

## Runtime composition and route mount

The ledger router is mounted under `/api/v1/finance` (the module route file describes this as the school's `/finance` path). All routes authenticate, establish tenant context, enforce a finance permission and require the `modules.fees` feature.

The container registers journal, period, account, report, integrity and period-close repositories; mappers; the scoped `PostingService`; use cases and controller. Other finance modules depend on `postingService`, `numberSequenceService` and/or `ledgerAccountRepository`.

## HTTP endpoints

All paths below are relative to `/api/v1/finance`.

### Chart of accounts

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/accounts` | `finance.accounts.view` | List/filter accounts; optional balances |
| GET | `/accounts/:id` | `finance.accounts.view` | Account and current balance |
| POST | `/accounts` | `finance.accounts.manage` | Create user account |
| PUT | `/accounts/:id` | `finance.accounts.manage` | Rename/update description, parent and bank metadata |
| POST | `/accounts/:id/deactivate` | `finance.accounts.manage` | Deactivate eligible account |
| POST | `/accounts/:id/reactivate` | `finance.accounts.manage` | Reactivate eligible account |
| DELETE | `/accounts/:id` | `finance.accounts.manage` | Soft-delete unused non-system account |

User account types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE. User-selectable kinds: GENERAL, CASH, BANK, PETTY_CASH. Money accounts are ASSET accounts. Bank metadata is only valid for BANK kind. Code is four digits, with the first digit representing account type; code/type/kind are immutable after creation.

System accounts are seeded per school and are protected from deletion/deactivation/type change. They may be renamed. Accounts with postings cannot be deleted; accounts with children cannot be deactivated/deleted; non-zero-balance money accounts cannot be deactivated.

### Journals and books

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/journals` | `finance.journals.view` | Paginated journal list; filters by date/source/status/account |
| GET | `/journals/:id` | `finance.journals.view` | Journal and ordered lines |
| POST | `/journals` | `finance.journals.post` | Manual balanced journal with written reason |
| POST | `/journals/:id/reverse` | `finance.journals.reverse` | Compensating reversal with reason |
| POST | `/opening-balances` | `finance.journals.post` | Set one money-account opening balance |
| POST | `/transfers` | `finance.journals.post` | Transfer between two money accounts |

Manual journals cannot post directly to control accounts managed by sub-ledgers (receivables, advances, payables, payroll liabilities and staff loans). A manual journal must have at least two lines, one positive debit or credit per line, and equal totals.

Opening balances are one live opening journal per account. To correct one, reverse the previous journal and enter a new opening balance. A negative opening amount represents an overdraft.

Transfers require two different active money accounts. The destination is debited and source credited. Optional `requestId` provides retry idempotency.

### Periods and reports

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/periods` | `finance.periods.view` | List accounting months |
| GET | `/periods/:id/close-checklist` | `finance.periods.view` | Read close checklist |
| POST | `/periods/:id/close` | `finance.periods.close` | Close ended period; acknowledge warnings |
| POST | `/periods/:id/reopen` | `finance.periods.reopen` | Reopen closed period with reason |
| GET | `/reports/account-balances` | `finance.reports.view` | Account balances as of date |
| GET | `/reports/cash-book` | `finance.reports.view` | Money-account movements and running balance |

Account-balance query accepts optional `asOf` and `moneyOnly`. Cash book requires `accountId`, `from` and `to`, and rejects reversed date ranges.

Permissions `finance.reports.export` and `finance.reports.accountant` are declared, but export and accountant statement/trial-balance endpoints are not mounted in the inspected router. Do not assume those reports are available through this API yet.

## Core posting contract

`PostingService.post(input)` is the sole journal writer. It runs in a tenant transaction (joining an existing caller transaction when present) and:

1. Validates at least two lines.
2. Requires exactly one positive debit or credit per line; amounts must be BigInt.
3. Requires exactly one account ID or system key per line.
4. Requires party type and party ID together.
5. Requires total debits equal total credits.
6. Rejects empty source ID, purpose or description.
7. Validates the exact calendar date and rejects future dates in `Africa/Lagos`.
8. Finds or creates the accounting month; refuses a closed period.
9. Resolves only active, postable accounts.
10. Allocates a yearly journal number and saves the journal and lines atomically.

Idempotency key is `sourceType:sourceId:purpose`. A repeated key returns the original journal with `duplicate=true`; a concurrent unique-key collision becomes a duplicate-posting error. The caller should use a stable source ID and purpose for the same business event.

Journal numbers are `JE-YYYY-000001`, sequenced by entry year. Reversals are new journals with debit/credit sides swapped, link to the original, and mark the original REVERSED. A journal cannot be reversed twice or reverse another reversal.

## System accounts and control boundaries

The current required system-key list includes cash/bank/petty cash/online clearing, fees receivable, advance payments, accounts payable, payroll liabilities, staff loans receivable, VAT receivable, opening equity, discounts allowed, bad debt, bank charges and salary expense accounts.

The domain comment says 17 required system accounts, but the current `REQUIRED_SYSTEM_KEYS` array contains 18 entries; the integrity test derives its expected set from the array. Correct the stale comment when next touching the constants.

System accounts must exist, be active, locked and not soft-deleted. User-created accounts cannot claim system keys. System accounts may be renamed but not structurally modified.

## Double-entry invariants and database enforcement

- Every journal has at least two lines.
- Each line has one positive side only.
- Debits equal credits and equal the journal total.
- Journal lines cannot be updated/deleted after insertion.
- Journal headers cannot be deleted or edited; only POSTED → REVERSED is allowed.
- Reversal link must be consistent with source type and unique per original.
- Finance periods must have end date on/after start date.
- Journal number, idempotency key, reversal original and account codes are unique.
- Posted journals reference an accounting period and preserve term/session/branch attribution.

Migration `20261019061500_finance_books` creates ledger account, finance period, journal and journal line tables, indexes/FKs and hand-written PostgreSQL check constraints, immutable triggers and deferred constraint triggers that validate journal balance at transaction commit. Application validation is not the only line of defense.

## Period close and reopen

The close checklist combines:

**Blockers**
- Unbalanced journal or trial-balance mismatch.
- Any sub-ledger control finding: receivables, advance payments, payables, expenses, payroll or staff loans.
- Other integrity findings such as invalid reversals, period mismatch, future-dated entries, deleted-account lines or missing system accounts.

**Warnings**
- Draft invoices.
- Payments awaiting confirmation.
- Expenses awaiting approval.
- Earlier accounting periods still open.
- Bank accounts with imported statement lines not reconciled through the month (warning by default; blocker when `finance.reconciliation_blocks_close` is enabled).

A period cannot close until it has ended in the finance timezone. Blockers always stop closure; warnings require `acknowledgeWarnings=true`. Reopen requires a written reason and is audited.

The posting service refuses future dates and closed periods. Period close uses a conditional OPEN→CLOSED update; reopen uses CLOSED→OPEN. The checklist is read-only and runs the whole-school integrity check, not just checks for the target month.

## Integrity checks

`RunLedgerIntegrityCheckUseCase` runs read-only checks against the current tenant:

- Journal balancing and trial balance.
- Reversal linkage/mirror correctness.
- Period mismatch, future date and posted-after-close.
- Duplicate live opening balances and journal lines on deleted accounts.
- Fees receivable vs issued invoice balances, by school and student.
- Advance Payments vs confirmed payment unallocated amounts.
- Invoice paid amounts vs live allocations; payment credit vs credit allocations.
- Accounts payable vs approved bills, by school/vendor.
- Expense paid amounts vs payment rows.
- Salaries payable vs final payslips; staff loans receivable vs active loan balances.
- Required system account presence/status/lock.

Each SQL check returns at most 50 findings. Monetary values are cast to text in SQL so integrity reporting does not lose BigInt precision.

`RunLedgerIntegrityForAllSchoolsUseCase` iterates active schools with provisioned schemas, enters each tenant context independently, records audit findings for failing schools, and continues if a school crashes. The worker is expected to report crashes/findings operationally.

## Reports

Account balances are calculated from posted journal lines up to the selected date, using natural debit/credit side for account type. Cash book reads one money account, opening totals before the start date and movements within the inclusive date range, then computes running/closing balances.

The current API does not expose trial balance, general ledger, income statement, balance sheet or cash flow endpoints despite the permission label suggesting future accountant reports.

## Finance settings dependencies

- `finance.reconciliation_blocks_close` changes unreconciled-bank checklist severity.
- `finance.reconciliation_tolerance_days` is consumed by bank reconciliation, not this module's cash book.
- Fiscal-year start month is defined in Finance Settings, but journal numbering currently uses calendar year from entry date.
- The finance timezone is currently the hard-coded `Africa/Lagos` constant, not a per-school setting.

## Tests and verification status

Test sources inspected under `apps/api/tests/finance/`:

- `posting.test.ts`
- `books-schema.test.ts`
- `books-usecases.test.ts`
- `accounts.test.ts`
- `chart-of-accounts.test.ts`
- `integrity.test.ts`

Tests cover posting validation/idempotency/reversal, date helpers, account CRUD/policy, schema constraints and integrity-check orchestration. The schema test describes PostgreSQL checks; integrity test comments report that SQL was previously exercised against corrupted PostgreSQL data. No period-close-specific test file or HTTP router integration test was found in the inspected suite.

**Not executed in this review:** tests, typecheck, build, Prisma generation, migration application, concurrency checks, live API requests or a nightly worker run.

## Open implementation and verification items

1. **Period close can race with journal posting.** The posting service reads the period status without locking the period row. Close computes its checklist and then conditionally updates OPEN→CLOSED in a separate operation. A posting transaction that has already read OPEN can potentially insert/commit after the close update, leaving a journal in a closed period. Serialize close and posting on the same period row/lock and add a two-transaction PostgreSQL regression test.
2. **No period-close tests or HTTP tests were found.** Add tests for blockers/warnings, ended-month rule, acknowledgement, reconciliation setting, concurrent posting/close, reopen reason and route permission/middleware.
3. **Finance date/timezone remains global.** `FINANCE_TIMEZONE` is `Africa/Lagos`; decide whether multi-country schools need a school-level timezone before international rollout.
4. **Fiscal-year setting is not used for journal numbering.** Journal numbering resets by calendar year; confirm whether `finance.fiscal_year_start_month` is intended to affect sequence periods or only financial reports.
5. **Required-system-account comment is stale.** It says 17 while the array has 18. Update comments/tests/docs to avoid misleading maintenance assumptions.
6. **Run schema, integrity and use-case tests plus typecheck/build** against disposable PostgreSQL tenant schemas before production rollout.

## Source paths reviewed

- `apps/api/src/modules/ledger/routes/ledger.routes.ts`
- `apps/api/src/modules/ledger/controllers/ledger.controller.ts`
- `apps/api/src/modules/ledger/dtos/ledger.dto.ts`
- `apps/api/src/modules/ledger/domain/`
- `apps/api/src/modules/ledger/ledger.permissions.ts`
- `apps/api/src/modules/ledger/ledger.container.ts`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/ledger/usecases/`
- `apps/api/src/modules/ledger/repositories/`
- `apps/api/src/modules/ledger/mappers/`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261019061500_finance_books/migration.sql`
- `apps/api/tests/finance/`
