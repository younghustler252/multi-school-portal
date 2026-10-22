# SchoolOS / Multi-School Portal — Platform Documentation & AI Handoff

> **Purpose:** This is the current, repository-grounded entry point for any developer or AI continuing work on this project. Read this file before changing architecture or starting a module.
>
> **Last reviewed:** 2026-10-22  
> **Branch reviewed:** `refactor/modules`  
> **Reviewed head:** `86c0506f3ade19091b57a27a06f96ac96e5cebe8`  
> **Important:** This document describes what is visible in this branch. File existence does not mean a module is integrated, tested, or production-ready.

---

## 1. Product direction

SchoolOS is a multi-tenant school-management SaaS focused initially on Nigerian primary and secondary schools. It should replace fragmented paper records and spreadsheets with one system for school administration, student records, academics, fee collection, finance, and communication.

The school is the tenant boundary. The platform must support multiple schools without allowing one school to access another school's data. Platform operations and school operations are separate realms.

### Core product principles

- Mobile-first and usable by non-technical school staff.
- School onboarding and verification, subscription plans, plan entitlements, and permissions are separate concerns.
- A user's login is not the same thing as their role inside one school. A login can have multiple school memberships/personas.
- Every school-owned record is accessed through the active tenant context, not by trusting a client-supplied school ID.
- Financial operations must be auditable, idempotent where retries are possible, and represented in the ledger through the shared posting service.
- Prefer extending the current architecture over replacing it. Do not introduce a second pattern just because another one seems simpler.
- Keep module changes scoped. Do not refactor unrelated modules as collateral work.

## 2. Stack and architecture

### Stack evidenced in the repository

- Node.js + TypeScript
- Express 5
- PostgreSQL
- Prisma 7 with separate public and tenant Prisma schemas/clients
- Awilix dependency-injection container
- Redis + BullMQ for background jobs
- Paystack integration for payments/billing
- Supabase Storage integration is present in the dependency stack
- Zod validation and a shared API response/error format
- Node test runner / `tsx` test command

See `package.json`, `prisma/public.prisma`, `prisma/tenant.prisma`, `src/container/index.ts`, and `src/routes/index.ts` for the current implementation.

### Multi-tenancy

- **Public schema:** platform-level records such as schools, users, plans, subscriptions, and billing.
- **Tenant schema:** each school's own operational records, including staff, students, guardians, academic data, and school finance data.
- Each school has its own PostgreSQL schema within the database.
- Tenant repositories should use `getTenantClient()`; tenant access must run inside the tenant context.
- Background jobs that touch school data must establish the appropriate tenant context. Do not call tenant models from a platform-only context.

### Request flow

The intended request pipeline is:

1. Resolve the tenant from the request host.
2. Authenticate the session and populate `req.auth`.
3. Require a school tenant for school-only routes.
4. Check role permissions and scope.
5. Check plan entitlements/limits where relevant.
6. Validate request data.
7. Controller calls a use case.
8. Use cases enforce business rules.
9. Repositories/services access the appropriate public or tenant database.
10. Shared error handling returns the standard error envelope.

Controllers should remain HTTP adapters. Business rules belong in use cases/services, not in controllers or route files.

### Dependency injection and route registration

- Module registrations live in `src/container/index.ts`.
- API mounts live in `src/routes/index.ts`.
- A module may have code files and imports while still being **inactive** because its container registration and/or route mount is commented out.
- Worker startup is in `src/worker.ts`; job/worker registration is under `src/infrastructure/jobs/`.
- When a module is enabled, check its dependency registrations and route mount together. Do not assume one implies the other.

### Shared platform concepts

- **Authentication/session:** identity and active context.
- **Membership/persona:** what a user is within a school.
- **Permission + scope:** what an actor can do and to which records.
- **Entitlement/plan limit:** what the school's subscription allows. This is separate from permission.
- **Audit:** records important actor actions and changes.
- **NumberSequenceService:** shared sequential identifiers; reuse it rather than inventing independent number-generation patterns.
- **Ledger PostingService:** finance modules should use this to post financial events into the books rather than independently writing journal rows.

## 3. Current implementation and integration status

Status terms used here:

- **Integrated:** registration and route wiring are present in the current source inspected.
- **Implemented, integration incomplete:** meaningful code exists, but one or more required registrations/routes/dependencies are not enabled.
- **Partial/in progress:** some use cases are present, but the module's full intended scope is not implemented.
- **Needs verification:** documentation or code indicates work, but the current branch has not been fully tested/audited in this review.

| Area | Current branch evidence | Status / caution |
|---|---|---|
| Shared infrastructure | Shared container, database clients, middleware, jobs, and common services exist | Foundation used by the registered modules; verify individual services when touching them |
| Foundation / RBAC / entitlements / registry sync | Registered in `src/container/index.ts`; current module notes describe permission and entitlement registry changes | Integrated foundation; preserve the registry-sync workflow |
| Auth | `registerAuth` and `/auth` are enabled; `docs/AUTH_MODULE_NOTES.md` documents current flows | Implemented pass according to notes; known items remain in its notes, so do not call it issue-free |
| School onboarding / verification | `registerSchool` and `/schools` are enabled; `docs/SCHOOL_MODULE_NOTES.md` documents lifecycle and routes | Implemented pass according to notes; check lifecycle worker/scheduler wiring before changing lifecycle behavior |
| User/profile/session management | `registerUser` and `/users` are enabled; see `docs/USER_MODULE_NOTES.md` | Implemented pass according to notes; email-change flow is explicitly deferred |
| Plans | `registerPlans` and `/plans` are enabled; see `docs/PLANS_MODULE_NOTES.md` | Implemented pass according to notes; plans use entitlements rather than the old fixed feature JSON |
| Subscriptions / platform billing | Subscription container is enabled; `src/routes/index.ts` currently mounts `billing.routes` at `/subscriptions`; see `docs/BILLING_MODULE_NOTES.md` and `docs/BILLING_SCHEMA.md` | Billing engine pass exists. The notes describe `/billing` and `/platform/subscriptions`, so the current route wiring differs from that documented contract and must be reconciled deliberately; verify workers, webhooks, migrations, and tests |
| Branches | `registerBranches` is enabled and `branchRouter` is imported, but the inspected `src/routes/index.ts` does not mount it | **Route integration incomplete.** Do not call the Branches API integrated until the intended mount is restored and verified; respect branch scopes and staff-branch assignments |
| Staff | `registerStaff` and `/staff` are enabled; see `docs/STAFF_AND_AUDIT_NOTES.md` | Implemented pass according to notes; CSV/Excel bulk import was deferred to a shared import approach with Students |
| Audit | `registerAudit` and `/audit` are enabled; see `docs/STAFF_AND_AUDIT_NOTES.md` | Integrated; audit changes should preserve actor, module, request ID, and impersonation semantics |
| Ledger / finance foundation | `registerLedger` and `/finance` are enabled; `src/modules/ledger/ledger.container.ts` exposes the posting service and accounting use cases | Finance foundation exists. Fees/payments/expenses/payroll should integrate with the posting service; do not duplicate ledger posting logic |
| Fees v2 | `registerFees` and `/fees` are enabled. Latest commits on this branch implement phase 2 pieces 1–2: schema/migration groundwork, fee types, fee structures, and discount rules | **Partial/in progress.** The container comment explicitly says invoices, payments, and the rest of Fees v2 are to be added as built. Do not describe the entire fee lifecycle as complete |
| Students | `registerStudents` and `/students` are enabled; see `docs/STUDENTS_MODULE_NOTES.md` | **First slice implemented** (create, get, list/search, update, deactivate, reactivate, photo). Bulk import, guardians on the detail, class/attendance on the list and student login are deferred. Build and unit tests checked; database/API tests not run |
| Guardians | Some references/files exist, including dependencies from student import | Not integrated; inspect current module completeness before enabling |
| Classes / Sessions / Enrolment | Student import references these modules; route/container registrations are commented out | Not integrated; treat as dependencies, not completed functionality |
| Attendance / Grades / Report Cards | Models/references and some module files exist; route/container registrations are commented out | Not integrated; audit each module before enabling |
| Payments / Notifications / Settings / Platform admin / Feedback | Some imports/files may exist, but current container/routes have registrations commented out | Not integrated as a whole; inspect individual scope before starting or re-enabling |
| Tests / CI status | `npm test` and `npm run build` scripts exist; `docs/TESTING_GUIDE.md` documents test setup | **Not run as part of this documentation update.** Never claim green build/tests without executing them on the current checkout |

### Important wiring snapshot

At the reviewed head, `src/container/index.ts` registers Shared, Foundation, Auth, School, User, Plans, Subscriptions, Branches, Staff, Ledger, Fees, and Audit. `registerStudents` is also registered (Students first slice).

At the same head, `src/routes/index.ts` mounts Auth, Users, Schools, Plans, Subscriptions (using `billing.routes`), Audit, Staff, Finance, and Fees. `/students` is mounted (Students first slice). `branchRouter` is imported but no `/branches` mount is present in the inspected file. The Billing notes describe a different route contract (`/billing` and `/platform/subscriptions`); resolve this discrepancy as part of a scoped billing integration task rather than silently changing it during the Students pass.

This is a code snapshot, not a guarantee that every route or worker is correct. Confirm exact current code before changing it.

## 4. Students module: next module to audit/refactor

Students is the next planned module, but **do not simply uncomment its container and route**. Its current code has dependencies on other modules that are not integrated.

### Existing files

The current module contains:

- `domain/student.entity.ts`, `domain/student.enums.ts`
- `dtos/student.dto.ts`
- `mappers/student.mapper.ts`
- `repositories/student.repository.ts`, `student.repository.impl.ts`
- `usecases/create-student.usecase.ts`
- `usecases/get-student.usecase.ts`
- `usecases/get-students-batch.usecase.ts`
- `usecases/list-students.usecase.ts`
- `usecases/update-student.usecase.ts`
- `usecases/deactivate-student.usecase.ts`
- `usecases/upload-photo.usecase.ts`
- `usecases/import-students.usecase.ts`
- `controllers/student.controller.ts`
- `routes/student.routes.ts`
- `students.container.ts`

### Confirmed integration/dependency concerns

These are visible in the current source and must be investigated before integration:

1. The Students container and route mount are commented out in the main wiring.
2. `CreateStudentUseCase` imports/requires the school-settings repository, user repository, password service, and mail service. Check whether these are registered and whether the intended student-login behavior still matches the current Auth/membership architecture.
3. `ImportStudentsUseCase` depends on the Classes, Enrolment, Sessions, Guardians, and Audit modules. Several of those module registrations are currently commented out. Bulk import therefore cannot be treated as ready merely because its source file exists.
4. The route file currently uses legacy role helpers such as `requireSchoolAdmin` and `requireStaff`. Review these against the current Foundation access/permission/scope system and the patterns used by Staff/Branches before deciding the correct authorization model.
5. The current route file includes CSV upload, JSON bulk creation, batch lookup, student CRUD, and photo upload. Check each route's validation, limits, authorization, and error behavior.
6. The tenant schema's Student model includes optional `userId`, optional unique `admissionNumber`, identity/profile fields, `isActive`, and `admittedAt`, with relations to enrolments, guardian links, attendance, grades, fee invoices, report cards, discounts, allocations, and refunds. Preserve established relations unless the audit proves a change is necessary.
7. `Staff` already uses the shared `NumberSequenceService` for employee numbers. Check its implementation and intended sequence conventions before designing admission-number generation.
8. The Staff notes defer CSV/Excel bulk import to a shared import engine built with Students. Audit the existing student importer first; do not prematurely build a second generic import framework.
9. Photo upload should follow the shared storage/file-validation patterns and existing file-signature checks. Do not trust a client-supplied MIME type.
10. Check student plan limits, duplicate admission numbers, duplicate-person handling, soft-deactivation, audit events, branch visibility, transaction boundaries, and tenant isolation. Confirm how each rule is enforced rather than assuming it is present.

### Suggested Students audit order

1. Read the current Student schema and every Students module file.
2. Trace every injected dependency to its container registration and current implementation.
3. Compare route guards to current RBAC and entitlement conventions.
4. Review create/update/deactivate, student login linkage, and admission-number generation.
5. Review list/search/pagination/batch behavior and data scoping.
6. Review photo upload and import validation, partial-failure reporting, transactions, and audit behavior.
7. Review plan-limit enforcement for single and bulk creation.
8. Check tests and add missing unit/integration tests.
9. Write a scoped implementation plan with **required changes**, **optional follow-ups**, and **explicit non-goals**.
10. Only then implement the Students pass and update the wiring it genuinely needs. Do not activate unavailable dependent modules just to make imports compile without first agreeing the dependency plan.

### Likely downstream dependency order

A sensible working sequence after Students is:

**Students → Guardians → Classes / Sessions / Enrolment → Attendance → Grades → Report Cards**

This is a planning recommendation, not a rigid architectural rule. Fees v2 is a parallel workstream and already has code in progress. Coordinate student/guardian/class relations with fee invoicing before finalizing those contracts.

## 5. Finance direction

The ledger is a shared accounting foundation, not just a collection of finance CRUD screens.

- `src/modules/ledger/` provides accounts, finance periods, journals, manual journals, reversals, transfers/opening balances, cash book/account balance reports, and ledger integrity checks.
- The shared `PostingService` is the intended integration point for fees, payments, expenses, and payroll.
- Fees v2 currently covers setup primitives visible in the latest commits: fee types linked to income accounts, fee structures, and discount rules/student discounts.
- Do not mark fee invoicing, payment allocation, refunds, or complete accounting reports as finished unless their code and tests have been reviewed.
- Expenses/staff payroll and richer financial statements (trial balance, income statement/profit-and-loss, balance sheet) should be designed around a consistent chart of accounts, journal posting rules, and closed/open finance periods. Avoid calculating authoritative financial statements from unrelated CRUD totals.

## 6. Repository documentation map

Read the relevant notes before modifying the associated area:

- `docs/AUTH_MODULE_NOTES.md` — authentication, sessions, OTPs, invites, impersonation, frontend contract, remaining assumptions.
- `docs/SCHOOL_MODULE_NOTES.md` — registration, verification, school lifecycle, provisioning, school/platform routes.
- `docs/USER_MODULE_NOTES.md` — profile, password changes, sessions, avatar, user-access APIs, deferred work.
- `docs/PLANS_MODULE_NOTES.md` — plans, entitlements, plan permissions, registry sync, pricing rules.
- `docs/BILLING_MODULE_NOTES.md` + `docs/BILLING_SCHEMA.md` — subscription billing engine, invoices, attempts, webhooks, workers and migration requirements.
- `docs/BRANCHES_NOTES.md` — branch model, branch scope, branch entitlements, migrations and role templates.
- `docs/STUDENTS_MODULE_NOTES.md` — students first slice: routes, permissions, admission numbers, frontend changes, deferred items.
- `docs/STAFF_AND_AUDIT_NOTES.md` — staff lifecycle, invites, staff branches, audit upgrade, permissions, deferred bulk import.
- `docs/SCHOOLOS_HOW_IT_WORKS.md` — deeper explanation of request flow, tenancy, shared foundation, module conventions, and debugging.
- `docs/TESTING_GUIDE.md` — test commands and safe database-test setup.
- `docs/must_do.txt` — broader engineering checklist; verify individual items against current code before treating them as open.
- `PROJECT_BRIEF (1).md` — product brief and high-level requirements; some older assumptions may differ from the current architecture.

The module notes are implementation handoff notes, not a substitute for reading the live code. Some describe applying changes from an earlier package/patch; when in doubt, compare the instruction with the current branch and do not reapply a historical migration blindly.

## 7. Rules for any AI or developer continuing this repository

1. **Start with the current branch and diff.** Confirm the branch and latest commit before edits.
2. **Read this file plus the relevant module notes and source.** Do not assume conversation memory is available.
3. **Inspect before coding.** Map the current schema, use cases, repositories, routes, container registrations, permissions, entitlements, jobs, and tests that the task touches.
4. **Keep the existing architecture.** Use controllers → use cases/services → repositories; use Awilix registration, shared errors/responses, tenant clients, Foundation access, and audit conventions.
5. **Separate implementation from integration.** Record whether a module is implemented, registered, mounted, tested, and verified.
6. **Avoid unrelated edits.** Do not opportunistically rename or reformat other modules.
7. **Do not enable dependent modules blindly.** Document the dependency graph and agree the smallest safe integration slice.
8. **Treat migrations carefully.** Inspect both Prisma schemas and migration history; never assume a migration in the notes has already been applied or rerun old schema instructions blindly.
9. **Verify claims.** Run focused tests and type/build checks when available. State what ran, what passed, what was skipped, and why. If you cannot run commands locally, say so.
10. **Update docs in the same pass.** Record the new behavior, routes/API contract, permissions, entitlements, migrations, tests, remaining gaps, and exact integration status.
11. **Do not invent completion.** A file existing, a comment describing intended behavior, or a passing test subset does not prove the whole module is complete.
12. **Leave a handoff.** End each module pass with changed files, migration/test status, known risks, deferred items, and the next recommended step.

## 8. How to run checks

The repository scripts include:

- `npm run build` — TypeScript build
- `npm test` — test suite
- `npm run sync:registries` — sync permission/role/feature/template registries
- `npm run prisma:generate` — generate both Prisma clients

Use `docs/TESTING_GUIDE.md` before database tests. Database tests must use the dedicated test database described there; never run destructive tests against development or production data. These commands were **not run during this documentation update**.

---

## 9. Current next action

**Guardians next** (then Classes / Sessions / Enrolment). Audit the Guardians module the same way as Students: trace its dependencies, compare routes to the permission system, then make the smallest change set. Run `npm run sync:registries` after pulling the Students pass. Update this document and the module notes after each pass.
