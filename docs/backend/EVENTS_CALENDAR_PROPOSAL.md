# School Events & Calendar: architecture proposal

Status: **proposal, before implementation.** Backend only. Branch `feat/api/events-calendar`, cut from `refactor/modules` at `5390a4c` (agreed).
Recurring events are deliberately **Phase 2** of the product (agreed); section 9 shows why nothing here blocks them.

---

## 1. What exists and will be reused

| Existing piece | Where | How it is reused |
|---|---|---|
| `CalendarEvent` table, `EventType` enum | `prisma/tenant.prisma` | Extended in place, same table and name. Existing rows keep working (all-day, published, everyone) |
| Calendar CRUD (entity, repository, use cases, DTO, mapper, 5 routes) | `modules/sessions` | Moved to the new module; the old URLs stay mounted (section 2) |
| Terms and sessions links (`termId`, `sessionId`, scope rules) | Sessions use cases | Same validation, called through the session repository |
| Holiday check for attendance | `attendance.repository.holidayCandidates` | Keeps working; gains a `PUBLISHED` filter (section 3) |
| Notification dispatch: idempotency keys, rows first then queue, `requeueStale`, `notification` queue and worker | `notifications/services/notification-dispatch.service.ts` | The only road for every message. No second engine |
| Notification types `event` and `holiday` | `SchoolNotificationType` | Already exist; no new notification enum values |
| Channel rules: plan feature **and** school preference, SMS off by default | `ChannelPolicyService`, `notifications.*` settings | Unchanged; events call it |
| Audience filters (pure): `studentAudienceWhere`, `guardianAudienceWhere`, `staffAudienceWhere`, `resolveAudience` BRANCH-scope rules | `notifications/domain/audience.ts` | Reused as they are; `staffAudienceWhere` gains an optional staff category (additive) |
| Recipient resolution (students, guardians, staff to people with email and phone) | **private method** inside `SendSchoolNotificationUseCase` | **Extracted** into a shared `AudienceRecipientService` (no behaviour change, characterisation tests first) so events do not copy it |
| Repeating-job pattern (BullMQ `upsertJobScheduler`, every school visited, `TenantContext.run`) | `automation.queue.ts` (5 min), `term-lifecycle` | Same pattern for the reminder worker |
| Per-school timezone | `School.timezone` | Used to turn "10:00 on 5 Dec" into an instant |
| Permissions registry + scopes (`ALL`/`BRANCH`), `Access`, sensitive flag | `*.permissions.ts`, `foundation/access.service` | Two new keys (section 5) |
| Audit | `AuditService.log` (`calendar_event.created/updated/deleted` exist) | Same service, more actions |
| School settings engine (defaults, group, label) | `notifications.settings.ts` | New `events.*` settings, **default OFF** |

Two facts that shaped the design:
- **Automation does not handle arbitrary event reminders.** Its rules are school-configured recurring messages (fee reminders). An event reminder is a one-off, tied to a row, so it needs its own table and worker.
- **Audience resolution is not reusable as it stands.** The pure filters are; the recipient lookup is private to the announcement use case, so it is extracted first.

## 2. Module ownership decision: a dedicated `events` module

`modules/events` owns the expanded domain: event lifecycle (draft, published, cancelled), audience, reminders, visibility, and the notifications they trigger.
`modules/sessions` keeps academic sessions and terms.

Why a separate module: the new work has its own states, permissions, background worker and notification flows; leaving it in Sessions would make Sessions own scheduling and messaging. Why not a new table: `CalendarEvent` is the same concept, and attendance already reads it.

Non-breaking rules:
- The Prisma model name and table stay `CalendarEvent`.
- The five existing routes under Sessions stay mounted with the same paths, permissions (`sessions.view`, `sessions.manage`) and response shapes, but delegate to the events use cases. Their behaviour: create makes a **published**, everyone-audience event with **no notifications** (exactly today's observable behaviour).
- One intentional change: legacy `DELETE` on a **published** event now **cancels** it (history kept) instead of erasing it; a **draft** is hard-deleted. The response shape is unchanged.
- Sessions' own use cases and tests for terms and sessions are untouched.

## 3. Database changes (tenant schema; new migrations only)

Two migrations, in this order, because PostgreSQL cannot use a new enum value in the transaction that added it (the provisioning bug fixed in `699beb0`; the builder now commits each migration on its own).

**Migration 1: enum values only.** `EventType` gains `meeting`, `sports`, `ceremony`, `graduation`, `resumption`, `pta`. (Existing: `holiday, event, exam, break, other`.) Nothing in this file uses them.

**Migration 2: structure.**
- New enums: `CalendarEventStatus` (`DRAFT`, `PUBLISHED`, `CANCELLED`), `EventAudienceKind` (`EVERYONE`, `TEACHING_STAFF`, `NON_TEACHING_STAFF`, `STUDENTS`, `GUARDIANS`), `EventReminderStatus` (`PENDING`, `PROCESSING`, `SENT`, `SKIPPED`, `CANCELLED`, `FAILED`), `publishNoticeSentAt` on the event.
- `CalendarEvent` new columns (all backward compatible):
  - `status` default `PUBLISHED` (existing rows stay visible; new API creates `DRAFT` explicitly)
  - `isAllDay` default `true`; `startTime`, `endTime` as `"HH:mm"` text, null for all-day. `startDate`/`endDate` keep their meaning, so attendance and every current reader are unaffected
  - `location`, `coverImageUrl` (nullable; upload is step D, if the storage pattern fits)
  - `audienceKinds EventAudienceKind[]` default `{EVERYONE}`
  - `notifyChannels` text array (`IN_APP`/`EMAIL`/`SMS`), `reminderOffsetsMinutes Int[]` default `{}`
  - `revision Int` default 1 (bumps on every reschedule; keys reminder rows and message idempotency)
  - `publishedAt`, `publishedById`, `cancelledAt`, `cancelledById`, `cancelReason`, `updatedById`
- `CalendarEventBranch (eventId, branchId)` and `CalendarEventClass (eventId, classId)`: narrow the audience, FK to `Branch`/`Class`, cascade on the event only.
- `CalendarEventReminder`: `id, eventId, revision, offsetMinutes, dueAt, status, attempts, lastError, processedAt`; unique `(eventId, revision, offsetMinutes)`; index `(status, dueAt)`.
- Index on `CalendarEvent (status, startDate)`.

Event history comes from the **audit log** (`calendar_event.created/updated/published/rescheduled/cancelled/reminders_scheduled`, with before and after) plus the `cancelled*` columns. No separate history table.

Migration checks: apply to a **fresh** schema (through the worker's builder) and to an **existing** school schema on a real PostgreSQL; existing rows must read back as `PUBLISHED`, all-day, everyone.

## 4. Audience targeting

An event's audience is `audienceKinds` (a set) narrowed by optional `branchIds` and `classIds`:
- Teaching staff and non-teaching staff map to `Staff.category`. Students and guardians map to the existing student and guardian filters. `EVERYONE` is all four.
- Branches narrow students, guardians and staff; classes narrow students and guardians only (same rule and same error as announcements: classes with staff-only audiences are refused).
- **No recipient IDs are accepted from the client at all** (stronger than announcements). The server resolves people from kind, branch and class, so there is nothing to forge. `branchIds` and `classIds` are validated to exist in the tenant, and classes must belong to the chosen branches.
- BRANCH scope: a user whose `events.manage` or `events.publish` is branch-limited can only choose their own branches; if they choose none, the audience is limited to all of theirs (the same `resolveAudience` rule as announcements). An event for the whole school needs ALL scope.
- **Holidays are school-wide.** `isHoliday` events must have the full audience with no narrowing, because attendance treats a holiday as a school-wide non-session day. Validation enforces it.
- Tenant isolation: everything goes through the tenant client; the worker runs each school inside `TenantContext.run`.

**Reading the calendar.** `sessions.view` stays the read permission (every persona has it). The list endpoint returns `PUBLISHED` and `CANCELLED` events whose audience includes the viewer (staff category and branch; student branch and current class; guardian through their children). Holders of `events.manage` or `events.publish` also see drafts. `CANCELLED` events stay visible, marked, because people were told about them. The matcher is a pure function, tested without a database; candidates are fetched by date window (default: one month) and matched in memory.

**Attendance.** `holidayCandidates` adds `status: PUBLISHED`, so a draft or cancelled holiday never blocks attendance.

## 5. API

New routes under `/events` (the legacy session routes remain as in section 2):

| Route | Permission | Purpose |
|---|---|---|
| `GET /events` (`from`, `to`, `type`, `termId`, `sessionId`, `status` for managers) | `sessions.view` | viewer-filtered calendar |
| `GET /events/:id` | `sessions.view` | one event, if visible to the viewer |
| `POST /events` | `events.manage` | create a **draft** |
| `PATCH /events/:id` | `events.manage` | edit; on a published event a change of date or time is a reschedule |
| `POST /events/:id/publish` | `events.publish` | draft to published; schedules reminders; notifies |
| `POST /events/:id/cancel` (`reason`, `notify`) | `events.publish` | published to cancelled; cancels pending reminders; notifies |
| `DELETE /events/:id` | `events.manage` | **drafts only**; published events are cancelled, never erased |
| `GET /events/:id/audience-preview` | `events.manage` | how many people, per kind and per channel, before publishing |

All bodies are validated with Zod DTOs; contracts go into `packages/contracts` the way the other modules do.

**Permissions** (`events.permissions.ts`, registered like the others; run `sync:registries`):
- `events.manage`: create, edit, delete drafts. Scopes `ALL`, `BRANCH`. Staff only.
- `events.publish`: publish, cancel, which notify many people. Scopes `ALL`, `BRANCH`. Staff only, `isSensitive`.
- Reading uses the existing `sessions.view`. Legacy create/edit/delete keep `sessions.manage`.
- Defaults: School Admin (grants-all) has both. Other role templates are not changed in this task; adding them to the head-teacher style templates is one line each and your call.

## 6. Notifications and reminders

**Settings, default OFF** (your rule for new features), group "Events": `events.notifications_enabled` (master switch). With it off, publishing, rescheduling and cancelling send no messages and due reminders are skipped; the calendar itself works as a calendar. The switch is read **at send time**, never stored per event (see section 11.1).

**Channels.** An event stores the channels it wants (`notifyChannels`). Publishing is **refused with the reason** if a requested channel is blocked by plan or school preference, exactly like announcements. At reminder time a channel that has since become unavailable is skipped quietly and logged (the plan can change between publish and reminder).

**Four message moments, all through `NotificationDispatchService`** (type `event`, or `holiday` for holidays):

| Moment | When | Idempotency key |
|---|---|---|
| Published | after the publish transaction commits | `event:{id}:published:{recipient}:{channel}` |
| Rescheduled | a published event's date or time changes (revision +1); `notify=false` available | `event:{id}:r{revision}:rescheduled:{recipient}:{channel}` |
| Cancelled | on cancel | `event:{id}:cancelled:{recipient}:{channel}` |
| Reminder | at each configured offset | `event:{id}:r{revision}:remind:{offset}:{recipient}:{channel}` |

Rows are written first and queued after, so a queue outage never loses or duplicates a message (`requeueStale` already covers it).

**Reminders: database rows scanned by a worker, not delayed queue jobs.** (This corrects my first suggestion of one delayed BullMQ job per reminder. Rows survive a Redis loss, cannot be orphaned when an event changes, and the repeating-scheduler pattern is already in the codebase.)
- Offsets: presets one day, two days, one week, or custom minutes; at most 5 per event, each 5 minutes to 90 days.
- On **publish** (switch on or off), one `CalendarEventReminder` row per offset for the current revision, `dueAt` computed in the school's timezone from the start date and time. For all-day events the base is 08:00 local on the start date, so "1 day before" is 08:00 the previous day. Offsets already past are not created.
- On **reschedule**: pending rows of the old revision become `CANCELLED`; new rows are created for the new revision. On **cancel**: pending rows become `CANCELLED`.
- New queue `event-reminders`, one repeating job every 5 minutes (`upsertJobScheduler`, never duplicated). Per provisioned school, in its tenant context: claim due rows (`PENDING` and `dueAt <= now`) with `FOR UPDATE SKIP LOCKED`, mark `PROCESSING`, resolve the audience **at send time** (people who joined or left since publishing are handled), dispatch with the keys above, mark `SENT`.
- Failure: back to `PENDING` with `attempts + 1`, `FAILED` after 5. `PROCESSING` rows older than 15 minutes are re-claimed; the dispatch keys make a double send impossible.
- Late worker: if the event has already started, the reminder is marked `CANCELLED` rather than sent; reminders only go out between `dueAt` and the event start.
- Defensive checks at send time: event still `PUBLISHED` and row's revision equals the event's revision, otherwise the row is cancelled.
- Cost note: each tick runs one cheap `EXISTS` query per school. Fine at current scale; a platform-level index of "schools with due reminders" is the upgrade path if the school count grows large.

## 7. Implementation stages (backend only)

| Step | Content | Verified by |
|---|---|---|
| **A. Foundations** | Characterisation tests for announcement recipient resolution; extract `AudienceRecipientService` (no behaviour change); optional staff category in `staffAudienceWhere` | existing notification tests still green + new ones |
| **B. Model and CRUD** | Migrations 1 and 2; `events` module (entity, DTO, repository, use cases, controller, routes, container); permissions and registry sync; audit; legacy routes delegating; attendance `PUBLISHED` filter | unit tests; real PostgreSQL tests on fresh and existing schemas |
| **C. Lifecycle and notifications** | Publish, reschedule, cancel; audience matcher and viewer-filtered list; audience preview; the `events.*` setting; messages through dispatch | tests for each moment, idempotency, plan and preference blocking, branch scope, tenant isolation |
| **D. Reminders and hardening** | Reminder table logic, `event-reminders` queue and worker, startup registration; cover image **only if** the existing storage pattern fits without new infrastructure; docs and the permission table | worker tests with a fake clock and fake dispatch; double-run, reschedule and cancel cases; real PostgreSQL claim query |

Each step is its own commit, pushed to `feat/api/events-calendar`, so it can be reviewed in order.

## 8. Verification plan, and its limits

- Unit tests with `node --test` as elsewhere; PostgreSQL-backed tests under `TEST_DATABASE_URL` for the migrations, the claim query and tenant behaviour.
- Typecheck and the architecture ratchet tests (use cases must not import the database client).
- Migration checks on a fresh schema and on an existing one.
- **Limits of my sandbox** (stated up front so results are read correctly): no Redis or BullMQ, and several dependencies are not installable here, so I cannot run the worker end to end or the full `npm run typecheck`/`npm test`. I can run real PostgreSQL 16 and pure-logic tests. I will report exactly what ran and what you still need to run on your machine.

## 9. Recurrence (Phase 2): what Stage 1 keeps open
- Series would add `seriesId` and a rule on the event plus per-date exceptions; occurrences are generated within a horizon.
- Reminders are already per `(eventId, revision, offset)`; per-occurrence is the same row keyed by occurrence.
- Messages already carry the event id and revision in their idempotency keys.
- Editing "this one" versus "this and following" is the real work; it needs the lifecycle (this proposal) to be stable first.

## 11. Clarifications (agreed scope review)

### 11.1 Notifications switched on after an event was published
Principle: **the switch is checked when a message is about to be sent, and turning it on never replays the past.** A surprise mass message about things that were already announced by other means is worse than a missed one.
- Reminder rows are created at publish whether the switch is on or off (they are just derived data). 
- When a reminder falls due, the worker checks the switch and the channel policy. **Off:** the row becomes `SKIPPED` with the reason recorded; it is never sent later. **On:** it is sent.
- So if the switch is turned on after publication, every reminder that is **still in the future** goes out normally; reminders that were already due while it was off stay `SKIPPED`. If it is turned off again, the next due reminders are skipped, and already `SENT` ones are untouched. No scan or backfill job is needed.
- The **publish notice** is not retroactive. While the switch is off, publishing records `publishNoticeSentAt = null`. After the switch is turned on, a manager can send it deliberately: `POST /events/:id/notify` (`events.publish`, body `{ "kind": "published" | "rescheduled" | "cancelled" }`). It is refused for events that already started, uses the same idempotency keys as the automatic notice (so it can never double-send), and is audited. Managers see in `GET /events` whether the notice was sent and how many reminders are pending, sent or skipped.
- Reschedule and cancel notices follow the same rule: not sent while the switch is off, and available through the same manual endpoint afterwards.
- Nothing runs when the setting changes; the change itself is audited by the settings engine.

### 11.2 Legacy `DELETE /sessions/calendar/events/:eventId`
Searched `apps/web/src` and `packages/contracts/src`: **no code calls the calendar-event routes** (the web's calendar tab only uses sessions and terms). So there is no known client to break; compatibility is kept for unknown clients anyway.
- **Status and envelope unchanged:** HTTP 200, the usual success envelope, `data.deleted` stays `true`, `data.title` stays the title.
- **Draft event:** exactly today's behaviour (hard delete), message "Calendar event deleted successfully".
- **Published event:** the event becomes `CANCELLED` (history kept, reminders cancelled, **no notification**, as the legacy endpoint never sent any). Same 200 and same fields, plus additive `cancelled: true` and `status: "CANCELLED"`; message "Calendar event cancelled (published events are kept for history)". Additive fields cannot break a client that ignores them.
- **Already cancelled:** same 200 (idempotent).
- **The legacy list hides cancelled and draft events**, so after a "delete" the event disappears from it, as an old client expects. The legacy update (`PUT`) treats cancelled and draft events as "not found", the same error a deleted event gave.
- Audit: a published event logs `calendar_event.cancelled` (with `via: "legacy_delete"`); a draft logs `calendar_event.deleted`. Both existing action names are kept where the behaviour is unchanged.
- Legacy create stays `PUBLISHED` + everyone + no notification; the legacy response mapper is unchanged (no new fields leak into it).
- The new `DELETE /events/:id` refuses published events outright with a clear error pointing to cancel; the cancellation-on-DELETE behaviour exists only on the legacy route.

### 11.3 Role templates (exact changes)
Facts: School Admin has grants-all (receives every permission automatically). `student` and `guardian` are locked and never touched. `principal`, `branch_principal`, `teacher`, `bursar` are editable templates: the sync **adds** new keys to schools' roles that were not customised and never removes or rescales anything. No template currently holds `sessions.manage` except through School Admin's grants-all.

Proposed, nothing else:
| Template | Added | Why |
|---|---|---|
| `principal` | `events.manage` ALL, `events.publish` ALL | already holds `notifications.send` ALL, so publishing event notices adds no new reach |
| `branch_principal` | `events.manage` BRANCH | can prepare drafts for their own branches. **Not** `events.publish`: this role has no `notifications.send` today and publishing is a messaging action, so a principal or the platform grants it deliberately |
| `teacher`, `bursar`, `student`, `guardian`, `school_admin` | **none** | unchanged; all keep `sessions.view` |

Two lines in `role-templates.registry.ts` plus the new permission registry file; a test asserts the full set of permission keys of every other template is byte-for-byte unchanged. Schools whose Principal or Branch Principal role was customised keep their customisation (the planner skips them); others receive the keys on the next `sync:registries`. Please confirm or amend this table.

## 10. Decisions I made, for you to overrule
1. A new `events` module, same table, legacy routes kept.
2. Reminders as database rows plus a 5-minute worker.
3. Everything new is off until `events.notifications_enabled` is switched on; SMS stays behind its existing plan and preference gates.
4. Legacy `DELETE` of a published event becomes a cancellation (details in 11.2).
5. Holidays must be school-wide.
6. Read access stays on `sessions.view`; two new management permissions.
7. No client-supplied recipient IDs, at all.

---

## Implemented: Step C (lifecycle and notices)

Routes (all school realm, under `/events`): `POST /:id/publish`, `POST /:id/reschedule`, `POST /:id/cancel`, `POST /:id/notify`
(all `events.publish`), `GET /:id/audience` (`events.manage`; counts only, sends nothing). `GET /events` and `GET /events/:id` now show each
person the events whose audience includes them, using the same audience rules that decide who is notified (managers also see drafts).

Behaviour worth knowing:
- Setting `events.notifications_enabled` (default OFF) is read at the moment a notice would go out. Publishing, rescheduling and cancelling
  work the same with it off; nobody is told. Turning it on never sends old notices; use `POST /:id/notify` for that.
- A published event's date and time change only through `reschedule` (PATCH refuses with `EVENT_USE_RESCHEDULE`). The old
  `PUT /sessions/calendar/events/:id` still changes dates and never notifies.
- Notices use the existing dispatch service with one idempotency key per person, channel and notice (a reschedule key includes the
  revision), so retries and repeated `notify` calls never send twice. Channels come from the event, then plan and school settings decide
  what is allowed; in-app is always allowed. Events that have started get no automatic notice and `notify` refuses them.

---

## Implemented: Step D (reminders, cover image)

**Reminders.** `reminderOffsetsMinutes` on an event (up to 5, from 5 minutes to 90 days before) becomes rows in `CalendarEventReminder`
when the event is published: one per offset for the event's current schedule revision. The rows are kept right after every change:
reschedule (new revision: old pending rows cancelled, new ones planned), offset change, cancel (all pending cancelled), and the old calendar
date edit. A reminder whose time had already passed when planned is created as `SKIPPED`; it never fires late. Reminders count back from the
start time, or from 08:00 school time for an all-day event; the school's own time zone is used.

**Sending.** The `event-reminders` queue runs one repeating job every 5 minutes (`schedulers/index.ts`, shown in Bull Board). Each tick goes
through every active, provisioned school in its own tenant context (one school failing does not stop the others) and claims due `PENDING`
rows so only one worker handles each. Per reminder:
- the event is no longer published, or its schedule moved on (older revision): `CANCELLED`;
- event notices are off (`events.notifications_enabled`), nobody to reach, or the event already started: `SKIPPED` with the reason. A skipped
  reminder never replays, so switching notices on later does not send old reminders;
- otherwise it is sent through the same notice road as publish/cancel (channel policy, audience rules, one idempotency key per person,
  channel, revision and offset) and marked `SENT`;
- a failure puts the row back for the next tick, up to 3 tries, then `FAILED` with the error. Rows stuck in `PROCESSING` for 30 minutes
  (a worker died) go back to `PENDING`.

**Cover image.** `POST /events/:id/cover` (multipart field `cover`; JPEG, PNG or WebP by the file's own bytes, up to 2 MB, SVG refused)
and `DELETE /events/:id/cover`, both `events.manage` and refused on a cancelled event. It uses the same storage service and public bucket as the
school logo, under `schools/<schoolId>/events`. Removing a cover clears the link; the stored file is not deleted.

**Not done (Phase 2, as agreed):** recurring events. The data model does not block them: a series would be a parent record with generated
occurrences, each with its own rows in the tables above.
