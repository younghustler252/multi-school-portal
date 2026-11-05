# CORE Finance Module — Current Handoff

> **Repository:** `younghustler252/multi-school-portal`  
> **Branch:** `refactor/modules`  
> **Source snapshot:** `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05)  
> **Important:** This handoff records source-visible structure and decisions. It does not claim that migrations have been applied to every school or that the current test suite has passed.

## 1. Core accounting decisions

- Double-entry accounting is the foundation.
- Monetary amounts are persisted as integer kobo (`BigInt`).
- Financial events must post through the shared posting service and preserve idempotency and reversal behavior.
- Approval-sensitive actions must preserve separation of duties and audit history.
- Tenant-owned finance records live in the school's tenant schema.
- Dates and finance reporting must follow the agreed Africa/Lagos business timezone conventions.
- Finance modules may read data owned by other modules, but should not silently take ownership of their write workflows.

## 2. Current implementation map

The following finance-related containers are registered in `apps/api/src/container/index.ts`, and their routers are mounted in `apps/api/src/routes/index.ts`:

| Area | API mount | Current responsibility |
|---|---|---|
| Ledger | `/finance` | Accounts, journals, opening balances, transfers, periods and close/reopen |
| Finance reports | `/finance` | Report catalogue, report execution/export and dashboard |
| Finance settings | `/finance/settings` | School-level finance configuration |
| Bank reconciliation | `/finance/reconciliation` | Statement import, bank/book line matching, adjustments, reconciliation sign-off/reopen |
| Gateway settlements | `/finance/settlements` | Paystack settlement report preview/recording, manual settlement, reversal |
| Fees and invoices | `/fees`, `/fees/invoices`, `/fees/adjustments` | Fee structures, invoice lifecycle, adjustments and fee reports |
| Payments | `/payments` | Payment recording/confirmation, online payment, allocation, credit, refunds and reversal |
| Expenses | `/expenses` | Expense lifecycle, approval, payment, reversal, reports and petty cash |
| Vendors | `/vendors` | Vendor records |
| Budgets | `/budgets` | Budget management |
| Recurring expenses | `/recurring-expenses` | Recurring expense rules |
| Payroll | `/payroll` | Components, staff pay profiles, runs, payslips, loans and remittances |
| Salary transfers | `/payroll/transfers` | Start/send/reconcile/retry/cancel bank-transfer attempts |
| Personal payslips | `/my/payslips` | Signed-in user's payslips |

The API prefixes are mounted under `/api/v1`.

## 3. Phase status

The older phase table in the previous handoff stopped at Payroll Phase 5 and described Phase 6 as not started. That status is obsolete.

The current source contains and wires the Phase 6 workstreams:

- **Finance settings:** registered and mounted at `/api/v1/finance/settings`.
- **Bank reconciliation:** registered and mounted at `/api/v1/finance/reconciliation`; the routes enforce the `finance.bank_reconciliation` plan feature and granular `finance.bank_reconciliation.*` permissions.
- **Gateway settlements:** registered and mounted at `/api/v1/finance/settlements`; the routes use payment permissions and the `modules.fees` feature.
- **Payroll bank transfers:** registered and mounted at `/api/v1/payroll/transfers`; the routes use payroll permissions and `modules.payroll`. The route documentation states that sending is off until both platform and school finance settings allow it.

These statements confirm source wiring, not deployment readiness. Verify public/tenant migrations, generated Prisma clients, provider credentials, worker behavior, settings values, and tests in the target environment before enabling financial operations.

## 4. Important route-level controls

- Ledger routes use finance permissions and the `modules.fees` feature gate.
- Bank reconciliation routes use `finance.bank_reconciliation` plus separate view/import/match/post/complete permissions.
- Gateway settlement routes use payment permissions and `modules.fees`.
- Payroll routes use payroll permissions and `modules.payroll`.
- Salary transfer routes use `payroll.transfers.send` / `payroll.transfers.reconcile`, plus `modules.payroll`; sending has an additional settings gate.
- Every tenant finance route must retain authentication, tenant resolution, permission checks, feature checks where defined, and strict DTO validation.

Inspect the actual route and use-case code before changing permission names, entitlement keys, or state transitions.

## 5. Background processing and provider boundaries

The API and worker are separate processes. The worker entry is `apps/api/src/worker.ts`; worker registrations are in `apps/api/src/infrastructure/jobs/index.ts`. The current worker set includes payment reconciliation, ledger integrity, recurring expenses, and other platform/school lifecycle workers.

Paystack settlement matching and salary transfers are distinct from the incoming webhook front door. Confirm the current provider callbacks, reconciliation behavior, idempotency keys, and unknown-outcome handling before modifying transfer behavior.

## 6. Database and deployment checklist

Before deploying finance changes:

1. Identify whether the change affects the public schema, tenant schema, or both.
2. Add/review the correct migration under `apps/api/prisma/migrations/` or `apps/api/prisma/tenant-migrations/`.
3. Generate Prisma clients with `npm run prisma:generate -w apps/api`.
4. Apply public migrations and tenant migrations using the documented API workspace scripts and the correct environment.
5. Apply tenant migrations to existing schools where required; new-school provisioning alone is not sufficient.
6. Run `npm test` with a dedicated test database configured if the changed tests need database access.
7. Verify registry/role sync when permission or entitlement definitions change.
8. Keep salary transfers disabled until provider configuration, school/platform settings, permissions, and operational reconciliation have been checked.

## 7. Verification status and remaining work

This documentation review verified registration and route mounting for the finance areas listed above and inspected the route definitions for ledger, finance settings, bank reconciliation, gateway settlements, payroll, payments, expenses and salary transfers.

It did **not** run builds, tests, migrations, provider calls, or live API requests. Do not reuse the old handoff's phase-specific test counts or migration instructions as current evidence.

For the next finance task, first identify the exact module and inspect its current implementation, tests, migrations, and frontend contract. Update this handoff only when a verified source change alters the workstream state.