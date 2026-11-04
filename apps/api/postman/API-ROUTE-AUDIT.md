# CORE API route audit — Postman suite

## Scope

Reviewed the API route registry on `refactor/modules` and the corresponding module route files. The route registry is `apps/api/src/routes/index.ts`; the Express application adds health, static preview assets, the Paystack webhook and Bull Board separately in `apps/api/src/app.ts`.

The Postman collection contains **438 requests in 14 folders**:
- 175 GET
- 166 POST
- 62 PUT
- 28 DELETE
- 7 PATCH

The count includes the health check, Bull Board entry, Paystack webhook and one static report-card template asset request. It is a route inventory, not 438 verified successful business operations.

## Modules represented

| Collection folder | Route areas |
|---|---|
| Health & Infrastructure | health, Bull Board |
| Authentication | registration, OTP, login, refresh/logout, persona, invitations |
| Users & Profile | own profile, password, avatar, sessions, platform account administration |
| Schools & Plans | school profile/onboarding, plans, subscription billing |
| Branches, Staff, Roles & Permissions | branches, staff, roles, permission catalogue |
| Students, Guardians & Enrolment | student CRUD/import/transfer, guardians, enrolment and promotion |
| Classes, Subjects, Sessions & Attendance | classes, subjects, school sessions/terms/calendar, attendance |
| Grades & Report Cards | grading scales/schemes, mark sheets, report cards and PDFs |
| Fees, Payments & Finance | fee setup/invoices/adjustments, payments/refunds, ledger, finance reports, reconciliation, settlements |
| Expenses, Vendors & Budgets | expenses, vendors, budgets, recurring expenses |
| Payroll & Salary Transfers | components, profiles, runs, payslips, loans, remittances and transfers |
| Notifications, Settings & Automation | notifications, school settings, message templates, automations |
| Platform Administration & Feedback | platform schools/plans/subscriptions/audit/settings, feedback |
| Webhooks & External Callbacks | Paystack webhook |

## Important implementation observations

### Tenant resolution is hostname-based

`resolveTenant` classifies the request hostname using `BASE_DOMAIN` and `ADMIN_SUBDOMAIN`. A school route sent to the base/platform host will not acquire a school context. The collection therefore separates:
- `publicBaseUrl`
- `schoolBaseUrl`
- `platformBaseUrl`

In development only, the resolver also supports `x-school-id` and `x-tenant-schema`; it validates the pair against an existing school record. The collection does not enable this override by default.

### School and platform sessions are separate

The login controller resolves school or platform sessions based on the request host. The collection includes separate school-host and platform-host login requests and stores their tokens in separate environment variables. This is important because school tokens are not platform sessions.

### Health check dependencies

`GET /api/v1/health` checks PostgreSQL and Redis. It returns 503 if either check fails; a healthy result requires both booleans to be true.

### Student CSV import is implemented, despite a stale comment

The student DTO contains a comment saying the import is "not switched on yet". However, the current route file registers template, preview and import endpoints; the controller injects both import use cases; and `student-import.usecases.ts` implements preview and transactional import logic, including plan limits, class-seat locking, guardian linking and audit logging. Treat the DTO comment as stale documentation, not proof the feature is disabled. Functional import testing is still required.

### Public platform settings endpoint

`GET /api/v1/platform/settings/` is intentionally unauthenticated in its route file. The controller returns the platform settings mapper response, which contains public-facing configuration such as platform name, support contacts, logo/policy URLs, trial/grace-period settings, registration/maintenance flags and announcement banner. No secret key fields appear in the mapper shown during this review. Confirm that this response remains limited to public-safe fields if the settings entity evolves.

### Paystack webhook body parsing

The webhook is mounted before the general JSON parser and uses `express.raw({ type: "application/json" })`. Preserve raw-body handling for signature verification. Do not test it with arbitrary payloads against production.

## Collection behaviour and limitations

- Every mutating method is skipped unless `runMutations=true`. This includes payments, refunds, promotion, transfers, payroll, notification sends, destructive operations and the webhook.
- A successful school login captures `accessToken` and `refreshToken`; platform login captures separate platform tokens.
- Generic tests reject the Express route-not-found fallback and unhandled 5xx responses. A 404 returned by a registered route for a missing record is allowed.
- Most write requests deliberately contain an empty JSON object placeholder. This is not a valid business payload for most DTOs. Review the relevant DTO and replace the body before opting into a mutation.
- Path variables are placeholders. Populate them with IDs from the same test tenant and workflow.
- The generic suite does not assert module-specific response fields, database side effects, ledger balance, notification delivery or cross-tenant isolation. Those require dedicated workflow tests.

## Verification status

**Source inspection:** performed for the route registry, application mounting, the module route files represented in the collection, login response handling, tenant resolver, health endpoint wiring, student import use cases and platform settings response mapping.

**Collection structure:** generated as Postman Collection v2.1 JSON and environment JSON; JSON was parsed during generation/update.

**Live API execution:** not performed. The GitHub repository connector cannot reach a process running on the developer's localhost, and no test server/database credentials were supplied.

**Backend test suite/build:** not executed. `apps/api/package.json` defines `npm test` and `npm run typecheck`; run them from the API workspace with its configured test environment.

## Recommended next verification stage

1. Run API tests and typecheck locally.
2. Start the API with the test PostgreSQL and Redis services; confirm health is green.
3. Import the collection and environment into Postman or run with Newman.
4. Verify login separately on school and platform hosts.
5. Build valid DTO examples and chained workflows module by module, starting with school setup, staff/roles, students/guardians/enrolment, classes/attendance, grades/report cards, then finance.
6. Run tenant-isolation and role/permission negative tests using at least two test schools and accounts with distinct scopes.
