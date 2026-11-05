# User module pass: apply notes\n\n> **Documentation status:** Historical apply handoff. Do not execute copy/delete instructions as written. Current backend source lives under `apps/api/`; use the source comparison below for the currently observed route and DI contract.

## Apply
1. Copy `modules/user/*` over the old module. **Delete**: `domain/user.enums.ts`, `domain/user.entity.ts`, `usecases/reser-school-admin-password.usecase.ts` (replaced by `reset-school-admin-password.usecase.ts`).
2. Copy the 5 changed auth files in `modules/auth/` (they extend the auth pass; nothing else in auth changes)pris:
   `services/auth-audit.service.ts` (optional `module`, `oldValue`, `newValue`), `repositories/refresh-token.repository(.impl).ts` (`listActiveForUser`), `services/membership.service.ts` (`listActiveUserIdsByRoleKey`), `auth.templates.ts` (new template `auth.password_reset_by_support`, reworded `auth.password_changed`). Re-run `syncAuthTemplates`; existing rows keep their old wording (wording is data), so edit `auth.password_changed` in the console if you want the new text.
3. `registerUser` must come after `registerAuth` in the container list.
4. Register permission key `platform.users.manage` (see `user.permissions.ts`) and give it to the platform roles that may reset passwords.
5. No schema change.

## What changed (gap review fixes)
- Removed dependence on `refreshTokenRepository.deleteByUserId` and `AuditService.log`; uses `revokeAllForUser` and `AuthAuditService`.
- Profile no longer exposes legacy `role` / `schoolId`; it returns `session { kind, schoolId, persona, impersonating }`. The `passwordChangedAt: null` workaround is gone.
- Change password: rate limited like a login, tenant password policy, blocked while impersonating, revokes all sessions then **issues a fresh session** (clears `mustChangePassword`) so a forced change no longer needs a second login.
- Avatar: JPEG/PNG/WebP only (checked by file signature, not the client mimetype), 2 MB, server-generated file name, multer errors mapped to the standard error shape; `reestablishTenantContext` after multer.
- Identity from `req.auth`, not `req.user`. Update profile is `strict()` and audited with before/after.

## New use cases
Remove avatar, list my access (profile + school switchers), list/revoke my sessions (devices), reset school admin password (platform support action, rewritten from the commented-out file for the membership model).

## Frontend contract
- `GET /me`: `{ id, email, firstName, lastName, phone, photoUrl, isEmailVerified, lastLoginAt, createdAt, session{kind,schoolId,persona,impersonating} }`. `role` and `schoolId` at top level are gone.
- `PUT /me` body `{ firstName?, lastName?, phone? (null clears) }`, at least one field; unknown keys are rejected.
- `PUT /me/password` `{ currentPassword, newPassword, confirmPassword }` now returns the same `AUTHENTICATED` shape as login (`user, session, tokens`) and sets new cookies. **Do not send the user to the login page afterwards.** Codes: `CURRENT_PASSWORD_INCORRECT`, `SAME_PASSWORD`, `WEAK_PASSWORD`, `IMPERSONATION_RESTRICTED`, `LOGIN_RATE_LIMITED`.
- `POST /me/avatar` (multipart field `avatar`), `DELETE /me/avatar`; code `INVALID_IMAGE`.
- `GET /me/access`: `{ personas[{persona,current}], schools[{id,name,url,current}] }` (personas only on a school host).
- `GET /me/sessions`: `[{ id, device, ipAddress, schoolId, lastActiveAt, current }]`; `DELETE /me/sessions/:id` (response `signedOut: true` when it was the current one).
- `POST /schools/:schoolId/admin/reset-password` body `{ userId? }` (platform host, needs `platform.users.manage`); codes `ADMIN_AMBIGUOUS` (several administrators: send `userId`), NOT_FOUND.

## Platform-wide user deactivation (closes a previously-flagged gap)
`User.isActive` already gated every auth flow (login, refresh, switch-persona, impersonation exchange,
forgot/reset password, invite acceptance, resend-otp) — but nothing could ever flip it to `false` except
registration's own initial unverified state. There was no platform support action to suspend or restore
an account. `ManagePlatformUsersUseCase` (`modules/user/usecases/manage-platform-users.usecase.ts`) adds it:
- `GET /users/:id` — look up any user by id (`platform.users.manage`): `{ id, email, firstName, lastName, isActive, lastLoginAt }`.
- `POST /users/:id/deactivate` body `{ reason? }` — sets `isActive=false`, revokes every refresh-token
  session immediately (not just future logins), audits `user.deactivated` (reason in `metadata`, never shown
  to the user). Idempotent: deactivating an already-inactive user is a no-op that returns the current state.
- `POST /users/:id/reactivate` — sets `isActive=true`, clears `failedLoginCount`/`lockedUntil`, audits
  `user.reactivated`. Idempotent the same way.
- Self-action is always refused (`USER_SELF_ACTION`, 403) — a platform user can never deactivate or
  reactivate their own account through this route.
- Deliberately independent of any school's own tenant Membership/Staff/Student status: a school can still
  suspend its own staff or students locally (`modules/staff`, `modules/students`) without this ever being
  involved. This route locks the account out of **every** school at once (the public cross-school login
  identity), for abuse/fraud/offboarding-level platform action — not for day-to-day school admin use.
- Tests: `apps/api/tests/user/manage-platform-users.test.ts` (9 cases: self-action block, not-found, happy
  path + audit + session revocation, idempotency both directions, reactivate clears lockout state).

## Open / deferred
- Change email is not built: it needs a pending-email field and a verification step, which belongs with a later settings pass.
- Old avatar files stay in the bucket until the storage service gets a delete method.
- Impersonated actions are audited under the impersonated user (cross-cutting fix for the audit pass; `update-profile` already records `impersonatedBy`).
- Docs update (section 0.3): permission `platform.users.manage`; user module status Done; error codes above; template `auth.password_reset_by_support`.


---

## 7. Source comparison — 2026-11-05

**Status: historical apply handoff + source-reviewed implementation notes.** Current source snapshot: branch `refactor/modules`; key files include `apps/api/src/modules/user/routes/user.routes.ts`, `user.container.ts`, `user.permissions.ts`, the User use cases, and `apps/api/src/container/index.ts`.

### Confirmed in current source

- The User module currently registers profile read/update, password change, avatar upload/removal, access listing, session management, school-admin password reset, and platform-wide user management use cases.
- User routes are mounted at `/api/v1/users`. Personal profile/access/session routes authenticate the caller; platform support routes use `platform.users.manage`.
- Avatar upload uses in-memory Multer storage with a 2 MB limit, then calls `reestablishTenantContext`. The route maps Multer errors to `INVALID_IMAGE`.
- `PUT /me/password` uses tenant ownership validation and DTO validation; it intentionally does not use the normal `loadAccess` chain because it supports the forced-password-change flow described in the use-case notes.
- Platform-wide account endpoints are `GET /api/v1/users/:id`, `POST /api/v1/users/:id/deactivate`, and `POST /api/v1/users/:id/reactivate`.
- School-admin reset is mounted as `POST /api/v1/users/schools/:schoolId/admin/reset-password` (not `/api/v1/schools/:schoolId/admin/reset-password`). The old section 4 endpoint should be read with this full mount prefix.
- `registerUser` is active in the container and is listed after `registerAuth`. It is also before School's later dependants only insofar as the registration list is concerned; current User container comments require Auth and shared storage services.

### Permission contract observed

`user.permissions.ts` defines one platform permission: `platform.users.manage`, marked sensitive and ALL-scoped. The source route applies it to password reset, platform user lookup, deactivation and reactivation. Personal self-service routes rely on authentication rather than this platform permission.

### Test coverage observed (not executed in this documentation pass)

`apps/api/tests/user/manage-platform-users.test.ts` contains nine focused cases covering safe lookup, not-found, self-action rejection, deactivation/session revocation/audit, idempotency, and reactivation/lockout reset. No additional files were present in the inspected `apps/api/tests/user` directory. This does not establish that all profile, password, avatar, access, session and reset flows are covered elsewhere.

### Follow-up items

1. Add tests for profile DTO strictness and audit, password-change session replacement and impersonation restriction, avatar signature/size/context behavior, access listing, session revocation, and school-admin password reset.
2. Verify `platform.users.manage` is included in the deployed permission sync and granted only to intended platform roles; the module-local constant does not prove database synchronization.
3. Review the platform-user deactivation use case's interaction with in-flight access tokens separately from refresh-token revocation. The source route/use case and focused tests establish refresh-token revocation; this source comparison did not establish immediate invalidation of already-issued JWT access tokens.
4. No build, tests, migration, or live API request was run as part of this documentation comparison.
