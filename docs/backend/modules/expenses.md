# Expenses Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide covers vendors, expenses/bills, approvals, outgoing payments, budgets, recurring expenses and expense reports. Test sources and migrations were inspected but not executed in this review.

## Responsibility and boundaries

Expenses owns school spending and supplier liabilities:

- Vendor/supplier records, including encrypted bank account numbers.
- Direct expenses and bills, expense lines and input VAT.
- Draft, submit, approve, reject, void and payment reversal workflows.
- Partial bill payments.
- Recurring expense templates and daily execution.
- Budgets and planned-vs-actual checks.
- Expense, creditor and petty-cash reports.

Ledger owns accounts, periods and journals. Expenses calls the shared `PostingService`; it does not create journal rows directly. Finance Settings provides approval thresholds, self-approval, budget enforcement, VAT and other school-level policies. Audit records all significant actions.

## Runtime composition and route mounts

The routers are registered in `apps/api/src/routes/index.ts`:

- `/api/v1/expenses` — expenses, expense reports, creditors and petty cash.
- `/api/v1/vendors` — vendor management.
- `/api/v1/budgets` — budget management and variance.
- `/api/v1/recurring-expenses` — recurring templates and run-now.

Expense, vendor and recurring routes require the `modules.expenses` entitlement. Budget routes require `finance.budgets`. All routes authenticate, establish tenant context and enforce school permissions.

The container depends on Ledger (`postingService`, `ledgerAccountRepository`, `cashBookUseCase`), shared number sequencing and encryption, audit, finance settings and the tenant repositories.

## HTTP endpoints

### Expenses — base `/api/v1/expenses`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `expenses.view` | Paginated/filterable expense list |
| POST | `/` | `expenses.create` | Create draft direct expense or bill |
| GET | `/:id` | `expenses.view` | Read expense, lines and payments |
| PUT | `/:id` | `expenses.create` | Edit draft/rejected expense with version |
| DELETE | `/:id` | `expenses.create` | Delete draft/rejected expense |
| POST | `/:id/submit` | `expenses.create` | Number and submit; may auto-approve below threshold |
| POST | `/:id/approve` | `expenses.approve` | First/second approval or final posting |
| POST | `/:id/reject` | `expenses.approve` | Reject with reason |
| POST | `/:id/void` | `expenses.void` | Reverse payments and accrual |
| POST | `/:id/payments` | `expenses.pay` | Pay approved bill fully or partially |
| POST | `/:id/payments/:paymentId/reverse` | `expenses.void` | Reverse one bill payment |
| GET | `/reports/expenses` | `finance.reports.view` | Approved expense lines by account/vendor/month/term |
| GET | `/reports/creditors` | `finance.reports.view` | Supplier balances and ageing |
| GET | `/petty-cash` | `expenses.view` | Petty cash book |

List filters include status, kind, vendor, requester, date range, query and overdue. Expense report requires from/to dates and optional grouping/vendor/term. Creditor report accepts as-of date/vendor. Petty cash accepts from/to.

### Vendors — base `/api/v1/vendors`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `expenses.view` | List vendors |
| POST | `/` | `vendors.manage` | Create vendor |
| GET | `/:id` | `expenses.view` | Read vendor |
| PUT | `/:id` | `vendors.manage` | Update vendor |
| POST | `/:id/deactivate` | `vendors.manage` | Deactivate |
| POST | `/:id/reactivate` | `vendors.manage` | Reactivate |
| DELETE | `/:id` | `vendors.manage` | Delete only if unused |

Vendor account numbers must be 10 digits, are encrypted before persistence, and are never returned in full. The response exposes only the last four digits and a presence flag. A vendor with expenses cannot be deleted; deactivate it to preserve history.

### Budgets — base `/api/v1/budgets`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `budgets.view` | List budgets |
| POST | `/` | `budgets.manage` | Create draft budget |
| GET | `/:id` | `budgets.view` | Read budget and lines |
| GET | `/:id/vs-actual` | `budgets.view` | Planned vs actual by account |
| PUT | `/:id` | `budgets.manage` | Update draft/active metadata |
| PUT | `/:id/lines` | `budgets.manage` | Replace all lines |
| POST | `/:id/activate` | `budgets.manage` | Activate non-empty draft |
| POST | `/:id/close` | `budgets.manage` | Close active budget |
| DELETE | `/:id` | `budgets.manage` | Delete draft only |

Budget lines contain an income/expense account, planned kobo, optional term and note. Duplicate account+term lines are rejected. Active budgets are checked during expense approval according to `finance.budget_enforcement` (`off`, `warn`, `block`).

### Recurring expenses — base `/api/v1/recurring-expenses`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `expenses.view` | List recurring templates |
| POST | `/` | `expenses.create` | Create template |
| GET | `/:id` | `expenses.view` | Read template |
| PUT | `/:id` | `expenses.create` | Update template |
| POST | `/:id/pause` | `expenses.create` | Pause |
| POST | `/:id/resume` | `expenses.create` | Resume |
| DELETE | `/:id` | `expenses.create` | Delete only before it has generated expenses |
| POST | `/run` | `expenses.create` | Run due templates for the current school |

Turning on `autoApprove` at create/update additionally requires `expenses.approve` in the controller. The current `/run` route itself is guarded only by `expenses.create`; see remediation item REM-032.

## Expense preparation and money rules

- Request amounts are whole kobo converted to BigInt. Amounts can be safe JSON integers or digit strings up to 18 digits.
- Expense line amount is the cost before VAT. VAT is stored separately on the line and added to total.
- Total is the sum of line amount + VAT.
- Every line must point to an active EXPENSE account, not a money account.
- A bill requires an active vendor. Direct expenses may optionally have a vendor.
- Expense date must be a real calendar date and not in the future in the finance timezone. Due date cannot precede expense date.
- DIRECT expenses require a cash/bank/petty-cash account by submission/approval; online clearing is forbidden.
- VAT is only allowed when the school's `finance.vat_enabled` setting is on. The caller may provide exact VAT or request calculation using the configured basis-point rate, not both.
- Expense numbers are allocated on submission, not draft creation: `EXP-YYYY-000001`.

## Approval and journal workflow

Lifecycle:

`DRAFT → PENDING_APPROVAL → APPROVED / PAID`

Other transitions: PENDING_APPROVAL → REJECTED → DRAFT; approved/part-paid/paid → VOID. A version field protects edits and transitions against stale updates.

Approval settings:
- `finance.expense_approval_required`
- `finance.expense_approval_threshold_kobo`
- `finance.second_approval_threshold_kobo`
- `finance.allow_self_approval`

Below the required threshold (or when approval is disabled), submission auto-approves. At/above the second-approval threshold, two different approvers are required; the first approval records identity/time but does not post. Requester self-approval is rejected unless the setting allows it.

**BILL approval:** Dr each expense account (and VAT Receivable for input VAT), Cr Accounts Payable with vendor party. The bill remains payable until paid.

**DIRECT approval:** Dr expense accounts and VAT Receivable, Cr selected money account. A payment record is created and the expense becomes PAID.

**Bill payment:** Dr Accounts Payable with vendor party, Cr selected cash/bank/petty-cash account. Partial payments update paid amount and status; payment cannot exceed outstanding balance.

**Void:** In one tenant transaction, reverse every live payment journal, reverse the bill accrual journal, mark payments reversed and set expense VOID. Journals are not deleted.

All posting goes through `PostingService`, so the ledger enforces balanced entries, active accounts, non-future dates, open periods and idempotency.

## Budget enforcement

For an expense date, active budget lines covering that date are loaded. Actual spend is net debit less credit on the expense account within the budget's date/term window. The proposed expense amount is added to actual:

- `off`: no check.
- `warn`: approval proceeds and returns budget warnings.
- `block`: approval fails with `BUDGET_EXCEEDED`.

A budget can be draft, active or closed. Only active budgets are used for approval checks. An active budget needs at least one line. Budget vs actual reports income accounts as credits less debits and expense accounts as debits less credits.

## Recurring expense execution

Frequency values: WEEKLY, MONTHLY, TERMLY and YEARLY. Occurrences are calculated from the original start date to avoid month-end drift (e.g. 31 January → 28 February → 31 March). TERMLY currently means a fixed four-month interval, not the school's actual term calendar.

The daily runner:
- Loads active templates whose next run date is due.
- Creates a draft for each due occurrence and submits it.
- Applies approval settings; auto-approval is permitted only when the approval workflow allows one approver.
- Catches up at most 12 occurrences per template per run.
- Uses a unique (template, expense date) constraint to avoid duplicate generated expenses.
- Reports per-template failures and continues with other templates.
- Advances next run date after successful/duplicate occurrences; a failing occurrence remains due for retry.
- Runs across provisioned active schools in separate tenant contexts; one school failure does not stop the rest.

The run-now route executes the same workflow for the current school. Its authorization currently does not re-check whether a due template will auto-approve; see REM-032.

## Reports

- Expense report groups approved/partially-paid/paid expense lines by account/vendor/month/term. Expense-line amount excludes input VAT, which is held in VAT Receivable rather than an expense account.
- Creditors report uses approved/partially-paid bills, subtracts payments and ages the remaining payable by due date (or expense date fallback).
- Petty cash report is the cash book for the PETTY_CASH system account; top-ups are transfers from bank, spends are expense journals.
- Budget variance compares planned amounts to posted journal net debits/credits, not draft expenses.

## Persistence and migrations

Tenant models include `Vendor`, `Expense`, `ExpenseLine`, `ExpensePayment`, `RecurringExpense`, `Budget` and `BudgetLine`. Vendor bank account numbers are stored in `accountNumberEncrypted` with `accountNumberLast4` for display. Expense totals/paid amounts and budget amounts are BigInt.

Relevant migrations:
- `20261025090000_expenses_phase3`: vendors, expenses, lines, outgoing payments, recurring templates, budgets and database amount/date constraints.
- `20261029090000_expense_vat`: VAT amount per line, non-negative constraint and VAT Receivable system account provisioning.

## Tests and verification status

Test source inspected:
- `apps/api/tests/finance/expenses.test.ts`
- `apps/api/tests/finance/support/expenses-world.ts`

The in-memory test world uses the real PostingService and covers drafts, preparation, approval, direct expense, bill payment, payment reversal, voiding, budgets and recurrence date helpers. The inspected test file does not exercise the recurring repository/runner, two-approver race, budget concurrency, vendor encryption persistence or HTTP routes. No dedicated populated-schema migration test or router integration test was found.

**Not executed in this review:** tests, typecheck, build, migrations, real PostgreSQL, recurring worker, encryption provider, HTTP routes or live finance posting.

## Open implementation and verification items

1. **Run-now endpoint can trigger auto-approval without the caller's approval permission.** The route requires only `expenses.create`; the controller checks `expenses.approve` only when a template is created/updated with `autoApprove=true`. A user with only `expenses.create` can call `POST /run` and cause an existing auto-approve template to post expenses. See REM-032.
2. **Budget block mode can be bypassed by concurrent approvals.** Budget check reads posted actuals before posting and does not lock/reserve the relevant budget/account. Two concurrent approvals can both pass against the same remaining budget and together exceed it. See REM-033.
3. **Budget line replacement is not atomic.** `replaceLines` deletes old lines then inserts replacements without an explicit tenant transaction. If insertion fails, the budget can lose its previous lines. See REM-034.
4. **Recurring auto-approval is attributed to the template creator.** The background runner passes `createdById` as the approver/actor for generated expenses, even when the actual action is performed by the system scheduler. This can make audit/journal attribution misleading. See REM-035.
5. **TERMLY recurrence is a fixed four-month interval.** Decide whether that is acceptable or whether recurring dates should align to configured school term dates.
6. **Recurring workflow has no dedicated tests in the inspected suite.** Add tests for template validation, create/update authorization, pause/resume/delete, catch-up, idempotency, failures, run-now permissions and system actor.
7. **No HTTP or populated-schema migration tests were found.** Add route/tenant/permission tests and DB migration coverage for vendors, expenses, budgets and recurring templates.
8. **Audit writes for vendor/budget/template/draft actions occur after writes.** Align failure behavior with the shared audit policy; expense approval itself calls audit inside the caller transaction.
9. **Run finance expense tests, typecheck/build and migration checks** against a disposable PostgreSQL tenant before rollout.

## Source paths reviewed

- `apps/api/src/modules/expenses/routes/`
- `apps/api/src/modules/expenses/controllers/`
- `apps/api/src/modules/expenses/dtos/`
- `apps/api/src/modules/expenses/domain/`
- `apps/api/src/modules/expenses/expenses.permissions.ts`
- `apps/api/src/modules/expenses/expenses.container.ts`
- `apps/api/src/modules/expenses/services/`
- `apps/api/src/modules/expenses/usecases/`
- `apps/api/src/modules/expenses/repositories/`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261025090000_expenses_phase3/migration.sql`
- `apps/api/prisma/tenant-migrations/20261029090000_expense_vat/migration.sql`
- `apps/api/tests/finance/expenses.test.ts`
