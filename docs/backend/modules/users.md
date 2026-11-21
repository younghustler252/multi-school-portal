# Users Module

> **Verification status:** Source-reviewed for route mounting, controller mappings, DTOs, primary use cases, permission declaration and focused platform-user tests. Profile/avatar/session/reset flows have not been runtime-tested in this documentation pass.
> **Source snapshot:** `refactor/modules`, source snapshot recorded as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/user/`
> **Route mount:** `/api/v1/users`, registered in `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

The Users module owns operations on the authenticated public user identity and platform-level user support actions:

- Read and update the caller's profile.
- Change the caller's password.
- Upload or remove the caller's avatar reference.
- List the caller's school/persona access.
- List and revoke the caller's active sessions.
- Reset a school's administrator password (platform support).
- Look up, deactivate and reactivate public user accounts (platform support).

It reuses Auth-owned user, refresh-token, membership, password, session, policy, message and audit services. School-specific staff/student/guardian records and school role membership are not managed as generic user profile fields.

## 2. Architecture and dependencies

| Layer | Source location | Responsibility |
|---|---|---|
| Routes | `routes/user.routes.ts` | Authentication, access loading, multipart upload and platform permission guards |
| Controller | `controllers/user.controller.ts` | Derives actor context from verified token and maps requests to use cases |
| DTOs | `dtos/user.dto.ts` | Profile, password, admin-reset and deactivation validation |
| Use cases | `usecases/*.usecase.ts` | Profile, avatar, access, session and support workflows |
| Mapper | `mappers/user.mapper.ts` | Safe profile response projection |
| Permissions | `user.permissions.ts` | Platform support permission declaration |
| Container | `user.container.ts` | Awilix registrations |

The controller derives `userId`, `schoolId`, `membershipId` and impersonation state from `req.auth`. It does not trust caller identity from the request body or URL.

The container expects Auth to be registered first and shared storage to be registered. The current registration order places Auth before User.

## 3. Identity and data ownership

The public `User` row represents the global login identity. The current session context is supplied by the access token and may be either:

- A school session, with `schoolId` and tenant `membershipId`.
- A platform session, with null `schoolId` and a platform membership ID.

The profile mapper returns identity fields plus a session descriptor. It does not make a user-row role or school field the authority for permissions.

Platform-wide deactivation changes public `User.isActive` and revokes refresh sessions. This is distinct from a school locally suspending a staff/student/guardian membership or person record.

## 4. API endpoints

All paths below are full paths under `/api/v1/users`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /me` | Authenticated; `loadAccess` | Get caller's profile with current persona/session context |
| `PUT /me` | Authenticated; `loadAccess`; UpdateProfileDto | Update caller's first name, last name or phone |
| `PUT /me/password` | Authenticated; tenant ownership validation; ChangePasswordDto | Change password and issue a fresh session |
| `POST /me/avatar` | Authenticated; `loadAccess`; multipart avatar; tenant context re-established after Multer | Upload caller's avatar |
| `DELETE /me/avatar` | Authenticated; `loadAccess` | Clear caller's avatar URL |
| `GET /me/access` | Authenticated; `loadAccess` | List personas in current school and schools available to this identity |
| `GET /me/sessions` | Authenticated; tenant ownership validation | List caller's active sessions |
| `DELETE /me/sessions/:id` | Authenticated; tenant ownership validation | Revoke one session family |
| `POST /schools/:schoolId/admin/reset-password` | Authenticated; `platform.users.manage`; ResetAdminPasswordDto | Reset a school administrator's password |
| `GET /:id` | Authenticated; `platform.users.manage` | Retrieve safe platform-wide user summary |
| `POST /:id/deactivate` | Authenticated; `platform.users.manage`; DeactivateUserDto | Deactivate a global user identity |
| `POST /:id/reactivate` | Authenticated; `platform.users.manage` | Reactivate a global user identity |

### Middleware notes

- Most personal routes use `authenticate` and `loadAccess`.
- `PUT /me/password` intentionally does not use `loadAccess`: it is the route exempted by Auth middleware for a session that must change its password. It still validates tenant ownership.
- Avatar upload uses in-memory Multer storage with a 2 MB limit. The route calls `loadAccess` before Multer, then `reestablishTenantContext` after Multer.
- Platform support routes use the platform permission guard and do not accept a caller-supplied actor identity.
- The school-admin password reset route is `/schools/:schoolId/admin/reset-password`, not a nested `/platform` path; platform realm authorization is enforced by its permission guard.

## 5. Request DTOs

### UpdateProfileDto — `PUT /me`

Strict object; unknown keys are rejected. At least one property must be supplied.

| Field | Rule |
|---|---|
| `firstName` | Optional; trimmed; 1–50 characters |
| `lastName` | Optional; trimmed; 1–50 characters |
| `phone` | Optional; nullable; trimmed; max 30 characters; null clears phone |

Email, password and role are not editable through this endpoint.

### ChangePasswordDto — `PUT /me/password`

Re-exported from Auth's password DTO:

- `currentPassword`: required, 1–128 characters.
- `newPassword`: required; 1–128 characters at DTO layer and subject to dynamic password policy in the use case.
- `confirmPassword`: required and must equal `newPassword`.

### ResetAdminPasswordDto — `POST /schools/:schoolId/admin/reset-password`

- `userId`: optional, non-empty string up to 64 characters.
- Required only when the school has more than one administrator; if there is exactly one administrator, the use case selects that account.

### DeactivateUserDto — `POST /:id/deactivate`

- `reason`: optional, trimmed, 3–500 characters.
- Strict object; unknown keys are rejected.
- Reason is stored in audit metadata and is not shown to the target user.

Avatar upload is multipart form data with field name `avatar`; no JSON DTO is used for the file itself.

## 6. Response contracts

All controller methods use the shared `sendSuccess` response helper, so the standard envelope is:

```json
{
  "success": true,
  "message": "…",
  "data": {}
}
```

The actual `data` shape depends on the operation.

### Profile response

`GET /me`, `PUT /me`, avatar upload and avatar removal return the profile projection:

- `id`, `email`
- `firstName`, `lastName`, `phone`
- `photoUrl`
- `isEmailVerified`
- `lastLoginAt`, `createdAt`
- `session.kind`: `school` or `platform`
- `session.schoolId`
- `session.persona`
- `session.impersonating`

### Other response data

| Endpoint | Data |
|---|---|
| `GET /me/access` | `{ personas: [{ persona, current }], schools: [{ id, name, url, current }] }` |
| `GET /me/sessions` | Array of active non-impersonation session summaries: `id, device, ipAddress, schoolId, lastActiveAt, current` |
| `DELETE /me/sessions/:id` | `{ signedOut: boolean }`; current session clears auth cookies |
| `PUT /me/password` | Authenticated session result with user, session and tokens; fresh cookies are set |
| `GET /:id` | Safe summary: `id, email, firstName, lastName, isActive, lastLoginAt` |
| `POST /:id/deactivate`, `POST /:id/reactivate` | Same safe user summary |
| `POST /schools/:schoolId/admin/reset-password` | `data: null`, with message describing email delivery of temporary password |

## 7. Business rules and workflows

### Profile update

Only first name, last name and phone are mutable through `PUT /me`. Changed values are recorded as before/after audit values. If submitted values are identical to stored values, no update or profile-update audit is written.

### Avatar upload

- Maximum size is 2 MB.
- Only JPEG, PNG and WebP signatures are accepted.
- The implementation inspects file bytes; it does not trust the client-supplied MIME type.
- The stored filename is generated by the server; the user-supplied filename is not used.
- The file is uploaded under `users/<userId>/avatar` through the shared Supabase storage service.
- The resulting URL is saved to `User.photoUrl`.

Removing an avatar clears the database URL. The current storage service does not expose a delete operation in this use case, so the uploaded object remains in the bucket. The remove use case currently does not write an audit event.

### Change password

- Not allowed while impersonating.
- Current-password checks use the Auth per-email/IP failure limiter.
- The new password must differ from the current password and satisfy the active password policy.
- All refresh-token sessions for the user are revoked.
- A fresh session is issued for the current device, school and membership; `mustChangePassword` is cleared.
- The controller replaces the auth cookies with the fresh token pair.

### Session management

- Session ID is the refresh-token `familyId`, stable across token rotations.
- The caller can see active sessions belonging to their own user identity.
- Impersonation sessions are filtered out.
- Revoking a session revokes its whole refresh-token family.
- If the revoked family is the current session, the controller clears the auth cookies.
- The displayed `lastActiveAt` currently maps to the active refresh row's `createdAt`, not a separate last-request timestamp.

### School administrator password reset

1. Look up the school in the public database.
2. Enter its tenant context.
3. Find active users holding the `school_admin` role.
4. Use the optional `userId` if it matches one of those admins; otherwise select the only admin if exactly one exists.
5. If multiple admins exist and no valid target is specified, return `ADMIN_AMBIGUOUS`.
6. Generate a temporary password, update the public user, set `mustChangePassword`, clear lockout and revoke all refresh sessions.
7. Record the support action and send the temporary password using the Auth-owned platform message template.

### Platform-wide deactivation/reactivation

- Deactivation blocks self-action.
- Deactivation flips public `User.isActive` to false and revokes every refresh-token session for that user.
- Repeated deactivation of an already inactive account is idempotent and does not repeat the revocation/audit side effects.
- Reactivation flips `isActive` to true and clears failed-login/lockout state.
- Repeated reactivation of an already active account is idempotent.
- School-local person/membership status is not changed by these platform-wide operations.

## 8. Permissions

The module declares one sensitive platform permission:

| Key | Realm | Scope | Persona | Sensitive |
|---|---|---|---|---|
| `platform.users.manage` | PLATFORM | ALL | STAFF | Yes |

It guards platform user lookup, deactivation/reactivation and school-admin password reset. Personal profile, password, avatar, access and session endpoints operate only on the authenticated caller and require authentication rather than a separate permission.

Permission-registry synchronization and deployed grants must be verified in the Foundation/Roles documentation; this declaration alone does not prove a grant exists in a given database.

## 9. Errors

User domain error factories define these stable codes:

- `CURRENT_PASSWORD_INCORRECT`
- `SAME_PASSWORD`
- `IMPERSONATION_RESTRICTED`
- `INVALID_IMAGE`
- `ADMIN_AMBIGUOUS`
- `USER_SELF_ACTION`

Not-found errors are produced by shared domain error classes for User, Session, School and School administrator. Additional errors may originate from Auth services, shared storage and the global error handler.

## 10. Tests and coverage

The inspected User test directory contains:

- `apps/api/tests/user/manage-platform-users.test.ts`: 9 focused tests for safe lookup, not-found, self-action prevention, deactivation, refresh-session revocation, audit reason, idempotency and reactivation lockout reset.

No tests were found in the inspected User test directory for profile update, password change, avatar validation/storage, access listing, session listing/revocation or school-admin password reset. This is a statement about the inspected directory, not proof that no broader integration test exercises those routes.

**Verification performed for this documentation:** source inspection only. Tests, typecheck, storage provider calls, mail delivery, migrations and live HTTP requests were not run.

## 11. Frontend integration requirements

1. Use `/api/v1/users` as the API prefix.
2. Derive the acting user from the authenticated session; never send a user ID to update the caller's profile.
3. Keep profile editing limited to first name, last name and phone. Send `phone: null` to clear it.
4. Use multipart field name `avatar` and enforce the 2 MB JPEG/PNG/WebP limit in the UI as a usability check; backend byte-signature validation remains authoritative.
5. Treat avatar removal as clearing the profile reference; it does not currently guarantee physical object deletion from storage.
6. Build school/persona switchers from `GET /me/access`; use the returned school URL and current flags.
7. Display sessions using family IDs and device labels; do not assume the current-session indicator is available if the refresh cookie is not sent.
8. After password change, use the fresh session returned by the endpoint and the replacement HttpOnly cookies.
9. Platform user-management screens require the platform realm and `platform.users.manage`.
10. School-admin reset must handle `ADMIN_AMBIGUOUS` by letting platform support select an administrator.

## 12. Outstanding verification and decisions

| Item | Status |
|---|---|
| Route mount, endpoint methods and route guards | Source-verified |
| Profile/password/avatar DTOs | Source-verified |
| Profile response mapper | Source-verified |
| Session family listing and revocation | Source-reviewed; runtime not tested |
| Avatar signature validation and upload path | Source-reviewed; provider not called |
| Avatar object deletion | Not implemented in inspected use case |
| Avatar removal audit | Not implemented in inspected use case |
| Platform deactivation/re-activation focused tests | Source-reviewed; tests not run |
| School-admin password reset flow | Source-reviewed; runtime not tested |
| Immediate access-token invalidation after global deactivation | Not established by inspected access-token middleware; access JWTs may remain usable until expiry |
| Immediate access-token invalidation after password change/reset | Open Auth security gap; see [Auth Audit](../../AUTH_AUDIT.md) |
| Full integration coverage of personal user routes | Not yet verified |

## Related documentation

- [Auth module](auth.md)
- [Authentication and authorization architecture](../../architecture/authentication-and-authorization.md)
- [Auth security audit](../../AUTH_AUDIT.md)
- [School module](school.md)
- [Roles module](roles.md)
