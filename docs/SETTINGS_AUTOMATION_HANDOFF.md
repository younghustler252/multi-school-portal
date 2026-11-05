# Settings and Automation: handoff (current state)

Updated 2026-11-04. The settings, message templates, notifications and automation backend is built and mounted. Read `SETTINGS_AUTOMATION_NOTES.md` for the design and decisions; this file says what is done, what is left, and the rules to follow.

## Done (backend)
| Piece | Where | Notes |
|---|---|---|
| School settings (branding, report card template, letterhead, stamp, signature) | `modules/school-settings` | Mounted at `/school-settings`. Permissions `school_settings.view` / `.manage`, checked before an upload is read. Plan feature checks stay in the update use case. |
| School preferences | `/school-settings/preferences` + `foundation/settings.engine.ts`, `settings.registry.ts` | Registry holds `notifications.*` and `automation.*` keys. Finance settings stay in `modules/finance-settings`. |
| Message templates | `modules/message-templates` | Platform catalog in code (`template-catalog.ts`); schools edit wording only. |
| Notifications | `modules/notifications` | One dispatch road, channel policy (plan feature AND school preference), delivery worker, inbox. |
| Automation | `modules/automation` | Definitions in code: `fee.reminder_due_soon`, `fee.overdue_notice`, `fee.payment_received`, `attendance.absent_today`, `fee.invoice_issued`. 5-minute tick, dry-run, run-now, run log, idempotency keys. Report-card-ready is event-driven in `modules/report-cards`. |
| Platform side | `/platform/schools/provisioning`, impersonation, overview | See the notes file. |

## Backend coverage check (2026-11-04)
Every Prisma model was compared with the code. Every `*.routes.ts` is mounted, every `*.container.ts` is registered, and 124 of 125 permission keys are enforced by a route or use case. Findings:
- `StudentBranchTransfer` and `students.transfer` were the only unfinished pair; the workflow (`POST /students/:id/transfer`, use case, policy, audit, tests) arrived in commit `e42e7cd`. Nothing is left unenforced.
- Public tables `BillingHistory` and `AutomationRuleDefinition` (and their enums `PaymentStatus`, `AutomationTrigger`) were never used and are dropped by public migration `20261107090000_drop_unused_billing_history_and_automation_definition`. Run `npm run prisma:generate` afterwards.
- `PlatformMemberRole` and `InstalmentLine` look unused to a text search but are used through nested Prisma queries (`include` / nested `create`). They are fine.

## Cleanup done 2026-11-04
- Dropped legacy columns: `Plan.studentLimit/staffLimit/features`, `Subscription` Paystack codes, setup-fee and last-attempt columns, `User.platformRole` (+ enum `LegacyPlatformRole`); removed the one-time `backfill-entitlements.ts`, the `legacyFlag` mapping in the feature registry and the feature gate. Public migration `20261107100000_drop_legacy_plan_subscription_and_user_fields`.
- Also dropped (public migration `20261107110000_drop_legacy_user_and_invite_role`, tenant migration `20261107110000_drop_legacy_staff_role`): `User.role`, `User.schoolId`, `Invite.role`, `Staff.role` and the enums `Role` and `StaffRole`. Nothing read them for authority. The only readers were the platform notices, which now find a school's admins through the school's own memberships (`school/services/school-admin-directory.service.ts`), so they follow role changes. `auth/services/legacy-role.ts` is deleted.
- Left on purpose: `Subscription.scheduledDowngradePlanId`, `nextBillingDate`, `failedBillingCount` (used by the billing engine).

## Architecture cleanup done 2026-11-05
- Role-name guards (`requireSuperAdmin`, `requireSchoolAdmin`, `requireStaff`, `requireRoles`, `requireSameSchool`), `Access.legacyRole` and `req.user` are deleted. The last two users of the super admin guard now use permissions: `/notifications/platform` (`platform.notifications.view` / `.send`) and the `/admin/queues` job dashboard (`platform.queues.view`). Run `npm run sync:registries`; platform roles that are not "grants all" need the new keys given by hand.
- Fixed a broken type import in `shared/types/express.d.ts` (`../../cc/access.service` does not exist; it is `../../foundation/access.service`).
- `tests/architecture/architecture.test.ts` keeps this from coming back: every relative import resolves, no role-name guards or `req.user`, platform routes use `platform.*` permissions, controllers never touch the database.
- Known and left alone: about 20 use cases still import the Prisma client directly instead of going through a repository (attendance, guardians, staff, sessions, classes, students, school dashboard). It works, but it is the main layering mismatch left; convert one module at a time.

## Still open
1. Done: `automation.rules.max` is active and granted in the default plans (see the notes file, deploy step 2).
2. Optional new automations (term start, results published, birthdays...). Add a definition plus a catalog message; nothing else changes.
3. Done: the WhatsApp stub and its inactive feature key are removed; add a real channel (enum value, provider, feature key) when a provider is chosen.
4. Done: the feedback notification goes to the platform support email (Platform settings); nothing is sent if it is empty.
5. Web UI: no settings tabs yet for preferences, message templates or automation rules (`apps/web`). Types are in `packages/contracts`.
6. Run the full test suite on a machine with dependencies installed. The sandbox cannot (npm install crashes).

## Rules to keep following
- Money is BigInt kobo; dates are YYYY-MM-DD strings; finance timezone Africa/Lagos.
- Module layout: container, permissions, controllers, usecases (deps object, optional `{now, transaction}`), repository interface + impl, mapper, dto (zod 4 `.strict()`), domain, routes with `validate(Dto)`; `sendSuccess` / `sendCreated`.
- Permission module names must be distinct per module. Sensitive permissions are not auto-granted to existing roles; grant by hand.
- New features default OFF or equal to previous behaviour; dependencies are optional so hand-built test worlds keep old defaults.
- Every schema change needs a tenant migration under `prisma/tenant-migrations/`.
- Background jobs wrap work in `TenantContext.run({ tenantSchema, schoolId }, ...)` (see `automation.worker.ts`).
- Notifications and automation belong to this workstream; attendance, graduation and billing belong to others. Read their data, never write it.
- Branch `refactor/modules`; `git pull --rebase origin refactor/modules` before pushing.
