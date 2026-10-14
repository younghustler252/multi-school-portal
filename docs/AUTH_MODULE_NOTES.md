# Auth module pass: apply notes (Revision 2 inputs)

## 1. Apply order
1. Schema (section 2), then `prisma migrate dev` for public.
2. Env (section 3).
3. Copy `modules/auth/*` over the old module. **Delete** the old files: `todo.txt`, `usecases/register.usecases.ts` (renamed `register.usecase.ts`), old `repositories/*` and `dtos/*`, `domain/auth.enums.ts` consumers that used `AuthErrorMessage`/`LOCK_DURATION_MINUTES`.
4. Copy `shared/services/url.service.ts` (new) and `shared/services/password.service.ts` (replaces yours: `generateTemp` now uses `crypto.randomInt`).
5. `registerAuth` is already in your list; no change to the container order. `planRepository` must be registered (plans module).
6. Add `syncAuthTemplates(prisma)` (from `modules/auth/auth.templates.ts`) to `sync-registries.ts`; run it once now.
7. Provisioning worker: after tenant migrations and role-template seeding, inside the school's tenant context, call `membershipService.provisionFirstAdmin(schoolId)`.
8. Super-admin impersonation use case: the Redis ticket JSON must be `{ userId, schoolId, impersonatorId, membershipId? }` under key `impersonation:<ticket>` (`impersonatorId` = the platform user's User.id). Tickets without it are rejected.
9. Frontend: section 5.

## 2. Schema changes (public.prisma)
RefreshToken: add `familyId String`, `schoolId String?`, `membershipId String?`, `impersonatorId String?`, `userAgent String?`, `ipAddress String?`, `lastUsedAt DateTime?`, `revokedAt DateTime?`, `replacedById String?`; `@@index([userId])`, `@@index([familyId])`. The `token` column now holds an HMAC, not the JWT.
Invite: add `personaEntityId String?` (Staff/Guardian/Student id for guardian and student invites). `token` now holds an HMAC.
Otp: no change (`code` now holds an HMAC).
Existing dev rows in RefreshToken/Otp/Invite are invalid after this change; clear those tables.

## 3. Environment
`env.ts` as uploaded does not yet contain the Foundation variables. Add: `BASE_DOMAIN` (required; `localhost` in dev, replaces `APP_BASE_DOMAIN`: grep its usages), `COOKIE_DOMAIN` (optional), `PUBLIC_URL_PORT` (optional, dev only, appended to generated links). Redis must be 6.2 or newer (GETDEL).

## 4. Verified and remaining assumptions
Verified against your files: domain error constructors, `req.auth` shape (`userId, schoolId, membershipId, impersonatedBy`), Prisma client paths (`generated/public/client`, `infrastructure/database/prisma/prisma.client`), separate public and tenant clients (so register's `$transaction` runs on the plain public client and the tenant models are only reachable inside a tenant context).
Still unverified (each isolated):
| Assumption | Where |
|---|---|
| `req.schoolId` is falsy or `"PUBLIC"` on the platform host (tenant-resolver not seen) | `hostSchoolId()` in controller |
| `redisConnection` at `infrastructure/jobs/connection`; `MailService` at `infrastructure/mail/mail.service` | login-attempt, impersonation, message service |
| `requireTenant` export in `tenant-resolver.middleware`; `getAccess`/`requirePermission` in `rbac.middleware`; `validate` and limiter names | routes, controller |
| Tenant models `membership`, `membershipRole`, `schoolRole`, `schoolRolePermission`, `schoolSettingValue`, `staff` (legacy `role` required, `category` present) match Foundation field names | membership + policy services |
| `IPlanRepository.findFreePlan()` path `plans/repositories/plan.repository` | register |
| `getAccess(req).hasRoleKey("school_admin")` means the locked School Admin role | invite actor |

## 5. Frontend contract
Responses use the standard envelope. Switch on `code`.
- `POST /auth/login` `{ email, password, persona? }` returns `data.status`:
  - `AUTHENTICATED`: `{ user, session{kind,schoolId,membershipId,persona}, tokens }` (cookies set)
  - `PERSONA_SELECTION_REQUIRED`: `{ personas[] }`; call login again with `persona`
  - `SCHOOL_SELECTION_REQUIRED` (platform host, school user): `{ schools[{id,name,url}] }`; redirect to the school's URL
- `user.mustChangePAssword` is now `mustChangePassword` (typo fixed). `user.role` and `user.schoolId` are gone; use `session`.
- `POST /auth/refresh`, `/auth/logout` (no access token needed), `/auth/logout-all`, `/auth/switch-persona { persona }`.
- `REFRESH_IN_PROGRESS`: retry the refresh once after a moment. `REFRESH_TOKEN_REUSED`, `REFRESH_TOKEN_INVALID`, `TENANT_MISMATCH`: go to login.
- OTP flows: `POST /auth/verify-email`, `/resend-otp {email,type?}`, `/forgot-password`, `/reset-password`. Forgot/resend always return the same message. Verify/reset answer `INVALID_OTP` for any failure; `OTP_MAX_ATTEMPTS` after 5 tries.
- Invites (on the school's host): `POST /auth/invite/validate {token}` returns `{email, persona, roleName, schoolName, accountExists, expiresAt}`; show name+password fields only when `accountExists` is false. `POST /auth/invite/accept {token, password, confirmPassword?, firstName?, lastName?, phone?}` returns `AUTHENTICATED`.
- Staff: `POST /auth/invite/send {email, persona, roleId | personaEntityId, firstName?}`, `GET /auth/invites`, `POST /auth/invites/:id/revoke`, `POST /auth/invites/:id/resend`. All need `users.invite`.
- New codes: INVALID_CREDENTIALS, ACCOUNT_INACTIVE, ACCOUNT_LOCKED, EMAIL_NOT_VERIFIED, LOGIN_RATE_LIMITED, INVALID_OTP, OTP_MAX_ATTEMPTS, REFRESH_TOKEN_INVALID, REFRESH_TOKEN_REUSED, REFRESH_IN_PROGRESS, INVITE_EXPIRED, INVITE_ALREADY_USED, INVITE_REVOKED, ROLE_NOT_ALLOWED, PERSONA_NOT_AVAILABLE, IMPERSONATION_INVALID.

## 6. Behaviour decisions made in this pass
- Register: one transaction (school, free subscription, admin, UserSchool); refuses if no free plan; reserved subdomains blocked; admin verifies email on the platform host and first logs in on the school host after activation (membership created by provisioning).
- Lockout: 5 failures per (email + IP) in 15 minutes blocks that pair; the account itself locks for 30 minutes only after 20 total failures. Constants in `auth.enums.ts` (candidate settings later).
- Refresh tokens, OTPs and invite tokens stored as HMACs; refresh rotation with family revocation on reuse; impersonation sessions capped at 60 minutes.
- Invite role escalation closed: inviter may grant only roles whose permissions they hold; grants-all roles only by School Admin.
- Logging in a school user on the platform host never issues a session; it returns their schools.
- Known remaining: IP limiters (D9) and validate middleware (D10-like params/query bug) untouched; `authenticate` should reject access tokens issued before `passwordChangedAt`; tokens still returned in the JSON body as well as cookies; a user who already has an account cannot register a second school with the same email (use invite or a future "add school" flow); cleanup job for `deleteExpired()` on refresh tokens, OTPs, invites not scheduled; Student/Guardian invites require the person record to exist first; email layout lost the large OTP styling (code is now a line of text in the template).

## 7. Documentation updates (section 0.3)
- 5.2 RefreshToken [C] fields above; Invite [C] `personaEntityId`; OTP/refresh/invite token columns store HMACs.
- 7: message templates added: `auth.otp.email_verification`, `auth.otp.password_reset`, `auth.invite`, `auth.welcome`, `auth.password_changed`. Setting used: `security.password_min_length`.
- 9.3: permission key `users.invite` (school, STAFF, ALL).
- 10: new services `UrlService`, `TokenHashService`; session minting centralised in `AuthSessionService`.
- 10.13: add the new codes in section 5.
- 16: auth = Done (pending items in section 6). school module gains `provisionFirstAdmin` hook.
- 17: D8 closed. Open: D9, validate middleware, access-token vs passwordChangedAt.
- 19: Revision 2 entry.
