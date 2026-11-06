# Salary Transfers Module

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This is a separate module from Payroll. It sends approved net salaries through the configured transfer provider and reconciles provider outcomes. Test source and migration were inspected but not executed.

## Responsibility and boundaries

Salary Transfers owns the outbound movement of payroll money:

- Creating a pending transfer per eligible approved payslip.
- Freezing bank details and payout amount at transfer start.
- Sending one transfer at a time through `ITransferProvider`.
- Handling provider response, signed webhook, verify and reconciliation outcomes.
- Retrying failed/reversed attempts with a new reference.
- Cancelling transfers that have not been sent.
- Posting the salary payment journal only after provider-confirmed success.

Payroll owns the approved run/payslips and manual payroll payment state. Ledger owns journals. The module calls Payroll repositories and the shared Ledger `PostingService`. The shared Webhooks module verifies provider signatures and dispatches events.

## Runtime composition and route mount

Mounted at `/api/v1/payroll/transfers` and registered separately through `registerPayrollTransfers`. Dependencies: Payroll run repository, Ledger posting/account repository, shared transfer provider, encryption, finance settings and audit.

Transfers are deliberately disabled unless both:
- The platform transfer provider is enabled.
- The school's `finance.payroll_transfers_enabled` setting is true.

All routes authenticate, establish tenant context, enforce permission and require the `modules.payroll` feature.

## HTTP endpoints

All paths below are relative to `/api/v1/payroll/transfers`.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `payroll.runs.view` | List/filter transfer records |
| GET | `/runs/:runId` | `payroll.runs.view` | Transfers and status totals for a run |
| POST | `/runs/:runId/start` | `payroll.transfers.send` | Prepare pending transfer rows; does not call provider |
| POST | `/runs/:runId/send` | `payroll.transfers.send` | Send pending transfers sequentially |
| POST | `/reconcile` | `payroll.transfers.reconcile` | Verify one or up to 200 unsettled transfers |
| POST | `/:id/retry` | `payroll.transfers.send` | Create a new attempt for FAILED/REVERSED |
| POST | `/:id/cancel` | `payroll.transfers.send` | Cancel PENDING transfer only |

Permissions are ALL-scope STAFF-only. `payroll.transfers.send` and `payroll.transfers.reconcile` are sensitive. The person who approved the run cannot start/send/retry its transfers unless `finance.allow_self_approval` is enabled.

## Start and freeze transfer details

Start requires an APPROVED payroll run. For each payslip with positive net pay:

- Skip if that payslip already has a live transfer (PENDING/SENDING/PROCESSING/UNKNOWN/SUCCESS).
- Load bank details effective on the last day of the payroll month.
- Skip staff without bank code, encrypted account number, account name or last four digits.
- Freeze amount, bank details and source money account on the transfer row.
- Assign an attempt number and reference: `sal-<first 16 hex chars of school UUID>-<12 random hex>-<attempt>`.
- Enforce per-transfer and batch maximums from finance settings. Zero means unlimited.
- Insert all prepared rows in one tenant transaction; a partial unique index enforces at most one live transfer per payslip.

Starting a run creates records only. No money moves until the send endpoint is called.

## Sending and provider state machine

The states are:

`PENDING → SENDING → PROCESSING | SUCCESS | FAILED | UNKNOWN`

A returned payment can later become REVERSED. FAILED or REVERSED can be retried as a new attempt; CANCELLED cannot be retried.

- The repository atomically claims PENDING → SENDING before network calls; two senders cannot both send the same row.
- Recipient creation uses the frozen encrypted account number. A definitive invalid-bank-details response marks FAILED. A temporary recipient setup failure returns the transfer to PENDING because no money request was sent.
- Initiation amount must fit JavaScript's safe integer range because the provider interface accepts `number`.
- Provider immediate success is booked immediately; provider pending moves to PROCESSING; definitive failure becomes FAILED.
- Timeout, network/5xx or duplicate-reference ambiguity becomes UNKNOWN. UNKNOWN is never sent again; only verification/reconciliation can settle it.
- Provider response, signed webhook, explicit verify and reconciliation all call the same `TransferOutcomeService`.

No database transaction is held open across a provider network request.

## Outcome and ledger behavior

Only provider-confirmed success is booked:

- Debit Salaries Payable for the staff party.
- Credit the frozen payout money account.
- Journal idempotency source is the transfer ID and purpose TRANSFER.
- Mark transfer SUCCESS with journal ID and confirmation timestamp.

When all positive-net payslips in an APPROVED run have SUCCESS transfers, the run becomes PAID and payslips become PAID.

A failure books nothing. A late success after FAILED is accepted and flagged because provider truth about money wins. A failure after SUCCESS is rejected and audited. A reversal ensures the original payment is booked if not previously observed, then reverses that journal and marks the transfer REVERSED.

## Reconciliation and retry

Reconciliation examines SENDING, PROCESSING and UNKNOWN:

- SENDING is checked after 5 minutes.
- PROCESSING is checked after 10 minutes.
- UNKNOWN is checked whenever requested.
- Provider `not_found` is not trusted until 30 minutes have elapsed; before then the transfer remains unsettled.
- Provider success/failed/reversed is applied through the shared outcome service.
- Provider still-pending leaves the transfer unchanged and may update transfer code.
- Provider errors are reported per transfer; other candidates continue.

Retry is allowed only for FAILED or REVERSED, and only if no other live transfer exists for the payslip. It creates a new attempt/reference. By default it reuses frozen bank details; `useCurrentBankDetails=true` explicitly reloads the pay profile details for the payroll month.

Cancel is allowed only from PENDING, before the provider send call.

## Webhook routing and tenant resolution

The provider transfer webhook has no school metadata, so the handler parses the school UUID prefix from the transfer reference. It queries the public School table for exactly one matching school, requires a provisioned tenant schema, enters that tenant context, then looks up the exact reference and applies the outcome.

The reference parser accepts only 16 lowercase hex school-prefix characters, 12 random hex characters and a numeric attempt. School IDs are UUIDs in the current public Prisma schema, so removing hyphens produces the required hex prefix.

The handler recognizes `transfer.*` events; the use case handles only `transfer.success`, `transfer.failed` and `transfer.reversed`. Unknown event types or references not belonging to this module are ignored.

## Persistence and migration

Tenant model: `SalaryTransfer`. It stores run/payslip/staff IDs, attempt/reference, amount, encrypted account details, provider recipient/transfer codes, status, sender, timestamps, journal and reversal journal.

Migration `20261031090000_salary_transfers` creates the table, status enum, amount/attempt constraints and indexes:
- Unique provider reference.
- Unique attempt number per payslip.
- Unique journal ID.
- Partial unique index allowing only one live transfer per payslip while status is PENDING/SENDING/PROCESSING/UNKNOWN/SUCCESS.

## Tests and verification status

Test source inspected:
- `apps/api/tests/finance/payroll-transfers.test.ts`
- `apps/api/tests/finance/support/transfers-world.ts`

Coverage includes platform/school switches, start and limits, approver separation, frozen bank details, send state machine, immediate/pending/failure/timeout/duplicate-reference outcomes, webhook idempotency, late success, reversal, retries, cancellation and ledger balances. The world uses in-memory transfer repositories/provider and the payroll world's PostingService; it does not exercise real PostgreSQL partial-index races, real provider webhooks/signatures or HTTP route wiring.

**Not executed in this review:** tests, typecheck, build, migrations, real provider calls, webhook signature delivery, PostgreSQL concurrency or live HTTP requests.

## Open implementation and verification items

1. **Payroll run reversal does not check for live salary transfers.** Payroll's `ReverseRunUseCase` reverses accrual and cancels the run without consulting `salaryTransferRepository.hasLiveTransfers`. If a transfer is PENDING/PROCESSING/UNKNOWN/SUCCESS, the run can be reversed while the provider may still send or has already sent salary. A later success can post a payment against a cancelled run with reversed accrual. Block payroll reversal while any live transfer exists; require pending transfers cancelled and unsettled transfers reconciled, and define how successful/reversed transfers are handled.
2. **Reconciliation is blocked when transfers are disabled.** `ReconcileTransfersUseCase` calls `assertEnabled`, which requires both platform and school transfer switches to remain on. If a switch is turned off while transfers are PROCESSING/UNKNOWN, operators cannot query provider state through reconciliation. Webhooks may still arrive, but missed webhooks can leave records stuck and manual payroll pay blocked. Keep reconciliation available for existing unsettled transfers even when new sends are disabled.
3. **Run paid attribution uses the initiator, not the confirming actor/system.** `TransferOutcomeService.completeRunIfPaid` passes the transfer's `initiatedById` as `paidById` when the last success arrives, including webhook confirmation. Ledger payment actor similarly falls back to initiator when webhook actor is null. Record SYSTEM/provider confirmation as actor and keep initiator in a separate field.
4. **Start response converts BigInt batch total to Number.** `StartTransfersUseCase` returns `totalKobo: Number(total)`; large payroll batches can exceed safe integer precision. Serialize with `koboOut` or a decimal string.
5. **Start does not reject provider-unsupported amounts before creating transfer rows.** Per-transfer safe-integer validation currently occurs during send after a recipient may have been created. Add an early safe-integer/maximum validation so impossible transfers are not persisted as PENDING.
6. **A reversed transfer leaves the payroll run/payslip marked PAID.** The outcome service reverses the payment journal but does not move the run out of PAID or update the payslip status. Decide the correct partial/returned-payment state and ensure reporting does not show a returned salary as still paid.
7. **No real-Postgres/HTTP/provider integration tests were found.** Add tests for concurrent start/retry, partial unique index behavior, payroll reversal with live/successful transfers, reconciliation while disabled, webhook tenant routing and provider timeout/reversal.
8. **Run salary-transfer tests, typecheck/build and migration checks** against disposable PostgreSQL and a provider sandbox before enabling transfers in production.

## Source paths reviewed

- `apps/api/src/modules/payroll-transfers/routes/transfer.routes.ts`
- `apps/api/src/modules/payroll-transfers/controllers/transfer.controller.ts`
- `apps/api/src/modules/payroll-transfers/dtos/transfer.dto.ts`
- `apps/api/src/modules/payroll-transfers/domain/`
- `apps/api/src/modules/payroll-transfers/payroll-transfers.permissions.ts`
- `apps/api/src/modules/payroll-transfers/payroll-transfers.container.ts`
- `apps/api/src/modules/payroll-transfers/usecases/`
- `apps/api/src/modules/payroll-transfers/repositories/`
- `apps/api/src/modules/payroll-transfers/webhooks/transfer.webhook-handler.ts`
- `apps/api/src/modules/payroll/usecases/run.usecases.ts`
- `apps/api/src/modules/payroll/repositories/payroll.repositories.impl.ts`
- `apps/api/src/modules/ledger/services/posting.service.ts`
- `apps/api/src/modules/webhooks/`
- `apps/api/prisma/public.prisma`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261031090000_salary_transfers/migration.sql`
- `apps/api/tests/finance/payroll-transfers.test.ts`
