# Finance API Operation Inventory

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This is a source-derived route and operation inventory, not the canonical OpenAPI document. Route declarations, mount composition and route-level middleware were inspected. Existing finance module guides were used for business invariants and known implementation notes. This pass does **not** claim runtime HTTP verification or complete request/response schema coverage.

## Scope and count

This inventory covers the finance-related school API route files mounted under `/api/v1`.

| Area | Route files | Operations |
|---|---:|---:|
| Fees (setup, invoices, adjustments, reports/family views) | 4 | 43 |
| Payments | 1 | 20 |
| Ledger | 1 | 19 |
| Expenses, budgets, vendors, recurring expenses | 4 | 38 |
| Payroll and own payslips | 2 | 34 |
| Salary transfers | 1 | 7 |
| Finance settings | 1 | 2 |
| Bank reconciliation | 1 | 16 |
| Gateway settlements | 1 | 7 |
| Finance reports | 1 | 4 |
| **Total** | **17** | **190** |

Counts are the number of Express `router.get/post/put/patch/delete` declarations in the reviewed files. They count declarations, not unique URL strings; identical relative paths on different routers are distinct operations.

## Global HTTP and tenant behavior

- All operations in this inventory are school-realm routes. The route guards call `authenticate` and `requireTenant`; effective authorization also depends on the permission registry and use-case/controller scope checks.
- Most finance modules additionally gate access by plan feature. The exact feature differs by module and is recorded below.
- The API application mounts the versioned router at `/api/v1`. Compose each module's route mount with its relative path below.
- The authenticated actor is derived from the verified request session; clients must not send an acting-user ID as authority.
- DTO validation is explicit on write operations listed in source. Reads commonly parse query input in controllers/use cases; do not assume route-level validation middleware normalizes query defaults.
- Amounts in the finance domain are whole kobo. The module guides document JSON-safe serialization as number-or-digit-string where values exceed JavaScript's safe integer range. Frontends must not coerce every monetary value to a JavaScript number.
- Route declarations and module guides do not establish a universal response envelope. Controller and response-helper behavior must be checked per operation before writing OpenAPI response schemas.

## Fees — 43 operations

Feature gate: `modules.fees`.

### Fee setup — mount `/fees`

| Method | Relative path | Permission | DTO |
|---|---|---|---|
| GET | `/types` | `fees.setup.view` | — |
| POST | `/types` | `fees.types.manage` | `CreateFeeTypeDto` |
| GET | `/types/:id` | `fees.setup.view` | — |
| PUT | `/types/:id` | `fees.types.manage` | `UpdateFeeTypeDto` |
| DELETE | `/types/:id` | `fees.types.manage` | — |
| GET | `/structures` | `fees.setup.view` | — |
| POST | `/structures` | `fees.structures.manage` | `CreateFeeStructureDto` |
| GET | `/structures/:id` | `fees.setup.view` | — |
| PUT | `/structures/:id` | `fees.structures.manage` | `UpdateFeeStructureDto` |
| DELETE | `/structures/:id` | `fees.structures.manage` | — |
| GET | `/discount-rules` | `fees.setup.view` | — |
| POST | `/discount-rules` | `fees.discounts.manage` | `CreateDiscountRuleDto` |
| PUT | `/discount-rules/:id` | `fees.discounts.manage` | `UpdateDiscountRuleDto` |
| DELETE | `/discount-rules/:id` | `fees.discounts.manage` | — |
| GET | `/students/:studentId/discounts` | `fees.setup.view` | — |
| POST | `/students/:studentId/discounts` | `fees.discounts.manage` | `GiveStudentDiscountDto` |
| DELETE | `/students/:studentId/discounts/:discountId` | `fees.discounts.manage` | — |

### Invoices and instalments — mount `/fees/invoices`

| Method | Relative path | Permission | DTO |
|---|---|---|---|
| GET | `/` | `fees.invoices.view` | — |
| POST | `/` | `fees.invoices.create` | `CreateInvoiceDto` |
| POST | `/generate` | `fees.invoices.create` | `GenerateInvoicesDto` |
| POST | `/issue` | `fees.invoices.issue` | `BulkIssueDto` |
| POST | `/opening-balances` | `fees.invoices.issue` | `OpeningBalancesDto` |
| POST | `/late-fees/run` | `fees.invoices.issue` | `RunLateFeesDto` |
| GET | `/:id` | `fees.invoices.view` | — |
| PUT | `/:id` | `fees.invoices.create` | `UpdateDraftInvoiceDto` |
| DELETE | `/:id` | `fees.invoices.create` | — |
| POST | `/:id/issue` | `fees.invoices.issue` | `IssueInvoiceDto` |
| POST | `/:id/void` | `fees.invoices.void` | `VoidInvoiceDto` |
| PUT | `/:id/instalments` | `fees.invoices.issue` | `SaveInstalmentPlanDto` |
| GET | `/:id/instalments` | `fees.invoices.view` | — |
| DELETE | `/:id/instalments` | `fees.invoices.issue` | — |

### Adjustments — mount `/fees/adjustments`

| Method | Relative path | Permission | DTO |
|---|---|---|---|
| GET | `/` | `fees.invoices.view` | — |
| POST | `/` | `fees.adjustments.request` | `RequestAdjustmentDto` |
| GET | `/:id` | `fees.invoices.view` | — |
| POST | `/:id/approve` | `fees.adjustments.approve` | `ApproveAdjustmentDto` |
| POST | `/:id/reject` | `fees.adjustments.approve` | `RejectAdjustmentDto` |

### Fee reports and family views — mount `/fees`

| Method | Relative path | Permission | Query/body notes |
|---|---|---|---|
| GET | `/reports/ageing` | `fees.reports.view` | `asOf`, branch/class/term filters |
| GET | `/reports/defaulters` | `fees.reports.view` | Same filters; optional minimum kobo |
| GET | `/reports/collections` | `fees.reports.view` | Inclusive `from`/`to`, grouping, branch |
| GET | `/statements/:studentId` | `fees.invoices.view` | Optional date bounds |
| GET | `/my/children` | `fees.view` | Authenticated family context |
| GET | `/my/invoices` | `fees.view` | Optional student filter; own/linked children |
| GET | `/my/statement/:studentId` | `fees.view` | Own/linked child only; optional date bounds |

Key workflow constraints from the Fees guide: drafts are not journalled or family-visible; issuing assigns a number and posts through Ledger; voiding an issued invoice is restricted after payments/approved adjustments; adjustment approval may require a second approver; instalment schedules do not themselves move money.

## Payments — 20 operations

Mount: `/payments`. Feature gate: `modules.fees`.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `payments.view` | List/filter payments |
| POST | `/` | `payments.record` | `RecordPaymentDto`; cash/POS may confirm immediately, other methods can remain pending |
| POST | `/allocation-preview` | `payments.record` | `AllocationPreviewDto`; preview only |
| GET | `/my` | `payments.pay` | Authenticated guardian payment history |
| POST | `/online/initialize` | `payments.pay` | `InitializeOnlinePaymentDto` |
| GET | `/online/verify/:reference` | `payments.pay` | Provider verification; browser return is not trusted as payment proof |
| POST | `/online/settlements` | `payments.settle` | `RecordSettlementDto`; legacy gross/fee settlement operation |
| GET | `/credit/:studentId` | `payments.view` | Student credit |
| POST | `/credit/apply` | `payments.record` | `ApplyCreditDto` |
| GET | `/refunds` | `payments.view` | Refund list |
| POST | `/refunds` | `payments.refund.request` | `RequestRefundDto` |
| GET | `/refunds/:id` | `payments.view` | Refund detail |
| POST | `/refunds/:id/approve` | `payments.refund.approve` | `ApproveRefundDto` |
| POST | `/refunds/:id/reject` | `payments.refund.approve` | `RejectRefundDto` |
| POST | `/refunds/:id/pay` | `payments.refund.approve` | `PayRefundDto`; payout from money account |
| GET | `/:id` | `payments.view` | Payment and allocations |
| GET | `/:id/receipt` | `payments.view` | Frozen receipt snapshot |
| POST | `/:id/confirm` | `payments.confirm` | `ConfirmPaymentDto`; separation of recorder and confirmer |
| POST | `/:id/reject` | `payments.confirm` | `RejectPaymentDto` |
| POST | `/:id/reverse` | `payments.reverse` | `ReversePaymentDto`; reversal constrained when refunds exist |

Family payment routes derive guardian identity from the authenticated persona and verify linked-child access. Manual payment requests may accept `clientRequestId` for retry idempotency. Allocation defaults to oldest due invoices; unallocated remainder becomes student advance credit.

## Ledger — 19 operations

Mount: `/finance`. Route feature gate: `modules.fees`.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/accounts` | `finance.accounts.view` | Filters: status, type, q, withBalances |
| POST | `/accounts` | `finance.accounts.manage` | `CreateAccountDto` |
| GET | `/accounts/:id` | `finance.accounts.view` | Account detail |
| PUT | `/accounts/:id` | `finance.accounts.manage` | `UpdateAccountDto`; system account identity restrictions apply |
| POST | `/accounts/:id/deactivate` | `finance.accounts.manage` | Deactivate |
| POST | `/accounts/:id/reactivate` | `finance.accounts.manage` | Reactivate |
| DELETE | `/accounts/:id` | `finance.accounts.manage` | Delete subject to usage constraints |
| GET | `/journals` | `finance.journals.view` | Journal list |
| POST | `/journals` | `finance.journals.post` | `ManualJournalDto`; written reason |
| GET | `/journals/:id` | `finance.journals.view` | Journal detail |
| POST | `/journals/:id/reverse` | `finance.journals.reverse` | `ReverseJournalDto` |
| POST | `/opening-balances` | `finance.journals.post` | `OpeningBalanceDto` |
| POST | `/transfers` | `finance.journals.post` | `TransferDto`; internal money transfer |
| GET | `/periods` | `finance.periods.view` | Accounting periods |
| GET | `/periods/:id/close-checklist` | `finance.periods.view` | Outstanding close blockers |
| POST | `/periods/:id/close` | `finance.periods.close` | `ClosePeriodDto`; warning acknowledgement where applicable |
| POST | `/periods/:id/reopen` | `finance.periods.reopen` | `ReopenPeriodDto`; written reason |
| GET | `/reports/account-balances` | `finance.reports.view` | Account balances |
| GET | `/reports/cash-book` | `finance.reports.view` | Cash book |

Ledger is the journal-writing boundary. Source modules should call its posting service rather than directly creating or mutating journal rows. Posting enforces balanced entries, active accounts, open periods, valid dates and source/purpose idempotency.

## Expenses, vendors, budgets and recurring expenses — 38 operations

### Expenses — mount `/expenses`; feature `modules.expenses`

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/reports/expenses` | `finance.reports.view` | Date/group/vendor/term filters |
| GET | `/reports/creditors` | `finance.reports.view` | As-of/vendor filters |
| GET | `/petty-cash` | `expenses.view` | Date range |
| GET | `/` | `expenses.view` | Filtered/paginated list |
| POST | `/` | `expenses.create` | `CreateExpenseDto`; draft |
| GET | `/:id` | `expenses.view` | Detail with lines/payments |
| PUT | `/:id` | `expenses.create` | `UpdateExpenseDto`; draft/rejected only |
| DELETE | `/:id` | `expenses.create` | Draft/rejected only |
| POST | `/:id/submit` | `expenses.create` | `SubmitExpenseDto`; may self-approve under threshold |
| POST | `/:id/approve` | `expenses.approve` | `ApproveExpenseDto`; requester separation |
| POST | `/:id/reject` | `expenses.approve` | `RejectExpenseDto` |
| POST | `/:id/void` | `expenses.void` | `VoidExpenseDto`; reverses generated journals |
| POST | `/:id/payments` | `expenses.pay` | `PayExpenseDto`; full/partial payment |
| POST | `/:id/payments/:paymentId/reverse` | `expenses.void` | `ReversePaymentDto` |

### Budgets — mount `/budgets`; feature `finance.budgets`

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `budgets.view` | Status/page/limit |
| POST | `/` | `budgets.manage` | `CreateBudgetDto` |
| GET | `/:id` | `budgets.view` | Detail |
| GET | `/:id/vs-actual` | `budgets.view` | Actual vs budget as of date |
| PUT | `/:id` | `budgets.manage` | `UpdateBudgetDto` |
| PUT | `/:id/lines` | `budgets.manage` | `SetBudgetLinesDto` |
| POST | `/:id/activate` | `budgets.manage` | Activate |
| POST | `/:id/close` | `budgets.manage` | Close |
| DELETE | `/:id` | `budgets.manage` | Draft only |

### Vendors — mount `/vendors`; feature `modules.expenses`

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `expenses.view` | Search/status/page/limit |
| POST | `/` | `vendors.manage` | `CreateVendorDto` |
| GET | `/:id` | `expenses.view` | Detail |
| PUT | `/:id` | `vendors.manage` | `UpdateVendorDto` |
| POST | `/:id/deactivate` | `vendors.manage` | Deactivate |
| POST | `/:id/reactivate` | `vendors.manage` | Reactivate |
| DELETE | `/:id` | `vendors.manage` | Delete subject to usage constraints |

Vendor bank account numbers are encrypted at rest; the module guide states responses expose only the last four digits.

### Recurring expenses — mount `/recurring-expenses`; feature `modules.expenses`

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `expenses.view` | Active/page/limit |
| POST | `/` | `expenses.create` | `CreateRecurringDto` |
| POST | `/run` | `expenses.create` | Run due schedules now |
| GET | `/:id` | `expenses.view` | Detail |
| PUT | `/:id` | `expenses.create` | `UpdateRecurringDto` |
| POST | `/:id/pause` | `expenses.create` | Pause |
| POST | `/:id/resume` | `expenses.create` | Resume |
| DELETE | `/:id` | `expenses.create` | Delete |

Enabling `autoApprove` additionally requires `expenses.approve`, checked by the controller/use case rather than the route guard alone.

## Payroll — 34 operations

Feature gate: `modules.payroll`.

### Payroll administration — mount `/payroll`

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/components` | `payroll.runs.view` | List pay components |
| POST | `/components` | `payroll.components.manage` | `CreateComponentDto` |
| GET | `/components/:id` | `payroll.runs.view` | Detail |
| PUT | `/components/:id` | `payroll.components.manage` | `UpdateComponentDto` |
| POST | `/components/:id/deactivate` | `payroll.components.manage` | Deactivate |
| POST | `/components/:id/reactivate` | `payroll.components.manage` | Reactivate |
| DELETE | `/components/:id` | `payroll.components.manage` | Delete subject to usage |
| GET | `/profiles` | `payroll.profiles.manage` | Staff payroll profiles |
| POST | `/profiles` | `payroll.profiles.manage` | `SetProfileDto` |
| GET | `/profiles/:staffId` | `payroll.profiles.manage` | Staff profile |
| GET | `/runs` | `payroll.runs.view` | Payroll runs |
| POST | `/runs` | `payroll.runs.create` | `CreateRunDto` |
| GET | `/runs/:id` | `payroll.runs.view` | Run detail |
| POST | `/runs/:id/calculate` | `payroll.runs.create` | Calculate |
| POST | `/runs/:id/submit` | `payroll.runs.create` | Submit |
| POST | `/runs/:id/cancel` | `payroll.runs.create` | `CancelRunDto` |
| POST | `/runs/:id/approve` | `payroll.runs.approve` | `ApproveRunDto` |
| POST | `/runs/:id/reject` | `payroll.runs.approve` | `RejectRunDto` |
| POST | `/runs/:id/reverse` | `payroll.runs.approve` | `ReverseRunDto` |
| POST | `/runs/:id/pay` | `payroll.runs.pay` | `PayRunDto` |
| GET | `/payslips` | `payroll.payslips.view` | ALL/OWN scope |
| GET | `/payslips/:id` | `payroll.payslips.view` | ALL/OWN scope |
| GET | `/payslips/:id/document` | `payroll.payslips.view` | Payslip document |
| GET | `/loans` | `payroll.loans.manage` | Loan list |
| POST | `/loans` | `payroll.loans.manage` | `CreateLoanDto` |
| GET | `/loans/:id` | `payroll.loans.manage` | Loan detail |
| POST | `/loans/:id/cancel` | `payroll.loans.manage` | `CancelLoanDto` |
| GET | `/remittances` | `payroll.remittances.manage` | Remittance list |
| GET | `/remittances/due` | `payroll.remittances.manage` | Due remittances |
| POST | `/remittances` | `payroll.remittances.manage` | `CreateRemittanceDto` |
| POST | `/remittances/:id/reverse` | `payroll.remittances.manage` | `ReverseRemittanceDto` |

### Own payslips — mount `/my/payslips`

| Method | Relative path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `payroll.payslips.view` | Current user's payslips |
| GET | `/:id` | `payroll.payslips.view` | Current user's payslip |
| GET | `/:id/document` | `payroll.payslips.view` | Current user's payslip document |

The own-payslip router uses the same permission and payroll feature gate, with the controller invoking the OWN-persona path.

## Salary transfers — 7 operations

Mount: `/payroll/transfers`. Feature gate: `modules.payroll`. Transfers remain unavailable unless both platform and school finance settings enable them.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `payroll.runs.view` | Filter transfers by status/run |
| GET | `/runs/:runId` | `payroll.runs.view` | Transfers and status totals for a run |
| POST | `/runs/:runId/start` | `payroll.transfers.send` | `StartTransfersDto`; creates pending transfer records, does not send |
| POST | `/runs/:runId/send` | `payroll.transfers.send` | Strict empty body; sends pending transfers |
| POST | `/reconcile` | `payroll.transfers.reconcile` | `ReconcileTransfersDto`; provider status lookup |
| POST | `/:id/retry` | `payroll.transfers.send` | `RetryTransferDto` |
| POST | `/:id/cancel` | `payroll.transfers.send` | Strict empty body; only unsent transfers |

## Finance settings — 2 operations

Mount: `/finance/settings`. No plan feature gate is applied in this route file.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/` | `finance.settings.view` | Effective values, defaults and school overrides |
| PUT | `/` | `finance.settings.manage` | `UpdateFinanceSettingsDto`; null restores a default |

## Bank reconciliation — 16 operations

Mount: `/finance/reconciliation`. Feature gate: `finance.bank_reconciliation`.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/accounts` | `finance.bank_reconciliation.view` | Bank accounts and reconciliation state |
| GET | `/statements` | `finance.bank_reconciliation.view` | Optional account filter |
| POST | `/statements` | `finance.bank_reconciliation.import` | `ImportStatementDto`; CSV text or parsed rows |
| DELETE | `/statements/:id` | `finance.bank_reconciliation.import` | Only if no statement line is matched |
| GET | `/bank-lines` | `finance.bank_reconciliation.view` | Account/status/date/statement filters |
| GET | `/book-lines` | `finance.bank_reconciliation.view` | Ledger lines and filters |
| GET | `/suggestions` | `finance.bank_reconciliation.view` | Suggested matches; ambiguous suggestions flagged |
| POST | `/auto-match` | `finance.bank_reconciliation.match` | `AutoMatchDto`; applies unambiguous suggestions |
| POST | `/matches` | `finance.bank_reconciliation.match` | `MatchDto`; explicit bank/book line pairing |
| DELETE | `/matches/:id` | `finance.bank_reconciliation.match` | Undo a pairing |
| POST | `/bank-lines/:id/entry` | `finance.bank_reconciliation.post` | `CreateEntryDto`; post missing charge/interest |
| POST | `/book-lines/clear` | `finance.bank_reconciliation.post` | `ClearBookLinesDto`; explain unmatched book entries |
| GET | `/summary` | `finance.bank_reconciliation.view` | Account/period; optional statement balance |
| GET | `/reconciliations` | `finance.bank_reconciliation.view` | Signed-off periods |
| POST | `/reconciliations` | `finance.bank_reconciliation.complete` | `CompleteReconciliationDto`; sign off month |
| POST | `/reconciliations/:id/reopen` | `finance.bank_reconciliation.complete` | `ReopenReconciliationDto`; written reason/latest month constraint |

## Gateway settlements — 7 operations

Mount: `/finance/settlements`. Feature gate: `modules.fees`.

| Method | Relative path | Permission | DTO / behavior |
|---|---|---|---|
| GET | `/unsettled` | `payments.view` | Confirmed online payments not yet paid out |
| GET | `/` | `payments.view` | Settlement list |
| POST | `/report/preview` | `payments.settle` | `SettlementReportDto`; Paystack report preview only |
| POST | `/report` | `payments.settle` | `SettlementReportDto`; records clean report settlements |
| POST | `/` | `payments.settle` | `SettlePaymentsDto`; manual itemized settlement |
| GET | `/:id` | `payments.view` | Settlement with paid-out payment items |
| POST | `/:id/reverse` | `payments.settle` | `ReverseSettlementDto`; written reason |

## Finance reports — 4 operations

Mount: `/finance`. The first two operations use route-level permission and feature checks. The report engine performs per-report permission and feature checks for execution/export.

| Method | Relative path | Route-level permission/feature | Behavior |
|---|---|---|---|
| GET | `/reports` | `finance.reports.view` + `modules.fees` | List reports available to caller |
| GET | `/dashboard` | `finance.reports.view` + `modules.fees` | Proprietor finance dashboard |
| GET | `/reports/:key/export` | Engine-level checks | CSV export; report-specific permission/feature plus export permission |
| GET | `/reports/:key` | Engine-level checks | Run report with validated query parameters |

Report catalogue keys and parameter schemas are defined in `finance-reports/services/report-catalogue.ts`, not in the route file. Current module guide lists trial balance, general ledger, income statement, balance sheet, cash flow, account balances, cash book, expense report, creditors, debtors ageing, collections and payroll summary. Report output is normalized table data; export is CSV.

## Cross-cutting contract risks and follow-up checks

These are source-audit observations, not runtime-confirmed failures. Existing remediation IDs should be reused rather than duplicated.

1. **Legacy settlement route overlap — known remediation REM-074.** `POST /api/v1/payments/online/settlements` and the itemized settlement workflow under `/api/v1/finance/settlements` are both mounted. The Payments guide identifies the former as legacy gross/fee-only posting that does not create `GatewaySettlementItem` records. The frontend must not treat these as interchangeable. Retire/delegate the legacy route or clearly mark it deprecated before final OpenAPI publication.
2. **Feature-gate inconsistency requires an explicit product decision.** Ledger routes use `modules.fees` as the feature gate; the route comments call it the finance entitlement. Finance Settings has no plan feature gate. Budgets use `finance.budgets`; bank reconciliation uses `finance.bank_reconciliation`. Confirm these are intentional entitlement boundaries and that the platform catalogue seeds/grants them.
3. **Finance Reports route guards are intentionally incomplete at the route layer.** `GET /reports/:key` and `GET /reports/:key/export` rely on engine-level report-specific permission/feature checks. OpenAPI security documentation must describe the effective checks, not falsely claim no permission requirement.
4. **Own payslip endpoint overlap.** `/my/payslips` and `/payroll/payslips` expose overlapping concepts with different controller paths/persona scoping. The client should use the own-persona endpoint for the logged-in staff member and the administrative route for permitted staff-wide access.
5. **Route-level DTO coverage is uneven.** Read endpoints generally have no `validate()` middleware; parameter and query parsing must be confirmed in controllers/use cases. Path IDs are not uniformly validated at the route layer.
6. **Binary/document response behavior needs controller inspection.** Payslip document endpoints may return files/streamed content; do not model them as ordinary JSON without checking controller headers and storage behavior.
7. **Import payload semantics need DTO/controller inspection.** Bank statement import describes CSV text or parsed rows. The final contract must specify exact accepted payload shape, encoding, limits and error behavior.
8. **Money representation is not a plain number contract.** Preserve safe-integer-or-digit-string serialization and kobo units across all financial schemas.
9. **Pagination and list envelopes are not assumed uniform.** Confirm each controller's `meta`, page/limit and filtering semantics before defining reusable OpenAPI response schemas.
10. **No runtime verification was performed for this inventory.** No HTTP integration suite, live request, typecheck, build, provider interaction, queue/worker run or migration execution was performed as part of this pass.

## Source files reviewed

Route declarations:
- `apps/api/src/modules/fees/routes/fee-setup.routes.ts`
- `apps/api/src/modules/fees/routes/fee-invoice.routes.ts`
- `apps/api/src/modules/fees/routes/fee-adjustment.routes.ts`
- `apps/api/src/modules/fees/routes/fee-report.routes.ts`
- `apps/api/src/modules/payments/routes/payment.routes.ts`
- `apps/api/src/modules/ledger/routes/ledger.routes.ts`
- `apps/api/src/modules/expenses/routes/expense.routes.ts`
- `apps/api/src/modules/expenses/routes/vendor.routes.ts`
- `apps/api/src/modules/expenses/routes/budget.routes.ts`
- `apps/api/src/modules/expenses/routes/recurring.routes.ts`
- `apps/api/src/modules/payroll/routes/payroll.routes.ts`
- `apps/api/src/modules/payroll/routes/my-payslips.routes.ts`
- `apps/api/src/modules/payroll-transfers/routes/transfer.routes.ts`
- `apps/api/src/modules/finance-settings/routes/finance-settings.routes.ts`
- `apps/api/src/modules/bank-reconciliation/routes/bank-reconciliation.routes.ts`
- `apps/api/src/modules/gateway-settlements/routes/settlement.routes.ts`
- `apps/api/src/modules/finance-reports/routes/report.routes.ts`

Additional implementation context:
- `docs/backend/modules/fees.md`
- `docs/backend/modules/payments.md`
- `docs/backend/modules/ledger.md`
- `docs/backend/modules/expenses.md`
- `docs/backend/modules/payroll.md`
- `docs/backend/modules/payroll-transfers.md`
- `docs/backend/modules/finance-settings.md`
- `docs/backend/modules/bank-reconciliation.md`
- `docs/backend/modules/gateway-settlements.md`
- `docs/backend/modules/finance-reports.md`
- `docs/backend/BACKEND_REMEDIATION_REGISTER.md`

## Next contract-audit step

Inspect each operation's controller and DTO implementation, especially response envelopes, status codes, query parsing/defaults, file/document content types, and report catalogue parameters. Then add the verified operations to the canonical OpenAPI 3.1 document only after the remaining module families have received equivalent coverage.
