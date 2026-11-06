# Automation Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents scheduled school automations, rule configuration, message generation and per-school execution. Automation tests were inspected but not executed.

## Responsibility and boundaries

Automation owns rule-driven school messages:
- Default rule provisioning and per-school enable/disable.
- Rule parameters, channels and schedule.
- Dry-run audience/sample generation.
- Manual run and scheduled run.
- Per-rule run history.
- Cross-school scheduler orchestration.
- Source queries for fees, attendance, payments, student transfers and class-register reminders.

Notifications owns message dispatch/outbox/channel delivery. Message Templates owns the template catalog and school overrides. School Settings owns the preference UI/persistence; Automation contributes the automation.enabled preference. Entitlements and ChannelPolicy determine plan and school availability.

Automation does not send email/SMS directly. It prepares messages and calls NotificationDispatchService with idempotency keys.

## Runtime composition and route mount

Mounted at /api/v1/automations. Requires school tenant context, SCHOOL realm, STAFF persona and the modules.automation feature. Container dependencies:
- Tenant AutomationRuleRepository, AutomationRunRepository and AutomationSourceRepository.
- AutomationRunnerService.
- NotificationDispatchService and ChannelPolicyService.
- MessageTemplateService.
- SchoolPreferencesService and EntitlementsService.
- AuditService and shared tenant/public school lookup.

The global scheduler calls RunAutomationsForAllSchoolsUseCase, which enumerates active provisioned schools and enters each tenant context before running its due rules. A failure in one school is recorded and does not stop later schools.

## HTTP endpoints

All paths below are relative to /api/v1/automations.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | automation.view | List all definitions/rules, effective params, channel availability and latest run |
| GET | /:id | automation.view | One rule and recent run history |
| PATCH | /:id | automation.manage | Change enabled state, channels, schedule and params |
| POST | /:id/dry-run | automation.manage | Preview matched audience/message samples; sends nothing |
| POST | /:id/run | automation.manage | Run one enabled rule immediately |
| GET | /:id/runs | automation.view | Paginated recent run history |

automation.view is ALL-scope STAFF-only. automation.manage is ALL-scope STAFF-only and sensitive because it can message parents/staff. The school master preference automation.enabled defaults true; when false, scheduled/manual runner execution is skipped but rule configuration is retained.

## Default automation registry

The registry currently contains eight definitions. Default rules are created lazily when the list endpoint or scheduler first runs:
- Fee due soon: enabled by default; two days ahead; IN_APP + EMAIL; daily 08:00.
- Fee overdue: disabled by default; first notice after one day and repeats according to configured interval/maximum; daily schedule.
- Invoice issued: disabled; catch-up window; hourly.
- Attendance absent today: disabled; IN_APP + SMS; daily 11:00.
- Payment received: disabled; IN_APP + EMAIL; every 15 minutes.
- Student branch transferred: disabled; guardian notification.
- Attendance low rate: disabled; current-term rate threshold/minimum days; weekly.
- Attendance register missing: disabled; class teacher notification; weekday schedule.

Default rules preserve the previous fee-reminder behavior for schools that change nothing. Other definitions are opt-in. Definition parameters are validated against each rule's own registry; invalid stored values fall back to defaults rather than stopping the rule.

## Rule configuration

A rule stores definitionKey, name, enabled, JSON params, channels, schedule, lastRunAt, nextRunAt and actor IDs.

Channels are IN_APP, EMAIL and SMS. ChannelPolicy blocks a channel if:
- The school has disabled it in notification preferences.
- The plan does not include the corresponding notifications.email/notifications.sms feature.
- Recipient has no usable address/phone.

The API returns blocked channel reasons so the UI can explain why a channel cannot be used. A rule may still run using the remaining allowed channels. If no usable channel remains, the run is SKIPPED.

Parameters are strongly defined per automation (e.g. due days, overdue repeat/max notices, include late, low-attendance threshold/minimum days, catch-up days). Schedule is strict JSON:
- daily: local wall-clock time HH:mm.
- weekly: weekday 0–6 and time.
- interval: 15–720 minutes in steps of five.
Unknown fields, invalid times and unsupported schedule types are rejected.

The schedule helper uses a fixed UTC+1 offset (Africa/Lagos) for daily/weekly rules. Interval rules are elapsed-minute schedules.

## Execution and idempotency

AutomationRunnerService:
1. Checks automation.enabled; if false, returns SKIPPED school_setting_off.
2. Checks rule enabled for manual runs.
3. Resolves the rule's current definition/params and schedule.
4. Queries source rows for the occurrence window.
5. Selects target occurrences and recipients.
6. Applies ChannelPolicy and MessageTemplateService.
7. Builds one dispatch message per recipient/channel.
8. Calls NotificationDispatchService with a deterministic idempotency key per occurrence/recipient/channel.
9. Writes AutomationRunLog and updates rule lastRunAt.
10. Returns matched/notified/created/duplicates/blocked/status counts.

Idempotency prevents the same occurrence being sent twice to the same recipient/channel when a rule is manually run again or a scheduled retry repeats. Examples:
- Due-soon: invoice ID + due date.
- Overdue: invoice ID + notice period index.
- Attendance absent: student ID + school day.
- Low attendance: student ID + term ID.
- Register missing: class ID + school day.
- Payment received: payment ID.
- Transfer: transfer ID.
- Invoice issued: invoice ID.

Dry run uses the same source selection, parameter resolution, channel policy and template rendering but does not dispatch or create run logs. It returns matched count and bounded message samples.

## Scheduler claim and cross-school processing

RunDueAutomationsUseCase:
- Requeues stale notification outbox messages first.
- Ensures default rules exist.
- Loads enabled rules with nextRunAt null or due.
- Atomically claims each rule by conditionally replacing its expected nextRunAt with the next scheduled occurrence.
- Executes the claimed rule.
- Counts ran/skipped/failed and returns due/requeued summary.

The claim moves nextRunAt forward before the runner executes. A lost claim does not run; a process crash or FAILED runner after a successful claim also leaves the nextRunAt advanced. The current behavior intentionally runs a missed schedule once rather than replaying every missed day, but it has no retry/lease for a failed claimed occurrence. See remediation.

RunAutomationsForAllSchoolsUseCase processes active, provisioned schools one by one in tenant context. Per-school failures are captured/audited and processing continues.

## Source data and limits

The repository reads:
- Unpaid/partial fee invoices due in a date window (up to 20,000).
- Newly issued unpaid/partial invoices (up to 20,000).
- Confirmed, unreversed online/manual fee payments with guardian (up to 5,000).
- Attendance rows for the target day (up to 20,000).
- Student branch transfers (up to 5,000).
- Current-term attendance grouped by student/status for low-attendance notices.
- Active classes with a teacher and current-term active enrolment, excluding classes with any register row for the day.

These fixed take limits are not paginated. If a school exceeds a cap, remaining rows are not processed in that occurrence.

Low attendance uses the attendance module's formula: (present + late) / (present + late + absent); excused days are excluded. The register-missing rule sends to the assigned class teacher and only checks whether any attendance row exists for that class/day.

## Persistence

Tenant models:
- AutomationRule: JSON params/channels/schedule, enabled, nextRunAt/lastRunAt and actor IDs.
- AutomationRunLog: rule, trigger, status, matched/notified counts, skipped reason/error and triggeredAt.

AutomationRule has indexes on definitionKey and enabled+nextRunAt, but no unique constraint on definitionKey. ensureDefaultRules performs list-then-create, so concurrent initialization can create duplicate defaults.

## Tests and verification status

Test sources inspected:
- apps/api/tests/automation/automation.test.ts
- apps/api/tests/automation/domain.test.ts

Coverage includes default rule provisioning, fee reminder/overdue/invoice/payment notifications, attendance absence/low attendance/register reminder, student transfer, dry-run, idempotency, school master switch, plan/channel blocking, update validation, schedule math, failed runner logging, scheduler claim behavior and multi-school failure isolation.

Tests use in-memory repositories/dispatch and static helper logic. No real tenant database concurrency test, scheduler/worker integration test or Express route HTTP test was found for the automation module.

Not executed: tests, typecheck, build, migrations, real notification dispatch, scheduler worker or live HTTP requests.

## Open implementation and verification items

1. **Default rule creation is not database-idempotent.** AutomationRule.definitionKey has a non-unique index only. ensureDefaultRules uses list-then-create; concurrent first list/scheduler requests can create duplicate rules for the same definition. Add a unique definitionKey constraint (with duplicate cleanup) and use upsert/create-on-conflict.
2. **A claimed scheduled occurrence can be lost on process crash or runner failure.** The scheduler advances nextRunAt before execution. If the process crashes after claim or runner returns FAILED, there is no lease/attempt state to retry that occurrence. Add durable run claim/lease and retry state, or explicitly accept skipped failed occurrences and expose alerting/retry controls.
3. **Schedules are fixed to Africa/Lagos.** Daily/weekly schedules use UTC+1 constant rather than a per-school IANA timezone. Decide timezone before international school onboarding; inject one shared school clock into scheduling and source date windows.
4. **Source queries have fixed non-paginated caps.** 5,000/20,000 row take limits silently omit older/remaining rows when a school grows beyond the cap. Add keyset pagination or explicit overflow status/count so an automation never reports success while silently skipping source rows.
5. **Plan rule-limit checks can race.** UpdateAutomationUseCase checks the current enabled-rule limit before update, but concurrent enable requests can both pass and exceed the plan limit. Serialize enabled-rule count changes or enforce usage reservation atomically.
6. **No real-DB/HTTP scheduler tests were found.** Add tests for concurrent default initialization, claim/retry after crash, tenant scheduler context, plan limit concurrency, source pagination and route permissions.
7. **Run automation tests, typecheck/build and migration checks** against disposable tenant schemas before production rollout.

## Source paths reviewed

- apps/api/src/modules/automation/routes/automation.routes.ts
- apps/api/src/modules/automation/controllers/automation.controller.ts
- apps/api/src/modules/automation/dtos/automation.dto.ts
- apps/api/src/modules/automation/domain/automation-definitions.ts
- apps/api/src/modules/automation/domain/schedule.ts
- apps/api/src/modules/automation/automation.permissions.ts
- apps/api/src/modules/automation/automation.settings.ts
- apps/api/src/modules/automation/automation.container.ts
- apps/api/src/modules/automation/services/automation-runner.service.ts
- apps/api/src/modules/automation/usecases/automation.usecases.ts
- apps/api/src/modules/automation/repositories/automation.repository.impl.ts
- apps/api/src/modules/notifications/services/channel-policy.service.ts
- apps/api/src/modules/notifications/services/notification-dispatch.service.ts
- apps/api/src/modules/message-templates/services/message-template.service.ts
- apps/api/src/foundation/settings.registry.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/tenant.prisma
- apps/api/tests/automation/automation.test.ts
- apps/api/tests/automation/domain.test.ts
