# Auth Module

> **Verification status:** Source-reviewed; endpoint behavior and principal DTOs checked against the current route, controller, DTO, use-case and service implementations. Runtime behavior and database-backed flows have not been executed as part of this documentation pass.
> **Source snapshot:** `refactor/modules`, source snapshot recorded as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/auth/`
> **Route mount:** `/api/v1/auth`, registered in `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

The Auth module owns account authentication and lifecycle flows:

- School self-registration and email verification.
- Login and session establishment.
- Refresh-token rotation and logout.
- Password recovery and reset.
- Persona switching.
- School invitations and invitation acceptance.
- Exchange of one-time platform impersonation tickets into school sessions.

It coordinates with the public user/school/subscription records, tenant membership and role records, school provisioning, Redis, mail delivery and audit logging.

Auth does not own the complete user profile or school administration APIs. Those are separate modules. The membership service is the bridge between public identity and a school's tenant membership/persona records.

## 2. Architecture and dependencies

The module follows the route → controller → use case/service → repository pattern.

| Layer | Source location | Responsibility |
|---|---|---|
| Routes | `routes/auth.routes.ts` | HTTP methods, middleware order and DTO selection |
| Controller | `controllers/auth.controller.ts` | HTTP request metadata, cookies and response envelopes |
| DTOs | `dtos/*.ts` | Zod request validation |
| Use cases | `usecases/*.ts` | Account, session and invitation workflows |
| Services | `services/*.ts` | Session issuance, OTP, policy, membership, invites, audit and messages |
| Repositories | `repositories/*.ts` | Public-schema user, OTP, refresh-token and invitation persistence |
| Domain | `domain/*.ts` | Entities, enums, stable error codes and domain error factories |
| Container | `auth.container.ts` | Awilix registrations |

### Important dependencies

- Shared `TokenService` and `PasswordService`.
- Public Prisma client for global users, schools, subscriptions, OTPs, invitations and refresh-token records.
- Tenant Prisma client through `getTenantClient()` for memberships, school roles and staff/guardian/student persona records.
- Redis for registration limits, per-email/IP login failure counters and one-time impersonation tickets.
- School provisioning's `WorkspaceActivationService` and `MembershipService.provisionFirstAdmin()`.
- Mail service and platform-managed message templates.
- Audit logging.

The Auth container registers repositories, services, use cases and the controller as scoped dependencies, except the mapper, token-hash helper and URL service which are singleton registrations.

## 3. Identity and tenant model

Public identity and school membership are distinct:

- `User` is a public identity.
- `UserSchool` is a public discovery/index link; it is not the authorization authority.
- `Membership` is the tenant-owned school membership and persona.
- `PlatformMember` represents platform access.
- A membership is associated with a persona record such as Staff, Guardian or Student and one or more role grants.

The membership service explicitly treats the tenant `Membership` as authoritative. Its tenant methods use `getTenantClient()` and require active tenant context. Public methods such as platform-member lookup and UserSchool discovery use the public client.

School context is resolved from the request host. The Auth controller derives the school ID from that resolved request context, not from a school ID supplied in the request body. School-host-only flows call `requireSchoolHost()`.

## 4. API endpoints

All paths below are full paths under `/api/v1/auth`.

| Method and path | Access/middleware | Purpose |
|---|---|---|
| `POST /register` | Public; auth IP limiter; RegisterDto | Create school, free subscription, initial public user and UserSchool link |
| `POST /verify-email` | Public; OTP IP limiter; VerifyEmailDto | Verify email and attempt workspace activation |
| `POST /resend-otp` | Public; OTP IP limiter; ResendOtpDto | Resend verification or password-reset OTP |
| `POST /forgot-password` | Public; OTP IP limiter; ForgotPasswordDto | Start password recovery |
| `POST /reset-password` | Public; OTP IP limiter; ResetPasswordDto | Reset password using OTP |
| `POST /login` | Public; auth IP limiter; LoginDto | Resolve school/platform access and establish session or return a selection result |
| `POST /refresh` | Public; auth IP limiter | Rotate refresh token; refresh token may be cookie or body value |
| `POST /logout` | Public; auth IP limiter | End the refresh-token family identified by the supplied refresh token |
| `POST /exchange-impersonation-token` | Public; auth IP limiter; requireTenant; ImpersonationExchangeDto | Consume a one-time ticket on the matching school host and establish an impersonated session |
| `POST /logout-all` | Authenticated | Revoke all user refresh sessions; impersonating actor only ends the current session |
| `POST /switch-persona` | Authenticated; requireTenant; SwitchPersonaDto | Establish a separate session for another active persona in the school |
| `POST /invite/validate` | Public; auth IP limiter; requireTenant; ValidateInviteDto | Validate invite and tell the frontend whether the account already exists |
| `POST /invite/accept` | Public; auth IP limiter; requireTenant; AcceptInviteDto | Accept invitation for a new or existing account and establish a session |
| `POST /invite/send` | Authenticated; requireTenant; `users.invite`; SendInviteDto | Invite a staff, guardian or student persona |
| `GET /invites` | Authenticated; requireTenant; `users.invite` | List pending invitations for the current school |
| `POST /invites/:id/revoke` | Authenticated; requireTenant; `users.invite` | Revoke a pending invitation |
| `POST /invites/:id/resend` | Authenticated; requireTenant; `users.invite` | Replace invitation token and send a new link |

### Middleware and host behavior

- `authenticate` reads a Bearer access token first, then the `accessToken` cookie.
- Authenticated school routes also require school tenant context where shown above.
- The Auth module's public registration, login, OTP and recovery routes do not require an access token.
- Invitation acceptance and validation are public, but require the school's own host.
- `/logout` deliberately does not require a valid access token; the refresh token identifies the session, allowing logout after the access token expires.
- `/refresh` also does not require an access token.
- The controller reads the refresh token from the `refreshToken` cookie first, then `req.body.refreshToken`.

## 5. Request DTOs

All DTOs are Zod objects. The validation middleware validates the request body and replaces `req.body` with the parsed data. Email fields are trimmed, lowercased, validated as email addresses and limited to 254 characters.

### RegisterDto — `POST /register`

| Field | Requirement |
|---|---|
| `schoolName` | Required; trimmed; 2–100 characters |
| `subdomain` | Required; lowercased; 3–50 characters; lowercase letters, digits and internal hyphens only |
| `schoolEmail` | Required valid email |
| `schoolPhone` | Optional; max 30 characters |
| `schoolCategory` | Required: `primary`, `secondary`, `primary_secondary` |
| `schoolOwnership` | Required: `private`, `public`, `mission`, `international` |
| `state`, `city` | Optional; max 100 characters each |
| `firstName`, `lastName` | Required; trimmed; 1–50 characters |
| `email` | Required valid email; becomes the public user email |
| `password` | Required; 1–128 characters at DTO layer; password policy is checked in the use case |
| `phone` | Optional; max 30 characters |

### LoginDto — `POST /login`

- `email`: required valid email.
- `password`: required, 1–128 characters.
- `persona`: optional; `STAFF`, `STUDENT` or `GUARDIAN`. Used when the account has multiple profiles in the school.

### OTP and password DTOs

| DTO | Fields |
|---|---|
| `VerifyEmailDto` | `email`, six-digit `otp` |
| `ResendOtpDto` | `email`, `type`: `email_verification` or `password_reset`; defaults to `email_verification` |
| `ForgotPasswordDto` | `email` |
| `ResetPasswordDto` | `email`, six-digit `otp`, `newPassword`, `confirmPassword`; the two password values must match |
| `SwitchPersonaDto` | `persona`: `STAFF`, `STUDENT` or `GUARDIAN` |

Password strength and minimum length are enforced by `AuthPolicyService`, not fully by the DTO. The minimum is the school setting `security.password_min_length` when a tenant context is active, otherwise the platform setting default; the effective minimum is clamped to 8–32 characters. Password composition validation is delegated to `PasswordService`.

### Invitation DTOs

**ValidateInviteDto**
- `token`: required, 16–200 characters.

**AcceptInviteDto**
- `token`: required, 16–200 characters.
- `password`: required and subject to password policy for new accounts.
- `confirmPassword`: optional in the schema; required to match `password` for new accounts by use-case logic.
- `firstName`, `lastName`: optional in the schema; required for new accounts unless derived from an existing staff record.
- `phone`: optional, max 30 characters.

**SendInviteDto**
- `email`: required valid email.
- `persona`: optional; defaults to `STAFF`.
- `roleId`: optional in schema, but required for `STAFF`.
- `personaEntityId`: optional in schema, but required for `GUARDIAN` and `STUDENT`.
- `firstName`: optional, max 50 characters; used for the invitation greeting.

**ImpersonationExchangeDto**
- `ticket`: required, 16–200 characters.

## 6. Response contracts

The controller uses the shared response helpers:

- Success: `{ success: true, message, data }`.
- Created: same envelope with HTTP 201.
- Validation failure: HTTP 400 with `{ success: false, message: "Validation failed", errors }`.
- The global error handler may add stable `code` and `details` fields through the shared error response format; inspect the current error handler before relying on a complete error catalogue.

### Authenticated session data

The typed authenticated result contains:

```ts
{
  status: "AUTHENTICATED";
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    photoUrl: string | null;
    isEmailVerified: boolean;
    mustChangePassword: boolean;
  };
  session: {
    kind: "school" | "platform";
    schoolId: string | null;
    membershipId: string | null;
    persona: "STAFF" | "STUDENT" | "GUARDIAN" | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
```

The controller also sets HttpOnly cookies when a result is authenticated. It does not set new auth cookies for the selection-only login results.

### Login selection results

Login can return one of two non-authenticated data shapes:

- `{ status: "PERSONA_SELECTION_REQUIRED", personas: PersonaType[] }`
- `{ status: "SCHOOL_SELECTION_REQUIRED", schools: { id, name, url }[] }`

These results do not contain tokens. The frontend must handle these states rather than treating every successful HTTP response as an authenticated session.

### Endpoint-specific data

| Endpoint | Controller data |
|---|---|
| Register | `{ subdomain }` |
| Verify email | `{ workspace }` where workspace may be null |
| Login / refresh / switch persona / impersonation exchange | Authenticated result or login selection result, depending on flow |
| Forgot password / reset password / resend OTP / logout / logout-all / revoke invite | `null` |
| Invite validate | `{ email, persona, roleName, schoolName, accountExists, expiresAt }` |
| Invite accept | Authenticated result |
| Invite send | `{ inviteId, expiresAt }` |
| Invite list | Array of pending invite summaries: `id, email, persona, roleId, roleName, sentById, expiresAt, createdAt` |
| Invite resend | `{ expiresAt }` |

The exact `workspace` structure is owned by `WorkspaceInfo` in the School module. It should be linked to that module's documented contract rather than duplicated here.

## 7. Session and security behavior

### Access and refresh tokens

- `AuthSessionService` is the single session-issuance path.
- Access-token claims include user ID, school ID, membership ID, must-change-password flag and optional impersonator ID.
- Refresh-token records are stored in the public database with an HMAC of the refresh token, family ID, school/membership context, impersonator, user agent, IP and expiry.
- Browser cookies are HttpOnly, use `SameSite=Lax`, use `Secure` in production, and have a 15-minute access-cookie lifetime and 7-day refresh-cookie lifetime.
- Cookie domain is host-only unless `COOKIE_DOMAIN` is configured.

### Refresh rotation

- The refresh JWT must verify and match the stored HMAC.
- Rotation claims the old row atomically and creates the replacement in the same token family.
- Reuse after the 10-second concurrent-refresh grace period revokes the family and is audited.
- Refresh revalidates the user, host school and active membership/platform-member status.
- Impersonation refresh chains retain their absolute expiry cap.

### OTP

- Email verification OTP expiry: 10 minutes.
- Password-reset OTP expiry: 15 minutes.
- OTP resend cooldown: 60 seconds per account and OTP type.
- Maximum verification attempts: 5.
- OTP values are stored as HMACs, attempts are incremented atomically, and successful consumption is single-use.

### Login protection

- Express auth limiter: 10 requests per 15 minutes, skipping successful requests.
- Express OTP limiter: 5 requests per 15 minutes.
- Additional Redis login-failure tracking is per normalized email fingerprint + IP: 5 failures in 15 minutes.
- Account-level lock occurs after 20 bad-password failures and lasts 30 minutes.
- Unknown emails still execute a dummy password comparison and receive the same invalid-credentials response as an incorrect password.

### Password reset

A successful reset updates `passwordChangedAt`, clears account lockout and `mustChangePassword`, verifies the email if necessary, and revokes all refresh tokens.

**Important open security gap:** the current `authenticate` middleware verifies the access JWT but does not compare its issue time with `passwordChangedAt`. Therefore already-issued access tokens may remain usable until their normal expiry even after a password reset. The reset use case itself documents this limitation. See [Auth Audit](../../AUTH_AUDIT.md).

### Invitations

- Invitation tokens are stored as HMACs, expire after 7 days, and are bound to the school host.
- Validation and acceptance reject invalid, revoked, accepted or expired invitations.
- Acceptance atomically claims the invite to prevent simultaneous double use.
- Existing users prove account ownership with their current password; new users create an account and verify the inbox by accepting the invite.
- A user can hold multiple school memberships and personas.
- Staff invitations require a staff role. The inviter may only grant permissions at scopes no wider than their own; a grants-all role is restricted to a school admin.
- Guardian/student invitations use the locked default role for the persona and require an existing person record.

### Impersonation

The platform creates a one-time Redis ticket. Exchange uses Redis `GETDEL`, verifies the ticket's school matches the current school host, verifies the impersonator is still an active platform member, validates the target membership and issues a session capped at 60 minutes. The session records the impersonator and is audited.

## 8. Business workflows

### School self-registration

1. Validate school/admin input and reserved subdomain.
2. Apply a per-IP registration limit of five per day.
3. Validate the password policy.
4. Check school subdomain/email and global user email uniqueness.
5. Require an available free plan.
6. In one public database transaction create the pending inactive school, active free subscription, unverified public user and UserSchool link.
7. Issue email-verification OTP and send the message asynchronously.
8. Record the registration audit event.

The initial tenant membership is not created during registration because the tenant schema does not yet exist. The provisioning flow later calls `MembershipService.provisionFirstAdmin()` inside the new tenant context, after tenant migrations and role-template seeding.

### Email verification and workspace activation

Email verification consumes the OTP and marks the public user verified. It then attempts workspace activation. Activation failure is logged but does not undo email verification; the school lifecycle job is expected to pick up an active but unbuilt workspace later.

### Invite acceptance

Invitation acceptance spans public and tenant data. The current compensation handler releases the invitation claim and deletes a newly created public user if a later operation fails.

**Open consistency concern:** when accepting an invite for an existing user, tenant persona linking and membership creation can occur before later operations such as session issuance. The catch handler does not explicitly remove those tenant-side changes. This is a cross-database compensation gap to resolve or formally constrain.

## 9. Permissions

The Auth module declares one school permission:

| Key | Realm | Scope | Persona | Sensitive |
|---|---|---|---|---|
| `users.invite` | SCHOOL | ALL | STAFF | Yes |

It guards invitation send/list/revoke/resend routes. The use case separately checks what role the inviter may delegate. The permission registry synchronization and deployed grants must be verified in the Foundation/Roles documentation; route declaration alone does not prove grants exist in a given database.

## 10. Events, jobs and external effects

- Auth audit events include registration, email verification, login success/failure, account lock, refresh-token reuse, logout, password reset, persona switch, invitation lifecycle and impersonation start.
- Audit writing is best-effort: audit failure is reported to the audit failure sink and does not break sign-in.
- Email delivery uses platform-managed message templates, with code defaults as fallback when a template row is missing or inactive.
- OTP, invite and welcome/password-change emails are sent through the shared mail service.
- Auth uses Redis directly for registration throttling, login-attempt counters and impersonation tickets.

Auth-related cleanup operations are exposed through repository methods for expired OTPs, invitations and refresh-token rows. The scheduler/worker registration and cadence for each cleanup must be verified before documenting operational guarantees.

## 11. Error handling

Stable Auth error codes are defined in `domain/auth.enums.ts`. The frontend should branch on `code`, not message text, where a code is provided.

Current Auth code catalogue includes:

- `INVALID_CREDENTIALS`
- `ACCOUNT_INACTIVE`
- `ACCOUNT_LOCKED`
- `EMAIL_NOT_VERIFIED`
- `LOGIN_RATE_LIMITED`
- `INVALID_OTP`
- `OTP_MAX_ATTEMPTS`
- `REFRESH_TOKEN_INVALID`
- `REFRESH_TOKEN_REUSED`
- `REFRESH_IN_PROGRESS`
- `TENANT_MISMATCH`
- `INVITE_EXPIRED`
- `INVITE_ALREADY_USED`
- `INVITE_REVOKED`
- `ROLE_NOT_ALLOWED`
- `PERSONA_NOT_AVAILABLE`
- `IMPERSONATION_INVALID`

Some conflict, bad-request and not-found errors use shared domain error classes with their shared codes. Rate-limit and registration-unavailable errors are also represented by application errors. This list should not be treated as the complete HTTP error response catalogue until the global error handler and every relevant branch are audited.

## 12. Tests and coverage

The inspected Auth test directory currently contains:

- `apps/api/tests/auth/role-delegation.test.ts`: unit tests for scope coverage and invitation role delegation, including the AUTH-01 regression cases.

These tests cover the role-delegation rule but do not constitute end-to-end coverage of registration, email verification, login, refresh rotation/reuse, logout, password recovery, persona switching, invitation acceptance compensation or impersonation exchange.

**Verification performed for this documentation:** source inspection only. Tests, typecheck, migrations, Redis, mail delivery and live HTTP requests were not run.

## 13. Frontend integration requirements

The frontend should consume the Auth module as follows:

1. Treat `/api/v1/auth` as the API prefix.
2. Support school-host and platform-host contexts; do not send a school ID as the tenant-selection authority.
3. Send access tokens as Bearer tokens for non-cookie clients; web clients can use the HttpOnly cookies established by the API.
4. Handle login's three distinct outcomes: authenticated, persona selection required and school selection required.
5. Handle cookie-based refresh and logout; refresh/logout can work without a valid access token.
6. Handle `mustChangePassword` and the `MUST_CHANGE_PASSWORD` response as a restricted session state.
7. For invite acceptance, call invite validation first and use `accountExists` to select the existing-account or new-account form.
8. For staff invites, provide a role selection; for guardian/student invites, select an existing person record and send `personaEntityId`.
9. Branch on stable error codes, not human-readable message strings.
10. Do not assume access tokens are immediately invalidated after password reset; this is a backend security gap pending remediation/policy decision.

## 14. Outstanding verification and decisions

| Item | Status |
|---|---|
| Route mount and route-level middleware | Source-verified |
| Principal Auth DTOs | Source-verified |
| Controller response envelopes and typed session result | Source-verified |
| Public vs tenant membership boundary | Source-verified |
| Refresh rotation and reuse behavior | Source-reviewed; not runtime-tested |
| OTP hashing, attempt limit and single-use behavior | Source-reviewed; not runtime-tested |
| Invite role delegation and regression tests | Source-reviewed; tests not run |
| Invite acceptance compensation for existing users | Open consistency concern |
| Access-token invalidation after password reset | Open security gap |
| Rate limiter behavior in multi-instance production | Deployment verification required |
| Cleanup scheduler registration/cadence | Not yet verified |
| Complete database schema/index/constraint map | Not yet documented |
| Complete integration/route test coverage | Not yet verified |
| Full global error response catalogue | Not yet verified |

## Related documentation

- [Authentication and authorization architecture](../../architecture/authentication-and-authorization.md)
- [Multi-tenancy and database architecture](../../architecture/multi-tenancy-and-database.md)
- [Auth security audit](../../AUTH_AUDIT.md)
- [Roles module](roles.md)
- [Users module](users.md)
- [School module](school.md)
