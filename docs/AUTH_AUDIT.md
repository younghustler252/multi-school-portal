# Auth Module Audit

> **Repository:** `younghustler252/multi-school-portal`  
> **Branch:** `refactor/modules`  
> **Application source reviewed at:** `2bcbf58b685041e7887a1fa9053bb66947be1145`  
> **Review date:** 2026-10-26  
> **Method:** source inspection only. No application code was changed during this audit. Build, automated tests, database tests, and live API behavior were not executed. Documentation-only commits followed the reviewed application-source revision.

## 1. Executive summary

Auth is registered in `src/container/index.ts` and its router is mounted at `/api/v1/auth`. It covers school registration, email verification, login, refresh-token rotation, logout, password recovery, persona switching, invitation lifecycle, and one-time impersonation-ticket exchange.

The design has several sound controls: HMAC storage for refresh/OTP/invite tokens, refresh-token rotation and reuse detection, membership revalidation during refresh, generic responses for account-enumerating recovery flows, password hashing with bcrypt, tenant-bound invite validation, and audit events.

The audit found two important correctness/security issues to address before treating the module as hardened: invite role delegation compares permission keys without comparing scopes, and invite acceptance compensation does not undo all tenant-side changes after a later failure. It also identified a session-invalidation gap after password reset and a lack of Auth-specific automated tests.

**This is an audit report, not a claim that any finding has been fixed.**

## 2. Auth architecture

### Registration and dependencies

`src/modules/auth/auth.container.ts` registers the Auth controller, repositories, services, and use cases. It depends on shared `prismaClient`, `tokenService`, `passwordService`, and `mailService`, and on the Plans module's `planRepository`.

- Public identity/session records use the public Prisma client: `User`, `UserSchool`, `PlatformMember`, `Otp`, `Invite`, and `RefreshToken`.
- School memberships, school roles, staff/guardian/student persona links, and tenant role assignments use `getTenantClient()` inside the active tenant context.
- `UserSchool` is used as a school-discovery index; the tenant `Membership` is the authority for a school session.
- `AuthSessionService` is the central point for issuing token pairs and persisting refresh-token HMACs with school, membership, family, and impersonator metadata.
- `AccessService` loads permissions and scopes from the active membership/roles. The access-token payload carries identity/session context, not permission lists.
- `AuthAuditService` records events through the public audit log, but intentionally catches and logs persistence failures rather than propagating them.

### HTTP routes

All routes below are relative to `/api/v1/auth`.

| Method and path | Route middleware | Purpose |
|---|---|---|
| POST `/register` | IP auth limiter, DTO validation | Register school and founding user |
| POST `/verify-email` | OTP limiter, DTO validation | Verify email and attempt workspace activation |
| POST `/resend-otp` | OTP limiter, DTO validation | Resend verification or reset code |
| POST `/forgot-password` | OTP limiter, DTO validation | Request a password-reset code |
| POST `/reset-password` | OTP limiter, DTO validation | Verify reset code and change password |
| POST `/login` | IP auth limiter, DTO validation | Resolve platform or school session |
| POST `/refresh` | IP auth limiter | Rotate refresh token |
| POST `/logout` | IP auth limiter | Revoke the presented refresh-token family |
| POST `/logout-all` | Authentication | Revoke all refresh tokens for the user |
| POST `/switch-persona` | Authentication, tenant required, DTO validation | Start a session for another active persona in this school |
| POST `/exchange-impersonation-token` | IP auth limiter, tenant required, DTO validation | Exchange one-time Redis ticket for an impersonation session |
| POST `/invite/validate` | IP auth limiter, tenant required, DTO validation | Validate an invite for the school host |
| POST `/invite/accept` | IP auth limiter, tenant required, DTO validation | Accept invite and create/link membership |
| POST `/invite/send` | Authentication, tenant required, `users.invite`, DTO validation | Send an invitation |
| GET `/invites` | Authentication, tenant required, `users.invite` | List pending invitations |
| POST `/invites/:id/revoke` | Authentication, tenant required, `users.invite` | Revoke invitation |
| POST `/invites/:id/resend` | Authentication, tenant required, `users.invite` | Rotate token and resend invitation |

The application mounts optional authentication and tenant resolution globally, but protected Auth routes still use route-specific `authenticate` and `requireTenant` guards as appropriate. The impersonation exchange intentionally uses the one-time ticket rather than an existing access token.

## 3. Findings

### AUTH-01 — Role invitation checks permission keys but ignores permission scope

**Severity: High (P1)**  
**Status: FIXED (scope-aware delegation, `canDelegateRole`; also applied to staff role changes; tests in `tests/auth/role-delegation.test.ts`)**

In `src/modules/auth/usecases/send-invite.usecase.ts`, the inviter's ability to grant a non-`grantsAll` staff role is checked using:

```ts
role.permissionKeys.every(k => actor.can(k))
```

However, `MembershipService.getRole()` in `src/modules/auth/services/membership.service.ts` selects only `permissionKey` from `SchoolRolePermission`, discarding each permission's `scope`. `Access.can()` in `src/foundation/access.service.ts` checks whether a key is held, while `Access.scopeOf()` returns the effective scope. A permission held at `OWN`, `ASSIGNED`, or `BRANCH` scope can therefore satisfy the key-only comparison for a role that grants the same permission at `ALL` scope.

The route's `users.invite` guard limits who can reach this use case, and `grantsAll` roles have a separate school-admin check. Those controls do not make the key-only comparison equivalent to checking the scope of every permission being granted.

**Recommended correction:** include permission scopes in the role record and require the target role's scope for every permission to be no broader than the inviter's effective scope. Preserve the separate rule that only an authorized school administrator can grant `grantsAll` roles. Add tests for same-key/different-scope cases, including `OWN → ALL`, `BRANCH → ALL`, and valid equal/narrower grants.

### AUTH-02 — Invite acceptance does not fully compensate tenant-side writes after failure

**Severity: Medium (P2)**  
**Status: Confirmed by source inspection; failure scenario not runtime-tested**

`src/modules/auth/usecases/accept-invite.usecase.ts` claims the invite, then performs several operations across public and tenant data: create or update the public user, link the tenant persona record, create the tenant membership and role assignment, add the public `UserSchool` discovery link, issue a refresh session, and send/audit the result.

Its catch block releases the invite claim and deletes the public user only when this flow created a new user. It does not reverse a successful tenant persona link or a tenant membership if a later step fails. `MembershipService.linkPersonaEntity()` updates `Staff.userId`, `Guardian.userId`, or `Student.userId`; those writes are not reversed by the catch block. If a later step fails, a retry may encounter an already-linked persona or an orphaned tenant membership even though the invite was unclaimed.

**Recommended correction:** define explicit compensation for every cross-database side effect, or restructure the workflow so tenant changes are transactional and can be safely retried. The solution must handle both new and existing users, and failures after persona linking, membership creation, `UserSchool` creation, and refresh-session creation. Add failure-injection tests for each boundary before changing the workflow.

### AUTH-03 — Password reset revokes refresh tokens but does not immediately invalidate existing access tokens

**Severity: Medium (P2)**  
**Status: Confirmed by source inspection**

`src/modules/auth/usecases/reset-password.usecase.ts` updates `passwordChangedAt` and revokes all refresh-token rows. Its own comment says access tokens issued before `passwordChangedAt` should be rejected by authentication middleware.

However, `src/infrastructure/middleware/auth.middleware.ts` verifies the JWT and checks the `mustChangePassword` claim; it does not load the user or compare token issuance time against `passwordChangedAt`. `TokenService.verifyAccessToken()` returns only the defined identity claims and does not expose `iat` for this check. Consequently, an already-issued access token can remain usable until its normal expiry even after a password reset or change.

**Recommended correction:** either implement a reliable invalidation check (including a defined cache strategy) or explicitly document and accept the bounded access-token lifetime as the policy. If implementing the check, test password reset/change against previously issued access tokens and avoid adding an unbounded database query to every request without considering performance.

### AUTH-04 — No Auth-specific automated test files are present

**Severity: Medium (P2)**  
**Status: Confirmed in the repository tree**

The current `tests/` tree contains tests for areas such as Classes, Guardians, Sessions, Students, Foundation, infrastructure, and Finance, but no `tests/**/auth*.test.ts` or Auth test directory was present in the reviewed branch.

That leaves the module's highest-risk flows without visible dedicated regression coverage: login/session selection, refresh rotation and reuse detection, OTP attempts and single-use behavior, password recovery, invitation authorization/acceptance, impersonation-ticket exchange, and tenant/session mismatch handling.

**Recommended correction:** add focused Auth tests before or alongside fixes. Start with the security boundaries in AUTH-01 through AUTH-03, then cover the public lifecycle endpoints and their generic responses. Use mocks for isolated use-case tests and a dedicated disposable test database for integration coverage where persistence/tenant context is material.

### AUTH-05 — IP rate limiters use the default in-memory store

**Severity: Medium (P2, deployment-dependent)**  
**Status: Confirmed by source inspection**

`src/infrastructure/middleware/rate-limit.middleware.ts` creates `express-rate-limit` limiters without a shared store. The IP-based `authLimiter` and `otpLimiter` therefore use the package's default process-local store. The module adds Redis-backed per-(email + IP) login failure tracking and a Redis registration counter, plus a database-backed OTP cooldown, which are useful additional controls.

In a multi-instance deployment, process-local IP counters are not shared across instances and are reset when an instance restarts. This weakens the intended IP-level limit for routes such as OTP and invite operations.

**Recommended correction:** if the API runs across multiple instances, use a shared rate-limit store for IP limits and configure trusted proxy handling correctly so `req.ip` cannot be spoofed. Retain the account/email-specific controls as a separate layer.

### AUTH-06 — Account lockout can be triggered by distributed password guessing

**Severity: Medium (P2, policy trade-off)**  
**Status: Confirmed by source inspection**

`LoginUseCase` increments `User.failedLoginCount` for every incorrect password and locks the user after `ACCOUNT_LOCK_THRESHOLD = 20`, regardless of the source IP. The separate Redis limiter allows up to five failures per email/IP pair within its window, but an attacker using multiple IPs can still accumulate the account-wide threshold.

**Recommended correction:** review the account-wide lock policy against the risk of denial-of-service lockouts. Consider progressive delays, alerts, and/or a policy that does not let unauthenticated distributed attempts permanently disrupt a legitimate user's sign-in. Preserve generic credential errors and test the resulting behavior.

## 4. Controls observed that should be preserved

- Passwords are hashed with bcrypt using 12 salt rounds in `src/shared/services/password.service.ts`.
- Email DTOs trim and lowercase addresses in `src/modules/auth/dtos/common.ts`.
- Login performs a dummy bcrypt comparison for unknown email addresses and uses a generic invalid-credentials response for bad passwords/no access.
- Password-reset and resend-OTP flows return generic messages rather than disclosing whether an account exists.
- OTPs, invite tokens, and refresh tokens are stored as keyed HMACs; comparisons use `timingSafeEqual`.
- OTP attempts are counted with an atomic database update, and OTP consumption uses a conditional update so a code is single-use.
- Refresh-token rotation claims the old row atomically, detects reuse, revokes a token family, and revalidates the current school membership or platform-member status.
- School invites are checked against the school ID resolved from the host, and invitation tokens are one-time and expiring.
- Staff invitation roles are checked against the inviter's permissions and `grantsAll` roles are restricted to a school-admin role check; AUTH-01 concerns the missing scope comparison, not the absence of a role check.
- Auth DTOs constrain email, password, OTP, persona, invitation token, and invitation-role inputs.
- Auth audit metadata is designed not to include raw passwords, OTP codes, or token values.

## 5. Verification gaps and limits

- No build or test command was executed for this audit.
- No database-backed or live API tests were executed.
- No runtime concurrency/failure injection was performed for refresh rotation, OTP issuance/consumption, or invitation acceptance.
- The review was source-based; the findings should be verified with focused tests before implementation and rechecked after changes.
- `docs/AUTH_MODULE_NOTES.md` was an implementation/apply note, not a reliable current contract. This audit supersedes its historical instructions; current code remains the source of truth.

## 6. Recommended remediation order

1. **AUTH-01:** enforce permission-scope-safe role delegation and add regression tests.
2. **AUTH-02:** make invitation acceptance safely recoverable across tenant/public writes; add failure-injection tests.
3. **AUTH-03:** choose and implement the access-token invalidation policy after password reset/change.
4. **AUTH-04:** build the Auth test suite around those security boundaries and the main lifecycle flows.
5. **AUTH-05 / AUTH-06:** confirm deployment topology and decide the rate-limit and lockout policy before production scaling.
