# CORE Platform Documentation

> **Purpose:** Current architecture guide for developers and future implementation work.  
> **Source snapshot:** branch `refactor/modules`, commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).  
> Application code, Prisma schemas/migrations, tests and runtime configuration remain authoritative. This is a source-checked snapshot, not a substitute for inspecting the module being changed.

## 1. Repository architecture

CORE is an npm-workspaces monorepo. Deployable applications live under `apps/`; reusable contracts live under `packages/`.

```text
/
├── apps/
│   ├── api/                 Express + Prisma + BullMQ backend
│   │   ├── prisma/          public/tenant schemas and migrations
│   │   ├── src/
│   │   │   ├── foundation/  access, permissions, entitlements, settings
│   │   │   ├── infrastructure/ database, middleware, jobs, providers
│   │   │   ├── modules/     feature modules
│   │   │   ├── shared/      cross-module utilities and services
│   │   │   ├── container/
│   │   │   ├── routes/
│   │   │   ├── app.ts, server.ts, worker.ts
│   │   └── tests/
│   └── web/                 Next.js 16 / React 19 dashboard
├── packages/
│   └── contracts/           shared frontend/backend contracts
├── docs/
├── package.json             npm workspaces and root scripts
└── tsconfig.base.json
```

The root workspace configuration includes `apps/*` and `packages/*`. Root scripts include `build:api`, `build:web`, `typecheck`, `typecheck:web`, `typecheck:all`, `test`, `check`, `db:up`, and development commands. Backend-specific commands belong to `apps/api/package.json`; do not assume root scripts named `build`, `sync:registries`, or `prisma:generate` exist.

## 2. Technology and backend boundaries

| Area | Current implementation |
|---|---|
| API | Node.js 22+, TypeScript, Express 5 |
| Web | Next.js 16, React 19, TypeScript |
| Database | PostgreSQL, Prisma 7 |
| Tenant model | Public schema plus a separate PostgreSQL schema per school |
| Dependency injection | Awilix, proxy injection |
| Background work | Redis + BullMQ; API and worker are separate processes |
| Validation | Zod 4 DTOs |
| Tests | Node test runner through `tsx` |
| Shared contracts | `packages/contracts` |

The backend is a modular monolith, not a set of independently deployed services. Feature boundaries live under `apps/api/src/modules/<module>/`. The established pattern is routes → controllers → use cases/services → repositories, with cross-cutting concerns in `foundation/`, `infrastructure/`, and `shared/`.

Some use cases still access Prisma directly for multi-table transactions. The architecture test keeps an explicit allow-list for those files; do not assume all use cases are repository-only.

## 3. Multi-tenancy and persistence

- Public schema: `apps/api/prisma/public.prisma`; migrations: `apps/api/prisma/migrations/`.
- Tenant schema: `apps/api/prisma/tenant.prisma`; migrations: `apps/api/prisma/tenant-migrations/`.
- Prisma configs: `apps/api/prisma.public.config.ts` and `apps/api/prisma.tenant.config.ts`.
- Each school has its own PostgreSQL schema. Tenant-owned work must run inside the active tenant context and use the tenant client (normally `getTenantClient()`).
- Public identity and school membership/persona are separate concepts. Do not reintroduce legacy role or school ownership fields as authorization authority.
- A migration existing in Git does not prove it has been applied to every existing school schema. Review new-school provisioning and existing-school migration application separately.

Never use a client-supplied school ID as the tenant isolation boundary.

## 4. Authorization and entitlements

Authorization and plan access are separate:
- **Permissions + scopes** decide what an actor may do and which records they may access (`ALL`, `BRANCH`, `ASSIGNED`, `OWN`).
- **Plan entitlements/features/limits** decide what the school's subscription permits.

Platform permissions use the `platform.*` namespace. School permissions are evaluated in the school realm. Role names are not authorization authority; the architecture test rejects legacy role-name guards and `req.user`.

Permission, role, feature and entitlement registries live under `apps/api/src/foundation/`. Review the target sync command and environment before running it.

## 5. API lifecycle

The current application is `apps/api/src/app.ts`. Its observed middleware order is:

1. Helmet and CORS.
2. Provider webhook entry at `/api/v1/webhooks` (before the global limiter and JSON parser; webhook signature verification needs the raw body).
3. Global rate limiter.
4. Static report-card template previews at `/api/v1/report-cards/template-previews`.
5. JSON/url-encoded parsers and cookie parser.
6. Morgan logging outside test.
7. Optional authentication.
8. Tenant resolution.
9. Tenant ownership validation.
10. Health endpoint and versioned router at `/api/v1`.
11. Bull Board at `/admin/queues`, guarded by authentication and `platform.queues.view`.
12. JSON 404 and global error handler.

Route-level middleware remains responsible for authentication, tenant requirements, permissions/scopes, feature entitlements and DTO validation.

**Deployment warning:** `apps/api/src/app.ts` currently permits production browser origins matching the placeholder pattern `https://.*\\.yourapp.com`. Replace it with the intended production-domain allow-list before deployment. Development mode currently permits any origin.

## 6. Active dependency-injection registrations

The current `apps/api/src/container/index.ts` registers:

- Shared and Foundation
- Auth, School, User, Plans, Subscriptions, Branches, Staff, Roles
- Ledger, Students, Guardians, Classes, Sessions, Enrolment, Attendance, Grades Setup, Report Cards
- Fees, Payments, Webhooks, Expenses, Payroll, Finance Reports, Finance Settings
- Bank Reconciliation, Gateway Settlements, Payroll Transfers
- Audit, Notifications, School Settings, Message Templates, Automation, Platform Settings, Feedback

All listed registrations are active in the current module array. The October documentation that described Enrolment, Attendance, Grades, Report Cards, Notifications, Settings, Automation and Feedback as commented-out modules is obsolete.

Registration does not prove route mounting, migration readiness, runtime correctness or test coverage. Check each independently.

## 7. Current API mount index

All prefixes are mounted under `/api/v1` by `apps/api/src/routes/index.ts`.

| Prefix | Area |
|---|---|
| `/auth`, `/users` | Authentication, identity, profile, sessions and user administration |
| `/schools`, `/platform/schools` | School operations and platform school operations |
| `/plans`, `/platform/plans` | Public plan catalogue and platform plan management |
| `/subscriptions`, `/platform/subscriptions` | School subscriptions and platform billing |
| `/audit`, `/platform/audit` | School and platform audit |
| `/staff`, `/students`, `/guardians`, `/branches` | People and branch management |
| `/roles`, `/permissions` | School roles and permissions |
| `/classes`, `/enrolments`, `/attendance`, `/grades`, `/sessions`, `/report-cards` | Academic operations |
| `/fees`, `/fees/invoices`, `/fees/adjustments`, `/payments` | Fees, invoices, adjustments and payments |
| `/finance` | Ledger and finance reports (two routers share this prefix) |
| `/finance/settings`, `/finance/reconciliation`, `/finance/settlements` | Finance settings, bank reconciliation and gateway settlements |
| `/expenses`, `/vendors`, `/budgets`, `/recurring-expenses` | Expense management |
| `/payroll`, `/payroll/transfers`, `/my/payslips` | Payroll, salary transfers and personal payslips |
| `/notifications`, `/message-templates`, `/automations`, `/school-settings` | School settings and communications automation |
| `/platform/settings`, `/platform/webhooks`, `/feedback` | Platform settings, webhook operations and feedback |

This is an index, not a complete API contract. Exact methods, DTOs, permissions, scopes and response shapes belong to each route/controller/DTO implementation.

## 8. Background processing

- API entry: `apps/api/src/server.ts`.
- Worker entry: `apps/api/src/worker.ts`.
- Worker registration: `apps/api/src/infrastructure/jobs/index.ts`.
- The current worker set includes provisioning, notifications, automation, billing, school lifecycle, term lifecycle, payment reconciliation, ledger integrity, recurring expenses and class PDF work.
- The worker starts scheduler initialization separately. Inspect the current scheduler implementation before changing cadence or deployment expectations.

Workers performing tenant-owned work must establish tenant context before accessing tenant data.

## 9. Finance invariants

- Persist monetary values as integer kobo (`BigInt`).
- Route financial postings through the shared posting service; do not write journal entries independently.
- Preserve balanced double-entry journals, idempotency, reversal behavior, approval separation and audit history.
- Bank reconciliation, gateway settlements and salary transfers are separate modules with their own permissions/features and lifecycle rules. Salary transfers have an additional platform/school settings gate.

See [Finance Handoff](FINANCE_HANDOFF.md) for the current finance workstream snapshot.

## 10. Development commands

Run from the repository root:

```bash
npm install
npm run db:up
npm run dev:api
npm run dev:worker
npm run dev:web
npm run build:api
npm run build:web
npm run typecheck:all
npm test
npm run check
```

Backend-owned scripts use the API workspace:

```bash
npm run prisma:generate -w apps/api
npm run sync:registries -w apps/api
npm run sync:school-roles -w apps/api
npm run migrate:apply-to-existing-schools -w apps/api
```

See [Testing Guide](TESTING_GUIDE.md) for database-test setup and safeguards. A passing test command does not prove database-backed tests ran; inspect the output.

## 11. Documentation policy

- [Documentation Index](README.md) distinguishes current guides, workstream handoffs and historical module notes.
- [Testing Guide](TESTING_GUIDE.md) is authoritative for the workspace test setup.
- [Auth Audit](AUTH_AUDIT.md) is a security-review snapshot; finding statuses must be updated when fixes are verified.
- [Finance Handoff](FINANCE_HANDOFF.md) and [Settings/Automation Handoff](SETTINGS_AUTOMATION_HANDOFF.md) preserve workstream context.
- Module notes are implementation snapshots. Do not execute old “copy/delete these files” instructions without rechecking the current branch.
