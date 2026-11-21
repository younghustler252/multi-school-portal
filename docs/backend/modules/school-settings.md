# School Settings Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents per-school branding, report-card layout, stamp/signature upload and school preferences. The school-settings unit/route test was inspected but not executed.

## Responsibility and boundaries

School Settings owns per-school presentation and preferences:
- School branding (colors, motto, address, website, founded year and principal name).
- Report-card template and optional custom letterhead.
- Stamp and principal signature image URLs.
- Teaching model and student-login fields exposed read-only in the settings response.
- School-level message and automation preferences stored as setting overrides.

School profile identity/verification is owned by School. Report card rendering consumes the settings. Notifications and Automation own their preference definitions; School Settings provides the UI/persistence API for those settings. Finance preferences are deliberately separate in Finance Settings.

## Runtime composition and route mount

Mounted at /api/v1/school-settings. All routes authenticate, resolve tenant context and enforce school_settings.view/manage. The module container registers SchoolSettingsRepository, SchoolSettingValueRepository, SchoolPreferencesService, mappers, use cases and controller. It depends on Entitlements, Audit and shared Supabase Storage.

## HTTP endpoints

All paths below are relative to /api/v1/school-settings.

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | school_settings.view | Read school branding/report-card settings |
| PUT | / | school_settings.manage | Update supplied branding/report-card fields |
| GET | /preferences | school_settings.view | Read notification/automation preference registry with defaults |
| PUT | /preferences | school_settings.manage | Atomically update 1–20 preferences; null resets default |
| POST | /stamp | school_settings.manage | Upload school stamp |
| POST | /signature | school_settings.manage | Upload principal signature |

Both permissions are SCHOOL realm, ALL scope, STAFF-only. Default role templates grant manage/view to principal; teacher, bursar, student and guardian templates do not receive these permissions.

## Branding and report-card fields

PUT accepts:
- primaryColor and secondaryColor: #RRGGBB.
- motto (max 200), address (max 300), website (HTTP/HTTPS URL), foundedYear (1800 through current year), principalName (max 100).
- reportCardTemplate: classic, modern, minimal or custom_letterhead.
- reportCardLetterheadUrl: HTTPS only.
- letterheadContentTopMm and letterheadContentBottomMm: integer 0–200.

Unknown fields are rejected. Empty update is rejected. allowStudentLogin and teachingModel are not editable through this endpoint; they are returned as read-only settings.

Selecting custom_letterhead or supplying a letterhead URL requires plan feature report_cards.letterhead. The check is performed server-side through EntitlementsService, not a client flag.

The response also returns logoUrl, stamp, signature, report-card layout, allowStudentLogin and teachingModel. The current route has no logo upload endpoint; logo URL is managed elsewhere in school onboarding/profile flows.

## Stamp/signature uploads

- Multipart field name is stamp or signature.
- Multer memory storage; maximum file size 2 MB and one file.
- Permission check runs before multer reads the file.
- The use case inspects file magic bytes, not browser MIME/filename.
- Only PNG, JPEG and WebP are accepted; SVG/HTML are rejected.
- Upload goes to the public Supabase bucket under schools/<schoolId>/<type>/ with a generated unique filename.
- The resulting public URL is saved in SchoolSettings and audit records the URL.

The storage service generates a new random path for every upload. The old object is not deleted when a new stamp/signature replaces its URL, so superseded objects remain in the public bucket unless separately cleaned up.

## School preferences

The preferences registry is assembled from:
- NOTIFICATION_SETTING_DEFS in Notifications.
- AUTOMATION_SETTING_DEFS in Automation.

Finance keys are not part of this registry; they belong to Finance Settings.

GET returns each key's current value, default and override status. PUT accepts 1–20 keys:
- All keys are validated against the shared settings registry before any write.
- Unknown keys or invalid type/range reject the whole request.
- null deletes the override and restores the module-defined default.
- Actual changes are written in one tenant transaction.
- A single audit event records the old/new value and reset flag.
- No-op updates do not write or audit.

SchoolPreferencesService is scoped and reads the current tenant's overrides. Notifications and Automation consume it through preferencesOf; if a module dependency is absent in a hand-built test, default preferences are used.

## Persistence

Tenant models:
- SchoolSettings: one intended settings row per school schema; contains branding/report-card fields, stamp/signature URLs and read-only student-login/teaching-model fields.
- SchoolSettingValue: one row per key for notification/automation preference overrides; unique key; JSONB value and updatedById.

SchoolSettings has only an ID primary key and no singleton unique constraint. Repository upsert performs findFirst then update-or-create, so simultaneous first updates can create duplicate rows.

## Tests and verification status

Test source inspected:
- apps/api/tests/settings/school-settings.test.ts
- apps/api/tests/settings/settings-engine.test.ts

Coverage includes permission registry/default role grants, DTO strictness, URL protocol validation, founded year, image magic-byte validation, file size/type, letterhead entitlement, settings updates/audit/no-op, preference validation/reset/all-or-nothing and static route wiring. It uses in-memory repositories and static source assertions; no real tenant database concurrency or HTTP multipart integration tests were found.

Not executed: tests, typecheck, build, migration, real Supabase upload/delete, tenant DB concurrency or live HTTP requests.

## Open implementation and verification items

1. **SchoolSettings singleton is not enforced in the database.** Repository upsert uses findFirst then create; concurrent first updates can create multiple rows. Add a fixed singleton key/unique constraint or a transactional atomic upsert.
2. **Replacing stamp/signature leaves old public objects orphaned.** Persist storage path (not only URL), then delete old object after successful DB update or enqueue cleanup. Add cleanup for existing orphaned files.
3. **No real-tenant DB or multipart HTTP tests were found.** Add tests for concurrent first settings update, tenant isolation, upload MIME spoofing/size, storage failure, DB failure after upload, and replacement cleanup.
4. **Audit is after settings/storage writes.** A failed audit does not roll back the change; use the shared durable audit/outbox policy (REM-077).
5. **Preferences share the global settings registry.** Keep module definitions owned by Notifications/Automation; do not add arbitrary keys from frontend or let Finance keys enter this endpoint.
6. **Run school-settings tests, typecheck/build and tenant migration checks** before rollout.

## Source paths reviewed

- apps/api/src/modules/school-settings/routes/school-settings.routes.ts
- apps/api/src/modules/school-settings/controllers/school-settings.controller.ts
- apps/api/src/modules/school-settings/dtos/school-settings.dto.ts
- apps/api/src/modules/school-settings/domain/
- apps/api/src/modules/school-settings/school-settings.permissions.ts
- apps/api/src/modules/school-settings/school-settings.container.ts
- apps/api/src/modules/school-settings/usecases/
- apps/api/src/modules/school-settings/services/school-preferences.service.ts
- apps/api/src/modules/school-settings/repositories/
- apps/api/src/foundation/settings.registry.ts
- apps/api/src/foundation/settings.engine.ts
- apps/api/src/infrastructure/storage/supabase-storage.service.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/tenant.prisma
- apps/api/tests/settings/school-settings.test.ts
- apps/api/tests/settings/settings-engine.test.ts
