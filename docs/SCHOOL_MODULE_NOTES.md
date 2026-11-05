# School module pass: apply notes

> **Documentation status:** Historical apply handoff. Do not execute its copy/delete/migration steps as written. Verify the current school, auth, provisioning code, migrations and API workspace scripts first. Current backend source lives under `apps/api/`.

## 1. Current implementation status

The old schema/migration, file deletion/copy, route-mount and worker-wiring checklist has been removed from this working guide. Those were one-time refactor instructions and must not be repeated against the current branch.

The current implementation is under `apps/api/src/modules/school/`. The School module is registered through `registerSchool` in `apps/api/src/container/index.ts`; school routes are mounted from `apps/api/src/routes/index.ts`; lifecycle scheduling is initialized through `apps/api/src/infrastructure/jobs/schedulers/index.ts` and the worker's `initSchedulers()` call.

This status is based on source inspection on 2026-11-05. It is not a claim that migrations were run in this pass or that the lifecycle has been exercised in a live environment.

## 2. The new school flow
register (school reserved, status "pending") -> confirm email -> school becomes "active" and is built -> admin signs in right away, school is "unverified" with locked features -> uploads documents -> verified (payments, SMS, result publishing unlock).
- `verify-email` now returns `data.workspace = { schoolId, subdomain, url, state: "setting_up" }` when a school was activated. Poll `GET /school/public/:subdomain` until `state` is `active`, then send the person to `url`.
- During the few seconds of building, the school host answers `503 SCHOOL_SETTING_UP`.
- Locked until verified (guard `requireVerifiedSchool`, error `403 SCHOOL_NOT_VERIFIED`): payment setup now; SMS, online payments and result publishing when those modules apply the same guard.
- The old trio approve / verify / activate is one action: **verify**. Rejecting no longer deactivates the school and no longer reuses the suspension field.

## 3. Protection against abandoned or "just testing" schools
Daily job (03:00 Lagos), windows editable in PlatformSettings:
1. Registration never confirmed within 72 h: released (subdomain and email freed, unconfirmed login removed).
2. Active but never finished building (10+ minutes): build queued again.
3. Not verified within 30 days of activation: reminders at 7 and 1 days left, then suspended with reason `verification_expired` (locked, nothing deleted). Platform staff can reactivate (restarts the trial).
4. Still suspended 60 days later AND holding no data: released (schema dropped, subdomain freed). A school with any data (students, extra staff, payments) is never deleted automatically; it is left for a person (`heldForReview`).
Also: at most 5 school registrations per network (IP) per day.

## 4. Routes (current mounted paths; API contract detail)
All paths below are prefixed with `/api/v1`. The school realm is tenant-host scoped; the platform realm is for platform sessions.

| Method | Path | Request body / input | Permission / notes |
|---|---|---|---|
| GET | `/schools` | — | `school.view`; current school resolved from host, never from body |
| PUT | `/schools` | School profile fields from `UpdateSchoolDto` | `school.update`; strict, at least one field |
| POST | `/schools/logo` | multipart field `logo`, max 2 MB | `school.update`; image validation |
| GET | `/schools/documents` | — | `school.documents.manage` |
| POST | `/schools/documents` | multipart field `document` plus `type`; proprietor ID types additionally require `idDocumentType`, `idNumber`, `proprietorFullName`; max 5 MB | `school.documents.manage`; returns created response |
| POST | `/schools/payment-setup` | `{ bankCode, accountNumber, password? }` | `school.payments.manage` and verified school required; password required when replacing an existing account |
| GET | `/schools/dashboard` | — | `school.dashboard.view`; sections are permission-filtered |
| GET | `/schools/setup-checklist` | — | `school.update` |
| GET | `/schools/public/:subdomain` | URL parameter | Public; no authentication |
| GET | `/platform/schools` | Query: `page?`, `limit?`, `status?`, `verificationStatus?`, `search?` | `platform.schools.view`; paginated |
| POST | `/platform/schools` | `{ name, subdomain, email, phone?, schoolCategory, schoolOwnership, admin: { firstName, lastName, email, phone? } }` | `platform.schools.create`; creates school and admin |
| GET | `/platform/schools/overview` | — | `platform.overview.view` |
| GET | `/platform/schools/provisioning` | Parsed provisioning query | `platform.schools.provisioning` |
| POST | `/platform/schools/:id/provisioning/retry` | — | `platform.schools.provisioning.retry` |
| PUT | `/platform/schools/documents/:documentId/approve` | — | `platform.schools.verify` |
| PUT | `/platform/schools/documents/:documentId/reject` | `{ reason }` (10–500 chars) | `platform.schools.verify` |
| POST | `/platform/schools/:id/impersonate` | Reason DTO parsed by controller | `platform.schools.impersonate` |
| GET | `/platform/schools/:id` | — | `platform.schools.view` |
| PUT | `/platform/schools/:id` | School profile fields from `UpdateSchoolDto` | `platform.schools.manage` |
| GET | `/platform/schools/:id/documents` | — | `platform.schools.documents` |
| PUT | `/platform/schools/:id/verify` | `{ note?, override? }` | `platform.schools.verify`; override defaults false |
| PUT | `/platform/schools/:id/reject` | `{ reason }` (10–500 chars) | `platform.schools.verify` |
| PUT | `/platform/schools/:id/suspend` | `{ reason }` (10–500 chars) | `platform.schools.suspend` |
| PUT | `/platform/schools/:id/reactivate` | — | `platform.schools.suspend` |

The route table is grounded in the current route files and DTOs. For exact response payloads, consult the named controller/use-case mapper path until the response examples in this guide are expanded; do not infer response fields from route names.
Response changes:
- School: `status` is now one of `active | setting_up | suspended | unavailable`; `verification {status, note, verifiedAt, requiredDocuments}`; `payment {setupComplete, bankCode, accountName, accountLast4}`; `website` added. The account number is never returned.
- Setup checklist: now `{ items[{key,group,label,done,locked,required}], completionPercent, verification{status,note,documents[{type,status}]} }` (a list, not fixed keys).
- Dashboard: sections `people / academics / fees / attendance` are `null` when the viewer's role does not allow them; money figures are for the current term and count only successful payments; plan limits are `null` when unlimited.
- Platform list rows have `plan` and `mrrKobo`, but no `studentCount` (that lives in each school's own database; it is on the single-school view).
- Public info: `state` instead of raw status; no verification details, no `principalName`.
- Payment setup: changing an existing account needs `password`; the response has `accountNameMatchesSchool`.
- Name, category and ownership type are locked for the school once verified (`403 FIELD_LOCKED_AFTER_VERIFICATION`); platform staff can change them.
- New codes: SCHOOL_NOT_VERIFIED, SCHOOL_SETTING_UP, FIELD_LOCKED_AFTER_VERIFICATION, INVALID_FILE, INVALID_IMAGE, DOCUMENT_LIMIT_REACHED, DOCUMENTS_INCOMPLETE, PASSWORD_CONFIRMATION_REQUIRED, REGISTRATION_RATE_LIMITED.

## 5. Things to know
- Dashboard "today" assumes `Attendance.date` is the calendar day at 00:00 UTC. Plan limits are read from entitlement rows directly (same rule as the entitlements service); switch to the service when convenient.
- Audit entries use the existing `AuditService.log` (the audit pass will upgrade it with module, actor type, request id).
- Platform notification texts are still written in code (notifications pass will move them to templates).
- Each school's database client stays in memory once created. Fine for hundreds of schools; for thousands, add an eviction cap to `prisma.client.ts` (later, not now).
- Not built here: renaming a subdomain, custom-domain verification, document download for the school after approval. All are small and can be added when needed.

## 6. Implementation inventory (historical design context)
The old implementation checklist and permission summary are not current execution instructions. Current permission declarations are in `apps/api/src/modules/school/school.permissions.ts`; current route middleware is visible in the two School route files. The permission registry/sync pipeline and deployed grants still require separate verification. Current schema definitions and migrations must be checked in the Prisma schema/migration directories before any database operation.


---

## 7. Source comparison — 2026-11-05

**Status: historical apply handoff + source-reviewed implementation notes.** The section above is retained for its design and implementation context. Its copy/delete/migration sequence is not a current deployment procedure. Current source snapshot: branch `refactor/modules`; key files include `apps/api/src/modules/school/routes/*`, `school.container.ts`, `school.permissions.ts`, `workspace-activation.service.ts`, `run-school-lifecycle.usecase.ts`, `tenant-resolver.middleware.ts`, and `apps/api/src/infrastructure/jobs/schedulers/index.ts`.

### Confirmed in current source

- Registration is in Auth: it reserves a school as `pending`, creates its free-plan subscription, creates the public user and `UserSchool` link, and issues email verification. On verification, `WorkspaceActivationService` activates the school and queues schema provisioning.
- Tenant resolution checks host/subdomain/custom domain, rejects inactive schools, and returns `503 SCHOOL_SETTING_UP` while `schemaProvisionedAt` is absent. School routes require a resolved tenant context.
- The lifecycle use case implements the 72-hour unconfirmed-registration release, stuck-provisioning retry after the policy threshold, unverified trial reminders/suspension, and retention release only when tenant data checks say the school is empty (or keep it for review if the check errors).
- The scheduler is wired through `apps/api/src/infrastructure/jobs/schedulers/index.ts` and invoked by `worker.ts` through `initSchedulers()`. The old instruction to import a worker directly in `worker.ts` is obsolete.
- School-realm and platform-realm routes are separate. Platform routes include provisioning overview/list/retry and school impersonation in addition to CRUD, verification, suspension and document review.
- Verification checks required approved documents unless `override` is supplied, records the override in audit metadata, and invalidates the verification cache.
- Payment setup is guarded by `requireVerifiedSchool` in the current route.
- Current DI registration is active in `apps/api/src/container/index.ts`. `registerSchool` is currently listed after Auth but before Plans, Subscriptions, Audit and Notifications. Awilix registrations are lazy; do not treat the historical ordering sentence as an observed runtime failure without a failing resolution/test.

### Current mounted API paths

The route files are mounted by `apps/api/src/routes/index.ts` under `/api/v1`:

- School realm: `/api/v1/schools` — `GET/PUT /`, `POST /logo`, `GET/POST /documents`, `POST /payment-setup`, `GET /dashboard`, `GET /setup-checklist`, and public `GET /public/:subdomain`.
- Platform realm: `/api/v1/platform/schools` — list/create, `/overview`, `/provisioning`, `/:id/provisioning/retry`, document approve/reject, `/:id/impersonate`, get/update, school document list, verify/reject/suspend/reactivate.

This corrects the earlier shorthand `/school` and `/platform/schools`: those were route-relative descriptions, not the complete mounted API paths.

### Permission contract observed

`school.permissions.ts` currently defines school permissions for profile view/update, document management, payment setup and dashboard view. Platform permissions additionally include school view/create/manage/verify/suspend, overview, impersonation, provisioning view/retry and document access. The older permission list in section 6 is incomplete.

### Test coverage observed (not executed in this documentation pass)

The school test directory currently contains `school-admin-directory.test.ts` with three focused cases for membership-based admin lookup, schools not yet provisioned, and broadcast resilience when one tenant cannot be read. No broader School route, lifecycle, registration/activation, verification, or provisioning test file was present in the inspected `apps/api/tests/school` directory. This is a coverage observation, not proof that the behaviors are broken.

### Follow-up items

1. Add focused tests for school lifecycle boundaries and idempotency, provisioning retry behavior, verification override/cache invalidation, and school/platform route authorization.
2. Reconcile the permission declarations with the actual permission sync/registry pipeline and verify that all listed School permissions are available in the target database. The module-local constants alone do not prove successful sync.
3. Compare the School DTO/mappers/repository and public/tenant Prisma migrations before treating every historical response-field and schema statement above as a fully verified current contract.
4. The source comments describe school verification as unlocking payments, SMS and result publishing; ensure each affected feature route consistently applies the verification guard. This pass directly confirmed the guard on `POST /api/v1/schools/payment-setup`, not every downstream payment/SMS/result endpoint.
5. No build, tests, migration, queue execution or live API request was run as part of this documentation comparison.
