# Bank Reconciliation Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents statement import, matching, journal creation from bank lines, month sign-off and reopen behavior. Test sources and migration SQL were inspected but not executed.

## Responsibility and boundaries

Bank Reconciliation compares a bank's statement lines with journal lines on a bank/online-clearing ledger account. It owns:

- CSV/manual statement import, parsing, deduplication and statement history.
- Bank-line and book-line queries.
- Suggested and automatic matching.
- Manual one-to-many/many-to-one matching groups.
- Creating missing book entries for bank charges/interest and clearing historical book entries.
- Monthly reconciliation summary, sign-off and reopen.
- Locking dates up to the latest completed reconciliation.

Ledger remains the source of truth for book balances and journals. Reconciliation reads journal lines and creates missing entries only through the shared Ledger `PostingService`. Finance Settings supplies automatic-match date tolerance and whether unreconciled accounts block period close.

## Runtime composition and route mount

Mounted at `/api/v1/finance/reconciliation`. The module requires:
- Ledger: posting service, account repository and finance periods.
- Finance Settings: reconciliation tolerance.
- Audit.

Every route authenticates, establishes tenant context, checks the route permission and requires feature `finance.bank_reconciliation`.

## HTTP endpoints

All paths below are relative to `/api/v1/finance/reconciliation`.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/accounts` | `finance.bank_reconciliation.view` | Bank/online-clearing account overview |
| GET | `/statements` | `finance.bank_reconciliation.view` | List imported statements |
| POST | `/statements` | `finance.bank_reconciliation.import` | Import CSV text or pre-parsed lines |
| DELETE | `/statements/:id` | `finance.bank_reconciliation.import` | Delete statement only when no lines matched and period unlocked |
| GET | `/bank-lines` | `finance.bank_reconciliation.view` | Bank statement lines |
| GET | `/book-lines` | `finance.bank_reconciliation.view` | Journal lines on selected account |
| GET | `/suggestions` | `finance.bank_reconciliation.view` | Suggested match pairs |
| POST | `/auto-match` | `finance.bank_reconciliation.match` | Apply unambiguous suggestions |
| POST | `/matches` | `finance.bank_reconciliation.match` | Manual group match |
| DELETE | `/matches/:id` | `finance.bank_reconciliation.match` | Remove match/clear group |
| POST | `/bank-lines/:id/entry` | `finance.bank_reconciliation.post` | Create missing journal for a bank line and match it |
| POST | `/book-lines/clear` | `finance.bank_reconciliation.post` | Clear selected unmatched book lines with reason |
| GET | `/summary` | `finance.bank_reconciliation.view` | Reconciliation summary for account and period |
| GET | `/reconciliations` | `finance.bank_reconciliation.view` | List completed reconciliations |
| POST | `/reconciliations` | `finance.bank_reconciliation.complete` | Complete month |
| POST | `/reconciliations/:id/reopen` | `finance.bank_reconciliation.complete` | Reopen latest month with reason |

Permissions are ALL-scope STAFF-only. Import, match, post, and complete/reopen are separate permissions. Posting/clearing and sign-off/reopen are sensitive. The module is plan-gated by `finance.bank_reconciliation`.

## Statement import and CSV parsing

A statement import targets one active reconcilable money account: BANK or ONLINE_CLEARING. Cash and petty-cash accounts are rejected.

The API accepts either:
- `csv`: raw CSV text, up to 8 MB.
- `lines`: 1–5,000 already parsed line objects.

Both cannot be supplied together. Each line has date, description, optional reference, signed amountKobo and optional running balance. Amounts are whole kobo BigInt; money in is positive, money out negative, zero is rejected/skipped.

CSV parser behavior:
- Detects comma, semicolon or tab delimiter.
- Searches the first 40 rows for a recognized date + amount/debit/credit header; preamble rows are allowed.
- Supports date-first DD/MM/YYYY, ISO YYYY-MM-DD and abbreviated month formats.
- Parses naira strings to whole kobo with string arithmetic, not floating point.
- Supports one signed Amount column or separate Debit/Credit columns.
- Parses optional running balance, reference and description.
- Refuses unreadable transaction rows unless `skipUnreadableRows=true`; then returns unreadable row details/count.
- Sorts newest-first statements into chronological order.
- Skips blank/summary rows and zero-amount rows.

Each line gets a SHA-256 dedupe key from date, signed amount, normalized reference/description and occurrence index among identical lines. A statement fingerprint is computed from sorted line keys. Re-importing the same file is rejected; overlapping uploads skip existing line keys. Unique database indexes enforce file hash and per-account line dedupe key.

Statement stores opening/closing balances when parsed or supplied. The line table stores optional running balance per transaction.

## Matching model

Bank and book sides use the same signed convention:
- Bank: money in positive, money out negative.
- Book: debit minus credit on the bank account's journal line.

Automatic suggestions require exact signed amount and date within configured `finance.reconciliation_tolerance_days` (default 3). Shared reference and similar description words increase score. Candidate ties are marked ambiguous and are not automatically applied. The algorithm greedily chooses strongest one-to-one pairs in deterministic order.

Manual match groups can pair one or more bank lines with one or more book lines, provided both sides are non-empty and signed totals are exactly equal. A bank line can belong to one group; a journal line can belong to one group. The repository claims all lines atomically; if any line was already taken, the whole group transaction is rolled back.

Reversal journals are paired with their original journal lines by original journal ID and line number. If both are unmatched, both sides are dropped from the unmatched book list because they net to zero. If the original is already matched, the reversal remains visible and must be reconciled separately.

## Recording missing book entries and clearing

**Create entry from bank line**
- Requires an unmatched bank line and an active reconcilable bank account.
- Counter account must be active, not the bank account, not a money account, and not a locked control account (except BANK_CHARGES).
- Money-in bank line: Dr bank, Cr counter account.
- Money-out bank line: Cr bank, Dr counter account.
- Journal source is the bank-line ID and purpose `BANK_LINE`, so the same line cannot create a second journal.
- Journal and match group are created in one tenant transaction.
- If a bank line date is in the future, the use case currently clamps the journal entry date to today's finance date.

**Clear book lines**
- Marks unmatched journal lines as CLEARED with a written reason.
- Used for legitimate old/opening entries that have no bank line.
- The reason and selected journal details are audited.
- Clearing does not create or alter a journal.

Removing a match group frees both bank and book lines. A CREATED group also unlinks the created journal line from the bank line; it does not reverse the journal itself.

## Reconciliation calculation and sign-off

For an account and period end date:

- Book balance = ledger debit minus credit through period end.
- Outstanding book items = unmatched book lines through period end, after dropping unmatched reversal pairs.
- Unmatched bank items = imported unmatched bank lines through period end.
- Statement balance = supplied typed balance, or the last non-null running balance on an imported bank line through period end.

Adjusted balances:
- Adjusted bank = statement balance + outstanding book net.
- Adjusted book = book balance + unmatched bank net.
- Difference = adjusted bank − adjusted book.

A period can complete only when:
- The month has ended in the finance timezone.
- A statement balance is known.
- Every imported bank line through period end is matched or recorded (no unmatched bank lines).
- Adjusted balances agree exactly to the kobo.
- No prior reconciliation exists for that account/period.

Outstanding book items may remain; they represent checks/deposits in transit and are included in adjusted bank balance.

Completing creates one `BankReconciliation` per account/period. A unique index prevents duplicate sign-off. The latest completed period end is used as `lockedThrough`; all statement import, match/unmatch, create-entry, clear and delete operations are intended to refuse dates up to that point.

Reopen requires a reason and is allowed only for the latest completed reconciliation for that account. Reopening deletes the sign-off row and records the previous values/reason in audit; it unlocks dates after the previous latest reconciliation.

## Persistence and migrations

Models/tables:
- `BankStatement`
- `BankStatementLine`
- `BankMatchGroup`
- `BankMatchedJournalLine`
- `BankReconciliation`

Migration `20261027090000_bank_reconciliation` creates these tables, signed kobo columns, date/line-count/non-zero checks, account/period FKs and unique indexes for statement file hash, per-account dedupe key, one match per journal line and one reconciliation per account/period.

Bank lines cascade with statement deletion. Match groups set bank-line matchGroupId null on delete and cascade journal-line mapping rows. Journal lines themselves are immutable ledger records and are never deleted by reconciliation.

## Tests and verification status

Test source inspected:
- `apps/api/tests/finance/bank-reconciliation.test.ts`
- `apps/api/tests/finance/support/reconciliation-world.ts`

Coverage includes CSV import/overlap, malformed rows, account eligibility, automatic matching/ambiguity, manual one-to-many matching, creating bank-charge journals, sign-off arithmetic, typed balance when line balances are absent, locked-month behavior and reopen. Tests use an in-memory reconciliation world and the real PostingService. No HTTP route tests or populated PostgreSQL migration/concurrency tests were found in the inspected suite.

**Not executed in this review:** tests, typecheck, build, migration, real PostgreSQL, CSV upload through HTTP, concurrent sign-off/mutation or live API requests.

## Open implementation and verification items

1. **Typed statement balance can override an imported running balance.** `position` uses the caller-supplied `typedBalance` whenever present and does not check whether imported bank lines already contain a running balance. A caller with complete permission can therefore provide a value that makes the adjusted balances agree even when the imported statement shows a different balance. Server-side validation must only accept typed balance when the period has no usable imported balance, and should compare against stored statement closing balance where present.
2. **Sign-off and lock checks have time-of-check/time-of-use races.** `CompleteReconciliationUseCase` computes balances and unmatched lines before its insert transaction; mutations call `assertUnlocked` before their own transaction. A concurrent import/match/unmatch/clear/delete can occur between the check and write, leaving a completed month changed after sign-off or signing off stale data. Serialize by account/period and recheck under the same lock/transaction for completion and every mutation.
3. **Imported statement closingBalanceKobo is stored but not used in summary fallback.** `BankStatementRepositoryImpl.balancesUpTo` reads only per-line `BankStatementLine.balanceKobo`; it does not use `BankStatement.closingBalanceKobo`. A closing balance supplied at import is therefore not automatically used when lines have no running balances; the user must submit it again in summary/complete.
4. **CSV summary-row detection can silently discard a malformed real transaction.** When a row date is unreadable, `parseBankCsv` skips it if any text in the row contains words such as `balance`, `total`, `opening` or `closing`. A real transaction with narration such as “balance transfer” and a malformed date can be silently skipped even when `skipUnreadableRows` is false. Restrict summary detection to recognized summary row shapes and report ambiguous rows as problems.
5. **Dedupe occurrence index can misidentify overlapping identical transactions.** Identical rows are distinguished by occurrence order within each imported file. If an overlapping statement contains only the second of two identical same-day transactions, it is renumbered as occurrence 1 and can collide with the first transaction from the earlier statement. Use a stable bank transaction reference/sequence where available, or mark ambiguous duplicate rows for manual resolution.
6. **Greedy auto-match can choose a locally best pair that blocks a better global assignment.** The algorithm marks ties as ambiguous but does not optimize the full bipartite matching. Construct tests where two bank lines compete for book lines with unequal local scores; consider maximum-weight matching or flag conflict graphs for manual review.
7. **No route/real-Postgres tests were found.** Add HTTP tests for permissions/feature gate/body validation and PostgreSQL tests for concurrent completion vs import/match/unmatch/reopen, line-claim uniqueness, statement deletion and typed-balance validation.
8. **Run bank reconciliation tests, typecheck/build and migration checks** against a disposable tenant schema before production rollout.

## Source paths reviewed

- `apps/api/src/modules/bank-reconciliation/routes/bank-reconciliation.routes.ts`
- `apps/api/src/modules/bank-reconciliation/controllers/bank-reconciliation.controller.ts`
- `apps/api/src/modules/bank-reconciliation/dtos/bank-reconciliation.dto.ts`
- `apps/api/src/modules/bank-reconciliation/domain/bank-csv.ts`
- `apps/api/src/modules/bank-reconciliation/domain/bank-lines.ts`
- `apps/api/src/modules/bank-reconciliation/domain/matching.ts`
- `apps/api/src/modules/bank-reconciliation/domain/reconciliation-math.ts`
- `apps/api/src/modules/bank-reconciliation/bank-reconciliation.permissions.ts`
- `apps/api/src/modules/bank-reconciliation/bank-reconciliation.container.ts`
- `apps/api/src/modules/bank-reconciliation/usecases/`
- `apps/api/src/modules/bank-reconciliation/repositories/bank-reconciliation.repositories.impl.ts`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant-migrations/20261027090000_bank_reconciliation/migration.sql`
- `apps/api/tests/finance/bank-reconciliation.test.ts`
