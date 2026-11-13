# Platform Settings Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents public platform configuration and its platform-admin update path. No dedicated platform-settings tests were found; no runtime checks were executed.

## Responsibility and boundaries

Platform Settings stores global product identity and operational switches:
- Platform name and support contact.
- Public logo, terms and privacy URLs.
- Subscription grace period, reminder offsets and default trial days.
- New school registration enable/disable.
- Maintenance mode/message and announcement banner.

It is distinct from school settings (per-school branding/report-card preferences) and Finance Settings (per-school finance policies).

## Runtime composition and route mount

Mounted at /api/v1/platform/settings. The GET route is public and does not require authentication or tenant resolution. PUT requires authenticated platform permission platform.settings.manage.

The module uses the public Prisma client and a singleton PlatformSettingsRepositoryImpl. The repository currently obtains the first row and creates an empty default row if none exists.

## HTTP endpoints

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | / | Public | Read platform settings; creates default row if table is empty |
| PUT | / | platform.settings.manage | Update supplied platform fields (not the logo) |
| POST | /logo | platform.settings.manage | Upload the platform logo (multipart field `logo`): JPEG, PNG or WebP, up to 2 MB, judged by the file's bytes, no SVG; saved under `platform/logos` in the public bucket; audited |
| DELETE | /logo | platform.settings.manage | Clear the logo (and remove its file if it is in `platform/logos`); safe to repeat; audited |

The update DTO accepts optional platformName, supportEmail, supportPhone, termsUrl, privacyPolicyUrl, subscriptionGracePeriodDays, reminderDaysBeforeExpiry, defaultTrialDays, allowNewRegistrations, maintenanceMode, maintenanceMessage and announcementBanner.

## Configuration fields and consumers

| Field | Default/constraint | Consumer |
|---|---|---|
| platformName | SchoolPortal; 1–100 chars | Public branding |
| supportEmail | support@schoolportal.com; valid email | Public support contact |
| supportPhone | optional | Public support contact |
| logoUrl | Set only by the upload/clear endpoints; sending it in PUT is refused | Public branding |
| termsUrl/privacyPolicyUrl | optional; https only, no embedded login, up to 2048 chars; null or empty clears | Public legal links |
| subscriptionGracePeriodDays | 0–90 | Subscription billing lifecycle/dunning |
| reminderDaysBeforeExpiry | 0–30 | Subscription reminders |
| defaultTrialDays | 0–90 | New school subscription/provisioning |
| allowNewRegistrations | boolean | School registration gate |
| maintenanceMode | boolean | Global maintenance middleware/UI |
| maintenanceMessage | optional text | Maintenance UI |
| announcementBanner | optional text | Public/school banner |

The route returns the mapper's public response shape: platformName, support email/phone, logo, legal URLs, grace/reminder/trial settings, registration/maintenance flags and banner. Other PlatformSettings model fields are not returned by this mapper.

## Persistence and initialization

Public model: PlatformSettings. The model has a UUID primary key but no singleton key/unique constraint. Repository find() uses findFirst(); if no row exists it creates one. Update first calls find() and updates that row.

The module does not expose delete or list endpoints. It assumes one global settings row, but the database does not enforce that invariant.

## Security considerations

The GET endpoint is intentionally public because its response is used by the public site and login/onboarding screens. The update endpoint is platform-realm and requires sensitive platform.settings.manage permission.

The logo is never typed in: it is uploaded to our own Supabase public bucket, so the stored link is always ours (same rules as a school logo). `termsUrl` and `privacyPolicyUrl` accept only https links (javascript:, data:, http: and links with an embedded login are refused). The mapper checks stored values again on the way out and hides any unsafe one, so a value saved before the rules tightened is not served. Run `npm run report:platform-settings-urls` (read-only) to list stored values that break the rules; a legacy typed-in logo link must be re-uploaded. On the web side, `next/image` hosts are built from `SUPABASE_URL` (see apps/web/.env.local.example).

UpdatePlatformSettingsUseCase does not inject or call AuditService. Changes to maintenance mode, registration availability, grace periods and public legal/branding configuration are not recorded by the shared audit module.

## Tests and verification status

Platform-settings tests: `apps/api/tests/settings/platform-settings.test.ts` (link validation, logo upload/clear rules, audit, mapper hiding). Earlier note: no dedicated test file existed. The module's DTO, repository initialization, public read, platform permission and update behavior were not covered by an inspected automated suite.

Not executed: tests, typecheck, build, public DB migration, public GET/PUT HTTP calls or concurrent first-read initialization.

## Open implementation and verification items

1. (Done) Logo is upload-only; terms/privacy links are https only and nullable.
2. Add a real singleton invariant for PlatformSettings and make first-row initialization atomic/upsert-based. Concurrent public GETs must not create duplicate rows.
3. Logo upload and removal are audited (`platform.logo_changed`, `platform.logo_removed`). Still open: inject AuditService into the general update and record before/after changes, especially maintenance mode, registration switch and subscription grace/trial policies.
4. Add tests for public response shape, update permission, URL protocol validation, settings initialization concurrency and audit.
5. Define which settings are safe to expose publicly and keep all secret provider/email credentials out of this response.
6. Run typecheck/build and public database checks before rollout.

## Source paths reviewed

- apps/api/src/modules/platform-settings/routes/platform-settings.route.ts
- apps/api/src/modules/platform-settings/controllers/platform-settings.controller.ts
- apps/api/src/modules/platform-settings/dtos/platform-settings.dto.ts
- apps/api/src/modules/platform-settings/domain/platform-settings.entity.ts
- apps/api/src/modules/platform-settings/mappers/platform-settings.mapper.ts
- apps/api/src/modules/platform-settings/platform-settings.permissions.ts
- apps/api/src/modules/platform-settings/platform-settings.container.ts
- apps/api/src/modules/platform-settings/usecases/
- apps/api/src/modules/platform-settings/repositories/platform-settings.repository.impl.ts
- apps/api/src/modules/subscriptions/services/billing-lifecycle.service.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/public.prisma
