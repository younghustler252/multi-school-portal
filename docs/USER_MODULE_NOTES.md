# User module pass: apply notes

## Apply
1. Copy `modules/user/*` over the old module. **Delete**: `domain/user.enums.ts`, `domain/user.entity.ts`, `usecases/reser-school-admin-password.usecase.ts` (replaced by `reset-school-admin-password.usecase.ts`).
2. Copy the 5 changed auth files in `modules/auth/` (they extend the auth pass; nothing else in auth changes):
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

## Open / deferred
- Change email is not built: it needs a pending-email field and a verification step, which belongs with a later settings pass.
- Old avatar files stay in the bucket until the storage service gets a delete method.
- Impersonated actions are audited under the impersonated user (cross-cutting fix for the audit pass; `update-profile` already records `impersonatedBy`).
- Docs update (section 0.3): permission `platform.users.manage`; user module status Done; error codes above; template `auth.password_reset_by_support`.
