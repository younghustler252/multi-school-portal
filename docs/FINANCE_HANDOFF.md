# SchoolOS Finance Module: Handoff (read this first in a new chat)

Repo: https://github.com/younghustler252/multi-school-portal  | Branch: `refactor/modules` | Last commit: `49c5fd5` (Phase 5)
Specs: `FINANCE_MODULE_BRIEF.md` and `SCHOOLOS_PLATFORM_DOCUMENTATION.md` (attach both to the new chat if they are not in the repo).
Stack: Node 22, TypeScript, Express 5, Awilix DI (PROXY injection), Prisma 7 tenant client, Postgres schema-per-school, BullMQ, zod 4 (`.strict()` DTOs), node:test via `npm test` (tsx).

## Decisions (brief F1–F11)
Double-entry books underneath; money is BigInt kobo; maker-checker approvals; every money event posts through `PostingService`
(`post()` / `reverse()`, idempotency key `sourceType:sourceId:purpose`); phases 0–6.

## Status
| Phase | Scope | State |
|---|---|---|
| 0–2 | Ledger, chart of accounts, fees, invoices, payments | Done, pushed; 467 tests passed locally at that point |
| 3 | Expenses, vendors, budgets, recurring (6b0511c) | Done, pushed. **Tests never run** |
| 4 | Period close/reopen, statements, report engine + CSV, dashboard (08e6917) | Done, pushed. **Tests never run** |
| 5 | Payroll (49c5fd5) | Done, pushed. **Tests never run** |
| 6 | Advanced | Not started. See below |

**First action in the new chat:** user runs `npx prisma generate`, applies tenant migrations (`20261025090000_expenses_phase3`, Phase 4 changes, `20261026090000_payroll_phase5`), runs the registry/plan sync, then `npm test`, and pastes failures. Fix those before building more. The sandbox cannot run tests (no node_modules, npm blocked).

## Conventions to follow
- Module layout: `<module>.container.ts`, `<module>.permissions.ts`, controllers, usecases, repositories (interface + `.impl.ts` extending `BaseTenantRepository`), mappers (`toDomain`, `toResponse`), dtos, domain. Use cases take one deps object plus optional `{now, transaction}`.
- Routes: `[authenticate, requireTenant, requirePermission(key), requireFeature(feature)]` + `validate(Dto)`. Responses via `sendSuccess/sendCreated`; lists `{success,message,data,meta}`.
- Responses: `koboOut` (number, or digit string if unsafe), `dayOut`, dates parsed with `parseDay`, zone Africa/Lagos (`todayInFinanceZone`).
- Constants stand in for the missing settings service: expenses approval threshold ₦50,000, self-approval false, budget enforcement "warn"; payroll `ALLOW_SELF_APPROVAL=false`, prefixes `PR` / `PSL`; `DEFAULT_FISCAL_YEAR_START_MONTH=1`.
- Tests: in-memory "worlds" over the real PostingService (`tests/finance/support/*-world.ts`: fees, expenses, payroll). No DB needed.
- No PDF/Excel library in the project: exports are CSV; payslip document is self-contained HTML.

## What exists (routes)
Ledger: `/finance/...` accounts, journals, periods (+ `/periods/:id/close-checklist`, `/close`, `/reopen`), opening balances, transfers.
Reports: `/finance/reports`, `/reports/:key`, `/reports/:key/export`, `/finance/dashboard` (13 reports incl. `payroll-summary`).
Fees/payments: `/fees/...`, `/payments/...`. Expenses: `/expenses`, `/vendors`, `/budgets`, `/recurring-expenses`.
Payroll: `/payroll/components|profiles|runs|payslips|loans|remittances` (+ `/runs/:id/calculate|submit|approve|reject|cancel|reverse|pay`, `/payslips/:id/document`, `/remittances/due`), and `/my/payslips`.
Permission keys: `finance.*` (11), `expenses.*`/`vendors.manage`/`budgets.*`, `payroll.*` (9). Features: `modules.fees`, `modules.expenses`, `finance.budgets`, `finance.reports.accountant` (Standard), `modules.payroll` (Premium).
Integrity controls: receivable, advance, payable, expense-paid, payroll (salaries payable), loan (staff loans receivable).

## Payroll design (Phase 5)
Payslip numbers assigned at approval (no gaps on recalculation). Approval posts accrual dated min(month end, today): Dr Salaries expense / Employer pension expense, Cr Salaries payable (per staff), Staff loans receivable, and each component's liability account. Pay: Dr Salaries payable / Cr money account. Approved-unpaid run can be reversed (accrual reversed, loan repayments restored, payslips VOID); no change after payment. Negative net blocks the whole run (`PAYROLL_CALC_PROBLEMS`). One non-cancelled run per month (code only). Loans disburse with sourceType PAYROLL_PAYMENT, purpose LOAN. `payroll.payslips.view` scopes ALL/OWN (OWN uses `personaEntityId`; only FINAL/PAID payslips).

## Known gaps
No PDF/email for payslips; one-run-per-month not a DB constraint; settings are constants; expense attachments not built; petty cash counts not built; existing schools do not get new role grants (templates applied once).

## Phase 6 proposal (agreed direction, order matters)
1. Bank statement import + reconciliation (`finance.bank_reconciliation`), reconciled mark per account/period feeding the close checklist.
2. Paystack settlement matching (replaces manual "mark as settled"; fee to Bank charges).
3. Multi-step approvals by amount (replaces hard-coded threshold; expenses, payroll runs, reversals).
4. Tax/VAT lines (optional, may defer).
5. Paystack salary transfers (`payroll.bank_transfers`), last, own approval step, idempotent references.
Also suggested before/alongside: a real settings service.

## Still owed at the end
Update brief and platform docs; frontend contract (routes, shapes, error codes); settings/entitlements note (list of constants); HTTP/Postman smoke test + dev seed; a beginner-friendly deep explanation of Phases 1–2.

## Open question for the user
Start Phase 6 with the settings service or with reconciliation? (After the local test run is green.)
