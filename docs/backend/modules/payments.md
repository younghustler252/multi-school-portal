# Payments Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This guide documents the payment, credit, online gateway, settlement, refund and reversal paths. Test sources and migrations were inspected but not executed in this review.

## Responsibility and boundaries

Payments owns money-received records and how those funds are allocated:

- Manual cash, POS, bank-transfer, cheque and other payment recording.
- Payment confirmation, receipt issuance and allocation to fee invoices.
- Student advance credit and credit application.
- Guardian online payment initialization and gateway verification.
- Online settlement journals.
- Refund requests, approval, payout and payment reversal.

Fees owns invoices and their receivable balances. Ledger owns journal posting and financial-period/account rules. Payments calls the shared `PostingService`; it does not write journals directly. Gateway provider calls are behind `IPaymentProvider`. Webhook routing/signature verification is owned by the shared Webhooks module.

## Runtime composition and route mount

The payment router is mounted at `/api/v1/payments`. Every route authenticates, establishes school tenant context, checks its payment permission and requires the `modules.fees` feature.

The container registers repositories, payment context lookup, confirmation service, credit service, refund workflows, online payment use cases, settlement use case, webhook handler and controller. Dependencies include:

- Fees: `feeInvoiceRepository`.
- Ledger: `postingService`, `numberSequenceService`, `ledgerAccountRepository`.
- Audit.
- Shared payment provider and mail service.
- Platform subscriptions/billing for the shared webhook integration.

## HTTP endpoints

All paths below are relative to `/api/v1/payments`.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `payments.view` | Paginated payment list |
| POST | `/` | `payments.record` | Record manual payment; cash/POS confirm immediately, other methods wait |
| POST | `/allocation-preview` | `payments.record` | Preview invoice allocation and credit; no writes |
| GET | `/my` | `payments.pay` | Authenticated guardian's own payments |
| POST | `/online/initialize` | `payments.pay` | Start gateway payment for linked child's invoice |
| GET | `/online/verify/:reference` | `payments.pay` | Ask gateway to verify and confirm guardian's payment |
| POST | `/online/settlements` | `payments.settle` | Post gateway gross/fee/net settlement |
| GET | `/credit/:studentId` | `payments.view` | Read student's available credit |
| POST | `/credit/apply` | `payments.record` | Apply student credit to one open invoice |
| GET | `/refunds` | `payments.view` | List refund requests |
| POST | `/refunds` | `payments.refund.request` | Request refund from student credit |
| GET | `/refunds/:id` | `payments.view` | Read refund |
| POST | `/refunds/:id/approve` | `payments.refund.approve` | Approve (may require two approvers) |
| POST | `/refunds/:id/reject` | `payments.refund.approve` | Reject |
| POST | `/refunds/:id/pay` | `payments.refund.approve` | Pay an approved refund from a money account |
| GET | `/:id` | `payments.view` | Payment and allocation detail |
| GET | `/:id/receipt` | `payments.view` | Frozen receipt snapshot |
| POST | `/:id/confirm` | `payments.confirm` | Confirm a pending manual payment |
| POST | `/:id/reject` | `payments.confirm` | Reject a pending manual payment |
| POST | `/:id/reverse` | `payments.reverse` | Reverse a confirmed payment |

Payment list filters: status, method, guardian, student, branch, from/to dates, page and limit. Refund list filters: status, payment, student, page and limit.

## Permissions and personas

| Permission | Scope/persona | Purpose |
|---|---|---|
| `payments.view` | ALL / STAFF | View payments, receipts, refunds and student credit |
| `payments.record` | ALL / STAFF | Record payments, preview allocations and apply credit |
| `payments.confirm` | ALL / STAFF | Confirm/reject pending manual payments |
| `payments.refund.request` | ALL / STAFF | Request refunds |
| `payments.refund.approve` | ALL / STAFF; sensitive | Approve/reject/pay refunds |
| `payments.settle` | ALL / STAFF | Record gateway settlement |
| `payments.pay` | OWN / GUARDIAN | Pay linked child's invoice online |
| `payments.reverse` | ALL / STAFF; sensitive | Reverse confirmed payment |

Family access is deliberately narrow: guardian online payment uses the authenticated guardian persona ID, verifies the invoice student is linked to that guardian, and the guardian's payment history is filtered by that guardian ID. The route does not accept a caller-supplied guardian ID for the family path.

## Manual payment recording and confirmation

Manual request supports payer type GUARDIAN/STUDENT/OTHER, method, positive whole-kobo amount, money account, paid date, reference/proof attachment, branch, student IDs, optional explicit allocations, credit holder and optional `clientRequestId`.

- A guardian payer requires `guardianId`; non-guardian payers require explicit `studentIds`.
- Student IDs must exist. If no student IDs are supplied for a guardian, linked active children are loaded.
- Bank transfer and cheque require a reference or proof attachment.
- Paid date is validated as a real day and cannot be in the future in the finance timezone.
- Cash and POS confirm immediately. Bank transfer, cheque and other methods wait for a second person; no journal/receipt is created until confirmation.
- An optional unique `clientRequestId` makes retries/double-clicks return the existing payment. A duplicate reference is rejected.
- The selected money account must be active and marked as a money account; online clearing is reserved for gateway payments. Defaults are cash account for cash and bank account for other methods.

Confirmation runs in one tenant transaction:

1. Load the payment and require PENDING/AWAITING_CONFIRMATION.
2. Determine target students and plan allocation.
3. Apply each invoice allocation with an invoice version check.
4. Allocate a receipt number and post the balanced journal.
5. Persist allocations, mark payment confirmed with a version check, and save the frozen receipt snapshot.

Default allocation is oldest-first by due date, then issue date, invoice number and ID; invoices without due dates come last. Explicit allocation overrides must reference open invoices, avoid duplicate invoice IDs, not exceed invoice balances or payment amount. Any remainder becomes advance credit for a selected/derived student.

The receipt snapshot stores school/payer details, method/reference, total amount, invoice allocation lines and balance-after values as digit strings. The snapshot is not rebuilt from live data later.

## Journal behavior

For a confirmed manual payment:

- Debit the selected cash/bank money account for the full payment.
- Credit Fees Receivable per student for invoice allocations.
- Credit Advance Payments per student for any unallocated credit.

For gateway confirmation, the debit is Online Clearing instead of the selected cash/bank account. The shared ledger posting service enforces balanced lines, valid active accounts, open accounting period, non-future date and idempotency by source type/source ID/purpose.

## Online payment lifecycle

1. Authenticated guardian initializes payment for a linked child's open invoice.
2. The use case checks guardian-child relationship, invoice status/balance, guardian contact and Online Clearing account.
3. A PENDING payment row is created with a random `PAY-` reference and the provider is asked to initialize. The school Paystack subaccount code is passed when configured; metadata includes school, payment and invoice IDs.
4. Provider initialization failure marks the payment FAILED.
5. Guardian return verification and webhook processing both call `ConfirmOnlinePaymentUseCase`. The backend verifies directly with the provider; it does not trust browser-supplied success.
6. Pending provider result leaves payment pending; failure marks it failed; success must match the exact expected amount.
7. Successful gateway payment uses the same `PaymentConfirmationService` as manual payments, posting Online Clearing, invoice receivables/advance credit, allocations and receipt.
8. A receipt email is best-effort; email failure does not undo a confirmed payment.

The online initialize path rejects amounts above JavaScript's safe integer range before calling the gateway because the provider interface accepts a number. An amount larger than the invoice balance is allowed; the excess becomes student credit.

The fee-payment webhook handler resolves the school from the signed event's metadata, loads the platform school's schema, enters that tenant context, and calls the same online confirmation use case. The shared webhook layer owns provider signature verification and event delivery.

## Gateway settlement

A settlement moves gross online collections out of Online Clearing:

- Debit bank for net received (`gross - fee`).
- Debit Bank Charges for the gateway fee.
- Credit Online Clearing for gross.

The optional settlement reference is used as the posting source ID; the posting idempotency key therefore prevents a repeated reference from posting twice. If no reference is supplied, the current use case generates a random UUID, so repeated calls are not deduplicated by the same business reference.

## Credit and refunds

Credit is the confirmed payment allocation with `invoiceId=null`; credit is held per student. Credit already reserved by REQUESTED or APPROVED refunds is excluded from available credit.

- Credit application uses the oldest available credit rows first, posts Dr Advance Payments / Cr Fees Receivable, changes the invoice paid/balance/status, moves allocations from credit to invoice, and reduces payment unallocated amount.
- Refunds can only pay out student credit, not reverse a charge directly. If an invoice charge needs to be cancelled after payment, first create a credit note in Fees so the overpaid amount becomes student credit.
- Refund lifecycle: REQUESTED → APPROVED → PAID, or REQUESTED → REJECTED.
- Request validates payment is confirmed, student exists, and requested amount does not exceed available credit after open refund reservations.
- Self-approval follows `finance.allow_self_approval`. Amounts at/above `finance.second_approval_threshold_kobo` require two different approvers; first approval only records approval metadata.
- Payout rechecks available credit inside a transaction, posts Dr Advance Payments / Cr selected payout account, reduces the student's credit allocation and payment's unallocated amount, then marks the refund paid.
- Default payout account is the original payment account; for an online payment whose original account is Online Clearing, default falls back to the school's default bank account.
- Reversal is allowed only for CONFIRMED payments with no refund records. It restores invoice balances, reverses held credit, posts one compensating journal, closes allocations and marks the payment REVERSED in one transaction.

## Persistence and migrations

Key tenant models include `Payment`, `PaymentAllocation`, `Receipt` and `Refund`. Payments also read/write FeeInvoice, LedgerAccount and related student/guardian records.

Migrations found:
- `20261023090000_payment_targets`: adds payment target student IDs and optional client request id with a unique index.
- `20261101090000_second_approval_refunds_adjustments`: adds first-approver identity/time to Refund and InvoiceAdjustment.

Payment/receipt/refund core tables are present in `apps/api/prisma/tenant.prisma`; fee invoices and ledger journals are owned by their respective modules. The migrations were inspected, not executed.

## Tests and verification status

Test sources inspected under `apps/api/tests/finance/`:

- `payments.test.ts`
- `online-payments.test.ts`
- `credit-adjustments.test.ts`
- `second-approval-refunds.test.ts`
- `gateway-settlements.test.ts`
- Shared fixture `support/fees-world.ts`

The tests use pure allocation policies, in-memory repositories and the posting test harness. They cover payment recording, confirmation, rejection, allocation, receipts, online provider outcomes, webhook confirmation, credit, refunds, reversals and gateway settlements. They do not constitute real-Postgres concurrency or HTTP-router integration tests.

**Not executed in this review:** tests, typecheck, build, migrations, live Paystack calls, webhook signature delivery, PostgreSQL concurrency, live HTTP requests or actual bank settlement.

## Open implementation and verification items

1. **Credit allocation mutations are not concurrency-safe at the allocation-row level.** `CreditService.applyToInvoice` and `PayRefundUseCase` read credit rows and later overwrite their amounts through unconditional `setAllocationAmount`; they also adjust `Payment.unallocatedKobo` separately. There is no allocation version/conditional decrement/row lock in the inspected repository method. Concurrent credit applications or payouts against the same credit row can use stale amounts and desynchronize allocation totals from payment unallocated balance.
2. **Refund requests can race while reserving credit.** `RequestRefundUseCase` checks open refunds/available credit and creates a refund in separate non-transactional operations. Two concurrent requests can both pass against the same available credit and reserve more than is held. Add a transaction/lock or atomic reservation mechanism shared with apply/payout paths.
3. **Settlement response converts BigInt money to Number.** `RecordSettlementUseCase` returns `receivedKobo`, `feeKobo` and `grossKobo` using `Number(...)`, while DTO accepts up to 18-digit kobo strings. Values above safe integer range lose precision in the response.
4. **Settlement reference is optional but provides the idempotency key.** Without it, the use case generates a new UUID, so a retried request can post the same settlement again. Decide whether to require a reference or accept a stable caller idempotency key.
5. **Audit writes follow committed payment/refund/credit transactions.** Confirm shared audit failure semantics; a failed audit may return an error after the financial transaction committed.
6. **No payment HTTP integration tests or populated-schema migration tests were found in the inspected suite.** Add route/middleware/tenant tests and real database concurrency tests for confirmation, credit, refunds and reversal.
7. **Verify webhook handler filtering and tenant binding end-to-end.** The handler selects fee-payment events by event type/reference and metadata type, then resolves tenant from metadata. Test unrelated successful charge events, missing/incorrect metadata and reference mismatches.
8. **Run finance payment tests, typecheck/build and migration checks** with disposable PostgreSQL and provider/webhook fixtures before production rollout.

## Source paths reviewed

- `apps/api/src/modules/payments/routes/payment.routes.ts`
- `apps/api/src/modules/payments/controllers/payment.controller.ts`
- `apps/api/src/modules/payments/dtos/payment.dto.ts`
- `apps/api/src/modules/payments/domain/`
- `apps/api/src/modules/payments/payments.permissions.ts`
- `apps/api/src/modules/payments/payments.container.ts`
- `apps/api/src/modules/payments/usecases/`
- `apps/api/src/modules/payments/services/`
- `apps/api/src/modules/payments/repositories/`
- `apps/api/src/modules/payments/webhooks/fee-payment.webhook-handler.ts`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/fees/repositories/fee-invoice.repository.impl.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261023090000_payment_targets/migration.sql`
- `apps/api/prisma/tenant-migrations/20261101090000_second_approval_refunds_adjustments/migration.sql`
- `apps/api/tests/finance/`
