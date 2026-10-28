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

## Gateway settlements (`/finance/settlements`, feature `modules.fees`, permissions `payments.view` / `payments.settle`)
Migration `20261028090000_gateway_settlements` (tables `GatewaySettlement`, `GatewaySettlementItem`).
Flow: upload Paystack's settlement report as CSV text -> `POST /report/preview` shows, per settlement, what matched and what did not -> `POST /report` records every CLEAN settlement (Dr bank net, Dr bank charges fee, Cr online clearing gross) and marks its payments paid out. A settlement with any problem is skipped and reported, never half recorded. `POST /` settles chosen payments by hand (one fee figure shared out by amount). `POST /:id/reverse` (reason required) reverses the journal and frees the payments.
Matching is by transaction reference (ours or the gateway's). A row is a problem when: NOT_FOUND, REVERSED, NOT_CONFIRMED, ALREADY_SETTLED, AMOUNT_DIFFERS, FEE_MISSING (no fee or net column) or DUPLICATE_IN_FILE. Report columns are found by name: settlement id (or send `settlementReference`), date, reference, amount, and fee or net.
`GET /unsettled` lists confirmed online payments not yet paid out and the control: clearing account balance minus unsettled payments should be 0. A non-zero difference means a lump settlement was recorded by hand through the older `POST /payments/online/settlements`, or a payment was refunded after settling.
Codes: SETTLEMENT_REPORT_COLUMNS, SETTLEMENT_REPORT_UNREADABLE, SETTLEMENT_REPORT_EMPTY, SETTLEMENT_ALREADY_RECORDED, SETTLEMENT_PAYMENTS_INVALID, SETTLEMENT_NOT_CLEAN, SETTLEMENT_FEE_INVALID, SETTLEMENT_ALREADY_REVERSED, SETTLEMENT_INVALID.
Known gaps: a reference cannot be reused after a reversal (unique per provider); reversing a settlement whose bank line is already reconciled leaves the reversal as an unmatched book line to clear; the report layout is matched by header names, so check a real Paystack export once.

## Optional VAT on expenses (input VAT)
Off by default; most schools never see it. Settings: `finance.vat_enabled` (false) and `finance.vat_rate_bps` (750 = 7.5%).
Migration `20261029090000_expense_vat`: `ExpenseLine.vatKobo` and the `VAT_RECEIVABLE` system account (code 1120, or the next free code to 1129) for existing schools; new schools get it from the chart template (`VAT_RECEIVABLE` is now a required system key, so run `npm run sync:registries`).
A bill or direct expense line takes `amountKobo` (cost WITHOUT VAT) plus either `vatKobo` (exact, from the supplier's invoice) or `vatable: true` (worked out at the school's rate, rounded to the nearest kobo). The total owed is cost plus VAT. Posting: Dr expense accounts, Dr VAT receivable (VAT), Cr accounts payable or the money account (total). Budgets compare the cost without VAT. Responses carry `vatKobo` per line and for the expense. Asking for VAT while the setting is off gives `VAT_NOT_ENABLED`.
The VAT receivable balance in the ledger is the input VAT the school can claim. Not built: output VAT on fee invoices or other income, a VAT return report, VAT on recurring expense templates, and VAT on payroll.

## Second approver above an amount (expenses and payroll runs)
Setting `finance.second_approval_threshold_kobo` (default 0 = off). At or above it, two DIFFERENT people must approve: the first call to the approve endpoint only records who approved (`firstApprovedById/At`, audit `expenses.first_approved` / `payroll.run.first_approved`, status stays PENDING_APPROVAL, response has `approvalsRequired: 2, approvalsReceived: 1`); the second approver posts to the books. The same person twice gives `SECOND_APPROVER_MUST_DIFFER`. The requester still cannot approve unless `finance.allow_self_approval` is on. A rejection by anyone clears the first approval.
Amount tested: an expense's total (VAT included); a payroll run's gross plus employer cost. A large expense can no longer approve itself at submit, even when "require approval" is off, and recurring expense templates no longer auto-approve above the amount (recurring also now follows the approval threshold settings).
Migration `20261030090000_second_approval` (`firstApprovedById/At` on `Expense` and `PayrollRun`). Not covered yet: refunds, fee adjustments and loans (they keep a single approver); more than two steps or approval by role/amount ladders.
