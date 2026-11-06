# Finance Reports Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents the report catalogue, report engine, dashboard, statement builders and CSV export. No dedicated finance-reports test suite was found; no runtime checks were executed.

## Responsibility and boundaries

Finance Reports is a read-only reporting layer. It composes Ledger, Fees, Expenses and Payroll query services into consistent report tables and downloadable CSV files. It does not own financial records or post journals.

- Central report catalogue: report key, title, description, permission, plan feature, parameter schema and query builder.
- Report authorization and feature checks.
- Parameter validation and normalized table/summary output.
- CSV export with spreadsheet-formula defusing for text cells.
- Proprietor finance dashboard: cash, receivables, payables, advance payments, month-to-date, fiscal-year-to-date and current accounting period.
- Shared statement builders: trial balance, general ledger, income statement, balance sheet and cash flow.

## Runtime composition and route mount

Mounted under /api/v1/finance:
- GET /reports
- GET /reports/:key
- GET /reports/:key/export
- GET /dashboard

The report engine receives repositories/use cases for ledger balances and movements, cash book, expense report, creditors, fee ageing, collections and payroll summary. It also uses Finance Settings for fiscal-year start month. Each report definition performs its own permission and feature check in the engine.

## Report catalogue

| Report key | Permission | Plan feature | Parameters |
|---|---|---|---|
| trial-balance | finance.reports.accountant | finance.reports.accountant | asOf, includeZero |
| general-ledger | finance.reports.accountant | finance.reports.accountant | from, to, optional accountId |
| income-statement | finance.reports.accountant | finance.reports.accountant | from, to |
| balance-sheet | finance.reports.accountant | finance.reports.accountant | asOf |
| cash-flow | finance.reports.accountant | finance.reports.accountant | from, to |
| account-balances | finance.reports.view | modules.fees | optional asOf, moneyOnly |
| cash-book | finance.reports.view | modules.fees | accountId, from, to |
| expense-report | finance.reports.view | modules.expenses | from, to, groupBy |
| creditors | finance.reports.view | modules.expenses | optional asOf, vendorId |
| debtors-ageing | finance.reports.view | modules.fees | optional asOf, branch/class/term |
| collections | finance.reports.view | modules.fees | from, to, groupBy |
| payroll-summary | payroll.runs.view | modules.payroll | optional year |

finance.reports.export is a separate permission. The report engine checks it before export and then re-runs the report's own permission/feature checks.

The accountant report permission/feature is intended for trial balance, general ledger and financial statements. The catalogue uses the same string for RBAC permission and plan feature; the feature must exist in platform entitlement definitions or the report is denied as unavailable.

## Report engine contract

Every report definition includes a stable key, display title/description, RBAC permission, optional plan feature, Zod parameter schema and run function returning typed columns, rows and summary.

Execution order:
1. Resolve report key; unknown key returns not found.
2. Check caller's report permission.
3. Check plan feature if configured.
4. Parse/validate raw query parameters.
5. Execute the report builder using tenant-scoped repositories/use cases.
6. Reject if result rows exceed MAX_REPORT_ROWS (50,000).
7. Return key/title/generated timestamp/normalized params/columns/rows/summary.

CSV export requires export permission, then calls the same report execution path and serializes the returned table. Export format is currently CSV only. Filename is <report-key>-<to-or-asOf-or-generated-date>.csv.

## Financial statement calculations

- **Trial balance:** each account's natural balance is placed on its debit or credit side; total debit must equal total credit.
- **General ledger:** opening balance before from, ordered journal movements in the inclusive range, and running/closing natural balance per account.
- **Income statement:** income natural balance (credits less debits) minus expense natural balance (debits less credits) over the selected period.
- **Balance sheet:** assets, liabilities and equity as of a date. Surplus/deficit to date is included in equity; balance check compares total assets to liabilities plus equity.
- **Cash flow:** sums money-account balances at range start/end and groups money-in/money-out movements by source type. Internal transfers appear as both in and out, netting to zero.
- **Account balances:** current natural balance per account; optional money-only filter.
- **Cash book:** one money account's opening balance, movements and running/closing balance.
- **Expense report:** approved expense lines grouped by selected dimension; input VAT is not treated as expense because it posts to VAT Receivable.
- **Creditors:** unpaid vendor bills with ageing.
- **Debtors ageing:** outstanding student invoices by age bucket.
- **Collections:** confirmed fee receipts grouped by selected dimension, with payment and credit totals.
- **Payroll summary:** year/month runs with staff count, gross, deductions, net and total employer cost.

All monetary calculations remain BigInt. Report builders convert to JSON-safe kobo values using koboOut; values outside JavaScript's safe integer range are serialized as digit strings.

## CSV safety

The CSV serializer emits the same columns/rows as the report, formats kobo values as decimal naira text, quotes cells and escapes embedded double quotes. Text cells beginning with =, +, - or @ are prefixed with an apostrophe to prevent spreadsheet formula execution. Number/money/date cells remain typed values. Report builders must correctly classify user-controlled text as text.

## Proprietor dashboard

The dashboard is computed from posted journals on request. It returns cash across cash/bank/petty-cash/online-clearing accounts; fees receivable; accounts payable; advance payments; month-to-date and fiscal-year-to-date income, expenses and surplus; non-zero money accounts; and the current accounting period/status.

Fiscal year starts at finance.fiscal_year_start_month (default January). The dashboard uses the finance-zone business date from Ledger's date helper. It does not cache results.

## Persistence and migrations

Finance Reports has no dedicated write models or migrations. It reads JournalEntry/JournalLine/LedgerAccount/FinancePeriod, FeeInvoice/Payment/PaymentAllocation/Refund, Expense/ExpenseLine/ExpensePayment/Vendor, and PayrollRun/Payslip. Source records remain owned by their respective modules.

## Tests and verification status

No dedicated apps/api/tests/finance-reports suite or report-engine test was found in the inspected tree. apps/api/tests/finance/fee-reports.test.ts covers fee ageing, collections and statements in Fees, not the central catalogue/engine/dashboard or CSV export. The pure statement builders are not independently covered in the inspected tests.

Not executed in this review: tests, typecheck, build, report execution against PostgreSQL, CSV download, dashboard queries or live HTTP requests.

## Open implementation and verification items

1. **Report row limit is checked after the entire report body is materialized.** General ledger, trial balance and other builders can fetch/construct a very large result before MAX_REPORT_ROWS rejects it. Add DB-level limits/pagination or streaming for high-volume reports; enforce a safe query plan before loading all rows.
2. **No dedicated report-engine/statement-builder/CSV tests were found.** Add tests for every report's parameter parsing, permission/feature checks, financial arithmetic, BigInt serialization, CSV formula injection and row limits.
3. **No HTTP integration tests were found.** Test report listing, individual report execution, export permission, unknown keys, unavailable features and tenant isolation through Express routes.
4. **Accountant feature definition must be present in platform entitlements.** The catalogue uses finance.reports.accountant both as permission and feature. Verify the feature is seeded/active in production plan definitions and intended plans grant it; otherwise accountant reports will all be denied.
5. **Dashboard/report output has no explicit freshness/cache contract.** It is live from posted journals on every request; document expected latency and introduce tenant-safe caching only with invalidation on journal/posting changes.
6. **Run finance report tests (once added), typecheck/build and high-volume query profiling** before enabling accountant reports for large schools.

## Source paths reviewed

- apps/api/src/modules/finance-reports/routes/report.routes.ts
- apps/api/src/modules/finance-reports/controllers/report.controller.ts
- apps/api/src/modules/finance-reports/dtos/report.dto.ts
- apps/api/src/modules/finance-reports/domain/report.types.ts
- apps/api/src/modules/finance-reports/domain/statements.ts
- apps/api/src/modules/finance-reports/domain/csv.ts
- apps/api/src/modules/finance-reports/services/report-catalogue.ts
- apps/api/src/modules/finance-reports/services/report-engine.service.ts
- apps/api/src/modules/finance-reports/usecases/report.usecases.ts
- apps/api/src/modules/finance-reports/repositories/statement.repository.impl.ts
- apps/api/src/modules/ledger/ledger.permissions.ts
- apps/api/src/modules/ledger/repositories/ledger-report.repository.impl.ts
- apps/api/src/modules/finance-settings/domain/finance-settings.ts
- apps/api/src/routes/index.ts
- apps/api/tests/finance/fee-reports.test.ts