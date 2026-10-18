# SchoolOS: how the backend works (a guide you can debug with)

**How to read this.** Every section has two layers. **In plain words** explains the idea with no code knowledge needed. **Under the hood** names the files, tables and rules, so you can open the right file when something breaks.
Every module is explained with the same five questions:
1. What problem is it solving?  2. What data does it need?  3. What can go wrong?  4. What does the system do in each case?  5. What else could we have done (alternatives), and why we chose this.

---

## 0. Words used in this guide

| Word | Plain meaning |
|---|---|
| **Tenant / school schema** | Each school's private set of tables, in its own folder ("schema") inside one PostgreSQL database, e.g. `school_greenfield`. One school can never see another's tables. |
| **Public schema** | The shared tables that belong to the platform: schools, users, plans, invoices, audit log. |
| **Realm** | Two worlds: the **school realm** (a school's own staff, students, parents, on the school's address) and the **platform realm** (your team, on the admin address). A key like `fees.view` belongs to the school realm; `platform.schools.view` to the platform realm. They never mix. |
| **Persona** | Who you are inside a school: STAFF, STUDENT or GUARDIAN. |
| **Membership** | "This login is a STAFF member of this school". One login can have several memberships (a teacher who is also a parent). |
| **Role / permission / scope** | A role is a bundle of permissions (e.g. Bursar). A permission is a key (`fees.view`). Scope says how much: ALL, ASSIGNED (their own classes) or OWN (their own record or their own children). |
| **Entitlement** | What the school's **plan** allows (`students.max = 200`, `notifications.sms = on`). Different from permissions: permissions say who in the school may do a thing; entitlements say whether the school's plan includes the thing at all. |
| **Token** | A signed string proving who you are. Access token (15 min) + refresh token (7 days). |
| **Webhook** | Paystack calling our server to say "this payment happened". |
| **Idempotent** | Safe to do twice: the second time changes nothing. Almost everything that touches money is built this way. |
| **Transaction** | A group of database changes that all succeed or all fail together. |
| **Queue / worker** | A to-do list in Redis (queue) and a background program that does the items (worker): building a school, running billing. |
| **Kobo** | Money is stored as whole numbers of kobo (100 kobo = ₦1) so there are never rounding errors. |

---

## 1. The big picture: what happens to one request

**In plain words.** When someone clicks a button in the app, the browser sends a request. The server asks, in order: *Which school is this?* → *Who are you?* → *Are you allowed?* → *Does the school's plan include this?* → *Is the data well-formed?* → then it does the work and answers. If any question fails, it stops and returns an error with a **code**, so the frontend (and you) know exactly which question failed.

**Under the hood.** The path for a school request, in order:

```
Browser  ->  host (greenfield.yourdomain.com)
 1. resolveTenant        app-level. Reads the HOST, finds the school, switches the request into that school's
                         schema (TenantContext). Sets req.schoolId ("PUBLIC" on the platform host).
 2. rate limiter         (per route) stops floods.
 3. authenticate         reads the access token (header, then cookie), checks the signature, sets req.auth
                         { userId, schoolId, membershipId, mustChangePassword, impersonatedBy }.
 4. requireTenant        (school routes) refuses if the host was not a school.
 5. requirePermission    loads Access (membership -> roles -> permissions) and checks the key.
 6. requireFeature /     asks the entitlements service whether the PLAN includes this / has room for one more.
    requirePlanLimit
 7. validate(zod)        checks the body shape. (Known issue: it does not write back query/params, so
                         controllers parse query strings themselves.)
 8. controller           HTTP only: reads req, calls ONE use case, writes the response.
 9. use case             the business rules. This is where "what should happen" lives.
10. repository / services  talk to the database (public via `prisma`, school via `getTenantClient()`).
11. errorHandler         last. Turns any thrown error into { success:false, message, code, details }.
```

**Files to open first, by symptom**
- Wrong school / "School portal not found": `infrastructure/middleware/tenant-resolver.middleware.ts`.
- "Who am I" problems: `auth.middleware.ts`, then `foundation/access.service.ts`.
- "Not allowed": `rbac.middleware.ts` + the role's permissions in the school's `SchoolRolePermission` table.
- "Plan" errors: `feature-gate.middleware.ts` + `foundation/entitlements.service.ts`.
- Anything else: the module's `usecases/` folder; the use case name matches the action.

**Two databases clients.** `prisma` (public tables) and `getTenantClient()` (the current school's tables). `getTenantClient()` **throws if there is no school context** (for example on the platform host or in a background job). Every job that touches a school's data wraps the work in `TenantContext.run({ tenantSchema, schoolId }, ...)`.

**Folder pattern (every module).**
`controllers/` (HTTP) -> `usecases/` (rules; school realm here, platform realm in `usecases/platform/`) -> `repositories/` (database) + `services/` (reusable logic) ; `dtos/` (input shape, zod) ; `mappers/` (database row <-> clean object) ; `domain/` (entities, errors, constants) ; `*.container.ts` (wiring: tells Awilix which class is which name).

**Wiring (Awilix).** `container/index.ts` calls `registerX(container)` for each module. A class asks for what it needs by **name** in its constructor, e.g. `({ prismaClient, auditService })`. If you see `AwilixResolutionError: Could not resolve 'xyz'`, a `registerX` is missing from the list, or the name is spelled differently.

---

## 2. Foundation (the shared rules everything stands on)

### 2.1 Multi-tenancy (schema per school)
- **Problem:** hundreds of schools, strict privacy, one system.
- **Data:** `School` row (public) has `subdomain`, `schemaName`, `schemaProvisionedAt`.
- **What can go wrong:** a request reaches the wrong school; a job forgets the school context; a school's schema is missing.
- **What the system does:** the host decides the school. No school context on a school route -> `NO_SCHOOL_CONTEXT`. A school whose schema is not built yet -> `503 SCHOOL_SETTING_UP`. A suspended school -> `403 SCHOOL_INACTIVE`. A token from school A used on school B -> `TENANT_MISMATCH`.
- **Alternatives:** (a) one set of tables with a `schoolId` on every row: simpler, but one forgotten `WHERE schoolId` leaks data between schools; (b) one database per school: strongest isolation, much costlier to run. Schema-per-school is the middle path.
- **Scale note:** each school's database client stays in memory after first use. Fine for hundreds of schools; add an eviction cap in `prisma.client.ts` before thousands.

### 2.2 Access: who may do what (`foundation/access.service.ts`)
- **Plain words:** "Who is this session, and what may they do?" The answer is built from the person's membership -> roles -> permissions, then remembered for 15 seconds.
- **Rules:** a role with `grantsAll` holds every permission of its realm. Otherwise permissions are the union over all the person's roles; for the same key the widest scope wins. `platform.*` keys only count for platform sessions; school keys only for school sessions.
- **What can go wrong:** you changed a role but the person still has the old rights (cache: wait 15 seconds or call `accessService.invalidate(membershipId)`); a permission key is not registered (typo) -> nobody but all-access roles has it.
- **Debug:** in the school's schema: `Membership` -> `MembershipRole` -> `SchoolRole` -> `SchoolRolePermission`. If the row is not there, the person does not have it.

### 2.3 Entitlements: what the plan includes (`foundation/entitlements.service.ts`)
- **Plain words:** the plan is a menu. Each line is a feature (on/off) or a limit (a number).
- **Rules:** *an unexpired school override replaces the plan value; otherwise the plan row; otherwise not granted. No row means off (or limit 0). A limit row with an empty value means unlimited.* Schools in `trialing`, `active` or `past_due` keep their entitlements; with no subscription they get nothing (which is why every school gets a Free subscription at registration).
- **What can go wrong:** "FEATURE_NOT_AVAILABLE" or "PLAN_LIMIT_REACHED" when it should work -> check (1) the feature definition exists and is active (registry sync ran), (2) the plan has a `PlanEntitlement` row, (3) the school's subscription status, (4) a stale 30-second cache.
- **Alternatives:** storing flags as JSON on the plan (what we had) cannot be edited without a deploy and cannot express limits cleanly.

### 2.4 Registry sync (`foundation/sync-registries.ts`, run on every deploy)
- **Problem:** some things must exist in code (something has to enforce them) but be editable as data (names, defaults).
- **What it does, in order:** feature keys -> permissions -> role templates -> auth email templates -> default plans. New keys are created; existing ones only update **code-owned** columns; platform-edited columns (labels, prices, wording) are never overwritten; a key removed from code is reported, never deleted; a conflict (a key that changed kind) stops the deploy.
- **If something "does not exist":** the sync was not run. This is the first thing to check for: missing permission keys, missing `school_admin` template (provisioning fails), missing Free plan (registration fails).

### 2.5 Errors and the response contract
Success: `{ success:true, message, data, meta? }`. Error: `{ success:false, message, code, details?, errors? }`. **Always debug by `code`, not message.** Server faults (non-operational errors) are hidden from the client and sent to Sentry; everything else is expected and returned as-is.

---

## 3. Auth (`modules/auth`)

### 3.1 Register a school
- **Problem:** let a new school sign up without letting people grab names and abuse the system.
- **Data:** `School` (status `pending`), `User` (unverified), `UserSchool` (link), `Subscription` (Free), OTP.
- **Steps:** one database **transaction** creates school + free subscription + admin user + link; then an OTP is emailed. A per-IP cap (5 registrations/day), reserved subdomains (`www`, `admin`, `api`...), and a duplicate check protect the name space.
- **What can go wrong:** no Free plan in the database -> `REGISTRATION_UNAVAILABLE` (run the sync); duplicate email or subdomain -> `409`; email never arrives -> user can resend (60-second cooldown).
- **Why a transaction:** a half-created school (school but no admin) would be impossible to clean up by hand.
- **Alternatives:** create the school only after email confirmation (cleaner database, but the name is not reserved while the person confirms). We reserve it for 72 hours, then the lifecycle job releases it.

### 3.2 Verify email -> the school becomes active
- **Plain words:** confirming the email is the moment the school is *built* and the admin can sign in. Documents are checked later; until then risky features are locked.
- **Under the hood:** `verify-email.usecase` checks the OTP, marks the user verified, then calls `WorkspaceActivationService`: school `pending -> active`, queues the `provision-schema` job. Response contains `workspace.state = "setting_up"`.
- **What can go wrong:** queue/worker not running -> school stays `setting_up` (`SCHOOL_SETTING_UP`); the daily lifecycle job re-queues anything stuck more than 10 minutes. Email verified but activation failed -> logged, not fatal.

### 3.3 Login (order matters)
1. Per email+IP attempt limit (Redis key `auth:login-fail:*`; 5 failures / 15 min -> `LOGIN_RATE_LIMITED`).
2. Look up the user and **always run one password comparison** (a dummy one if the email does not exist) so timing never reveals which emails exist.
3. Wrong password -> one generic `INVALID_CREDENTIALS`, whatever the cause.
4. Only after the password is proven: `ACCOUNT_LOCKED`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED`.
5. Resolve the session from the **host**: on a school host -> the tenant Membership (if several personas, answer `PERSONA_SELECTION_REQUIRED` and the client logs in again with `persona`); on the platform host -> PlatformMember, or the list of the person's schools.
- **Account lock:** only after 20 failures in total (any IP), for 30 minutes; so one attacker cannot lock someone out from everywhere.
- **Debug:** "valid password but INVALID_CREDENTIALS on a school host" = the person has no active Membership in that school's schema (provisioning did not create it, or a different persona was requested).

### 3.4 Tokens, refresh and logout
- Access token claims: `sub` user, `tid` school, `mid` membership, `mcp` must-change-password, `imp` impersonator. **No roles in the token**; roles are loaded per request, so changes apply within seconds.
- Refresh tokens are stored only as an HMAC (a keyed fingerprint), in rows grouped by `familyId`. Each refresh **rotates**: the old row is revoked and a new one created. Using an already-rotated token again = theft suspected -> the whole family is revoked (`REFRESH_TOKEN_REUSED`). Two tabs refreshing at once get `REFRESH_IN_PROGRESS` (retry once).
- Logout needs no access token (it may be expired): the refresh token identifies the session.
- **Debug:** repeated logouts -> check cookies (`COOKIE_DOMAIN`, secure flag in production), clock, `ENCRYPTION_KEY` unchanged (changing it invalidates every stored fingerprint).
- **Alternative:** stateless refresh tokens (no database rows) cannot be revoked; we trade a row per session for real revocation.

### 3.5 OTPs, password reset
OTP codes are stored as HMACs bound to user and purpose; 5 attempts counted **before** comparing (so parallel guessing cannot beat the limit); single use; forgot/resend always give the same answer (no account discovery). A reset also verifies the email, clears locks and signs out every device.

### 3.6 Invites and impersonation
- **Invite:** the inviter may only grant a role whose every permission they hold themselves (grants-all roles only by a School Admin: `ROLE_NOT_ALLOWED`). Token is 7 days, stored hashed, claimed atomically (accepting twice is impossible). Existing accounts gain a second membership after confirming their password.
- **Impersonation:** platform staff get a one-time Redis ticket (`impersonation:<ticket>`), exchanged once (`GETDEL`) for a school session carrying `imp`; capped at 60 minutes; cannot change passwords or switch persona.

---

## 4. User module (`modules/user`)
- **Problem:** people manage their own profile, password and devices.
- **Rules to remember:** changing a password revokes every session and immediately issues a fresh one for this device (clears `mustChangePassword`). The current-password check is rate limited like a login. Avatars: file type read from the file's first bytes (not the browser's claim), 2 MB. Support can reset a school admin's password (platform permission `platform.users.manage`): temporary password emailed, must be changed at first sign-in.
- **What can go wrong:** forced password change loop -> `PUT /me/password` must return the new session and the frontend must keep it; `IMPERSONATION_RESTRICTED` while impersonating.

---

## 5. School module (`modules/school`)

### 5.1 The life of a school
```
register ──> pending ──(email confirmed)──> active + "setting up" ──(worker finishes)──> active + built
                 │                                                         │
          never confirmed                                       unverified ──docs──> under_review ──> verified
          in 72 h -> released                                         │
                                                       not verified in 30 days -> suspended (locked, nothing deleted)
                                                       still suspended 60 days later AND empty -> released
```
- **Problem:** schools should be able to start using the system immediately, but money, SMS and published results must wait until the school is real; and "just testing" schools must not hold names forever.
- **Data:** `School.status` (pending/active/suspended/deactivated), `verificationStatus` (unverified/under_review/verified/rejected), `schemaProvisionedAt` (set **last**, when the school is truly built), `activatedAt`, documents in `SchoolDocument`.
- **State a frontend sees:** `active | setting_up | suspended | unavailable` (computed by `schoolState()` in `school.policy.ts`).
- **Locked until verified:** guard `requireVerifiedSchool` (`403 SCHOOL_NOT_VERIFIED`): payment setup today; SMS and publishing results when those modules apply it.

### 5.2 The provision worker (`provision-schema.worker.ts`)
Builds the school's schema in **one transaction** (all or nothing): create schema -> apply every migration in `prisma/tenant-migrations` -> seed grading scale and fee types -> copy the platform's **role templates** into the school as its own roles -> commit. Then, outside the transaction, `provisionFirstAdmin` creates the admin's Staff record + Membership + School Admin role; only then is `schemaProvisionedAt` set. It never drops an existing schema (a re-run resumes at the admin step).
- **Fails with "role template school_admin is missing"** -> run the registry sync.
- **School stuck on setting_up** -> is the worker process running? Look at the job in Redis/bull-board; check the log line `Provisioning schema: school_x`.
- **Schema exists but school never completes** -> look for the "resuming at the first-admin step" log; the usual cause is the admin user row missing (`UserSchool` has no row for that school).

### 5.3 Documents and verification
Required documents depend on ownership (private/mission/international: ID + CAC; public: ID + ministry approval). The file type is checked from its bytes (PDF/JPG/PNG), max 3 per type. A government ID is checked with the verification provider (a provider outage never blocks the upload; it goes to manual review). When all required documents are approved the school is verified automatically by the system actor. A platform person can verify with `override` (audited). **Rejecting never deactivates** a school; it stays usable with locked features and can re-upload.

### 5.4 Payment (settlement) account
Money from parents is paid out to this account, so it is treated as high risk: first setup needs no password; **changing** needs the user's password (rate limited); the number is stored encrypted, only the last 4 digits are shown; the bank's account name is compared with the school's name (mismatch allowed but flagged for review); the school and the user are emailed on every change. Subscriptions are never paid into this account.

### 5.5 The daily lifecycle job (`school-lifecycle`)
Five steps (release unconfirmed registrations, re-queue stuck builds, trial reminders, suspend, release empty expired schools). Windows come from `PlatformSettings` (`unconfirmedRegistrationHours`, `unverifiedSchoolTrialDays`, `unverifiedSchoolRetentionDays`). A school with any data is **never** deleted automatically.
- **Alternative:** deleting abandoned schools immediately is simpler but destroys data someone may want; we suspend first, release last, and only when empty.

### 5.6 Platform vs school routes
School's own data: `/school/...` on the school host (permissions `school.*`). Platform actions: `/platform/schools/...` on the admin host (permissions `platform.schools.*`). The use cases live in `usecases/` and `usecases/platform/`, matching the two realms.

---

## 6. Plans module (`modules/plans`)
- **Problem:** the business needs to change prices and what each plan includes without a code release.
- **Data:** `Plan` (name, prices in kobo, `systemKey`, flags) + `PlanEntitlement` rows (one line per feature) + `FeatureDefinition` (the menu of features).
- **Rules:** Free is found by `systemKey = "free"` (renaming it cannot break registration); Free can never be priced or deactivated; a paid plan needs both prices and yearly can never cost more than 12 months; a plan with subscribers cannot be retired; plans are never deleted (invoices point at them). `PUT /platform/plans/:id/entitlements` validates every line first and applies all in one transaction.
- **What can go wrong:** public pricing shows nothing -> no `isPublic && isActive` plans, or the sync did not seed them; `UNKNOWN_FEATURE` -> the feature definition is not in the database (sync).
- **Alternatives:** a fixed JSON of flags on the plan (old way); or hard-coded plans in code. Both need a deploy for every business change.

---

## 7. Subscriptions and billing (`modules/subscriptions`)

### 7.1 The idea in plain words
Every charge is an **invoice**. An invoice has line items (plan, setup fee, credit for unused time, discount). A school pays an invoice by **attempts** (a checkout page, a saved-card charge, or a bank transfer confirmed by staff). **A school's plan only changes when a payment is verified**, never because someone was sent to a payment page.

### 7.2 Tables
`Subscription` (the school's current plan and period) · `SubscriptionInvoice` (+`Item`) · `PaymentAttempt` (each try; its `reference` is the same string we give Paystack) · `PaymentMethod` (saved card, code encrypted, with the checkout email) · `WebhookEvent` (every Paystack event, logged once) · `BillingNotice` (a reminder was already sent) · `PlatformSequence` (invoice numbers).

### 7.3 Money flow
```
choose plan ─> PREVIEW (same maths as the real charge) ─> CHANGE PLAN ─> invoice (open)
   ─> attempt (pending) ─> Paystack checkout ─> customer pays
   ─> THREE things may notice: browser returns / webhook / reconciliation job
   ─> all call BillingEngine.reconcile(reference) ─> verify with Paystack ─> check amount & currency
   ─> lock the invoice row ─> apply: plan + period + card saved ─> invoice paid ─> audit + notify + refresh entitlements
```
- **Why three callers, one road:** whichever notices first does the work; the rest find nothing left to do. The invoice row is **locked** while applying, so two callers cannot both apply it.
- **What the system does in each case:** amount differs -> nothing applied, attempt marked `amount_mismatch`, audit entry; invoice already paid -> recorded as `duplicate_payment`; invoice void -> `payment_on_void_invoice` (needs a manual refund); provider says pending -> stays pending, re-checked later; provider timeout -> **never assumed failed**, verified later by the same reference.
- **Proration:** inside a paid period, same cycle, higher price -> keep the renewal date and charge the price difference for the days left; anything else (from Free, from a trial, monthly<->yearly) -> new period from today at full price minus a credit for unused paid time. A setup fee is charged once in total. A coupon discounts the plan charge only.

### 7.4 The hourly billing job (`billing`), in order
1 re-check pending payments · 2 roll Free periods forward · 3 apply cancellations/scheduled moves to Free · 4 create renewal invoices 3 days ahead · 5 send reminders (7, 3, 1 days, once each) · 6 charge saved cards due now (retries on days +1, +3, +5, +7 inside the grace period) · 7 mark unpaid renewals `past_due` · 8 grace over -> move to Free (data kept, lost plan remembered for "restore") · 9 void stale upgrade invoices.
Every step asks the database "what is still to do" so running twice is harmless, and one school failing never stops the others.
- **Past due does not lock anyone out.** The school keeps plan and features until the grace period ends. Modules may use `requireGoodStanding` to block only *new* enrolments and score entry.

### 7.5 Saved cards
Charging a saved card needs the **same email used at checkout** (stored with the card). The charge reference is fixed (`<invoice>-A<n>`), claimed atomically first, so a crash can never lead to a second charge. Removing the card used for renewal turns auto-renew off.

### 7.6 What can go wrong (and what to look at)
| Symptom | Likely cause | Look at |
|---|---|---|
| Paid but plan did not change | webhook not reaching the server, or amount mismatch | `WebhookEvent` (failed rows), `PaymentAttempt.status/failureReason`, audit `billing.amount_mismatch` |
| Auto-renew switch refuses | no saved card (`AUTO_RENEW_NEEDS_CARD`) | `PaymentMethod` rows; the provider must return `authorization_code` with `reusable = true` (card payments only) |
| Card charge fails every time | email differs from checkout email; card expired | `PaymentMethod.checkoutEmail`, `expMonth/expYear`, `PaymentAttempt.failureReason` |
| Reminders never arrive | billing job not scheduled/running | `scheduleBilling()` called at worker start; Redis; `BillingNotice` rows |
| School moved to Free unexpectedly | unpaid past grace | open invoice `status`, `dueDate`, `PlatformSettings.subscriptionGracePeriodDays`, audit `subscription.lapsed_to_free` |
| Duplicate money | two checkouts for one invoice | `PaymentAttempt` rows for the invoice; `billing.duplicate_payment` audit |

### 7.6b Alternatives we rejected
(a) Paystack's own Subscriptions API: it does not retry failed charges, and has no proration, scheduled downgrades or entitlement checks, so we own the scheduler. (b) Charging the plan immediately on "click upgrade" and fixing later: a failed or abandoned payment would leave the school on a plan it never paid for. (c) Locking the school the day payment fails: schools collect fees and serve parents daily, so we degrade instead.

---

## 8. Background jobs map

| Queue / worker | Runs | Does | If it stops |
|---|---|---|---|
| `provision-schema` | on demand | builds a school | new schools stay `setting_up` |
| `school-lifecycle` | daily 03:00 Lagos | releases/suspends/re-queues | abandoned names never freed; stuck builds not healed |
| `billing` | hourly :05 | renewals, charges, reminders, past due, lapse | no renewals, no reminders, nobody ever lapses |
| `payment-reconciliation` | its own schedule | re-checks pending fee and subscription payments | missed webhooks stay unsettled |
| report-card, term lifecycle, defaulter-reminder, notifications | as built | their own modules | see those modules' passes |

**Always check first:** is the worker process running, is Redis reachable, and was the schedule registered (`scheduleBilling()`, `scheduleSchoolLifecycle()`).

---

## 9. Debugging playbook

### 9.1 Error codes -> meaning -> where to look
| Code | Meaning | Look at |
|---|---|---|
| `TOKEN_MISSING / TOKEN_EXPIRED / TOKEN_INVALID` | no, old or bad token | frontend refresh logic; clock; `JWT_*` secrets |
| `SESSION_INVALID` | membership deleted or user changed | `Membership` row in the school schema |
| `MEMBERSHIP_INACTIVE` | membership suspended/removed | `Membership.status` |
| `TENANT_MISMATCH` | token school differs from host school | which host the browser used; cookie domain |
| `PLATFORM_SESSION_IN_SCHOOL` | platform login used on a school host | use impersonation |
| `NO_SCHOOL_CONTEXT` | school route called on the platform host | the URL/host |
| `SCHOOL_NOT_FOUND / SCHOOL_INACTIVE / SCHOOL_SETTING_UP` | host unknown / suspended / still building | `School` row, provision worker |
| `PERMISSION_DENIED` (details.permission) | role lacks the key | role permissions; did the sync register the key |
| `PERSONA_FORBIDDEN` | wrong kind of login for this action | membership persona |
| `FEATURE_NOT_AVAILABLE` / `PLAN_LIMIT_REACHED` | plan does not include / is full | plan entitlements, subscription status, usage |
| `SCHOOL_NOT_VERIFIED` | feature locked until documents verified | `verificationStatus` |
| `PAYMENT_OVERDUE` | unpaid renewal past due | open invoice |
| `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `LOGIN_RATE_LIMITED`, `EMAIL_NOT_VERIFIED` | login states | Redis `auth:login-fail:*`, `User.lockedUntil` |
| `INVALID_OTP`, `OTP_MAX_ATTEMPTS` | code wrong, expired or used up | `Otp` rows |
| `REFRESH_TOKEN_INVALID / _REUSED`, `REFRESH_IN_PROGRESS` | session ended / theft suspected / race | `RefreshToken` family |
| `INVITE_*`, `ROLE_NOT_ALLOWED`, `ALREADY_MEMBER` | invite state / escalation | `Invite` row, inviter's permissions |
| `DOWNGRADE_BLOCKED` | usage exceeds target plan | details.violations |
| `VALIDATION_ERROR` | body shape wrong | the DTO file for that route |
| `INTERNAL_ERROR` | a real bug | Sentry / server log, search the stack trace |

### 9.2 Handy queries (public schema)
```sql
-- is the school built and verified?
SELECT subdomain, status, "isActive", "schemaProvisionedAt", "verificationStatus", "activatedAt" FROM "School" WHERE subdomain = 'greenfield';
-- which school schemas exist?
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'school_%';
-- current subscription and plan
SELECT s.status, s."currentPeriodEnd", s."autoRenew", p.name FROM "Subscription" s JOIN "Plan" p ON p.id = s."planId" WHERE s."schoolId" = '<id>';
-- unsettled payments and failed webhooks
SELECT reference, status, "failureReason", "createdAt" FROM "PaymentAttempt" WHERE status = 'pending' ORDER BY "createdAt" DESC;
SELECT "eventType", reference, error, "receivedAt" FROM "WebhookEvent" WHERE status = 'failed' ORDER BY "receivedAt" DESC;
-- who did what (audit)
SELECT action, "userId", "schoolId", metadata, "createdAt" FROM "AuditLog" WHERE "schoolId" = '<id>' ORDER BY "createdAt" DESC LIMIT 50;
```
School schema (replace `school_greenfield`):
```sql
SELECT m.persona, m.status, r.name, r."grantsAll" FROM school_greenfield."Membership" m
  JOIN school_greenfield."MembershipRole" mr ON mr."membershipId" = m.id
  JOIN school_greenfield."SchoolRole" r ON r.id = mr."roleId" WHERE m."userId" = '<userId>';
```
Redis keys: `auth:login-fail:*` (login limits), `auth:register:<ip>` (registration cap), `impersonation:<ticket>` (one-time tickets).

### 9.3 A method for any bug
1. Read the **code** in the error response. 2. Find the table above. 3. Reproduce with the smallest request. 4. Check the data (queries above) before reading code: most "bugs" are missing seed data, a worker not running, or a stale 15/30-second cache. 5. Only then open the use case named after the action; the first lines are the guards, the middle is the rule, the end is the database write and audit.

---

## 10. End-to-end test path (do this in order)
1. Run migrations, then the **registry sync** (it must print created permissions, role templates, plans).
2. Start the API **and the workers** (provision, billing, school-lifecycle, reconciliation).
3. `POST /auth/register` on the platform host -> get an OTP email (or read the `Otp`/log in dev).
4. `POST /auth/verify-email` -> response has `workspace.state = setting_up`; watch the provision log; poll `GET /school/public/<subdomain>` until `state = active`.
5. Log in on `<subdomain>.<BASE_DOMAIN>` -> `AUTHENTICATED`; `GET /school/setup-checklist`.
6. Upload documents; as a platform user approve them -> `verificationStatus = verified`.
7. `POST /billing/preview` then `/billing/change-plan` -> pay with a Paystack test card; confirm the plan changed and a saved card exists.
8. Force a renewal in dev: set `currentPeriodEnd` to 2 days ahead, run the billing job (or call `billingLifecycleService.run()`), check the invoice and reminder.
9. Invite a staff member; accept; log in as them; check what they can and cannot do.
10. Break things on purpose: wrong password x6, expired token, old refresh token, wrong host. Each should return the codes in 9.1.

---

## 11. Decisions and alternatives at a glance
| Decision | Why | Alternative |
|---|---|---|
| Schema per school | privacy + cheap | table-per-school-id (leaks on one missed filter), db-per-school (costly) |
| Roles loaded per request, not in the token | edits apply instantly | permissions in token (stale for 15 min) |
| Plan = prices; features = rows | business edits without deploy | JSON flags on the plan |
| Invoice-first billing | state follows verified money | change plan, charge later |
| We own the billing scheduler | retries, proration, entitlement checks | Paystack Subscriptions API |
| Platform Paystack account + subaccounts for fees | easy onboarding, no secrets of schools stored | schools bring their own Paystack keys (their own money and disputes, more support work) |
| Degrade, do not lock out | schools run daily operations | lock on first failed payment |
| School built at email confirmation, features locked until verified | try before documents | build only after manual approval |
| Soft-delete / release instead of delete | recover from mistakes | hard delete |
