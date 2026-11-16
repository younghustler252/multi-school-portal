# Web ↔ backend contract audit

Date: 2026-11-15. Branch: `refactor/web` after #24. Method: `tools/audit-web-endpoints.py` (run from the repo root with `python3 tools/audit-web-endpoints.py`) reads every `router.<method>("path")` the API mounts in `apps/api/src/routes/index.ts` and every `API.<method>(...)` / `apiCall({method, url})` in `apps/web/src`, and lists the web calls whose method + path has no backend route. Types and response shapes were read by hand for the features marked "read".

## What this does and does not prove

- A matching method + path means the endpoint exists. It does not prove the request body or the response shape matches. Only `packages/contracts` has a test (`apps/api/tests/contracts/parity.test.ts`) that fails when a DTO and its contract disagree, and it covers about ten areas (auth, automation, message templates, provisioning, school settings, platform, report cards, /me permissions, errors).
- The script finds calls written as `API.x("...")` or `apiCall({ method, url })`. A call built another way (a helper, a computed URL) is not seen. Treat the list as a floor, not a complete list.
- No endpoint was called against a running backend. That is M7.

## Result by web feature (calls whose route exists / calls found)

| Feature | Match | State |
|---|---|---|
| auth | 11/11 | aligned |
| classes | 16/16 | aligned (path level) |
| plans | 9/9 | aligned, read (M3, M6c-2) |
| subscriptions | 20/20 | aligned, read (M6c-1, M6c-3) |
| staff | 10/10 | aligned, read (M6a) |
| user | 6/6 | aligned (path level) |
| feedback | 1/1 | list ok; see super-admin feedback |
| notifications | 4/5 | one path wrong |
| enrolment | 4/6 | two paths wrong (singular `/enrolment`) |
| guardians | 8/11 | three portal calls wrong |
| students | 7/10 | three calls wrong |
| school | 14/23 | `/schools/me/*` no longer exists |
| fees | 7/18 | eleven calls on removed routes |
| report-cards | 3/10 | seven calls on removed routes |
| attendance | 2/6 | four calls on removed routes |
| payments | 1/6 | five calls on removed routes |
| grades | 1/8 | seven calls on removed routes (backend is now sheet-based) |
| super-admin | 5/25 | most calls on removed `/super-admin/*` and old `/schools/*` admin routes |

## The mismatches, with the backend route that looks like the replacement

These are my reading of the route lists, not confirmed against use cases. Check each before changing.

- **enrolment:** `/enrolment/promote`, `/enrolment/promotion-preview` -> `/enrolments/promote`, `/enrolments/promotion-preview` (plural; a one-word fix).
- **notifications:** `PATCH /notifications/:id/read` -> `PATCH /notifications/me/:id/read`.
- **school (tenant):** `/schools/me`, `/me/dashboard`, `/me/documents`, `/me/setup-checklist`, `/me/logo`, `/me/payment-setup` -> same paths without `/me` (`GET|PUT /schools`, `/schools/dashboard`, ...). `POST /school/settings/letterhead` has no route: backend offers `/school-settings/signature` and `/school-settings/stamp` (the letterhead gap I reported earlier).
- **students:** `DELETE /students/:id` -> `POST /students/:id/deactivate`; `/students/batch` and `/students/bulk-create` -> `/students/import/preview` + `/students/import`.
- **attendance:** `POST /attendance`, `/attendance/bulk` -> `POST /attendance/classes/:id` (take a register) with `GET /attendance/classes/:id/register` and `/summary`; `PUT /attendance/:id` to correct one; `/attendance/me` and `/attendance/summary/:id` have no direct route.
- **grades:** `/grades/config` and `/grades` writes -> the sheet workflow: `/grades/sheets`, `PUT /grades/sheets/:id/scores`, then submit / approve / lock / publish / reopen; scales and schemes under `/grades/scales` and `/grades/schemes`. This is a redesign of the teacher grading screens, not a rename.
- **fees:** `/fees/invoices/my-children` -> `/fees/my/children` and `/fees/my/invoices`; `POST /fees/invoices/bulk|class|copy-from-class` -> `/fees/invoices/generate` + `/issue`; `/fees/invoices/:id/record-payment` -> `POST /payments`; `PATCH .../waive` -> `/fees/adjustments`; invoice-items and defaulters have no direct route.
- **payments:** `/payments/initialize` -> `/payments/online/initialize`; `/payments/verify/:ref` -> `/payments/online/verify/:ref`; `/payments/my-payments` -> `/payments/my`; `/payments/banks` and `/verify-bank-account` have no route in the payments module.
- **report-cards:** `POST /report-cards` and `/bulk` -> `POST /report-cards/generate`; `PUT /report-cards/:id` -> `PUT /report-cards/:id/remarks`; `/:id/send` -> `/publish`; bulk status -> `/class-pdf/status/:id`; `/me`, `/my-children` have no route.
- **guardians (portal):** attendance, fees and grades "my-children" calls -> `/fees/my/children` exists; attendance and grades equivalents are not in the route list.
- **super-admin:** old admin calls on `/schools/:id/{approve,reject,suspend,verify,documents}` and `POST /schools` -> the same under `/platform/schools/...` (the backend list has `reactivate` too). `/super-admin/schools/:id/impersonate` -> `/platform/schools/:id/impersonate`. `/super-admin/schools/:id/reset-admin-password` -> `POST /users/schools/:id/admin/reset-password`. `/super-admin/stats` -> `/platform/schools/overview` and `/platform/subscriptions/stats` (shape differs). `/super-admin/users` and `DELETE /super-admin/users/:id`: no platform users route exists. Activity feed: closest is `/platform/audit`. Feedback admin: `PUT /feedback/:id` -> `PATCH /feedback/:id/respond` and `/status`; the list call's URL is `"feedback"` with no leading slash (works, but fix). Platform logo upload: no route.

## Backend modules with no web screen yet

branches, expenses, vendors, budgets, recurring-expenses, payroll (and transfers), my/payslips, finance (ledger, settings, reconciliation, settlements, reports), automations, message-templates, audit (school), platform webhooks. These are built and waiting for the UI. `branches` matters first because staff assignment needs a branches list.

## Status after the path corrections (2026-11-16)

Fixed (path confirmed against `refactor/api` routes and docs):
- enrolment: `/enrolments/promotion-preview`, `/enrolments/promote`. The promote body no longer sends `rows` (the strict DTO rejects it; the server works out who moves where, per `docs/backend/modules/enrolment.md`).
- school (tenant): `/schools`, `/schools/logo`, `/schools/documents`, `/schools/payment-setup`, `/schools/setup-checklist`, `/schools/dashboard`.
- platform school actions: list, detail, create, verify, reject, suspend, reactivate, documents, document approve/reject now use `/platform/schools/...`. Reject, suspend and document-reject bodies are `{ reason }` only (strict DTOs; the old `schoolId`/`documentId` extras would be rejected). The old "activate" (`/approve`) call became `/reactivate`; it is only used to reactivate a suspended school.
- The web school list used `GET /schools`, which matched the tenant route by accident; it now calls `/platform/schools`.

Still blocked or needing a contract review (not changed):
- `POST /platform/schools` requires an `admin` object (firstName, lastName, email); the create-school form has no admin fields yet.
- Impersonation is a one-time ticket flow in the backend (`POST /platform/schools/:id/impersonate`); the web expects `{ accessToken, school, admin }`. Left on its old path until the flow is reviewed.
- Reset admin password (`POST /users/schools/:id/admin/reset-password`), school activity feed (`/super-admin/.../activity`), `/super-admin/stats`, `/super-admin/users`, platform logo, letterhead upload: no confirmed equivalent in the requested scope; unchanged.
- Response shapes for the moved school and platform-school calls (`AdminSchoolResponseData`, `SchoolResponseData`, the promotion preview rows) are not verified against the backend mappers.
- Notifications read path and the feedback calls: confirmed routes exist but outside the requested scope; unchanged.
- Grades, attendance, report-cards: workflow changes. Payments and fees: separate contract reviews first. Teacher reassignment/handover and CSV export: outside M6b.

## Open backend decisions

1. ~~Assignable roles for invites~~ Resolved: `GET /staff/assignable-roles` (`staff.manage`; returns only roles the caller may grant). Do not use `GET /roles` for the picker.
2. ~~Branches list permission~~ Resolved: `GET /staff/assignable-branches` (`staff.manage`; active branches in the caller's scope). Show the picker only when `branches.schoolHasSeveral` in `/users/me/permissions`.
3. **Attendance and grades for guardians/students:** `my-children` / `me` equivalents are missing; are they planned or should those screens use the generic endpoints?
4. **`/super-admin/users`:** does a platform-staff management API exist or is it planned? (Web has a Users page.)
5. **Payment helpers:** `/payments/banks` and `/verify-bank-account` (used for school payout setup).
6. **Entitlements for non-billing roles** (expose on `/me`), REM-062 (limit 0 shown as granted publicly), lapsed non-public plan restore.

## Mobile readiness

- Backend is a single REST API with permissions in `/me`; a mobile app can reuse it.
- Auth today is cookie-based through the web's same-origin proxy. Mobile needs a bearer-token path (login returns tokens in the body, refresh endpoint accepting a token). Not built.
- Shareable code currently inside `apps/web` that a mobile app would want in `packages/`: permission checks (`lib/use-access.ts`, `lib/route-access.ts`), money formatting and plan/billing helpers (`features/plans/lib`, `features/subscriptions/lib`), API error handling (`lib/api/api-error.ts`), and the response types in each `features/*/types`. Only a subset of types is in `packages/contracts` today.
- Suggested order: align web features to the backend (above), then move types + pure helpers into `packages/contracts` (or a sibling `packages/core`) with parity tests, then add bearer auth, then start `apps/mobile`.

## Suggested next steps

1. Quick wins in one PR (path fixes only): enrolment plural, notifications read, school `/me` removal, feedback URL and respond/status, `/platform/schools/*` for the super-admin school actions.
2. Per feature, read use cases and DTOs, then rewrite: students, attendance, report-cards, fees, payments, grades (largest), guardian portal, super-admin dashboard/users.
3. Extend `packages/contracts` + parity tests feature by feature as each is aligned.
