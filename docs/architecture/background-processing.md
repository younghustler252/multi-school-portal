# Background Processing Architecture

> **Status:** Current source-checked architecture snapshot.
> **Source snapshot:** `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Authority:** Worker, queue, scheduler and job implementations are authoritative; inspect them before changing operational behavior.

## Process boundaries

CORE runs the HTTP API and background worker as separate processes:

| Process | Entry point |
|---|---|
| API | `apps/api/src/server.ts` |
| Worker | `apps/api/src/worker.ts` |

Background work uses Redis and BullMQ. Worker registration is located at:

`apps/api/src/infrastructure/jobs/index.ts`

The API and worker have separate startup responsibilities. Do not assume starting the API also starts the worker.

## Current worker areas

The current worker set includes jobs for:

- School provisioning.
- Notifications.
- Automation.
- Billing.
- School lifecycle.
- Term lifecycle.
- Payment reconciliation.
- Ledger integrity.
- Recurring expenses.
- Class PDF work.

This is a high-level inventory, not a complete queue/job contract. Inspect the job registration and implementation for exact queue names, payloads, retry policy, concurrency, idempotency and failure handling.

## Scheduler initialization

The worker starts scheduler initialization separately. Inspect the current scheduler implementation before changing cadence, timezone assumptions or deployment expectations. Do not infer scheduler behavior solely from the presence of a job processor.

## Tenant context

Workers performing tenant-owned operations must establish the correct tenant context before accessing tenant data. An HTTP middleware chain does not run automatically for a background job.

When adding or changing a tenant job, verify:

1. How the job identifies the target school.
2. How the tenant context/client is established.
3. Whether retries are safe and the operation is idempotent.
4. How failures are recorded and surfaced.
5. Whether the job needs audit records or notifications.
6. Whether scheduler/worker deployment configuration includes the new work.

## Related guides

- [Multi-tenancy and database architecture](multi-tenancy-and-database.md)
- [Finance architecture and invariants](finance-architecture.md)
