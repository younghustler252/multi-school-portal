# Feedback Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents authenticated feedback submission and platform review. One submit-use-case test file was inspected but not executed.

## Responsibility and boundaries

Feedback is a public-schema support channel for authenticated product users. It allows any authenticated session to submit:
- Bug reports.
- Suggestions.
- Complaints.
- Praise.

Platform staff can list, inspect, respond, change status and delete feedback. Feedback is not stored in the school's tenant schema because platform support needs to review submissions across all schools.

## Runtime composition and route mount

Mounted at /api/v1/feedback. The module uses:
- Public FeedbackRepository.
- PlatformSettingsRepository to resolve supportEmail.
- MailService for best-effort support notification.
- FeedbackMapper for user/school enrichment.

Submission stores feedback first, then attempts to email the configured platform support address. Email failure is caught and does not fail the feedback submission.

## HTTP endpoints

All paths are relative to /api/v1/feedback.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| POST | / | Authenticated user | Submit feedback |
| GET | /my | Authenticated user | List feedback submitted by current global user ID |
| GET | / | platform.feedback.manage | Paginated platform-wide feedback list |
| GET | /:id | platform.feedback.manage | Read one enriched feedback item |
| PATCH | /:id/status | platform.feedback.manage | Change status |
| PATCH | /:id/respond | platform.feedback.manage | Save platform response and optional status |
| DELETE | /:id | platform.feedback.manage | Hard-delete feedback |

Submitting and reading one's own feedback require authentication but no separate permission key. Platform management permission is PLATFORM realm, ALL scope, STAFF-only. The platform list can filter by type, status, userId and schoolId.

## Submission contract

Request fields:
- type: bug, suggestion, complaint or praise.
- message: trimmed, 1–5,000 characters.
- pageUrl: optional string, max 2,048 characters.

The controller stores authenticated userId and optional authenticated schoolId; callers cannot submit another user/school ID. Platform users can submit with schoolId null.

The support email is loaded from Platform Settings. If it is empty, feedback is still saved and no email is sent. If email delivery fails, the use case logs the error and returns the saved feedback successfully.

The notification email includes type, message, optional page URL and school ID. It does not include user email/name in the current message body.

## Status and response behavior

Statuses: OPEN, REVIEWED and RESOLVED. Platform can set any status from the enum. Responding saves response text (1–5,000 chars) and defaults status to RESOLVED unless the request supplies another valid status.

There is no status transition graph; any status can be changed to any other. Response history is not versioned; a later response replaces the previous response. Delete is a hard delete.

## Persistence and enrichment

Public model Feedback stores nullable userId/schoolId, type, message, pageUrl, status, response, createdAt and updatedAt. It has indexes on userId+createdAt, schoolId+createdAt and status.

Platform list/detail joins User first/last/email and School name. /my queries by global userId across all school submissions for that identity. The platform detail response exposes user email, school name, message and page URL to platform.feedback.manage users.

## Tests and verification status

Test source inspected:
- apps/api/tests/feedback/submit-feedback.test.ts

It covers configured support email, empty support email and email failure not breaking submission. No tests were found for platform listing/detail, status/response/delete, permissions, pageUrl handling, rate limiting or public DB behavior.

Not executed: tests, typecheck, build, migration, live HTTP requests or actual mail delivery.

## Open implementation and verification items

1. **Feedback submission has no rate limit or abuse controls.** Any authenticated user can submit up to 5,000 characters and trigger a support email; repeated submissions can flood the support inbox. Add per-user/IP rate limits, duplicate throttling and spam controls.
2. **pageUrl is not validated as a safe URL or redacted.** It is stored and returned to platform UI as-is. Browser URLs can contain access tokens or other query secrets; unsafe schemes may also be rendered as links. Restrict to relative paths or http/https URLs, strip fragments/query secrets, and render as text unless safely normalized.
3. **Platform review/status/response/delete actions are not audited.** These use cases do not call AuditService. Record reviewer, status transitions, response edits and deletion (prefer soft-delete/tombstone for support history).
4. **Support email delivery is best-effort without an outbox.** If MailService fails, feedback is saved but support is not notified and there is no retry. Add a durable support-notification outbox or an admin dashboard alert for unnotified feedback.
5. **Hard delete removes support history.** Consider soft deletion with actor/reason or retention policy; ensure deletion does not erase records needed for security investigations.
6. **No platform management HTTP/DB tests were found.** Add tests for permission/realm, /my ownership, platform filters, status/response/delete, rate limits and URL handling.
7. **Run feedback tests, typecheck/build and public DB checks** before rollout.

## Source paths reviewed

- apps/api/src/modules/feedback/routes/feedback.routes.ts
- apps/api/src/modules/feedback/controllers/feedback.controller.ts
- apps/api/src/modules/feedback/dtos/feedback.dto.ts
- apps/api/src/modules/feedback/domain/feedback.entity.ts
- apps/api/src/modules/feedback/domain/feedback.enums.ts
- apps/api/src/modules/feedback/feedback.permissions.ts
- apps/api/src/modules/feedback/feedback.container.ts
- apps/api/src/modules/feedback/usecases/
- apps/api/src/modules/feedback/repositories/feedback.repository.impl.ts
- apps/api/src/modules/feedback/mappers/feedback.mapper.ts
- apps/api/src/modules/platform-settings/repositories/platform-settings.repository.impl.ts
- apps/api/prisma/public.prisma
- apps/api/tests/feedback/submit-feedback.test.ts
