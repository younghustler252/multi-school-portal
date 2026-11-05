# Finance Architecture and Invariants

> **Status:** Current source-checked architecture snapshot.
> **Source snapshot:** `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Authority:** Finance services, Prisma schema/migrations and tests are authoritative. This guide records cross-module invariants, not every finance workflow.

## Accounting invariants

- Persist monetary values as integer kobo using `BigInt`.
- Route financial postings through the shared posting service.
- Do not write journal entries independently from individual modules.
- Preserve balanced double-entry journals.
- Preserve idempotency for posting operations.
- Preserve reversal behavior rather than silently mutating posted accounting history.
- Preserve approval separation and audit history.

These invariants apply across finance workflows. A feature must not bypass the shared posting path because it appears to be a small or isolated transaction.

## Module boundaries

The current architecture has distinct modules for:

- Ledger.
- Fees and payments.
- Expenses.
- Payroll.
- Finance reports.
- Finance settings.
- Bank reconciliation.
- Gateway settlements.
- Payroll transfers.

Bank reconciliation, gateway settlements and salary transfers are separate modules with their own permissions/features and lifecycle rules. Salary transfers have an additional platform/school settings gate.

The exact routes, DTOs, state transitions and posting behavior must be verified in the relevant module source before implementation.

## Change review checklist

Before changing a financial workflow, establish:

1. Which business event creates the accounting effect.
2. Which service owns journal posting.
3. Whether the operation is idempotent under retries.
4. How duplicate, failed and reversed operations are handled.
5. Whether approval and posting duties remain appropriately separated.
6. Which audit events are recorded.
7. Whether tenant context and school-level permissions/features are enforced.
8. Which tests cover journal balance and the workflow's failure paths.

Do not use a direct database write to bypass the posting service, even if the new code can construct a balanced journal itself.

## Workstream documentation

See the [Finance Handoff](../FINANCE_HANDOFF.md) for the current finance workstream snapshot. It contains implementation status and next steps that require module-by-module verification; it is not a substitute for the accounting invariants in this guide.

## Related guides

- [System and monorepo architecture](system-and-monorepo.md)
- [Multi-tenancy and database architecture](multi-tenancy-and-database.md)
- [Background processing](background-processing.md)
