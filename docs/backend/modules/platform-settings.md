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
| PUT | / | platform.settings.manage | Update supplied platform fields |

The update DTO accepts optional platformName, supportEmail, supportPhone, logoUrl, termsUrl, privacyPolicyUrl, subscriptionGracePeriodDays, reminderDaysBeforeExpiry, defaultTrialDays, allowNewRegistrations, maintenanceMode, maintenanceMessage and announcementBanner.

## Configuration fields and consumers

| Field | Default/constraint | Consumer |
|---|---|---|
| platformName | SchoolPortal; 1–100 chars | Public branding |
| supportEmail | support@schoolportal.com; valid email | Public support contact |
| supportPhone | optional | Public support contact |
| logoUrl | optional URL | Public branding |
| termsUrl/privacyPolicyUrl | optional URL | Public legal links |
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

The DTO currently uses z.string().url() for logoUrl, termsUrl and privacyPolicyUrl without restricting URL protocol. This differs from School Settings, which explicitly restricts web links to http/https and letterhead links to https only. Restrict platform public links to http/https before returning them to the browser.

UpdatePlatformSettingsUseCase does not inject or call AuditService. Changes to maintenance mode, registration availability, grace periods and public legal/branding configuration are not recorded by the shared audit module.

## Tests and verification status

No dedicated platform-settings test file was found in apps/api/tests. The module's DTO, repository initialization, public read, platform permission and update behavior were not covered by an inspected automated suite.

Not executed: tests, typecheck, build, public DB migration, public GET/PUT HTTP calls or concurrent first-read initialization.

## Open implementation and verification items

1. Restrict logoUrl, termsUrl and privacyPolicyUrl to http/https; reject javascript:, data: and other non-web protocols.
2. Add a real singleton invariant for PlatformSettings and make first-row initialization atomic/upsert-based. Concurrent public GETs must not create duplicate rows.
3. Inject AuditService and record before/after changes for platform settings, especially maintenance mode, registration switch and subscription grace/trial policies.
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
