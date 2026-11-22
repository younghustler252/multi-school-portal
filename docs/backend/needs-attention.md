# Backend: Needs Attention

Technical debt we are knowingly **not** fixing right now, kept so it is not lost. Nothing here is closed. The full evidence, recommended action and acceptance criteria for each item stay in [`BACKEND_REMEDIATION_REGISTER.md`](./BACKEND_REMEDIATION_REGISTER.md) under the same REM id.

**Last updated:** 2026-11-20. **Paused at:** all remediation Batches 1 to 12 are merged into `refactor/api`; nothing is in progress except the attendance security fix (`fix/api/attendance-summary-scope`).

Priority is the register's (P1 high, P2 medium, P3 low) unless a section says otherwise.

## Deployment and rollout conditions (must not be forgotten)

| Item | Condition |
|---|---|
| Tenant migration `20261116090000_audit_outbox` | Run on every school schema **before** the outbox code goes live; then tenant `prisma generate` |
| Public migration `20261116100000_coupon_exhausted_exception` | Before the coupon code goes live |
| Public `20261116110000_platform_settings_singleton` and tenant `20261116110000_school_settings_singleton` | Both delete duplicate settings rows, keeping the latest; back up first |
| REM-095 (P1, mitigated, not resolved) | Frontend/backend rollout of explicit platform notification targeting, then set `PLATFORM_BROADCAST_STRICT=true` |
| REM-037 | Check production for duplicate live payroll runs before the uniqueness migration |
| Verification | Typecheck, `prisma generate`, `npm test`, `npm run test:local` run by the owner (the sandbox cannot) |
| Branch hygiene | Two Unverified GitHub merge commits on `refactor/api` need an explicit decision; `refactor/api` to `refactor/modules` integration is owner-controlled |

## Approved contract additions (roadmap, scope unchanged)

Built to the agreed designs and decisions in open PRs into `refactor/api`; waiting for review and merge (a duplicate set of implementations merged on 2026-11-22 was reverted so these stay the single source).

| Addition | Status |
|---|---|
| Bank list and account verification | Done (PR #47) |
| School entitlements in `/users/me/permissions` | Open PR #49 |
| Invoice-level payment history | Open PR #51 |
| Platform-wide user listing and search | Open PR #52 (new `platform.users.view` permission) |
| Report-card letterhead upload | Open PR #53 (part E) |
| School-specific subscription billing history | Open PR #53 (part F) |

## Known smaller observations from the attendance review (not fixed)

| Observation | Endpoint | Priority | Why deferred / condition |
|---|---|---|---|
| Class summary answers 403 for an existing out-of-scope class and 404 for a missing one, so class existence is visible | `GET /attendance/classes/:id/summary` and register | P3 | Matches the register rule and class ids are not secret; change both together if the policy tightens |
| Subject-teacher term semantics differ: lists and student summary use the current term, class summary and register use the term asked for | attendance reads | P3 | Intentional; revisit if teachers need history of past terms in lists |
| Dashboard `people` and `academics` blocks use `students.view`/`staff.view` without narrowing to scope | `GET /dashboard` | P2 | Counts only (no identifiers); needs a decision on what a branch/teacher dashboard should show |
| Report-card attendance snapshot and automation attendance aggregates not reviewed for scope | report cards, automation | P2 | Review after the grades frontend starts; server-side jobs, not user-facing reads |
| Withdrawn/transferred student's history stays visible to that class's teacher | attendance summary | P3 | Intended (marks are class history); confirm with product |


## A. Frontend blockers (not deferred)

| Id | Status |
|---|---|
| REM-003, REM-005, REM-012 | Done in PR `fix/api/grades-reportcards-decisions` (see the register) |
| REM-113, REM-114 | Done in PR `fix/api/request-validation-errors` (frontend note: validation `errors` values are now strings) |

## B. Integrity risks: real, but need production conditions; do next after the blockers

Races, double counting or state drift that appear only under concurrency, odd data or provider failures. No frontend feature is waiting on them, but they are the first items to schedule once blockers are done.

**Impact:** Wrong money/state in rare cases (e.g. REM-049 shows a returned salary as PAID).

**Dependency / condition:** Each needs a small migration or transaction change plus a real-Postgres test; REM-049 and REM-064 also need a product rule on the recovery state.

| Id | Module | Problem | Priority |
|---|---|---|---|
| REM-009 | Report Cards / background jobs | Whole-class PDF queue job IDs are not tenant-namespaced | P2 |
| REM-010 | Report Cards / Grades | Report-card publication can race with mark-sheet publication changes | P2 |
| REM-015 | Student graduation / plan entitlements | Undo graduation plan-capacity check is outside the lifecycle transaction | P2 |
| REM-025 | Payments / settlements | Settlement idempotency is bypassed when reference is omitted | P2 |
| REM-033 | Expenses / budgets | Budget block enforcement is vulnerable to concurrent approvals | P2 |
| REM-040 | Payroll | Payroll calculation inputs can change before approval without stale-run detection | P2 |
| REM-049 | Salary Transfers / Payroll | Reversed salary transfer leaves payroll run and payslip marked PAID | P2 |
| REM-054 | Bank Reconciliation | Imported statement closing balance is stored but ignored by summary fallback | P2 |
| REM-063 | Plans | Plan creation/clone and entitlement grants are not one atomic operation | P2 |
| REM-064 | Plans / Subscriptions | Plan deactivation does not account for open upgrade invoices | P2 |
| REM-073 | Subscriptions / Provisioning | One-live-subscription-per-school is not enforced at the database boundary | P2 |
| REM-087 | Automation | Default automation rules are not protected by a unique definition key | P2 |
| REM-088 | Automation / scheduler | A claimed automation occurrence is lost after process crash or runner failure | P2 |
| REM-091 | Automation / Entitlements | Plan automation-rule limit check is not serialized with enabling rules | P2 |

## C. Scope and policy decisions

Behavior is consistent but not what the permission metadata or settings advertise, or the rule is a product call.

**Impact:** Branch-scoped enrolments return nothing (REM-002), timezones are fixed to Africa/Lagos (REM-030, 089, 021), grace days and approval rules are not configurable (REM-004, 020).

**Dependency / condition:** Product decision first: enrolment/grades branch rule, multi-timezone schools, whether approval and grace days are per-school.

| Id | Module | Problem | Priority |
|---|---|---|---|
| REM-002 | Enrolment | Enrolment BRANCH scope is declared but currently returns no records | P2 |
| REM-004 | Grades | Grades approval requirement is hard-coded rather than school-configurable | P2 |
| REM-020 | Fees / Finance Settings | Persisted finance grace-days setting is not used by late-fee execution | P2 |
| REM-021 | Fees / family reporting | Family fee-summary overdue count uses server UTC date instead of finance timezone | P3 |
| REM-030 | Ledger / finance-wide date handling | Finance timezone is globally hard-coded to Africa/Lagos | P2 |
| REM-089 | Automation / school settings | Automation daily/weekly schedules use a global Lagos timezone | P2 |
| REM-031 | Ledger | Required system-account count comment says 17 while registry has 18 | P3 |

## D. Audit, atomicity and abuse controls

Audit gaps, non-atomic writes, orphaned files, feedback abuse and retention. The audit outbox (Batch 8) already covers the school-side atomicity for new writes.

**Impact:** Missing audit rows for platform actions, rare partial writes, spam on feedback.

**Dependency / condition:** Platform audit needs the outbox pattern extended to the public schema; feedback rate limit needs a limiter policy.

| Id | Module | Problem | Priority |
|---|---|---|---|
| REM-006 | Grades | Grades domain writes and audit writes are not atomic | P2 |
| REM-016 | Student graduation / audit | Promotion and undo-graduation audit writes occur after lifecycle commits | P2 |
| REM-082 | Platform Settings / Audit | Platform settings changes are not audited | P2 |
| REM-085 | School Settings / Storage | Replacing school stamp/signature leaves old public storage objects orphaned | P2 |
| REM-096 | Notifications / Audit | Platform notification sends are not audited | P2 |
| REM-099 | Notifications / Email and SMS | External notification delivery is at-least-once without provider idempotency | P2 |
| REM-106 | Feedback | Feedback submission has no rate limit or abuse control | P2 |
| REM-107 | Feedback | Feedback pageUrl is stored/returned without safe URL normalization or secret stripping | P2 |
| REM-108 | Feedback / Audit | Platform feedback review, response and deletion are not audited | P2 |
| REM-109 | Feedback | Feedback support email has no durable retry/outbox | P2 |
| REM-110 | Feedback | Feedback deletion is a hard delete with no retention/tombstone | P3 |

## E. Correctness, limits and polish

Edge-case correctness, attribution, large-number handling and response polish. REM-116 (warn-mode warnings) is additive and the frontend can ship without it.

**Impact:** Wrong actor on some records, BigInt-to-Number on very large totals, silent list truncation, unexposed plan warnings.

**Dependency / condition:** Independent of each other; pick up in module batches. REM-061 needs production data to verify.

| Id | Module | Problem | Priority |
|---|---|---|---|
| REM-011 | Report Cards | Class-PDF status polling is not bound to tenant/class ownership | P3 |
| REM-014 | Report Cards | ReportCard persistence adapter duplicates Prisma delegate types | P3 |
| REM-035 | Expenses / recurring jobs / audit | Recurring auto-approval is attributed to the template creator rather than the system actor | P2 |
| REM-042 | Payroll / remittances | Payroll remittance due list omits valid liability accounts accepted by components | P2 |
| REM-046 | Salary Transfers / audit | Transfer completion attributes run payment to the initiator, not the confirming actor | P2 |
| REM-047 | Salary Transfers | Salary-transfer start response converts BigInt batch total to Number | P2 |
| REM-048 | Salary Transfers | Provider-safe transfer amount is checked only during send, after rows are created | P2 |
| REM-055 | Bank Reconciliation / CSV import | CSV parser can silently skip malformed transactions whose narration contains summary keywords | P2 |
| REM-056 | Bank Reconciliation / statement import | Occurrence-based dedupe can collapse a genuine duplicate in overlapping statements | P2 |
| REM-057 | Bank Reconciliation / matching | Greedy auto-match can produce a suboptimal global assignment | P2 |
| REM-059 | Finance Reports | Finance report row limit is enforced after full materialization | P2 |
| REM-061 | Finance Reports / Entitlements | Accountant report entitlement definition/grants need production verification | P2 |
| REM-076 | Gateway Settlements | Gateway settlement preview does not validate effective settlement date | P3 |
| REM-090 | Automation | Automation source queries silently truncate at fixed take limits | P2 |
| REM-105 | Webhooks / Paystack adapter | Webhook event key fallback collapses events with no ID/reference to type:none | P3 |
| REM-116 | API Infrastructure / Entitlements | Entitlement warn-mode decisions are not exposed to clients | P2 |

## F. Test coverage gaps

No behavior is known to be wrong; these are missing HTTP and real-Postgres tests.

**Impact:** Regressions would be caught late.

**Dependency / condition:** Needs a working local Postgres plus the real dependency install (the user's `npm run test:local` run).

| Id | Module | Problem | Priority |
|---|---|---|---|
| REM-007 | Grades | Grades lacks HTTP-level route tests in the inspected test suite | P2 |
| REM-008 | Grades | Grades database and migration tests have not yet been executed in this audit | P2 |
| REM-013 | Report Cards | Report-card integration tests do not cover database migrations or HTTP routing | P2 |
| REM-017 | Student graduation / Enrolment | Graduation has no HTTP-level route tests in the inspected suite | P2 |
| REM-026 | Payments | Payment routes and credit/refund concurrency lack HTTP/real-DB coverage | P2 |
| REM-027 | Payments / Webhooks | Fee-payment webhook event filtering and tenant metadata need end-to-end verification | P2 |
| REM-029 | Ledger | Period-close behavior has no dedicated test or HTTP integration suite | P2 |
| REM-036 | Expenses / recurring expenses | Recurring expense execution has no dedicated tests or route integration tests | P2 |
| REM-043 | Payroll | Payroll lacks HTTP and real-Postgres concurrency tests | P2 |
| REM-050 | Salary Transfers | Salary transfers lack real-Postgres and HTTP/provider integration coverage | P2 |
| REM-051 | Finance Settings | Finance settings lacks HTTP and real-tenant isolation tests | P2 |
| REM-058 | Bank Reconciliation | Bank reconciliation lacks HTTP and real-Postgres concurrency tests | P2 |
| REM-060 | Finance Reports | Finance Reports has no dedicated report-engine, statement-builder or HTTP tests | P2 |
| REM-072 | Subscriptions | Subscription/billing lifecycle has no dedicated automated test suite | P2 |
| REM-075 | Gateway Settlements | Gateway Settlements has no dedicated parser/matcher/database/HTTP tests | P2 |
| REM-080 | Audit | Audit read/query behavior lacks school/platform isolation and enrichment tests | P2 |
| REM-086 | Platform Settings / School Settings | Platform Settings and School Settings lack database-backed integration tests | P2 |
| REM-092 | Automation | Automation has no real-tenant DB or HTTP route integration tests | P2 |
| REM-100 | Notifications | Notifications lacks real-DB and HTTP integration coverage | P2 |
| REM-104 | Webhooks | Webhook tests do not cover real HTTP signature/raw-body and concurrent DB claims | P2 |
| REM-111 | Feedback | Feedback platform-management paths lack automated tests | P2 |
