# CORE Platform Documentation

> Repository-grounded architecture and developer handoff for the multi-school portal API.
>
> **Branch:** `refactor/modules`  
> **Reviewed commit:** `2bcbf58b685041e7887a1fa9053bb66947be1145`  
> **Review date:** 2026-10-26  
>
> Source code on the reviewed branch is authoritative. This document records the architecture and wiring observed at that revision; verify the relevant files before changing behavior. A registered module is not automatically routed, fully implemented, tested, or production-ready.

## 1. Product and tenancy model

CORE is a multi-tenant school-management SaaS initially aimed at Nigerian primary and secondary schools. The platform separates platform operations from each school's operational data.

- **Public schema:** platform-level records such as schools, users, plans, subscriptions, and billing.
- **Tenant schemas:** school-owned operational records. Each school has its own PostgreSQL schema.
- **Tenant context:** tenant-owned database work must run in the active tenant context and use `getTenantClient()`; never trust a client-supplied school ID as the tenant boundary.
- **Identity and membership:** a user login is distinct from a persona or membership within a school.
- **Authorization:** permissions and scope answer what an actor may do and to which records. Subscription entitlements and limits answer what the school's plan permits. Do not conflate them.
- **Financial integrity:** financial workflows should use the shared ledger posting service rather than writing journal rows independently.

## 2. Technology and key files

| Concern | Implementation |
|---|---|
| Runtime / language | Node.js, TypeScript |
| HTTP API | Express 5 |
| Database | PostgreSQL, Prisma 7 |
| Database schemas | `prisma/public.prisma`, `prisma/tenant.prisma` |
| Prisma configuration | `prisma.public.config.ts`, `prisma.tenant.config.ts` |
| Dependency injection | Awilix, proxy injection |
| Shared DI registrations | `src/container/shared.container.ts` |
| Module DI registrations | `src/container/index.ts` |
| API route mounts | `src/routes/index.ts` |
| Middleware / request pipeline | `src/app.ts`, `src/infrastructure/middleware/` |
| Background jobs | `src/infrastructure/jobs/`, started by `src/worker.ts` |
| Cross-cutting access and entitlements | `src/foundation/` |
| Tests | `tests/**/*.test.ts`, Node test runner through `tsx` |

## 3. Request lifecycle

The application-level order in `src/app.ts` is:

1. Helmet security headers and CORS.
2. Global rate limiter.
3. Paystack webhook route at `POST /api/v1/payments/webhook`, using raw JSON body parsing.
4. Static report-card template previews.
5. JSON and URL-encoded body parsers and cookie parser.
6. Morgan request logging outside the test environment.
7. Optional authentication.
8. Tenant resolution from request context/host.
9. Tenant ownership validation.
10. Health endpoint and API route mounts.
11. Bull Board at `/admin/queues`, protected by authentication and super-admin authorization.
12. JSON 404 response and global error handler.

Route-specific middleware remains responsible for enforcing authentication, tenant requirements, permissions/scopes, plan entitlements, and validation. Check each route rather than assuming those checks are global.

**Deployment configuration to revisit:** `src/app.ts` currently allows production CORS origins only when they match `https://.*\\.yourapp.com`. Confirm and replace that placeholder-domain policy with the intended production origins before deploying the frontend. Development mode currently allows any origin.

The intended module layering is:

- **Routes:** compose middleware and map HTTP methods/paths.
- **Controllers:** translate HTTP requests and responses; avoid owning business rules.
- **Use cases/services:** enforce business rules and coordinate work.
- **Repositories:** encapsulate persistence.
- **Foundation/infrastructure:** shared authorization, tenant context, database access, queues, providers, and common services.

Preserve established module patterns rather than introducing a parallel architecture for an isolated feature.

## 4. Dependency injection and module wiring

`src/container/index.ts` determines which module containers are registered. `src/routes/index.ts` separately determines which routers are mounted. Check both, plus dependencies, permissions, entitlements, migrations, workers, and tests, before calling a module integrated.

### Container registrations enabled at the reviewed commit

Shared services, Foundation, Auth, School, User, Plans, Subscriptions, Branches, Staff, Ledger, Students, Guardians, Classes, Sessions, Fees, Payments, Expenses, Payroll, Finance Reports, and Audit.

The following registrations are commented out and are considered **in progress / not enabled** for this snapshot: Enrolment, Attendance, Grades, Report Cards, Notifications, Super Admin, School Settings, Platform Settings, and Feedback. Do not treat their commented wiring alone as a defect or enable them as part of unrelated work.

### API route mounts at the reviewed commit

All paths below are mounted under `/api/v1`, except the separately mounted health, webhook, static assets, and queue dashboard.

| API prefix | Router / area |
|---|---|
| `/auth` | Auth |
| `/users` | User |
| `/schools` | School |
| `/plans` | Plans |
| `/subscriptions` | Subscription billing routes |
| `/audit` | Audit |
| `/staff` | Staff |
| `/finance` | Ledger |
| `/students` | Students |
| `/guardians` | Guardians |
| `/classes` | Classes |
| `/sessions` | Sessions |
| `/finance` | Finance reports (also mounted at this prefix) |
| `/expenses` | Expenses |
| `/vendors` | Vendors |
| `/budgets` | Budgets |
| `/recurring-expenses` | Recurring expenses |
| `/payroll` | Payroll |
| `/my/payslips` | Current user's payslips |
| `/fees/invoices` | Fee invoices |
| `/fees/adjustments` | Fee adjustments |
| `/fees` | Fee reports and fee setup |
| `/payments` | Payments |

**Known wiring discrepancy:** Branches is registered in the container and its router is imported, but there is no active `router.use("/branches", branchRouter)` mount in `src/routes/index.ts` at the reviewed commit. Do not describe its API as mounted until this is resolved and verified. The subscription router is mounted at `/subscriptions`; confirm its actual route definitions before describing individual billing endpoints.

Routes for Enrolment, Attendance, Grades, Report Cards, Super Admin, Notifications, School Settings, Platform Settings, and Feedback are commented out in `src/routes/index.ts`. They are not active API mounts in this snapshot.

## 5. Tenant database and migrations

- Public Prisma schema: `prisma/public.prisma`; migration directory: `prisma/migrations/`.
- Tenant Prisma schema: `prisma/tenant.prisma`; migration directory: `prisma/tenant-migrations/`.
- Public and tenant Prisma generation/migration commands are configured separately in `package.json` and the corresponding Prisma config files.
- New-school provisioning and existing-school migration application are separate concerns. A migration file existing in the repository does not prove it has been applied to every existing school schema.
- For tenant queries, establish tenant context and use the tenant client. For platform-level data, use the public Prisma client.
- Never use development or production databases for destructive tests.

## 6. Validation and error handling

The app has a shared error handler and a standard not-found response. Route-level request validation and domain errors should be checked in the module being changed; do not infer exact error codes or response DTOs from this overview.

For frontend-facing contracts, document the current source behavior: HTTP method and path, required permissions/persona, query parameters, request body, response JSON, nullability, pagination, and error codes. Use actual DTOs, mappers, controllers, and route definitions as evidence. Do not copy a historical note without checking it against source.

## 7. Testing and local commands

The supported scripts are defined in `package.json`:

```bash
npm run build
npm test
npm run sync:registries
npm run prisma:generate
npm run prisma:generate:public
npm run prisma:generate:tenant
```

Database test setup and safeguards are documented in [Testing Guide](TESTING_GUIDE.md). `npm test` may skip database-backed tests when `TEST_DATABASE_URL` is absent; a passing command therefore does not necessarily mean database tests ran. Always inspect the test output.

After changing permissions or role templates, review whether `npm run sync:registries` is required. After schema changes, verify generated clients and the correct migration path, including the strategy for existing school schemas.

## 8. Working rules for future changes

1. Inspect current source before relying on a note or historical audit.
2. Keep changes scoped; avoid unrelated application-code changes during documentation or module work.
3. Follow the existing route → controller → use case → repository layering.
4. Enforce tenant isolation and check authorization, scope, and entitlements independently.
5. For tenant operations, preserve tenant context and transactional boundaries.
6. For financial operations, use the shared ledger posting service and preserve idempotency/reversal rules.
7. Verify container registration and route mounting separately.
8. Add or update tests for changed behavior. State clearly whether tests were run and whether database-backed tests were skipped.
9. Update durable module documentation in the same change set as the implementation.
10. Do not enable modules whose registrations/routes remain commented out without an explicit scoped audit and integration pass.

## 9. Documentation map

- [Testing Guide](TESTING_GUIDE.md): test commands, database setup, safety, and writing tests.
- Module notes that remain in `docs/` are interim reference material. Treat source code as authoritative and replace stale implementation-history notes with current module contracts as each module is reviewed.
- [Auth Audit](AUTH_AUDIT.md): source-based findings for the Auth module. It records security/correctness issues and verification gaps; findings remain open until fixed and tested.
