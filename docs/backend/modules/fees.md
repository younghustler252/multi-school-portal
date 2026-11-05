# Fees Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide covers fee setup, invoicing, adjustments, instalments, opening balances, late fees and fee reports/family views. Test sources and migrations were inspected but not executed in this review.

## Responsibility and boundaries

The fees module owns the school's receivables workflow:

- Fee types and income-account mapping.
- Term/class/branch/student-type fee structures.
- Discount rules and student-specific discount assignments.
- Draft invoice generation, editing, issuing and voiding.
- Invoice adjustments: waivers, write-offs, credit notes and additional discounts.
- Instalment schedules, opening balances and late-fee invoices.
- Ageing, defaulters, collections, statements and family fee views.

It does not own payment collection/provider callbacks, payment allocation/credit, refunds, ledger journals or finance settings. It coordinates with:

- **Ledger:** the only journal-posting boundary; invoice issue, adjustments and voids call `PostingService`.
- **Payments:** invoice payment allocations, student credit, credit application and refund data.
- **Finance settings:** adjustment approval thresholds and self-approval policy.
- **Audit:** records setup, invoice and adjustment actions.
- **Students/Enrolment/Classes/Sessions:** fee structures and invoice generation depend on student, class and term context.
- **Platform entitlements:** every fee route requires `modules.fees`.

## Runtime composition and route mounts

The routers are registered in `apps/api/src/routes/index.ts`:

- `/api/v1/fees/invoices` → invoice router.
- `/api/v1/fees/adjustments` → adjustment router.
- `/api/v1/fees` → report/family router.
- `/api/v1/fees` → setup router.

The report router is registered before setup so fixed report/family paths are resolved before setup routes. All routes authenticate, establish tenant context, enforce a fee permission and require the `modules.fees` feature.

The `registerFees` container registration supplies fee types, structures, discounts, invoices, adjustments, reports, instalments and controllers. Its documented dependencies include payments (`paymentRepository`, `creditService`), audit, and ledger (`ledgerAccountRepository`, `postingService`, `numberSequenceService`).

## HTTP endpoints

### Fee setup — base `/api/v1/fees`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/types` | `fees.setup.view` | List fee types |
| POST | `/types` | `fees.types.manage` | Create fee type |
| GET | `/types/:id` | `fees.setup.view` | Read fee type |
| PUT | `/types/:id` | `fees.types.manage` | Update fee type |
| DELETE | `/types/:id` | `fees.types.manage` | Delete only if never used |
| GET | `/structures` | `fees.setup.view` | List structures by session/term/class/branch/status |
| POST | `/structures` | `fees.structures.manage` | Create structure |
| GET | `/structures/:id` | `fees.setup.view` | Read structure |
| PUT | `/structures/:id` | `fees.structures.manage` | Update name/due date/description/status/items |
| DELETE | `/structures/:id` | `fees.structures.manage` | Delete only if no invoice was generated from it |
| GET | `/discount-rules` | `fees.setup.view` | List discount rules |
| POST | `/discount-rules` | `fees.discounts.manage` | Create rule |
| PUT | `/discount-rules/:id` | `fees.discounts.manage` | Update rule |
| DELETE | `/discount-rules/:id` | `fees.discounts.manage` | Delete only if not assigned |
| GET | `/students/:studentId/discounts` | `fees.setup.view` | List student discount assignments |
| POST | `/students/:studentId/discounts` | `fees.discounts.manage` | Assign a rule to a student/session |
| DELETE | `/students/:studentId/discounts/:discountId` | `fees.discounts.manage` | Remove assignment |

### Invoices — base `/api/v1/fees/invoices`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `fees.invoices.view` | Paginated invoice list |
| POST | `/` | `fees.invoices.create` | Create a manual admission/ad-hoc draft |
| POST | `/generate` | `fees.invoices.create` | Generate term-fee drafts from structures |
| POST | `/issue` | `fees.invoices.issue` | Issue a selected/filter-matched batch; each invoice is independent |
| POST | `/opening-balances` | `fees.invoices.issue` | Import historical balances as issued invoices |
| POST | `/late-fees/run` | `fees.invoices.issue` | Dry-run or create late-fee invoices |
| GET | `/:id` | `fees.invoices.view` | Read invoice |
| PUT | `/:id` | `fees.invoices.create` | Edit draft only, with optional version check |
| DELETE | `/:id` | `fees.invoices.create` | Delete draft only |
| POST | `/:id/issue` | `fees.invoices.issue` | Issue one invoice |
| POST | `/:id/void` | `fees.invoices.void` | Reverse and void an eligible issued invoice |
| PUT | `/:id/instalments` | `fees.invoices.issue` | Create/replace an instalment schedule |
| GET | `/:id/instalments` | `fees.invoices.view` | Read schedule |
| DELETE | `/:id/instalments` | `fees.invoices.issue` | Cancel schedule |

Invoice list filters: status, type, term, class, student, branch, free-text query, page and limit.

### Adjustments — base `/api/v1/fees/adjustments`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `fees.invoices.view` | List adjustment requests |
| POST | `/` | `fees.adjustments.request` | Request waiver/write-off/credit note/additional discount |
| GET | `/:id` | `fees.invoices.view` | Read request |
| POST | `/:id/approve` | `fees.adjustments.approve` | Approve; may record first of two approvals |
| POST | `/:id/reject` | `fees.adjustments.approve` | Reject |

Adjustment list filters: status, type, invoice, student, page and limit. The requester cannot approve their own request unless the finance setting permits it. The configured second-approval threshold can require a different second approver.

### Reports and family views — base `/api/v1/fees`

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/reports/ageing` | `fees.reports.view` | Amount owed by current/1–30/31–60/61–90/over-90-day buckets |
| GET | `/reports/defaulters` | `fees.reports.view` | Students with overdue balances |
| GET | `/reports/collections` | `fees.reports.view` | Confirmed receipts grouped by method/day/month/branch/class |
| GET | `/statements/:studentId` | `fees.invoices.view` | Staff statement |
| GET | `/my/children` | `fees.view` | Guardian/student balance and credit summary |
| GET | `/my/invoices` | `fees.view` | Issued invoices for own/linked children |
| GET | `/my/statement/:studentId` | `fees.view` | Statement for own/linked child only |

Ageing/defaulters accept `asOf`, branch, class and term filters. Collections require an inclusive `from` and `to` range and optional grouping/branch. Statements accept optional inclusive date bounds.

## Money and invoice invariants

- API request amounts are whole kobo and are converted to JavaScript `bigint` before domain logic. The supported input form is a safe integer or a digit string of up to 18 digits.
- Response money uses `koboOut`: JSON number when within JavaScript's safe-integer range, otherwise a digit string. Clients must not assume every amount is a JSON number.
- Invoice totals obey `totalKobo = subtotalKobo - discountKobo + adjustmentsKobo`.
- Invoice balances obey `balanceKobo = totalKobo - paidKobo`; persisted money columns have database constraints.
- Draft invoices are not journalled and are not visible to families. Issuing assigns a number and posts the journal; families see non-draft, non-void invoices.
- Invoice number format is `INV-YYYY-000001`; issue date determines the year. Ledger posting refuses future dates, closed periods, inactive/unknown accounts, unbalanced entries and duplicate source/purpose postings.
- Invoice issue is transactional: number allocation, journal posting and issue state commit together. A version check prevents two issuers from issuing the same draft.
- Fee types point to active income accounts. The income account is copied onto invoice items, so later fee-type account changes affect future invoices, not historical invoices.
- Issued invoice voiding is allowed only before payments or approved adjustments; the original journal is reversed rather than deleted.
- Fee adjustments are approved transactionally with their journal and invoice money changes. A credit note on an overpaid invoice moves excess payment allocation into student credit.
- Payment allocation, credit and refund operations belong to Payments, even though fee statements and adjustments consume their records.

## Fee structures and discounts

A fee structure is scoped by term, optional class, optional branch and student type (`ALL`, `NEW`, `RETURNING`). Scope is immutable after creation; make a new structure to change where it applies. Only one structure may exist for the same scope. The most specific matching structure wins: class specificity, student-type specificity and branch specificity contribute to the ranking.

Each structure contains 1–40 distinct active fee types. Every item has a positive whole-kobo amount. Structure updates replace the item list; already-created invoices are not changed.

Fee types have a stable code generated from the name if omitted. Code format is uppercase letters/digits/underscores; code is immutable. Deletion is allowed only if unused; otherwise deactivate. A fee type must point to an active INCOME ledger account.

Discount rules:
- `PERCENT` values are basis points: 1000 = 10%, 10000 = 100%.
- `FIXED` values are whole kobo.
- A rule can apply to one fee type or the whole invoice.
- Student assignments may be session-specific or apply across sessions.
- Discounts are computed in assignment order; percentage amounts round down to a whole kobo; fixed discounts are capped at the remaining eligible amount; discounts cannot reduce the invoice below zero.
- The generated invoice stores discount lines and amounts, so later rule edits do not rewrite existing invoices.

## Invoice generation and issue lifecycle

Term invoice generation selects active students with active enrolments for the term, optionally narrowed to a class or named student IDs. It chooses the best matching fee structure using class, student type and requested billing branch. It applies active student discounts and creates one draft per student. Existing non-void invoices from the same structure are skipped; students without a matching structure are returned for correction.

Manual invoices support `ADMISSION` and `ADHOC` types. Draft edits replace the entire item list and recompute discounts; a version mismatch stops a stale edit. Issuing one invoice is atomic. Bulk issue runs each invoice independently and reports issued/failed outcomes so one closed period or bad invoice does not stop the rest.

Issue journal:
- Debit Fees Receivable for the amount the student owes (student party).
- Debit Discounts Allowed for discounts.
- Credit each fee item's income account for its full charge.
- Debits equal credits.

A student's available credit is automatically applied to a new invoice when it is issued; `AUTO_APPLY_CREDIT` is currently a hard-coded true policy constant, not a finance setting.

## Adjustments and approvals

Types:
- **Waiver:** reduce what remains owed; debit Discounts Allowed, credit Fees Receivable.
- **Write-off:** reduce what remains owed; debit Bad Debt, credit Fees Receivable.
- **Credit note:** cancel part of a named invoice item; debit that fee's income account and credit receivable, or move excess into Advance Payments/student credit if the invoice is already overpaid.
- **Additional discount:** add a discount line and reduce receivable.

Waivers/write-offs/additional discounts cannot exceed the current balance. A credit note cannot exceed the remaining amount on the named item after prior approved credit notes, or the invoice total.

The requester cannot approve their own adjustment unless `finance.allow_self_approval` is true. When the amount reaches the configured second-approval threshold, the first approval is recorded without posting; a different user must approve to post. Approval posts the journal, updates invoice money, adjusts allocations/credit if needed, and marks the request approved in one transaction.

## Instalments, opening balances and late fees

Instalment plans are schedules only; they move no money and create no journal. They contain 2–24 positive parts, strictly increasing due dates, and the amounts must sum to the invoice total. Payments still apply to the invoice oldest-first; the schedule view allocates paid money to earlier instalments and ages each unpaid part independently. Adjustments can shrink the final parts.

Opening balances create one `OPENING_BALANCE` invoice per student, posted against Opening Balance Equity. The as-of date cannot be in the future. Each row is handled independently; failed rows are reported and any failed draft is removed. The use case returns the created invoice details and failures.

Late fees:
- The caller supplies either a fixed kobo amount or a percentage, not both.
- The base is the unpaid amount overdue beyond the grace days; active instalment plans are expanded and only overdue parts count.
- Late-fee invoices are ADHOC invoices linked to the original invoice.
- An original invoice is charged at most once; a late-fee invoice is never itself charged.
- Dry-run returns the plan without creating drafts or journals.
- Successful issue uses the normal invoice posting workflow.

**Configuration mismatch to resolve:** the finance settings registry defines `finance.grace_days`, but the late-fee use case currently uses the request's `graceDays` (default 0) rather than reading the persisted finance setting. See the remediation register.

## Reports and family access

- Ageing uses outstanding invoice balances and the invoice due date (or issue date if no due date). Buckets are current, 1–30, 31–60, 61–90 and over 90 days.
- Instalment plans age each unpaid part against its own due date.
- Defaulters are students with overdue balances above the requested minimum.
- Collections include confirmed payments, split by allocation destination and retained student credit.
- Statements combine issued invoices, approved adjustments, payments, reversals and paid refunds. Positive entries increase what the student owes; negative entries reduce it; a negative running balance means student credit.
- Family endpoints derive student IDs from the authenticated STUDENT or GUARDIAN persona. A guardian can request a specific student only if linked; drafts and void invoices are never returned.

## Persistence and migrations

Key tenant models include `FeeType`, `FeeStructure`, `FeeStructureItem`, `FeeDiscountRule`, `StudentDiscount`, `FeeInvoice`, `FeeInvoiceItem`, `FeeInvoiceDiscount`, `InvoiceAdjustment`, and `InvoiceInstalmentPlan` / plan lines. The module also reads Payment, PaymentAllocation, Refund, Student, Guardian, Class, Branch, Term, Session, LedgerAccount and SchoolSettingValue.

Relevant migrations found in the tenant migration tree:

- `20260908063238_consolidated_invoices`
- `20260916135835_add_fee_type_is_active`
- `20261022090000_fees_v2`
- `20261022121500_fee_invoice_discounts`
- `20261023120000_adjustment_item`
- `20261024090000_late_fee_link`
- `20261101090000_second_approval_refunds_adjustments`

The ledger migration establishes journal constraints and immutability; the fees migrations add fee v2 tables/columns, invoice discount lines, credit-note item references, late-fee linkage and approval metadata. Migration SQL was not executed in this review.

## Tests and verification status

Test sources inspected under `apps/api/tests/finance/`:

- `fees-setup.test.ts`
- `fees-invoices.test.ts`
- `credit-adjustments.test.ts`
- `fee-reports.test.ts`
- `invoice-extras.test.ts`
- `support/fees-world.ts`

The tests cover fee setup, structure matching, discount arithmetic, invoice generation/issue/void, journal balance, adjustments/approvals, instalments, opening balances, late fees, reports, statements and family visibility. They primarily use in-memory repositories/fakes and the in-memory posting test harness. No dedicated fee-module populated-schema migration test or HTTP router integration test was found in the inspected test tree.

**Not executed in this review:** test commands, typecheck, build, Prisma generation, migrations, live PostgreSQL, Paystack/provider operations, queue/storage integration or live HTTP requests.

## Open implementation and verification items

1. **Statement double-counts approved additional discounts.** The additional-discount path increases `FeeInvoice.discountKobo`, so the invoice statement entry already reflects the reduced total. The statement repository also returns the approved `ADDITIONAL_DISCOUNT` adjustment and `buildStatement` subtracts it again as an adjustment entry. The statement running balance is therefore too low by the additional-discount amount. See remediation register.
2. **Opening-balance response converts BigInt to Number unsafely.** The DTO accepts up to 18-digit kobo strings, but `OpeningBalancesUseCase` converts each amount to `Number` and later reconstructs the audit total with `BigInt(number)`. Values above `Number.MAX_SAFE_INTEGER` lose precision in the response and audit total even though the invoice/journal itself was created using BigInt.
3. **Late-fee grace setting is not consumed.** `finance.grace_days` exists in finance settings, but the run uses request `graceDays` defaulting to zero. Decide whether request-level override is intentional; otherwise read the effective finance setting and test it.
4. **Family summary overdue count uses server date directly.** `FeeReportRepositoryImpl.familySummary` uses `dayString(new Date())` instead of `todayInFinanceZone`. Review around midnight and align with the school's finance timezone.
5. **Additional-discount statement regression test is missing.** Existing statement tests cover waiver, payment, reversal and refund but not `ADDITIONAL_DISCOUNT`; add a regression case asserting statement closing balance equals invoice/ledger balance.
6. **Audit writes generally occur after fee setup/invoice/adjustment domain changes.** Review failure semantics against the shared audit policy; a failed audit after committed money state can make an API response appear failed even though the financial change persisted.
7. **No fee HTTP tests or dedicated populated-schema migration tests were found.** Add route-level authorization/validation/tenant tests and migration tests against a populated disposable school schema.
8. **Run the finance test suite, typecheck/build and migration checks** before production rollout; verify invoice issue/adjustment/payment interactions against a disposable PostgreSQL tenant and test gateway environment.

## Source paths reviewed

- `apps/api/src/modules/fees/routes/`
- `apps/api/src/modules/fees/controllers/`
- `apps/api/src/modules/fees/dtos/`
- `apps/api/src/modules/fees/domain/`
- `apps/api/src/modules/fees/fees.permissions.ts`
- `apps/api/src/modules/fees/fees.container.ts`
- `apps/api/src/modules/fees/usecases/`
- `apps/api/src/modules/fees/repositories/`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/ledger/mappers/kobo.ts`
- `apps/api/src/modules/finance-settings/domain/finance-settings.ts`
- `apps/api/src/modules/finance-settings/usecases/finance-settings.usecases.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261022090000_fees_v2/migration.sql` and related fee migrations listed above
- `apps/api/tests/finance/`
