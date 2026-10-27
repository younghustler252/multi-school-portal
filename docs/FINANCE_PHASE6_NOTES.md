# Finance Phase 6 notes: settings service and bank reconciliation

Status: settings service and bank reconciliation done. Paystack settlement matching, multi-step approvals, tax/VAT and Paystack salary transfers are NOT started.

## Before you run it
1. `npm run prisma:generate`
2. Apply tenant migrations not yet applied: `20261025090000_expenses_phase3`, `20261026090000_payroll_phase5`, `20261027090000_bank_reconciliation`
3. `npm run sync:registries` (new permissions, feature `finance.bank_reconciliation`)
4. `npm test`. Run `books-schema.test.ts` against Postgres; it was not run in the build sandbox.
Existing schools: role templates are applied once, so grant the new permissions to existing roles by hand. Grant feature `finance.bank_reconciliation` to plans (seeded on Standard/Premium for new or synced plans only).

## Settings service (`/finance/settings`, GET/PUT)
Permissions `finance.settings.view`, `finance.settings.manage` (sensitive). Stored in `SchoolSettingValue` under `finance.*`; null resets to the default; updates are all-or-nothing and audited (`finance.settings.updated`). No caching on purpose (scoped services behave as singletons).
Keys (default): expense_approval_required (true), expense_approval_threshold_kobo (5000000), allow_self_approval (false), budget_enforcement (warn; off|warn|block), fiscal_year_start_month (1), grace_days (0), reconciliation_blocks_close (false), reconciliation_tolerance_days (3).
Consumers: expenses submit/approve/reject, budget check, payroll run, fee adjustments, refunds, dashboard year start, period-close checklist, auto-match tolerance. All take an optional `financeSettingsService`, so hand-built tests keep the old defaults.
Error codes: FINANCE_SETTING_UNKNOWN, FINANCE_SETTING_INVALID.
Known gap: SettingDefinition (public) defaults are not read; code defaults only.

## Bank reconciliation (`/finance/reconciliation`, feature `finance.bank_reconciliation`)
Permissions: `finance.bank_reconciliation.view | import | match | post | complete` (post and complete are sensitive and not auto-granted; permission module names are `bank_reconciliation` and `finance_settings`).
Routes: GET /accounts, GET+POST /statements, DELETE /statements/:id, GET /bank-lines, GET /book-lines, GET /suggestions, POST /auto-match, POST /matches, DELETE /matches/:id, POST /bank-lines/:id/entry, POST /book-lines/clear, GET /summary, GET+POST /reconciliations, POST /reconciliations/:id/reopen.
Flow: import CSV text (or lines) -> auto-match / match by hand / record bank charges or interest as a journal (via PostingService) / clear stale book items with a reason -> summary -> complete. Identity checked to the kobo: statement + outstanding book = book + unmatched bank.
Rules: import skips already-imported lines and refuses identical files; unreadable rows refuse the file unless `skipUnreadableRows`; max 5000 lines; a signed-off month locks imports, matching and deletes for that account up to month end; only the latest month can be reopened (reason required); the month must have ended.
Close checklist: item `unreconciledAccounts` is a warning, or a blocker when `finance.reconciliation_blocks_close` is on.
Main error codes: STATEMENT_ROWS_UNREADABLE, STATEMENT_ALREADY_IMPORTED, RECONCILIATION_LOCKED, RECONCILIATION_PERIOD_NOT_ENDED, STATEMENT_BALANCE_REQUIRED, UNMATCHED_BANK_LINES, BANK_LINE_ALREADY_MATCHED, BOOK_LINE_ALREADY_MATCHED, MATCH_TOTALS_DIFFER, MATCH_CHANGED, ENTRY_ACCOUNT_INVALID, ALREADY_RECONCILED. Amounts are kobo as JSON numbers.

## Tests
`bank-reconciliation-domain.test.ts` (30), `bank-reconciliation.test.ts` (31, in-memory world over the real PostingService), `finance-settings.test.ts`. All finance suites pass here except `books-schema.test.ts` (needs Postgres). The raw SQL repositories and the new Prisma models have not been run against a database.
