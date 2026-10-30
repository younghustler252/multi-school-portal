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

## Attendance absence notice
`attendance.absent_today` (off by default; in-app + SMS; daily 11:00) tells guardians when today's register marks their child absent, optionally late too. It only READS the attendance table (the attendance module is another developer's) and is stored as an `attendance_alert` message. One message per student per day.

## Deploy steps
1. `npm run sync:registries` (new permission, feature and setting keys) then `npm run sync:school-roles`. New keys are not auto-given to existing editable roles; `school_admin` has everything. Principal templates carry the new keys for new schools.
2. Activate `automation.rules.max` in the platform console and grant it per plan (it is inactive in code, so unlimited until then).
3. Start the app: `initSchedulers` registers the 5-minute `automation-tick` and removes the old `defaulter-reminder-scheduler` once.

## Left alone on purpose
Billing (hourly), school lifecycle (03:00), term lifecycle (07:00) are now started by `initWorkers` and scheduled by `initSchedulers`; the old every-minute subscription expiry job is replaced by billing and removed from Redis once. The payment reconciliation worker imported the billing engine from a path outside the repo, which would have stopped the API from starting: fixed. AUTH-01 is fixed (see below).

## AUTH-01 (fixed)
Inviting someone into a role, or changing a staff member's roles, now compares scope as well as key: the inviter must hold every permission of the role at a scope at least as wide (`canDelegateRole` in `foundation/access.service.ts`). `RoleRecord.permissions` carries the scopes and `InviteActor.scopeOf` supplies the inviter's. Grants-all roles still need a school admin. Tests: `tests/auth/role-delegation.test.ts`.
