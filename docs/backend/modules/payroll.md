# Payroll Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents pay components/profiles, calculation, monthly runs, payslips, staff loans and remittances. The separate salary-transfer module is documented independently. Tests and migrations were inspected but not executed.

## Responsibility and boundaries

Payroll owns the school's staff compensation records:

- Pay components and calculation rules.
- Effective-dated staff pay profiles and encrypted bank details.
- Monthly payroll runs and payslip calculation/snapshots.
- Maker-checker approval, accrual, payment recording and reversal.
- Staff loans and monthly deductions.
- Tax/pension/other liability remittances.
- Own-payslip visibility and printable HTML.

Staff identity/employment remains owned by Staff. Ledger owns journals and accounts. Payroll posts through the shared `PostingService`. Salary transfer execution is a separate module mounted under `/payroll/transfers`; it consumes approved payslips and prevents a run from also being marked manually paid while live transfers exist.

## Runtime composition and route mounts

Registered in `apps/api/src/routes/index.ts`:

- `/api/v1/payroll` — payroll administration, runs, payslips, loans and remittances.
- `/api/v1/my/payslips` — current staff member's own payslips.
- `/api/v1/payroll/transfers` — separate salary-transfer module.

All payroll routes authenticate, establish tenant context, require the `modules.payroll` feature and enforce the route permission. Payroll container dependencies include Ledger posting/accounts/reports, Payments' school-header context, shared number sequencing/encryption and Audit.

## HTTP endpoints

All paths below are relative to `/api/v1/payroll`.

### Pay components and profiles

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/components` | `payroll.runs.view` | List components |
| POST | `/components` | `payroll.components.manage` | Create component |
| GET | `/components/:id` | `payroll.runs.view` | Read component |
| PUT | `/components/:id` | `payroll.components.manage` | Update values/accounts, not type/calc type |
| POST | `/components/:id/deactivate` | `payroll.components.manage` | Deactivate |
| POST | `/components/:id/reactivate` | `payroll.components.manage` | Reactivate |
| DELETE | `/components/:id` | `payroll.components.manage` | Delete only if unused |
| GET | `/profiles` | `payroll.profiles.manage` | List active profiles |
| GET | `/profiles/:staffId` | `payroll.profiles.manage` | Current profile and history |
| POST | `/profiles` | `payroll.profiles.manage` | Set effective-dated profile |

### Monthly runs and payslips

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/runs` | `payroll.runs.view` | List runs |
| POST | `/runs` | `payroll.runs.create` | Start a monthly run |
| GET | `/runs/:id` | `payroll.runs.view` | Read run and payslips |
| POST | `/runs/:id/calculate` | `payroll.runs.create` | Calculate/recalculate draft payslips |
| POST | `/runs/:id/submit` | `payroll.runs.create` | Send calculated run for approval |
| POST | `/runs/:id/approve` | `payroll.runs.approve` | First/second approval and accrual |
| POST | `/runs/:id/reject` | `payroll.runs.approve` | Return run to calculated state |
| POST | `/runs/:id/cancel` | `payroll.runs.create` | Cancel unapproved run |
| POST | `/runs/:id/reverse` | `payroll.runs.approve` | Reverse approved but unpaid run |
| POST | `/runs/:id/pay` | `payroll.runs.pay` | Record payment from a money account |
| GET | `/payslips` | `payroll.payslips.view` | List all/own based on scope |
| GET | `/payslips/:id` | `payroll.payslips.view` | Read all/own based on scope |
| GET | `/payslips/:id/document` | `payroll.payslips.view` | Render frozen payslip HTML |

Run list filters by status/year/page/limit. Payslip list filters by run/staff/page/limit. A non-ALL payslip viewer is forced to OWN scope and must resolve to a STAFF persona. Own routes under `/api/v1/my/payslips` always force own scope, even if the user's permission also has ALL.

### Loans and remittances

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/loans` | `payroll.loans.manage` | List staff loans |
| POST | `/loans` | `payroll.loans.manage` | Disburse staff loan |
| GET | `/loans/:id` | `payroll.loans.manage` | Read loan and repayments |
| POST | `/loans/:id/cancel` | `payroll.loans.manage` | Reverse loan with no repayments |
| GET | `/remittances` | `payroll.remittances.manage` | List remittances |
| GET | `/remittances/due` | `payroll.remittances.manage` | Liability balances still owed |
| POST | `/remittances` | `payroll.remittances.manage` | Pay liability from a money account |
| POST | `/remittances/:id/reverse` | `payroll.remittances.manage` | Reverse remittance |

### Own payslip routes

Base `/api/v1/my/payslips`:
- GET `/`
- GET `/:id`
- GET `/:id/document`

All use `payroll.payslips.view`, but the controller forces OWN scope and the use cases return only FINAL/PAID payslips for the authenticated staff persona. Missing/other staff IDs return not found to avoid revealing existence.

## Pay components and calculation

Amounts are whole-kobo BigInt; rates are integer basis points (1000 = 10%). Percent calculations round half-up to a whole kobo. No statutory rates are hard-coded; the school configures its own components and bands.

Component types:
- EARNING: FIXED or PERCENT_OF_BASIC. Earnings can be taxable.
- DEDUCTION: FIXED, PERCENT_OF_BASIC, PERCENT_OF_GROSS or BANDED; must point to a liability account.
- EMPLOYER_CONTRIBUTION: same calculation methods as deductions; must point to a liability account and adds employer cost, not employee deduction.

A banded component applies progressive slices to taxable pay (basic plus taxable earnings). Bands must increase; only the final band may be open-ended. Rates are 0–10000 basis points. Components may have an expense account for earnings/employer contributions; otherwise system salary/employer pension expense accounts are used. Type and calculation method cannot be changed after creation; deactivate and create a new component instead.

Calculation:
1. Basic salary plus earnings = gross.
2. Taxable basic/earnings = banded taxable base.
3. Deductions and employer contributions are calculated.
4. Due staff-loan instalments are added as deductions, capped at remaining loan balance.
5. Net = gross − deductions − loan repayments. Negative net is a calculation problem and the run is not saved.
6. Employer contributions are reported separately and are not deducted from net pay.

## Effective-dated pay profiles

A profile contains basic salary, effective date range, bank details, tax/pension identifiers and component assignments/overrides. Only active staff can receive a profile. A new profile must start after the latest profile's start date; the prior open-ended profile is closed the day before the new effective date.

Bank account number is encrypted before persistence; only last four digits are returned. Payslip snapshots include bank name, account name and last four digits, not full account number.

The profile in force on the last day of the payroll month is selected for calculation. Staff with no active profile are returned separately so the payroll operator can fix missing profiles.

## Payroll run lifecycle and accounting

Lifecycle:

`DRAFT → CALCULATED → PENDING_APPROVAL → APPROVED → PAID`

A run may be rejected back to CALCULATED, cancelled before approval, or reversed after approval only while unpaid.

- One active/non-cancelled run per year/month is intended. Cancelled runs free the month for another run.
- Calculation replaces draft payslips and stores gross, deductions, employer cost, net and staff count; it posts no journal.
- Negative net for any staff member blocks the whole calculation and returns staff-specific shortfalls.
- Active staff with no pay profile are listed separately.
- Submission requires a calculated run with at least one payslip.
- Approval is maker-checker: creator cannot approve their own run unless `finance.allow_self_approval` is true. A second approval is required when the configured threshold is met; first approval only records approver identity/time.
- Final approval applies loan repayments, posts accrual, assigns payslip numbers, freezes snapshots and marks run APPROVED in one transaction.
- Payslip snapshot contains school/staff identity, period, pay date, bank last4, line labels/types/amounts and totals. It is the immutable source for printable payslip HTML.
- Paying an approved run posts Dr Salaries Payable per staff member, Cr selected money account, and marks run/payslips PAID. It records payment; it does not initiate bank transfers.
- A run with live salary transfers cannot be manually marked paid.
- Reversing an approved unpaid run reverses accrual, restores loan repayments, voids payslips and cancels the run.

Accrual journal:
- Debit Salaries Expense for basic and earnings (or configured expense accounts).
- Debit Employer Pension Expense for employer contributions (or configured expense accounts).
- Credit Salaries Payable per staff member for net pay.
- Credit each deduction/employer-contribution liability account.
- Credit Staff Loans Receivable for loan repayments withheld.

## Staff loans

Loan disbursement is a ledger transaction: Dr Staff Loans Receivable for the staff party, Cr selected money account. Monthly repayment is capped at remaining balance and applied only when payroll run is approved. Loan repayment records link to payslip; reversing an unpaid run restores loan balances.

A loan may be cancelled only while ACTIVE with no repayments and full principal still outstanding; cancellation reverses the original disbursement journal.

## Remittances

A remittance pays a liability (tax, pension, union dues, etc.): Dr liability account, Cr selected money account. The use case checks the liability account is active and of type LIABILITY, excludes Salaries Payable, and checks the requested amount does not exceed current owed balance. Reversal restores the liability via a compensating journal.

The `/remittances/due` endpoint returns non-zero balances only for liability accounts whose subtype is `PAYROLL_LIABILITY`. Component configuration currently accepts any LIABILITY account, so a component using a general liability account can post a deduction that does not appear in this due list.

## Persistence and migrations

Key tenant models: `PayComponent`, `StaffPayProfile`, `StaffPayComponent`, `PayrollRun`, `Payslip`, `PayslipLine`, `StaffLoan`, `StaffLoanRepayment`, `PayrollRemittance`. Salary transfers use a separate `SalaryTransfer` model.

Migrations:
- `20261026090000_payroll_phase5`: payroll components/profiles/runs/payslips/loans/remittances, BigInt amount constraints and indexes.
- `20261031090000_salary_transfers`: transfer states, one-live-transfer-per-payslip partial unique index and journal/run/payslip/account references.

Important: `PayrollRun` has a non-unique index on `periodYear, periodMonth`, not a unique constraint. The use case's `existsForMonth` check is application-only and can race under concurrent run creation.

## Tests and verification status

Test source inspected:
- `apps/api/tests/finance/payroll.test.ts`
- `apps/api/tests/finance/support/payroll-world.ts`

The suite covers calculation math, bands, profiles, encryption, run lifecycle, maker-checker, loans, remittances, snapshots and ledger controls using in-memory repositories and the real PostingService. It does not exercise real PostgreSQL concurrency or HTTP route wiring.

**Not executed in this review:** tests, typecheck, build, Prisma generation, migrations, live bank transfers, PostgreSQL concurrency or live API requests.

## Open implementation and verification items

1. **Concurrent run creation can create multiple payroll runs for the same month.** The use case checks `existsForMonth` before insert, but migration has only a non-unique period index. Add a partial unique index for non-cancelled runs (or equivalent atomic reservation) and handle cancelled-run replacement safely.
2. **Second-approval threshold amount is double-counted.** `employerCostKobo` is stored as gross + employer contributions, but `ApproveRunUseCase` calls `approvalsRequired(run.grossKobo + run.employerCostKobo)`. This compares 2×gross + employer contributions against the threshold rather than total employer cost.
3. **Effective-dated profile replacement is not atomic.** `PayProfileRepositoryImpl.createFrom` closes the current profile then creates the next one without a transaction. If creation fails, the old profile remains closed with no replacement. Concurrent profile writes can also overlap.
4. **Calculated payroll can become stale before approval.** Calculation uses the profile in force on the month-end date, but approval re-reads the profile for bank details and does not verify that the profile/component/loan inputs are unchanged. A profile change between calculation and approval can make payslip amounts and bank snapshot refer to different profile versions.
5. **Remittance amount check can race.** Owed liability is read before the posting transaction and not locked/reserved. Concurrent remittances can both pass against the same liability balance and over-remit.
6. **Remittance due list is narrower than component account validation.** Components accept any LIABILITY account, but due list only includes subtype PAYROLL_LIABILITY. Either restrict component liability accounts to the subtype or make due list include every account used by payroll deductions/employer contributions.
7. **Approval threshold and payroll settings are only partly configurable.** `ALLOW_SELF_APPROVAL` and `PAYSLIP_PREFIX` constants are declared in payroll policy; current run logic uses FinanceSettings for self-approval but payslip prefix remains hard-coded. Verify settings contract and remove stale constants or wire the intended settings.
8. **No HTTP or populated-schema tests were found.** Add route/permission/persona tests for own payslips, profiles, approval, pay, loans and remittances; add PostgreSQL concurrency tests for duplicate run creation, profile history and remittance.
9. **Run payroll tests, typecheck/build and migration checks** against a disposable tenant schema before production rollout.

## Source paths reviewed

- `apps/api/src/modules/payroll/routes/`
- `apps/api/src/modules/payroll/controllers/`
- `apps/api/src/modules/payroll/dtos/payroll.dto.ts`
- `apps/api/src/modules/payroll/domain/`
- `apps/api/src/modules/payroll/payroll.permissions.ts`
- `apps/api/src/modules/payroll/payroll.container.ts`
- `apps/api/src/modules/payroll/usecases/`
- `apps/api/src/modules/payroll/repositories/`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261026090000_payroll_phase5/migration.sql`
- `apps/api/prisma/tenant-migrations/20261031090000_salary_transfers/migration.sql`
- `apps/api/tests/finance/payroll.test.ts`
