# School settings, message templates, notifications, automation, provisioning visibility

Built on `refactor/modules`. Notifications and automation are owned by the same developer as school settings; attendance, graduation and billing are not touched.

## What exists now
| Area | Where | Routes (all school realm unless stated) |
|---|---|---|
| School profile settings (branding, report card, stamp, signature) | `modules/school-settings` | `GET/PUT /school-settings`, `POST /stamp`, `POST /signature`, `GET/PUT /school-settings/preferences` |
| Settings engine (one place that validates and describes preferences) | `foundation/settings.engine.ts`, `settings.registry.ts` | none |
| Message templates (fee reminder, overdue notice) | `modules/message-templates` | `GET /message-templates`, `GET /:key`, `PUT /:key/:channel`, `DELETE /:key/:channel`, `POST /:key/:channel/preview` |
| Notifications (one dispatch road, real delivery worker, inbox) | `modules/notifications` | `/notifications/school`, `/me`, `/me/read-all`, `/me/:id/read`, `/platform-inbox`, `/platform` |
| Automation (rules, schedule, run log) | `modules/automation` | `GET /automations`, `GET/PATCH /automations/:id`, `POST /:id/dry-run`, `POST /:id/run`, `GET /:id/runs` |
| Provisioning visibility (platform realm) | `modules/school/usecases/platform/school-provisioning.usecases.ts` | `GET /platform/schools/provisioning?state=all|provisioned|pending|failed`, `POST /platform/schools/:id/provisioning/retry` |

## Decisions
- **Templates**: the platform defines the messages and their placeholders in code (`template-catalog.ts`); each school may edit only the words, using whitelisted `{{placeholders}}`. Delete the school's version to return to the default. Email and SMS text need the plan features `notifications.email` / `notifications.sms`.
- **Escaping**: messages are stored as plain text. HTML escaping happens only where the email is built. Never escape earlier (parents would see `&amp;`).
- **Channels**: in-app always; email and SMS need both the plan feature and the school preference (`notifications.email_enabled`, `notifications.sms_enabled`, SMS default off). `ChannelPolicyService` decides. A manual announcement is refused if a requested channel is blocked; automation uses the allowed channels and records what was blocked.
- **Automation**: a school never writes logic. Code defines automations (`automation-definitions.ts`); a school switches them on, picks channels, time (daily or weekly, Lagos time) and a few bounded numbers. One rule per automation per school, created on first sight. A tick runs every 5 minutes for all schools, claims due rules atomically, and runs a missed rule once. Every message has an idempotency key (rule, occasion, guardian, channel), so reruns, retries and "run now" never double send. To add an automation, add a definition (and a catalog message); nothing else changes.
- **Provisioning**: "ready" is `School.schemaProvisionedAt`; the queue only explains a school that is not ready (queued / running / failed with reason / stuck = no job). Retry removes the old failure and queues again; the worker never rebuilds an existing schema.

## Behaviour changes to know about (fee reminders)
The old 08:00 defaulter worker was removed; `fee.reminder_due_soon` replaces it with the same defaults (2 days before, in-app + email, 08:00 Lagos). Differences: each invoice is reminded **once** (the old one repeated daily inside the window); email now respects the plan and the school's email switch; the extra notice to the school admin was dropped; reminders still follow the outstanding balance, not student status. A new, off-by-default `fee.overdue_notice` exists.

## Payment received
`fee.payment_received` (off by default; in-app + email; checks every 15 minutes) thanks the guardian who paid once a payment is CONFIRMED and not reversed, with amount, students and receipt number. It polls confirmed payments instead of hooking each confirmation path (manual record, webhook, online), so it never touches the payments module and cannot be missed; one message per payment. Schedules now also support `{type:"interval", minutes}` (15 to 720, steps of 5).

## Attendance absence notice
`attendance.absent_today` (off by default; in-app + SMS; daily 11:00) tells guardians when today's register marks their child absent, optionally late too. It only READS the attendance table (the attendance module is another developer's) and is stored as an `attendance_alert` message. One message per student per day.

## Invoice issued
`fee.invoice_issued` (off by default; in-app + email; checks every hour) tells a student's guardians when the school issues a new invoice (catalog message `fee.invoice`, stored as a `fee_invoice` notification). It READS issued invoices (status unpaid or partial, not void, balance above zero, issue date inside a catch-up window of 0 to 14 days, default 2); drafts, late fees and opening-balance invoices are never announced. One message per invoice, ever (idempotency key is the invoice). Switching the rule on for the first time tells the invoices issued inside the catch-up window; set the window to 0 to avoid that. An invoice with no due date reads "due on the date shown on the invoice".

## Deploy steps
0. Apply the public migration `20261107090000_drop_unused_billing_history_and_automation_definition` (`npm run prisma:migrate:deploy:public`; this also applies `20261107100000_drop_legacy_plan_subscription_and_user_fields`) and run `npm run prisma:generate` (the generated client in `src/generated` still lists the two dropped tables until you do).
1. `npm run sync:registries` (new permission, feature and setting keys) then `npm run sync:school-roles`. New keys are not auto-given to existing editable roles; `school_admin` has everything. Principal templates carry the new keys for new schools.
2. `automation.rules.max` is now active (counts switched-on rules). The default plans grant it: Free 1, Starter 3, Standard and Premium unlimited (change in the console). A plan that has no grant allows no more rules to be switched on, so give custom plans a value.
3. Start the app: `initSchedulers` registers the 5-minute `automation-tick`. (The old `defaulter-reminder` queue and its cleanup code are deleted; the app was never hosted, so no old Redis job exists to remove.)

## Left alone on purpose
Billing (hourly), school lifecycle (03:00), term lifecycle (07:00) are now started by `initWorkers` and scheduled by `initSchedulers`; the old every-minute subscription expiry job is replaced by billing and removed from Redis once. The payment reconciliation worker imported the billing engine from a path outside the repo, which would have stopped the API from starting: fixed. AUTH-01 is fixed (see below).

## AUTH-01 (fixed)
Inviting someone into a role, or changing a staff member's roles, now compares scope as well as key: the inviter must hold every permission of the role at a scope at least as wide (`canDelegateRole` in `foundation/access.service.ts`). `RoleRecord.permissions` carries the scopes and `InviteActor.scopeOf` supplies the inviter's. Grants-all roles still need a school admin. Tests: `tests/auth/role-delegation.test.ts`.

## Platform routes and impersonation (added later)
- `/platform/schools`, `/platform/plans`, `/platform/subscriptions`, `/platform/audit` are now mounted (they were not reachable before). A test fails if a `*.platform.routes.ts` file is left unmounted.
- `POST /platform/schools/:id/impersonate` `{ reason (10-500 chars, required), membershipId? }`, permission `platform.schools.impersonate` (sensitive; run `npm run sync:registries -w apps/api` and grant it only to roles that should have it). Creates a one-use 60 second ticket for the school admin (or the chosen active STAFF member, never platform staff), audits `platform.impersonation_issued` with the reason, and returns `redirectUrl` to open on the school host. The school host exchanges it at `/auth/exchange-impersonation-token`; that session is capped at 60 minutes, carries the platform member's id and cannot change passwords.
- `GET /platform/schools/overview` (permission `platform.overview.view`, run `sync:registries`): schools by status (plus not yet provisioned), users, platform members and active students across schools (one unreadable school is skipped and counted). Money and plans stay in `/platform/subscriptions/stats`.
- The old `super-admin` module is deleted. Its stats, MRR, billing and activity live under `/platform/*`. Platform-wide user deactivation was deliberately not rebuilt (suspend the school instead); add it with its own permission and audit when a real need appears.
