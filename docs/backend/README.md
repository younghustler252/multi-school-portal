# Backend Documentation

This section documents the backend implementation for developers building and maintaining CORE.

## Reading order

1. [System and monorepo architecture](../architecture/system-and-monorepo.md)
2. [Multi-tenancy and database architecture](../architecture/multi-tenancy-and-database.md)
3. [Authentication and authorization architecture](../architecture/authentication-and-authorization.md)
4. [Background processing architecture](../architecture/background-processing.md)
5. [Module guides](#module-guides) — source-reviewed implementation behavior and cross-module dependencies.
6. [API conventions](api-conventions.md) — route composition, tenant/auth middleware, validation, pagination, rate limits and response conventions.
7. [Error handling](error-handling.md) — error classes, status/code mapping and response envelopes.
8. [Backend remediation register](BACKEND_REMEDIATION_REGISTER.md) — cumulative developer handoff of confirmed findings, potential risks and verification tasks.
9. OpenAPI contract — next, after route/DTO coverage and response behavior have been audited.

## Module guides

| Module | Guide | Verification |
|---|---|---|
| Auth | [Auth module](modules/auth.md) | Source-reviewed; runtime and integration verification outstanding |
| Users | [Users module](modules/users.md) | Source-reviewed; runtime and integration verification outstanding |
| School | [School module](modules/school.md) | Source-reviewed; provider/runtime verification outstanding |
| Roles and permissions | [Roles and permissions](modules/roles.md) | Source-reviewed; registry sync/runtime verification outstanding |
| Branches | [Branches module](modules/branches.md) | Partially source-verified; tests/schema/runtime verification outstanding |
| Staff | [Staff module](modules/staff.md) | Partially source-verified; remaining use cases/tests/schema/runtime verification outstanding |
| Students | [Students module](modules/students.md) | Partially source-verified; remaining lifecycle/photo/schema/test verification outstanding |
| Guardians | [Guardians module](modules/guardians.md) | Partially source-verified; update/repository/schema/test verification outstanding |
| Classes and subjects | [Classes and subjects](modules/classes.md) | Partially source-verified; remaining use cases/schema/test verification outstanding |
| Enrolment | [Enrolment module](modules/enrolment.md) | Partially source-verified; schema/migration/runtime verification outstanding |
| Sessions and calendar | [Sessions module](modules/sessions.md) | Partially source-verified; schema/migration/runtime verification outstanding |
| Attendance | [Attendance module](modules/attendance.md) | Partially source-verified; tests/runtime and summary authorization review outstanding |
| Grades | [Grades module](modules/grades.md) | Source-reviewed; DB/migration execution, HTTP tests and runtime verification outstanding |
| Report cards | [Report cards module](modules/report-cards.md) | Source-reviewed; migration/HTTP/worker verification outstanding |
| Fees | [Fees module](modules/fees.md) | Source-reviewed; migration/HTTP/runtime verification and remediation outstanding |
| Payments | [Payments module](modules/payments.md) | Source-reviewed; PostgreSQL concurrency, HTTP/runtime and webhook verification outstanding |
| Ledger | [Ledger module](modules/ledger.md) | Source-reviewed; period-close concurrency, HTTP and runtime verification outstanding |
| Expenses | [Expenses module](modules/expenses.md) | Source-reviewed; recurring authorization, budget concurrency and runtime verification outstanding |
| Payroll | [Payroll module](modules/payroll.md) | Source-reviewed; database uniqueness, profile atomicity, HTTP and concurrency verification outstanding |
| Salary transfers | [Salary transfers module](modules/payroll-transfers.md) | Source-reviewed; reversal guard, disabled-state reconciliation and provider integration verification outstanding |
| Finance settings | [Finance Settings module](modules/finance-settings.md) | Source-reviewed; HTTP and cross-tenant database verification outstanding |
| Bank reconciliation | [Bank Reconciliation module](modules/bank-reconciliation.md) | Source-reviewed; balance-evidence, sign-off concurrency and HTTP/DB verification outstanding |
| Finance reports | [Finance Reports module](modules/finance-reports.md) | Source-reviewed; query limits, report/CSV tests and accountant entitlement verification outstanding |
| Plans | [Plans module](modules/plans.md) | Source-reviewed; zero-limit presentation, atomic grants and open-invoice deactivation verification outstanding |
| Subscriptions | [Subscriptions and Billing module](modules/subscriptions.md) | Source-reviewed; checkout uniqueness, lifecycle concurrency, coupon limits and billing integration verification outstanding |
| Gateway settlements | [Gateway Settlements module](modules/gateway-settlements.md) | Source-reviewed; legacy route conflict, itemized settlement tests and preview validation outstanding |
| Audit | [Audit module](modules/audit.md) | Source-reviewed; transactional outbox, redaction, date filtering and isolation verification outstanding |
| Platform settings | [Platform Settings module](modules/platform-settings.md) | Source-reviewed; public URL validation, audit and singleton initialization outstanding |
| School settings | [School Settings module](modules/school-settings.md) | Source-reviewed; singleton initialization, storage cleanup and DB/multipart verification outstanding |
| Automation | [Automation module](modules/automation.md) | Source-reviewed; rule uniqueness, scheduler recovery, timezone, pagination and DB/HTTP verification outstanding |
| Notifications | [Notifications module](modules/notifications.md) | Source-reviewed; platform delivery, broadcast safety, dispatch durability and DB/HTTP verification outstanding |
| Message templates | [Message Templates module](modules/message-templates.md) | Source-reviewed; rendered subject validation and DB/HTTP verification outstanding |
| Webhooks | [Webhooks module](modules/webhooks.md) | Source-reviewed; processing leases, retry automation and raw-body/DB integration verification outstanding |
| Feedback | [Feedback module](modules/feedback.md) | Source-reviewed; abuse controls, URL privacy, audit, support notification retry and management tests outstanding |
| Graduation lifecycle | [Student graduation lifecycle](modules/graduation-lifecycle.md) | Source-reviewed across Students, Enrolment and Sessions; DB/migration execution, HTTP and quota-concurrency verification outstanding |

## Documentation contract

Module guides describe implementation responsibilities, dependencies, data ownership, route behavior, DTOs, response shapes, permissions, business rules, background work, errors, tests and frontend integration requirements.

A guide must identify its source snapshot and distinguish:

- **Source-verified:** confirmed in the current implementation.
- **Partially verified:** some relevant implementation paths remain unchecked.
- **Open:** a known defect, design decision or missing verification.
- **Not verified:** no claim should be made until the source or runtime behavior is inspected.

Do not treat a module guide as a replacement for OpenAPI. The API specification should become the canonical cross-team HTTP contract after endpoint coverage has been audited.

## Module audit sequence

The source inventory contains 34 top-level API module directories. Each has a corresponding guide; the singular source folder user is documented as users.md. The guides were written from source inspection, but that does not mean every test, migration, provider integration or runtime path has been executed.

**Foundation and identity**
1. Auth
2. Users
3. School and provisioning
4. Roles and permissions
5. Branches
6. Staff
7. Students
8. Guardians

**Academic operations**
9. Classes and subjects
10. Enrolment
11. Sessions and calendar
12. Attendance
13. Grades
14. Report cards
15. Graduation lifecycle (cross-module student/enrolment/session behavior)

**Finance**
16. Fees
17. Payments
18. Ledger
19. Expenses
20. Payroll
21. Salary transfers
22. Finance Settings
23. Bank Reconciliation
24. Finance Reports
25. Plans
26. Subscriptions and Billing
27. Gateway Settlements

**Platform and communications**
28. Audit
29. Platform Settings
30. School Settings
31. Automation
32. Notifications
33. Message Templates
34. Webhooks
35. Feedback

The graduation lifecycle guide is a cross-module guide, not a separate source module, so the total is 34 module folders plus that lifecycle guide.

The remaining backend documentation work is API conventions, error handling and OpenAPI contract coverage. After those contracts are complete, document the target frontend architecture and integration requirements against the verified backend—not the outdated frontend implementation.

The frontend is intentionally not being documented as the current implementation while it remains behind the backend. Frontend implementation documentation will follow the backend contract audit.
