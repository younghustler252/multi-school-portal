# School module pass: apply notes

## 1. Apply, in this order
1. **Schema (public.prisma)**, then migrate:
   - `School`: add `verificationNote String?`, `activatedAt DateTime?`, `settlementAccountName String?`, `settlementAccountLast4 String?`, and `@@index([status, activatedAt])`.
   - `PlatformSettings`: add `unconfirmedRegistrationHours Int @default(72)`, `unverifiedSchoolTrialDays Int @default(30)`, `unverifiedSchoolRetentionDays Int @default(60)`.
   - Dev data only: `UPDATE "School" SET "activatedAt" = now() WHERE status = 'active' AND "activatedAt" IS NULL;` (optional). Existing `settlementAccountNumber` values were plain text and are now stored encrypted; clear them in dev.
2. **Delete the old files**: `usecases/school-admin/`, `usecases/super-admin/`, `domain/school.enum.ts`, `types/school-status.types.ts`, `services/tenant-provisioning.service.ts` (dead code; the provision worker does this job and does it correctly), the old routes file.
3. **Copy** `modules/school/*`, `shared/utils/file-sniff.ts`, the three files in `infrastructure/` (middleware, queue, worker), and the patched `tenant-resolver.middleware.ts`.
4. **Auth patches** (4 files in `modules/auth/`): `usecases/verify-email.usecase.ts`, `usecases/register.usecase.ts`, `controllers/auth.controller.ts`, `domain/auth.errors.ts`, and `auth.templates.ts` (3 new emails: re-run the template sync).
5. **Mount the routes** in `routes/index.ts`: `/school` -> `school.routes`, `/platform/schools` -> `school.platform.routes`. Remove the old `/school` mount that served super-admin routes.
6. **worker.ts**: import `schoolLifecycleWorker` and call `scheduleSchoolLifecycle()` once at start (BullMQ 5.16 or newer).
7. `registerSchool` must come after `registerAuth`, plans, subscriptions, audit and notifications in the container list.
8. **Permissions** (see `school.permissions.ts`): register these keys, and give `school_admin` (all-access) everything. Until the permission registry exists, only all-access roles can use these routes.

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

## 4. Routes (frontend contract)
School realm (school host): `GET/PUT /school`, `POST /school/logo`, `GET/POST /school/documents`, `POST /school/payment-setup`, `GET /school/dashboard`, `GET /school/setup-checklist`, public `GET /school/public/:subdomain`. (The old `/school/me/...` paths are gone.)
Platform realm (admin host): `GET/POST /platform/schools`, `GET/PUT /platform/schools/:id`, `PUT /:id/verify` `{note?, override?}`, `/:id/reject` `{reason}`, `/:id/suspend` `{reason}`, `/:id/reactivate`, `GET /:id/documents`, `PUT /platform/schools/documents/:documentId/approve|reject`.
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

## 6. Docs update (section 0.3)
Fields: School +4; PlatformSettings +3. Permissions: `school.view|update|documents.manage|payments.manage|dashboard.view`, `platform.schools.view|create|manage|verify|suspend|documents`. Templates: `auth.account_created_by_platform`, `school.payment_account_changed`. Middleware: `requireVerifiedSchool`, resolver `SCHOOL_SETTING_UP`. Module status: school Done. Defects: provisioning dead service removed.
