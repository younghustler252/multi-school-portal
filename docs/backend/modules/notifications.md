# Notifications Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents school announcements/inboxes, platform-to-school notifications, dispatch/outbox, channel delivery and worker behavior. Unit tests were inspected but not executed.

## Responsibility and boundaries

Notifications owns message records, recipients, inbox read state and delivery orchestration:
- School announcements to students, guardians and staff.
- In-app inbox for each school persona.
- Platform notices to school admins and the school's platform inbox.
- Per-channel policy checks.
- Recipient rows, idempotency keys and delivery queue handoff.
- Email/SMS provider dispatch and retry status.
- School/platform sent-message history.

Automation and business modules prepare messages and call NotificationDispatchService. Message Templates owns customizable wording and placeholders. Notifications does not own the business trigger (invoice due, attendance absent, payment received, etc.).

## Runtime composition and route mount

Mounted at /api/v1/notifications. Dependencies include tenant/public NotificationRepository, NotificationDispatchService, ChannelPolicyService, NotificationDeliveryService, channel registry, school admin directory, school/student/guardian/staff/user repositories, MailService and AuditService.

School notifications live in each tenant schema. Platform notifications and platform recipients live in the public schema. The worker listens on the BullMQ notification queue and enters the school's tenant context for school recipients.

## HTTP endpoints

All paths are relative to /api/v1/notifications.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | /school | notifications.view | School sent-message history |
| POST | /school | notifications.send | Send announcement to selected school audience |
| GET | /me | Authenticated STAFF/STUDENT/GUARDIAN | Own in-app inbox |
| PATCH | /me/read-all | Authenticated STAFF/STUDENT/GUARDIAN | Mark all own in-app messages read |
| PATCH | /me/:recipientId/read | Authenticated STAFF/STUDENT/GUARDIAN | Mark one own message read; other recipient is 404 |
| GET | /platform-inbox | notifications.platform.view | Messages from platform to current school |
| PATCH | /platform-inbox/:recipientId/read | notifications.platform.view | Mark current school's platform message read |
| GET | /platform | platform.notifications.view | Platform sent-message history |
| POST | /platform | platform.notifications.send | Send platform notice. Target: `schoolIds` (at least one; an empty list is a 400) or `broadcastAll: true`. While the web app still sends no target for "all schools", omitting both is read as a broadcast (see REM-095). Optional `idempotencyKey` (or `Idempotency-Key` header): a retry returns the original broadcast and resumes undelivered rows without resending delivered ones (REM-097). Email/SMS go through the queue; the parent is COMPLETED only when no row is waiting (REM-093) |

School permissions are STAFF-only. notifications.send is sensitive and supports ALL or BRANCH scope. BRANCH senders can only reach their own branches; class targeting is restricted to student/guardian audiences. Own inbox routes require an authenticated persona but no separate inbox permission. Platform routes require platform-realm permissions.

## School announcement audience

Send request includes title, message, notification type, targetType, channels, optional branch/class filters, optional specific student/guardian/staff IDs, includeGraduates and bounded metadata.

Audience targets:
- STUDENT / ALL_STUDENTS.
- GUARDIAN / ALL_PARENTS.
- STAFF / ALL_STAFF.
- EVERYONE.

The use case resolves target records from tenant repositories, then contact details from the related guardian record or global User account. Branch scope is enforced server-side:
- Chosen branch must be within the sender's branch grant.
- Chosen class must exist and belong to an allowed branch.
- Specific person IDs are checked against the narrowed audience; any out-of-scope ID rejects the request.
- A class cannot be used when staff are included.

The server does not accept arbitrary recipient email/phone from the request. It resolves recipients from persisted school records.

## Channel policy

Channels: IN_APP, EMAIL, SMS.

- IN_APP is always allowed.
- EMAIL requires plan feature notifications.email and school preference notifications.email_enabled=true.
- SMS requires plan feature notifications.sms and school preference notifications.sms_enabled=true.
- School announcement requests are rejected if any requested channel is blocked; the system does not silently downgrade the sender's request.
- People without an email/phone do not receive a row for that channel.
- Automation can use the allowed subset and reports blocked channels in its run result.

## School dispatch and outbox

NotificationDispatchService is the shared path for school announcements and automation:
1. Drop duplicate idempotency keys within the call.
2. Query existing recipient idempotency keys and drop already-created occurrences.
3. Group messages with the same type/title/body into one SchoolNotification.
4. Create one SchoolNotificationRecipient per person/channel.
5. IN_APP recipient rows start SENT and are visible immediately.
6. EMAIL/SMS recipient rows start PENDING.
7. Enqueue delivery jobs; successful queue handoff marks rows QUEUED.
8. If queue is unavailable, rows remain PENDING. Automation's scheduled tick calls requeueStale to enqueue stale PENDING/QUEUED rows.

Notification recipient idempotency is enforced by the unique key in the tenant schema. Automation keys include source occurrence, recipient and channel, so retrying an automation does not create another recipient for an already-created occurrence.

The dispatch service creates notification header and recipient rows as separate repository operations, and recipient batches are chunked by 1,000. There is no single transaction spanning the header and every recipient chunk.

## Worker delivery and status semantics

BullMQ worker:
- Queue name notification.
- Concurrency 5.
- Each job carries kind, recipientId, schoolId and tenantSchema.
- School job enters TenantContext before resolving NotificationDeliveryService.
- Platform job uses public recipient and school-admin directory.
- A failed provider delivery throws so BullMQ retries three times; an undeliverable contact is recorded and not retried.
- Final failures are logged and reported to Sentry.

Recipient statuses:
- PENDING: row persisted but not queued.
- QUEUED: delivery job accepted.
- SENT: provider accepted the message; this is not proof the human read it.
- FAILED: no contact or provider failure; provider failures are retryable through queue attempts.
- READ: in-app recipient opened/marked read.
- CANCELLED: terminal state if cancelled by a supported workflow.

Email channel escapes title, greeting and body before passing them to MailService. SMS sends plain text through the configured channel provider. Delivery service resolves current contact details at send time rather than freezing them at dispatch time.

The delivery model is at-least-once with provider-side uncertainty: if the provider accepts a message but the process fails before SENT is persisted, a retry can send the same message again. Provider idempotency support is not wired into the channel contract.

## Platform notifications

Platform messages are stored in public PlatformNotification and PlatformNotificationRecipient tables. A recipient row is created per school and channel. School admins see IN_APP messages in /platform-inbox.

### Send path (REM-093, REM-095, REM-097)

`SendPlatformNotificationUseCase` now works like this:
1. **Target is decided before anything is saved.** `schoolIds` (at least one) or `broadcastAll: true`. An empty list, both together, or `broadcastAll: false` with no schools is a 400.
2. **Idempotency.** An optional `idempotencyKey` (body, or `Idempotency-Key` header) derives the notification id from (operator, key). The primary key makes a repeated or concurrent send one broadcast; the retry returns the original and resumes it. The notification stores a request fingerprint (SHA-256 of title, message, type, the set of channels, the audience — the sorted set of schools, or ALL for `broadcastAll`/implicit — and metadata) in `metadata.requestFingerprint`. The same key with a different fingerprint is a 400, checked before any recipient row is touched, so a refused reuse adds no rows and changes nothing. Order and duplicates in `schoolIds`/`channels` do not matter.
3. **Recipient rows** are created only if missing (`@@unique([notificationId, schoolId, channel])`, `skipDuplicates`). IN_APP rows are SENT at creation. EMAIL/SMS rows are PENDING, then handed to the notification queue as `kind: "platform"` jobs (job id = row id) and marked QUEUED.
4. **Delivery** is `NotificationDeliveryService.deliverPlatformRecipient` in the worker: SENT on success, FAILED when no admin contact exists or the last try fails. A failed try that the queue will repeat keeps the row QUEUED (reason and try count recorded) and the parent open.
5. **Parent state.** PROCESSING while any EMAIL/SMS row is PENDING or QUEUED; COMPLETED once none is (immediately for in-app-only sends). If the queue refuses the jobs, rows stay PENDING and the parent goes back to QUEUED. There is no PARTIAL/FAILED parent state (it needs an enum migration); failures are visible per recipient.

### Implicit "all schools" (REM-095) — compatibility switch (mitigated, deferred)

The web composer (`compose-platform-notification-card.tsx`) sends "All schools" as `schoolIds: undefined` with no `broadcastAll`, so the JSON body has neither field. The API therefore still accepts that shape, but never silently: it logs a warning and marks the notification `metadata.implicitBroadcast = true`.

To switch it off once the web app is updated:
1. Web change (not part of the API batches): in `onSubmit`, send `broadcastAll: audienceMode === "all" ? true : undefined` next to `schoolIds`, and add `broadcastAll?: boolean` to `SendPlatformNotificationDto`.
2. Deploy the web change, then set `PLATFORM_BROADCAST_STRICT=true` on the API. An implicit send then returns 400 before anything is saved.
3. After that, the env check can be replaced by making the DTO require one of the two fields.
Until step 2, a stale browser tab keeps working.

### Known limitations after REM-093 + REM-097

- **FAILED rows are not re-driven.** A row that used all 3 tries is FAILED. Re-sending with the same key does not retry it: only PENDING/QUEUED rows are handed back, and the queue still holds the failed job under the same id (`removeOnFail: 5000`). Retrying a failed recipient needs a deliberate "retry failed" action (reset the row, remove the old job).
- **No background recovery for platform rows.** The school side has `requeueStale()` on the automation tick. Platform rows that were never queued (Redis down at send time) or whose job was lost stay PENDING/QUEUED until the operator re-sends with the same idempotencyKey. A send without a key cannot be resumed (a retry makes a new broadcast). A platform-level sweep needs its own scheduled job, because platform rows are not tenant-scoped.
- **Operators should send with an idempotencyKey** (a UUID per compose action). The web composer does not send one yet.
- **A resend with the same key rebuilds its target from the new request.** If the second request names more schools than the first, the missing schools' rows are added to the same broadcast; it does not remove rows.
- **Provider success followed by a DB write failure** can re-send on the queue's retry (at-least-once, unchanged).
- **No per-recipient lease or delivery summary** on the parent.
- **Platform sends are still not audited** (REM-097 does not cover it; see open item 4).

## Persistence

Tenant models:
- SchoolNotification: title/message/type/targetType/sender/metadata/sentAt.
- SchoolNotificationRecipient: notification, recipient type/entity/user, channel, priority, status, idempotencyKey, queued/sent/read/failure fields, provider message ID and retry count.

Public models:
- PlatformNotification: title/message/type/state/creator/metadata/timestamps.
- PlatformNotificationRecipient: notification, school, channel, status, sent/read/failure fields and provider message ID.

School inbox query is forced by persona and personaEntityId from the authenticated Access object; request parameters cannot choose another recipient. Platform inbox is forced by current schoolId. Mark-read operations use conditional updateMany and return 404 for another recipient/school.

## Tests and verification status

Test sources inspected:
- apps/api/tests/notifications/notifications.test.ts
- apps/api/tests/notifications/audience.test.ts
- apps/api/tests/notifications/platform-delivery.test.ts

Coverage includes school dispatch grouping/idempotency/queue-down requeue, channel delivery success/failure/no-contact, email HTML escaping, branch/class audience constraints, plan and preference channel gates, inbox ownership/persona isolation, permissions/route wiring and platform recipient delivery service.

Message template tests are separate. Existing notification tests use in-memory repositories/queue/channel fakes and static source checks. They do not test real tenant/public DB behavior, HTTP delivery endpoints, platform send orchestration, partial batch failures, duplicate platform sends or provider-success/DB-failure recovery.

Not executed: tests, typecheck, build, migrations, Redis/BullMQ, email/SMS provider sandbox or live HTTP requests.

## Open implementation and verification items

1. **(Resolved in batch 1, REM-093.) Platform notification send path did not honor all requested channels or track recipient outcomes.** DTO accepts IN_APP/EMAIL/SMS; use case creates rows for each but only sends EMAIL directly. SMS rows remain PENDING, and EMAIL rows are not marked SENT/FAILED. Parent notification is marked COMPLETED regardless of actual delivery. Use one outbox/worker path for all channels and compute parent state from recipient outcomes.
2. **Empty school recipient-message list causes a runtime failure.** When people exist but none has contact details for requested EMAIL/SMS channels, messages is empty. Dispatch returns no notificationIds; the use case then reads notificationIds[0] and maps a null result. Return a clear NO_DELIVERABLE_RECIPIENTS response before dispatch.
3. **(Mitigated / deferred, REM-095: NOT fully resolved.) Empty platform schoolIds meant broadcast to every active school.** The empty-list case is fixed; the implicit all-schools shape stays accepted behind a compatibility switch until the web composer sends `broadcastAll: true` and `PLATFORM_BROADCAST_STRICT=true` is enabled (see "Implicit all schools" above). DTO comment says null means all schools, but use case also treats [] as all. Reject an explicitly empty array or require an explicit broadcastAll flag with a confirmation/permission boundary.
4. **Platform notifications have no audit record.** SendPlatformNotificationUseCase does not inject AuditService, despite platform.notifications.send being sensitive.
5. **(Resolved in batch 2, REM-097, with the limitations above.) Platform sends were not idempotent and not queued.** A request retry can create duplicate platform notifications/emails; a failure midway leaves some emails sent and others pending without a resumable delivery workflow. Use an outbox with stable request/recipient/channel idempotency.
6. **School dispatch header and recipient chunks are not one transaction.** A failure partway through recipient batch creation can leave partial audience rows/header. Wrap persistence in one tenant transaction or use a resumable dispatch record with expected/created counts.
7. **Provider delivery is at-least-once.** Provider success followed by DB failure can cause retry duplicate. Use provider idempotency keys where supported and record UNKNOWN/confirmation states when provider acceptance is ambiguous.
8. **No real DB/HTTP tests were found.** Add school/platform route tests, tenant/public persistence tests, platform send channel/status tests, empty recipient tests, broadcast selection tests and partial failure/retry tests.

## Source paths reviewed

- apps/api/src/modules/notifications/routes/notification.routes.ts
- apps/api/src/modules/notifications/controllers/notification.controller.ts
- apps/api/src/modules/notifications/dtos/notification.dto.ts
- apps/api/src/modules/notifications/domain/audience.ts
- apps/api/src/modules/notifications/notifications.permissions.ts
- apps/api/src/modules/notifications/services/notification-dispatch.service.ts
- apps/api/src/modules/notifications/services/notification-delivery.service.ts
- apps/api/src/modules/notifications/services/channel-policy.service.ts
- apps/api/src/modules/notifications/repositories/notification.repository.impl.ts
- apps/api/src/modules/notifications/usecases/
- apps/api/src/modules/message-templates/services/message-template.service.ts
- apps/api/src/infrastructure/jobs/queues/notification.queue.ts
- apps/api/src/infrastructure/jobs/workers/notification.worker.ts
- apps/api/src/infrastructure/notifications/channel.registry.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/tenant.prisma
- apps/api/prisma/public.prisma
- apps/api/tests/notifications/
