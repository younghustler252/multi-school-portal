# Message Templates Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents the code-owned message catalog, per-school text overrides, placeholder rendering and SMS segmentation. Unit tests were inspected but not executed.

## Responsibility and boundaries

Message Templates owns the approved wording and variables for system-generated school messages:
- Code-owned catalog of supported message keys.
- Per-school overrides for IN_APP, EMAIL and SMS.
- Placeholder allowlists and sample values.
- Strict validation before save.
- Preview using sample values.
- Reset to platform default.
- HTML-safe email rendering and SMS segment estimation.

A school cannot add new message keys or arbitrary placeholders. Automation, Fees, Attendance, Report Cards and Notifications request a known template and supply values. Notifications owns dispatch and provider delivery.

## Runtime composition and route mount

Mounted at /api/v1/message-templates. Requires authenticated school tenant context and message_templates.view/manage permissions. The module uses:
- MessageTemplateRepositoryImpl backed by tenant SchoolMessageTemplate.
- MessageTemplateService to resolve school override or code default.
- EntitlementsService for email/SMS plan checks.
- AuditService for save/reset events.

The service does not cache school overrides; each effective template read queries the current tenant repository.

## HTTP endpoints

All paths are relative to /api/v1/message-templates.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | message_templates.view | List all catalog templates, placeholders and channel text |
| GET | /:key | message_templates.view | Read one template key |
| PUT | /:key/:channel | message_templates.manage | Save school override for one channel |
| DELETE | /:key/:channel | message_templates.manage | Delete override and restore code default |
| POST | /:key/:channel/preview | message_templates.manage | Render draft/current text with sample data; no save/send |

Channel path accepts in_app, email or sms case-insensitively; in-app and hyphen variants normalize to IN_APP. Unknown channels and keys return stable domain errors.

Permissions are SCHOOL realm, ALL-scope STAFF-only. Principal role receives view/manage; teacher, bursar, student and guardian do not receive these permissions by default.

## Code-owned catalog

The current catalog has nine keys:
- fee.reminder — fee due soon.
- fee.invoice — fee invoice issued.
- fee.overdue — fee overdue notice.
- fee.receipt — payment received.
- attendance.absent — absence/late notice.
- student.transferred — student branch transfer.
- attendance.low — low attendance warning.
- attendance.register_reminder — class register not taken.
- report_card.ready — report card published.

Each key defines:
- Notification type used by the in-app record.
- Display name and description.
- Allowed placeholder variables and sample values.
- Default subject/body for all three channels.

Examples of allowed placeholders include guardian_name, student_name, school_name, amount_due, due_date, invoice_number, amount_paid, paid_date, receipt_number, class_name, status, term_name, from_branch, to_branch, rate, days_marked and staff_name. The exact allowlist is specific to each catalog key.

## Save and reset behavior

Save request:
- body is required, non-empty and max 6,000 characters at DTO layer.
- subject is optional at DTO layer but required by domain validation for EMAIL and IN_APP; max 120 characters and one line.
- SMS cannot have a subject.
- body maximum is channel-specific (SMS has the shortest limit).
- every placeholder must be in that catalog key's allowlist.
- malformed or unknown placeholders are rejected with a list of allowed variables.
- HTML is allowed as literal template text but is escaped during EMAIL rendering; it is not executed as markup.
- EMAIL requires plan feature notifications.email.
- SMS requires plan feature notifications.sms.
- IN_APP is always allowed.
- isActive=false stores a disabled override but the service uses the code default.
- Save is an upsert by key/channel/locale; current locale is en.

Reset deletes the school override. It is safe to repeat; audit is written only when a row was actually removed.

The audit event records old/new subject/body/isActive for save and a reset event for delete. Audit is written after the settings write and uses the shared AuditService behavior described in REM-077.

## Placeholder rendering and safety

Template engine:
- Placeholder syntax is {{lowercase_name}}; whitespace inside braces is tolerated.
- fillPlaceholders performs one pass, so a replacement value that itself looks like {{another_placeholder}} is not recursively expanded.
- Missing/null values become empty strings and are returned in a missing list.
- Values are converted to strings, control characters are replaced with spaces, trimmed and capped at 500 characters.
- EMAIL body is HTML-escaped after placeholder substitution, then split into paragraphs; single newlines become <br>.
- EMAIL subject remains plain text (not inserted into HTML).
- IN_APP and SMS remain plain text.
- renderPlain returns plain text for NotificationDispatchService; the email channel performs escaping at send time.

SMS length uses GSM-7 basic/extended tables or UCS-2 code units:
- GSM-7: 160 characters for one segment, 153 per concatenated segment.
- UCS-2: 70 characters for one segment, 67 per concatenated segment.
- Extension-table characters count as two GSM units.
The preview endpoint returns encoding, character count and estimated segment count for SMS.

## Persistence

Tenant model SchoolMessageTemplate is unique by key/channel/locale. It stores subject, body, isActive, updatedById and updatedAt. No separate catalog rows are stored; the catalog is code-owned and cannot be modified by schools.

The repository uses Prisma upsert for save and deleteMany for reset. A unique composite index ensures one override per key/channel/locale.

## Tests and verification status

Test sources inspected:
- apps/api/tests/settings/message-templates.test.ts
- apps/api/tests/settings/message-templates-engine.test.ts

Coverage includes permissions/default roles, catalog listing, unknown keys/channels, save/placeholder validation, per-channel plan gates, inactive overrides, reset, preview, HTML escaping, SMS encoding/segments, default template validation and static route/container wiring.

Tests use in-memory repositories and pure rendering; no real tenant DB or HTTP route integration test was found.

Not executed: tests, typecheck, build, migration, live route calls, actual email/SMS delivery or cross-tenant DB isolation.

## Open implementation and verification items

1. **No real tenant DB/HTTP tests were found.** Add tests for composite uniqueness, per-tenant override isolation, route permission enforcement, plan feature denial, save/reset persistence and concurrent upsert.
2. **Audit writes occur after template persistence.** A failed audit can leave a committed override without a durable audit event; follow the shared transactional outbox policy (REM-077).
3. **Rendered subject length is not revalidated after placeholder substitution.** Template text is capped at 120 characters, but a variable can expand to up to 500 characters. Add a post-render subject limit and safe truncation/rejection before passing to the mail provider.
4. **Template reads are uncached.** This is safe for tenant isolation and keeps changes immediate, but repeated automation sends may cause repeated DB reads; if optimizing, cache by school/key/channel and invalidate on upsert/reset.
5. **Run template tests, typecheck/build and tenant migration checks** before rollout.

## Source paths reviewed

- apps/api/src/modules/message-templates/routes/message-template.routes.ts
- apps/api/src/modules/message-templates/controllers/message-template.controller.ts
- apps/api/src/modules/message-templates/dtos/message-template.dto.ts
- apps/api/src/modules/message-templates/domain/template-engine.ts
- apps/api/src/modules/message-templates/domain/template-catalog.ts
- apps/api/src/modules/message-templates/domain/template.errors.ts
- apps/api/src/modules/message-templates/message-templates.permissions.ts
- apps/api/src/modules/message-templates/services/message-template.service.ts
- apps/api/src/modules/message-templates/repositories/message-template.repository.impl.ts
- apps/api/src/modules/message-templates/usecases/message-template.usecases.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/tenant.prisma
- apps/api/tests/settings/message-templates.test.ts
- apps/api/tests/settings/message-templates-engine.test.ts
