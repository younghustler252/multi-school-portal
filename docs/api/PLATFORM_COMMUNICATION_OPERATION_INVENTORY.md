# Platform, Identity, Billing and Communications API Operation Inventory

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. Source-derived route inventory; not runtime-verified and not yet a canonical OpenAPI contract. The operation count is based on Express route declarations in the reviewed files, including the separately mounted provider webhook ingress.

## Scope and count

| Area | Route files | Operations |
|---|---:|---:|
| Authentication and invitations | 1 | 17 |
| User profile, access and platform account support | 1 | 13 |
| School profile and platform school administration | 2 | 24 |
| Public plans and platform plan administration | 2 | 10 |
| School billing and platform subscription administration | 2 | 22 |
| School and platform audit | 2 | 2 |
| Notifications | 1 | 9 |
| Message templates | 1 | 5 |
| Automation | 1 | 6 |
| Platform settings | 1 | 2 |
| School settings | 1 | 6 |
| Webhook provider ingress and platform console | 1 | 5 |
| Feedback | 1 | 7 |
| **Total** | **17** | **128** |

Counts are route declarations, not unique URL strings. The provider webhook ingress is a separate exported router in the webhook route file and is counted in addition to the four platform-console declarations.

## Global contract rules

- All listed routes are mounted under `/api/v1`, except where explicitly described as a separately mounted provider webhook ingress (also `/api/v1/webhooks`).
- School routes use the school tenant context and relevant school permissions/persona guards. Platform routes use platform permissions and must not be documented as school-tenant operations.
- Authentication endpoints intentionally mix public, authenticated and tenant-host-bound operations. A single blanket bearer-security declaration would be inaccurate.
- The authenticated actor is derived from the verified session. Do not accept actor identity from request bodies.
- DTO validation is route-specific. Several read operations have no route-level DTO middleware; inspect controllers/use cases for parsing/defaults.
- File uploads use multipart handling and may restore tenant context after Multer. Document exact field names, size limits and content types from route/controller source before generating client types.
- This inventory lists route-level guards. Some operations have additional use-case checks, such as linked-child ownership, persona, school verification, plan entitlement or state-transition rules.

## Authentication and invitations — 17 operations

Mount: `/auth`.

| Method | Path | Access / notable middleware | Request DTO |
|---|---|---|---|
| POST | `/register` | Public; auth limiter | `RegisterDto` |
| POST | `/verify-email` | Public; OTP limiter | `VerifyEmailDto` |
| POST | `/resend-otp` | Public; OTP limiter | `ResendOtpDto` |
| POST | `/forgot-password` | Public; OTP limiter | `ForgotPasswordDto` |
| POST | `/reset-password` | Public; OTP limiter | `ResetPasswordDto` |
| POST | `/login` | Public; auth limiter | `LoginDto` |
| POST | `/refresh` | Public refresh-token flow; auth limiter | Refresh cookie/body contract requires controller inspection |
| POST | `/logout` | Public access-token-wise; refresh token identifies session; auth limiter | Controller-defined |
| POST | `/exchange-impersonation-token` | Tenant context + auth limiter | `ImpersonationExchangeDto` |
| POST | `/logout-all` | Authenticated | — |
| POST | `/switch-persona` | Authenticated + tenant context | `SwitchPersonaDto` |
| POST | `/invite/validate` | Public invitee flow + tenant context + auth limiter | `ValidateInviteDto` |
| POST | `/invite/accept` | Public invitee flow + tenant context + auth limiter | `AcceptInviteDto` |
| POST | `/invite/send` | Authenticated school member; `users.invite` | `SendInviteDto` |
| GET | `/invites` | Authenticated school member; `users.invite` | Query/controller-defined |
| POST | `/invites/:id/revoke` | Authenticated school member; `users.invite` | — |
| POST | `/invites/:id/resend` | Authenticated school member; `users.invite` | — |

Important auth semantics: login uses per-(email + IP) attempt tracking in addition to the route IP limiter; generic invalid-credential responses avoid revealing account membership. Invite acceptance supports existing and new global accounts, claims the invite atomically, and compensates on failure across public and tenant data stores. Persona switching is tenant-bound. Impersonation-token exchange is separate from the platform school impersonation initiation endpoint.

## Users — 13 operations

Mount: `/users`.

| Method | Path | Access / notable behavior |
|---|---|---|
| GET | `/me` | Authenticated; loads current access |
| PUT | `/me` | Authenticated; `UpdateProfileDto` |
| PUT | `/me/password` | Authenticated; tenant ownership validation; `ChangePasswordDto`; returns fresh session per route comment |
| POST | `/me/avatar` | Authenticated; avatar multipart field; 2 MB maximum; tenant context re-established after upload |
| DELETE | `/me/avatar` | Authenticated |
| GET | `/me/access` | Authenticated; current login's school/access switcher data |
| GET | `/me/permissions` | Authenticated; current session permissions/scopes/branches |
| GET | `/me/sessions` | Authenticated; tenant ownership validation |
| DELETE | `/me/sessions/:id` | Authenticated; tenant ownership validation |
| POST | `/schools/:schoolId/admin/reset-password` | Platform permission `platform.users.manage`; `ResetAdminPasswordDto` |
| GET | `/:id` | Platform permission `platform.users.manage` |
| POST | `/:id/deactivate` | Platform permission `platform.users.manage`; `DeactivateUserDto` |
| POST | `/:id/reactivate` | Platform permission `platform.users.manage` |

The `/me` routes are current-account operations. The last four are platform support/account administration and must not be exposed as ordinary school-user profile routes.

## School profile and platform school administration — 24 operations

### School self-service — mount `/schools`

| Method | Path | Access / notable behavior |
|---|---|---|
| GET | `/public/:subdomain` | Public school discovery for login |
| GET | `/` | Authenticated school tenant; `school.view` |
| PUT | `/` | `school.update`; `UpdateSchoolDto` |
| POST | `/logo` | `school.update`; multipart `logo`, 2 MB maximum; upload limiter |
| GET | `/documents` | `school.documents.manage` |
| POST | `/documents` | `school.documents.manage`; multipart `document`, 5 MB maximum; `UploadDocumentDto` |
| POST | `/payment-setup` | `school.payments.manage`; requires verified school; `SetupPaymentDto` |
| GET | `/dashboard` | `school.dashboard.view` |
| GET | `/setup-checklist` | `school.update` |

### Platform school administration — mount `/platform/schools`

| Method | Path | Permission / DTO |
|---|---|---|
| GET | `/` | `platform.schools.view` |
| POST | `/` | `platform.schools.create`; `CreateSchoolDto` |
| GET | `/overview` | `platform.overview.view` |
| GET | `/provisioning` | `platform.schools.provisioning` |
| POST | `/:id/provisioning/retry` | `platform.schools.provisioning.retry` |
| PUT | `/documents/:documentId/approve` | `platform.schools.verify` |
| PUT | `/documents/:documentId/reject` | `platform.schools.verify`; `RejectDocumentDto` |
| POST | `/:id/impersonate` | `platform.schools.impersonate` |
| GET | `/:id` | `platform.schools.view` |
| PUT | `/:id` | `platform.schools.manage`; `PlatformUpdateSchoolDto` |
| GET | `/:id/documents` | `platform.schools.documents` |
| PUT | `/:id/verify` | `platform.schools.verify`; `VerifySchoolDto` |
| PUT | `/:id/reject` | `platform.schools.verify`; `RejectSchoolDto` |
| PUT | `/:id/suspend` | `platform.schools.suspend`; `SuspendSchoolDto` |
| PUT | `/:id/reactivate` | `platform.schools.suspend` |

Platform school provisioning, verification, suspension and impersonation are privileged operations. The school-side payment setup endpoint separately requires verified-school status.

## Plans — 10 operations

### Public plan catalogue — mount `/plans`

| Method | Path | Access |
|---|---|---|
| GET | `/` | Public |
| GET | `/:id` | Public |

### Platform plan administration — mount `/platform/plans`

| Method | Path | Permission / DTO |
|---|---|---|
| GET | `/` | `platform.plans.view` |
| POST | `/` | `platform.plans.manage`; `CreatePlanDto` |
| GET | `/:id` | `platform.plans.view` |
| PUT | `/:id` | `platform.plans.manage`; `UpdatePlanDto` |
| PUT | `/:id/entitlements` | `platform.plans.manage`; `SetEntitlementsDto` |
| PUT | `/:id/deactivate` | `platform.plans.manage` |
| PUT | `/:id/reactivate` | `platform.plans.manage` |
| POST | `/:id/clone` | `platform.plans.manage`; `ClonePlanDto` |

## Subscriptions and billing — 22 operations

### School subscription — mount `/subscriptions`

The route file composes shared `view` and `manage` middleware arrays; resolve their exact permission/persona and tenant guards from the route source before final OpenAPI security annotation.

| Method | Path | DTO / behavior |
|---|---|---|
| GET | `/` | Subscription summary |
| POST | `/preview` | `PreviewChangeDto`; preview plan change |
| POST | `/change-plan` | `ChangePlanDto`; auth limiter |
| GET | `/verify` | Verify current billing/payment state |
| GET | `/invoices` | School invoices |
| GET | `/invoices/:id` | Invoice detail |
| POST | `/invoices/:id/pay` | Pay invoice; auth limiter |
| POST | `/downgrade` | `RequestDowngradeDto` |
| DELETE | `/downgrade` | Cancel pending downgrade |
| POST | `/cancel` | `CancelSubscriptionDto` |
| POST | `/resume` | Resume subscription |
| PUT | `/auto-renew` | `ToggleAutoRenewDto` |
| GET | `/payment-methods` | List payment methods |
| DELETE | `/payment-methods/:id` | Remove payment method |

### Platform subscription administration — mount `/platform/subscriptions`

| Method | Path | Permission / DTO |
|---|---|---|
| GET | `/` | `platform.subscriptions.view` |
| GET | `/stats` | `platform.subscriptions.view` |
| GET | `/invoices` | `platform.subscriptions.view` |
| PUT | `/invoices/:id/void` | `platform.subscriptions.manage`; `VoidInvoiceDto` |
| PUT | `/invoices/:id/mark-paid` | `platform.subscriptions.manage`; `MarkInvoicePaidDto` |
| GET | `/:schoolId` | `platform.subscriptions.view` |
| PUT | `/:schoolId/plan` | `platform.subscriptions.manage`; `PlatformChangePlanDto` |
| PUT | `/:schoolId/extend` | `platform.subscriptions.manage`; `ExtendPeriodDto` |

## Audit — 2 operations

| Method | Full path | Access |
|---|---|---|
| GET | `/api/v1/audit` | Authenticated school tenant; `audit.view` |
| GET | `/api/v1/platform/audit` | Authenticated platform principal; `platform.audit.view` |

The school and platform audit feeds are distinct access boundaries. Query filters, actor attribution, pagination and date semantics require controller/use-case verification.

## Notifications — 9 operations

Mount: `/notifications`.

| Method | Path | Access / DTO |
|---|---|---|
| GET | `/school` | School tenant; `notifications.view`; `ListNotificationsDto` query |
| POST | `/school` | School tenant; `notifications.send`; `SendSchoolNotificationDto` |
| GET | `/me` | Authenticated STAFF/STUDENT/GUARDIAN; `ListNotificationsDto` query |
| PATCH | `/me/read-all` | Authenticated STAFF/STUDENT/GUARDIAN |
| PATCH | `/me/:recipientId/read` | Authenticated STAFF/STUDENT/GUARDIAN; own recipient row only |
| GET | `/platform-inbox` | School tenant; `notifications.platform.view`; `ListNotificationsDto` query |
| PATCH | `/platform-inbox/:recipientId/read` | School tenant; `notifications.platform.view` |
| GET | `/platform` | Platform permission `platform.notifications.view`; `ListNotificationsDto` query |
| POST | `/platform` | Platform permission `platform.notifications.send`; `SendPlatformNotificationDto` |

School notifications and platform notifications have different audiences and guards. Email/SMS delivery additionally depends on plan features and school preferences as described in route comments.

## Message templates — 5 operations

Mount: `/message-templates`. All operations use school tenant guards.

| Method | Path | Permission / DTO |
|---|---|---|
| GET | `/` | `message_templates.view` |
| GET | `/:key` | `message_templates.view` |
| PUT | `/:key/:channel` | `message_templates.manage`; `SaveTemplateDto` |
| DELETE | `/:key/:channel` | `message_templates.manage`; reset override |
| POST | `/:key/:channel/preview` | `message_templates.manage`; `PreviewTemplateDto` |

## Automation — 6 operations

Mount: `/automations`. All operations use authenticated school tenant and the listed permission.

| Method | Path | Permission / behavior |
|---|---|---|
| GET | `/` | `automation.view`; list definitions/settings and recent run context |
| GET | `/:id` | `automation.view`; definition and recent runs |
| PATCH | `/:id` | `automation.manage`; `UpdateAutomationDto` |
| POST | `/:id/dry-run` | `automation.manage`; preview recipients/content, sends nothing |
| POST | `/:id/run` | `automation.manage`; execute now |
| GET | `/:id/runs` | `automation.view`; execution history |

Manual run and dry-run are distinct side-effect contracts. The route comments state that the same message is not sent twice to the same person; scheduler recovery and occurrence idempotency are covered by existing remediation entries.

## Platform settings — 2 operations

Mount: `/platform/settings`.

| Method | Path | Access / DTO |
|---|---|---|
| GET | `/` | Public; no authentication or tenant resolution |
| PUT | `/` | Authenticated platform principal; `platform.settings.manage`; `UpdatePlatformSettingsDto` |

Existing remediation items REM-081 and REM-082 cover unsafe URL protocol validation and missing audit logging for platform setting changes. Do not duplicate those findings in a new handoff.

## School settings — 6 operations

Mount: `/school-settings`. All routes use authenticated school tenant guards.

| Method | Path | Permission / DTO |
|---|---|---|
| GET | `/` | `school_settings.view` |
| PUT | `/` | `school_settings.manage`; `UpdateSchoolSettingsDto` |
| GET | `/preferences` | `school_settings.view` |
| PUT | `/preferences` | `school_settings.manage`; `UpdateSchoolPreferencesDto` |
| POST | `/stamp` | `school_settings.manage`; multipart upload field `stamp`; tenant context re-established |
| POST | `/signature` | `school_settings.manage`; multipart upload field `signature`; tenant context re-established |

The two upload declarations shown do not include an explicit route-local Multer size limit in this route file. Inspect the shared upload configuration and storage validation before documenting limits.

## Webhooks — 5 operations

### Provider ingress — mount `/api/v1/webhooks` directly in `app.ts`

| Method | Path | Access / behavior |
|---|---|---|
| POST | `/:provider` | Public provider callback; dedicated webhook limiter; raw `application/json` bytes retained, 1 MB limit; signature verification handled downstream |

This router is mounted before the global JSON parser so the provider signature is checked against the original raw bytes. Do not model it as an authenticated user bearer-token endpoint.

### Platform webhook console — mount `/platform/webhooks`

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `platform.webhooks.view` |
| GET | `/summary` | `platform.webhooks.view` |
| GET | `/:id` | `platform.webhooks.view` |
| POST | `/:id/retry` | `platform.webhooks.retry` |

The console's event filters and retry semantics are described in route comments and require controller/use-case inspection for exact parameter and response schemas.

## Feedback — 7 operations

Mount: `/feedback`.

| Method | Path | Access / DTO |
|---|---|---|
| POST | `/` | Authenticated; `SubmitFeedbackDto` |
| GET | `/my` | Authenticated; current user's feedback |
| GET | `/` | Platform permission `platform.feedback.manage`; `ListFeedbackDto` query |
| GET | `/:id` | Platform permission `platform.feedback.manage` |
| PATCH | `/:id/status` | Platform permission `platform.feedback.manage`; `UpdateFeedbackStatusDto` |
| PATCH | `/:id/respond` | Platform permission `platform.feedback.manage`; `RespondToFeedbackDto` |
| DELETE | `/:id` | Platform permission `platform.feedback.manage` |

Existing remediation items REM-106 and REM-107 cover feedback submission abuse controls and unsafe/un-normalized `pageUrl` handling.

## Findings and remediation pointers

The authoritative cumulative issue list is **`docs/backend/BACKEND_REMEDIATION_REGISTER.md`**. Keep that as the single developer handoff; do not scatter new issues across ad hoc notes.

Relevant existing entries surfaced during this pass include:
- REM-081 / REM-082 — Platform Settings URL validation and audit logging.
- REM-087 / REM-088 — Automation default initialization concurrency and lost scheduled occurrence recovery.
- REM-091 onward — Audit behavior and test coverage (confirm exact IDs/status in the register before assigning work).
- REM-104 / REM-105 — Webhook integration verification and event-key fallback robustness.
- REM-106 / REM-107 — Feedback rate limiting/abuse control and safe `pageUrl` handling.

The auth route file contains a comment referring to an older defect label for IP-based limiting, while the current login use case also enforces per-(email + IP) failed-attempt tracking. Treat the current implementation as layered controls; do not raise a duplicate finding without reconciling the older defect reference and current tests.

## Contract verification still required

1. Inspect controllers and DTOs for every operation to capture actual request/response schemas, status codes, response envelopes and error variants.
2. Resolve school subscription's shared `view`/`manage` guard arrays into exact permission/persona/tenant requirements.
3. Inspect public plan visibility and whether inactive plans are filtered from public reads.
4. Verify school/platform separation for notifications, audit, feedback and settings with HTTP tests.
5. Inspect all upload controller/storage constraints, especially school stamp/signature.
6. Verify webhook raw-body signature behavior and retry authorization/claim semantics through the mounted Express application.
7. Confirm automation manual-run idempotency and scheduled-run recovery behavior against the existing remediation entries.
8. No runtime HTTP tests, typecheck, build, provider sandbox calls or database concurrency tests were run for this inventory.

## Source files reviewed

- `apps/api/src/modules/auth/routes/auth.routes.ts`
- `apps/api/src/modules/user/routes/user.routes.ts`
- `apps/api/src/modules/school/routes/school.routes.ts`
- `apps/api/src/modules/school/routes/school.platform.routes.ts`
- `apps/api/src/modules/plans/routes/plan.routes.ts`
- `apps/api/src/modules/plans/routes/plan.platform.routes.ts`
- `apps/api/src/modules/subscriptions/routes/billing.routes.ts`
- `apps/api/src/modules/subscriptions/routes/billing.platform.routes.ts`
- `apps/api/src/modules/audit/routes/audit.routes.ts`
- `apps/api/src/modules/audit/routes/audit.platform.routes.ts`
- `apps/api/src/modules/notifications/routes/notification.routes.ts`
- `apps/api/src/modules/message-templates/routes/message-template.routes.ts`
- `apps/api/src/modules/automation/routes/automation.routes.ts`
- `apps/api/src/modules/platform-settings/routes/platform-settings.route.ts`
- `apps/api/src/modules/school-settings/routes/school-settings.routes.ts`
- `apps/api/src/modules/webhooks/routes/webhook.routes.ts`
- `apps/api/src/modules/feedback/routes/feedback.routes.ts`

## Next step

Finish the remaining module families in the route inventory, then inspect controller/DTO/use-case behavior across all operation inventories. Only after that should the canonical OpenAPI 3.1 file be authored and validated against live HTTP tests.
