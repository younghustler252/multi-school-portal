# Backend Remediation Register

> **Purpose:** One developer handoff for actionable backend findings discovered during the module-by-module source audit. This register is cumulative: new findings are added as modules are reviewed. It is not a substitute for the module guides, and it does not imply that every item has been runtime-reproduced.
>
> **Audit branch:** `refactor/modules`  
> **Last updated:** 2026-11-06  
> **Status vocabulary:** `Confirmed behavior` means directly established from current source; `Potential risk` means the code path warrants validation but impact is not yet proven; `Verification` means the source/test state is known but runtime evidence is outstanding.

## Prioritization

- **P0 — Critical:** confirmed cross-tenant exposure, privilege escalation, data corruption or production outage.
- **P1 — High:** confirmed privacy/authorization defect, material integrity risk, or blocking migration defect.
- **P2 — Medium:** unsupported permission contract, inconsistent business behavior, or missing safeguards/tests with plausible impact.
- **P3 — Low:** maintainability, documentation or lower-impact consistency improvement.

No P0 finding has been established in the modules recorded here. Priority may change after reproduction and product decisions.

## Findings

### REM-001 — Attendance student-summary authorization may expose related metadata

- **Module:** Attendance
- **Priority:** P1 — investigate promptly
- **Status:** Potential risk; source path identified, exploit not confirmed
- **Evidence:** The student-summary use case applies the attendance visibility predicate to attendance aggregation, but separately retrieves student, enrolment/class and register-day information. The current test verifies zero attendance days for an unauthorized child but does not assert that all associated student/class metadata is suppressed.
- **Risk:** A guardian or student who is not authorized for the requested student may receive zero attendance marks while still receiving metadata or register-day counts about that student.
- **Recommended action:** Authorize the target student before any related lookup; apply the same authorization boundary to every query contributing to the response. Return a not-found/forbidden response or a fully empty response according to the API's established privacy policy. Add tests asserting no student identity, class, enrolment or register-day metadata leaks for an unrelated child.
- **Owner/workstream:** Attendance backend developer
- **Acceptance criteria:** Unauthorized target requests reveal no student-specific metadata or aggregates; authorized own/linked-child and staff-scope cases continue to pass.

### REM-002 — Enrolment BRANCH scope is declared but currently returns no records

- **Module:** Enrolment
- **Priority:** P2 — contract and permission alignment
- **Status:** Confirmed behavior from source review
- **Evidence:** `enrolment.view` declares BRANCH scope, but the current implementation resolves that scope to no records.
- **Risk:** Users assigned a BRANCH grant may reasonably expect branch-specific enrolments but receive empty results. This can appear as missing data in the frontend and can conceal an incomplete RBAC implementation.
- **Recommended action:** Decide whether enrolment visibility should follow the student's current branch, the enrolment's class branch, or a historical branch-at-enrolment rule. Implement and test the selected rule, or remove BRANCH from the declared scope/grants until it is supported.
- **Owner/workstream:** Enrolment/RBAC developer
- **Acceptance criteria:** Permission metadata and effective query behavior agree; tests cover cross-branch and historical enrolment cases.

### REM-003 — Grades BRANCH scope is declared but explicitly resolves to no records

- **Module:** Grades
- **Priority:** P2 — contract and permission alignment
- **Status:** Confirmed behavior
- **Evidence:** `grades.view` declares ALL, BRANCH, ASSIGNED and OWN. `grades-scope.ts` explicitly returns an empty predicate for BRANCH because classes are not branch-linked in that scope implementation.
- **Risk:** A principal or staff member granted BRANCH visibility sees no grades/mark sheets despite the permission registry advertising the scope.
- **Recommended action:** Define branch visibility against the class's branch and implement it consistently for results, sheet lists and individual sheet reads; or remove the unsupported BRANCH scope from the permission declaration and role grants until class/branch authorization is available.
- **Owner/workstream:** Grades/RBAC developer
- **Acceptance criteria:** Branch-scoped access is tested across list, detail and result endpoints; no cross-branch data is visible.

### REM-004 — Grades approval requirement is hard-coded rather than school-configurable

- **Module:** Grades
- **Priority:** P2 — product/implementation decision
- **Status:** Confirmed behavior
- **Evidence:** `REQUIRE_APPROVAL` is a constant set to `true`. The pure transition policy accepts a `requireApproval` argument and has a no-approval branch, but the use case invokes it without a school-specific value.
- **Risk:** Schools cannot configure direct publication after submission even though the policy surface suggests that behavior may be configurable.
- **Recommended action:** Decide whether approval is mandatory for every school. If configurable, add a persisted school setting and pass it into transition validation, capability calculation and tests. If mandatory, simplify the policy and documentation to remove the unused optional path.
- **Owner/workstream:** Grades/product owner
- **Acceptance criteria:** One explicit product rule is implemented consistently in transition guards, response capability flags and tests.

### REM-005 — Grades setup read endpoints share a permission that includes family personas

- **Module:** Grades
- **Priority:** P3 — confirm intended information boundary
- **Status:** Confirmed route behavior; impact depends on intended product policy
- **Evidence:** `GET /grades/scales` and `GET /grades/schemes` require `grades.view`. That permission is declared for STAFF, STUDENT and GUARDIAN; OWN scope is valid for students/guardians. The setup read use cases return school grading scales/schemes and do not perform a separate staff-persona check.
- **Risk:** Students/guardians with OWN grades-view permission can read school-wide grading configuration even though the route comments describe setup management as an administrative concern. The data is not obviously secret, so this is not classified as a confirmed sensitive-data exposure.
- **Recommended action:** Decide whether family-facing clients need these configuration endpoints. If not, introduce a staff-only read permission or enforce the intended persona/permission. If yes, document the deliberate exposure and add an authorization test.
- **Owner/workstream:** Grades/RBAC developer
- **Acceptance criteria:** Explicit decision reflected in permission metadata, route behavior and tests.

### REM-006 — Grades domain writes and audit writes are not atomic

- **Module:** Grades
- **Priority:** P2 — audit reliability
- **Status:** Confirmed sequencing; failure impact needs runtime validation
- **Evidence:** Scale/scheme saves and deletes, score saves, and sheet transitions commit their database work before calling `auditService.log`. The audit write is not part of the same tenant transaction.
- **Risk:** If audit persistence fails after a domain write commits, the API may report an error even though the scale, scores or workflow state changed. Retrying may then produce confusing outcomes or an incomplete audit trail.
- **Recommended action:** Review the shared audit service's failure semantics and system-wide audit policy. Where the audit record is mandatory, persist it in the same transaction or use a durable outbox. Where audit is intentionally best-effort, return a successful domain result while alerting/recording audit delivery failure. Do not add ad hoc behavior only to grades if a shared pattern is intended.
- **Owner/workstream:** Platform/audit + grades developers
- **Acceptance criteria:** A defined failure policy is tested by forcing audit persistence failure after a write; API response and persisted audit/domain state match that policy.

### REM-007 — Grades lacks HTTP-level route tests in the inspected test suite

- **Module:** Grades
- **Priority:** P2 — verification gap
- **Status:** Confirmed test inventory finding; no route tests found under `apps/api/tests/grades/`
- **Evidence:** The inspected tests cover domain policies, use cases/repositories and database migrations. No test in the grades test folder mounts the Express routers and verifies middleware, route parameters, DTO handling and response envelopes together.
- **Risk:** Unit and use-case tests do not prove that route mounting, middleware ordering, permission guards, validation middleware or controller response handling are wired correctly.
- **Recommended action:** Add HTTP integration tests for setup read/write/delete, sheet read/save/submit/approve/publish/lock/reopen, invalid UUIDs and DTO payloads, unauthenticated requests, missing tenant context, and each relevant scope.
- **Owner/workstream:** Grades backend developer
- **Acceptance criteria:** Routes are tested through the application/router boundary with test database isolation; expected status codes and response envelopes are asserted.

### REM-008 — Grades database and migration tests have not yet been executed in this audit

- **Module:** Grades
- **Priority:** P2 — release verification
- **Status:** Verification outstanding
- **Evidence:** Test source was inspected, but no tests, typecheck, build or migration command was run as part of this documentation review. Database tests require `TEST_DATABASE_URL` and a database name containing `test`.
- **Risk:** Source-level expectations may not match the current generated Prisma client, PostgreSQL constraints, migration ordering or real transaction behavior.
- **Recommended action:** Run policy tests, grades DB tests and both migration tests against a disposable test database; run API typecheck/build; retain the command output and resolve failures before production rollout.
- **Owner/workstream:** Backend QA/release owner
- **Acceptance criteria:** Test commands and environment are recorded; all relevant checks pass or remaining failures are linked to tracked work.

### REM-009 — Whole-class PDF queue job IDs are not tenant-namespaced

- **Module:** Report Cards / background jobs
- **Priority:** P2 — cross-tenant job collision / availability
- **Status:** Potential risk strongly supported by source composition; reproduce with two tenants
- **Evidence:** `ClassPdfUseCase` passes the content hash as the BullMQ job ID. The hash covers template/render data/branding timestamps but not `schoolId` or `tenantSchema`. The BullMQ queue is shared, while the PDF cache folder is school-specific. BullMQ deduplicates jobs with the same retained job ID.
- **Risk:** Two schools with identical report-card render payloads can compute the same job ID. The second school's request may attach to the first school's job and never populate its own school-specific cache while that job ID remains retained.
- **Recommended action:** Namespace the queue job ID with an unambiguous tenant identifier (and optionally class/term) while retaining the content hash as the cache key. Add a two-tenant test with identical render data that proves each tenant gets its own job/cache output.
- **Owner/workstream:** Report cards/background jobs developer
- **Acceptance criteria:** Identical content across two schools cannot deduplicate distinct tenant jobs; both school-specific caches are populated.

### REM-010 — Report-card publication can race with mark-sheet publication changes

- **Module:** Report Cards / Grades
- **Priority:** P2 — snapshot consistency
- **Status:** Potential concurrency risk; no reproduction performed
- **Evidence:** The publish use case reads the current fingerprint, checks staleness, then updates the card status. The fingerprint check and card update are not performed in one transaction that locks/rechecks the relevant mark sheets.
- **Risk:** A mark sheet could be reopened or republished after the fingerprint check but before the report card is published, allowing a card based on an outdated snapshot to become visible.
- **Recommended action:** Decide the required consistency guarantee. If strict freshness is required, lock or version-check the relevant published sheets and revalidate the fingerprint in the same transaction that publishes the card; otherwise explicitly accept the race window and document it.
- **Owner/workstream:** Report cards/grades developer
- **Acceptance criteria:** A concurrency test demonstrates either that stale publication is prevented or that the accepted behavior is explicitly specified.

### REM-011 — Class-PDF status polling is not bound to tenant/class ownership

- **Module:** Report Cards / background jobs
- **Priority:** P3 — authorization boundary review
- **Status:** Confirmed implementation shape; impact limited to status metadata
- **Evidence:** The status route requires authentication, tenant context and `report_cards.view`, but `ClassPdfStatusUseCase` receives only a 16-character job ID and queries the shared queue. It does not bind the job to the requesting school or class. The response reveals only queued/done/failed/unknown.
- **Risk:** A user with report-card view permission may be able to determine the state of another tenant's job if its hash is known. No PDF bytes or card content are returned by this endpoint.
- **Recommended action:** Include tenant identity in the job ID or persist a tenant-scoped job record and verify ownership on poll. Do not rely on the hash being difficult to guess as authorization.
- **Owner/workstream:** Report cards/background jobs developer
- **Acceptance criteria:** A user from school A cannot distinguish or poll a job belonging to school B.

### REM-012 — Report-card publish override is controlled by the request payload

- **Module:** Report Cards
- **Priority:** P2 — product/authorization decision
- **Status:** Confirmed behavior; intended policy needs confirmation
- **Evidence:** `PublishDto.allowMissing` is a caller-supplied boolean. When true, `publishBlockers` permits publication despite subjects that have not been published. The route only requires `report_cards.publish`, which is an ALL-scope sensitive permission; there is no separate school setting check in the publish use case.
- **Risk:** Any principal with the publish permission can bypass the missing-subject completeness check, whether or not the school intends that override to be available.
- **Recommended action:** Confirm whether this is a deliberate per-action override. If so, keep it explicit, audit it and test it. If it is a school policy, read a persisted setting instead of trusting the client. If it is exceptional, use a separate sensitive permission.
- **Owner/workstream:** Report cards/product owner
- **Acceptance criteria:** The selected policy is enforced server-side and represented in role/permission metadata and tests.

### REM-013 — Report-card integration tests do not cover database migrations or HTTP routing

- **Module:** Report Cards
- **Priority:** P2 — verification gap
- **Status:** Confirmed test inventory finding
- **Evidence:** The inspected report-card suite uses pure policy tests and in-memory fake repositories/queue/cache. No report-card DB migration test or HTTP router test was found in the test tree.
- **Risk:** These tests do not validate the report-card migration against populated tenant schemas, Prisma delegate behavior, middleware/route wiring, or real queue/storage integration.
- **Recommended action:** Add populated-schema migration coverage for legacy report cards and HTTP integration tests for visibility, class scope, template routes, publish/unpublish, PDF feature gates and status polling. Verify queue/worker behavior with disposable Redis/storage dependencies.
- **Owner/workstream:** Report cards backend/QA
- **Acceptance criteria:** Migration and HTTP tests run in CI with explicit disposable dependencies and assert tenant boundaries.

### REM-014 — ReportCard persistence adapter duplicates Prisma delegate types

- **Module:** Report Cards
- **Priority:** P3 — type-safety / schema drift
- **Status:** Confirmed implementation; maintainability risk
- **Evidence:** `card-table.ts` defines a handwritten `CardTable` interface and repository comments state that migrated columns are manually typed to compile against the generated Prisma client available at the time.
- **Risk:** Schema or generated-client changes can drift from the hand-maintained delegate interface without compiler detection.
- **Recommended action:** Regenerate the Prisma client and use generated Prisma delegate/input types where possible. Retain a small adapter only if it adds a real abstraction, and type its implementation against generated Prisma types.
- **Owner/workstream:** Report cards/backend developer
- **Acceptance criteria:** Typecheck validates adapter calls against the generated client; no manually duplicated field contract is required for migrated columns.

### REM-015 — Undo graduation plan-capacity check is outside the lifecycle transaction

- **Module:** Student graduation / plan entitlements
- **Priority:** P2 — quota integrity under concurrency
- **Status:** Potential race established by source ordering; not reproduced
- **Evidence:** `UndoGraduationUseCase` calls `assertWithinPlanLimit` before `StudentRepositoryImpl.undoGraduation` opens its database transaction. The transaction protects the one-student graduation clear, but it does not serialize the plan-count check with concurrent undo/create/reactivate operations.
- **Risk:** Two concurrent operations can both observe available capacity and then both restore active-student eligibility, potentially exceeding the configured student limit.
- **Recommended action:** Decide whether plan limits must be strictly concurrency-safe. If yes, introduce a shared quota reservation/lock/counter strategy covering student creation, reactivation and undo graduation—not a local lock used by only one endpoint. Add concurrent tests at the shared quota boundary.
- **Owner/workstream:** Entitlements/platform + students developer
- **Acceptance criteria:** Concurrent operations cannot exceed the plan limit, or the documented product policy explicitly accepts temporary overage and provides reconciliation.

### REM-016 — Promotion and undo-graduation audit writes occur after lifecycle commits

- **Module:** Student graduation / audit
- **Priority:** P2 — audit reliability
- **Status:** Confirmed sequencing; failure impact needs validation
- **Evidence:** Promotion commits enrolment/graduation updates before calling `auditService.log`; undo graduation commits the repository transaction before writing `student.graduation_undone`.
- **Risk:** Audit persistence failure can leave committed lifecycle changes without the corresponding audit record while the API returns an error.
- **Recommended action:** Align with the shared audit policy. If mandatory, use a transaction-aware audit write or durable outbox; if best-effort, return a successful domain outcome while surfacing audit delivery failure operationally.
- **Owner/workstream:** Platform/audit + enrolment/students developers
- **Acceptance criteria:** Forced audit failure has defined, tested API and persistence behavior.

### REM-017 — Graduation has no HTTP-level route tests in the inspected suite

- **Module:** Student graduation / Enrolment
- **Priority:** P2 — verification gap
- **Status:** Confirmed test inventory finding
- **Evidence:** The inspected `apps/api/tests/graduation/` suite covers pure rules and real-Postgres use cases/migrations, but no router/application test mounts the student and enrolment routes.
- **Risk:** Middleware permission enforcement, tenant context, route ordering, request validation and HTTP response envelopes are not verified end-to-end for graduation.
- **Recommended action:** Add HTTP integration tests for promotion preview/run and undo graduation, including missing permission, wrong tenant context, invalid payload/reason, non-graduate, plan limit, reopen-current-term and class-capacity outcomes.
- **Owner/workstream:** Students/Enrolment backend + QA
- **Acceptance criteria:** The endpoints are exercised through the Express router with test tenant isolation and asserted status/error envelopes.

### REM-018 — Additional discounts are deducted twice in student statements

- **Module:** Fees / financial reporting
- **Priority:** P1 — financial statement accuracy
- **Status:** Confirmed by source calculation; regression case not yet executed
- **Evidence:** Approving an `ADDITIONAL_DISCOUNT` increases `FeeInvoice.discountKobo` and reduces `totalKobo`. `FeeReportRepositoryImpl.statementSource` also returns every approved adjustment, and `buildStatement` adds every adjustment as a separate negative statement entry. The invoice entry is already calculated as `subtotalKobo - discountKobo`, so the same additional discount is reflected in both the invoice charge and the adjustment entry.
- **Risk:** Student/family statement running balance is understated by the additional-discount amount, even though the invoice and ledger totals may be correct.
- **Recommended action:** Choose one representation for additional discounts in statements: either keep the discount in the invoice charge and omit it from adjustment entries, or represent invoice charge before the additional discount and show the discount as a separate adjustment. Keep the statement model consistent with invoice/ledger totals.
- **Owner/workstream:** Fees/reporting developer
- **Acceptance criteria:** Regression test for an issued invoice followed by an approved additional discount proves statement closing balance equals the authoritative invoice balance/ledger receivable; waiver, write-off and credit-note statement cases still pass.

### REM-019 — Opening-balance response/audit converts whole-kobo BigInt through Number

- **Module:** Fees / opening balances
- **Priority:** P1 — financial precision
- **Status:** Confirmed unsafe conversion; large-value regression not present
- **Evidence:** The request schema accepts up to 18-digit kobo strings. `OpeningBalancesUseCase` stores `Number(e.amountKobo)` in its created result, then calculates audit `totalKobo` by converting that potentially rounded number back to BigInt. JavaScript Number cannot exactly represent every integer above `Number.MAX_SAFE_INTEGER`.
- **Risk:** Large opening balances can be posted accurately to the invoice/journal using BigInt but returned and audited with a different amount.
- **Recommended action:** Keep amounts as BigInt internally and serialize each result with the shared `koboOut` helper (number when safe, digit string otherwise). Compute the audit total directly from original BigInt values, never from serialized numbers.
- **Owner/workstream:** Fees developer
- **Acceptance criteria:** Test an amount above `Number.MAX_SAFE_INTEGER` kobo and assert exact response serialization, audit total and posted invoice amount.

### REM-020 — Persisted finance grace-days setting is not used by late-fee execution

- **Module:** Fees / Finance Settings
- **Priority:** P2 — configuration contract mismatch
- **Status:** Confirmed behavior
- **Evidence:** `finance.grace_days` is defined in `FINANCE_SETTING_DEFS` and described as the school's late-fee grace period. `RunLateFeesUseCase` instead uses the request DTO's `graceDays`, whose default is zero; it does not read `FinanceSettingsReader`.
- **Risk:** Changing the school finance setting has no effect on late-fee runs unless the caller independently supplies the matching request value. A client that omits it can charge fees earlier than the configured policy.
- **Recommended action:** Decide whether the request is an intentional override. If the school setting is authoritative, inject the settings reader and use its grace-days value (or define a permissioned explicit override with clear precedence). Add tests for default, configured and override cases.
- **Owner/workstream:** Fees/finance-settings developer
- **Acceptance criteria:** Effective late-fee grace period matches the documented school policy and is covered by use-case tests.

### REM-021 — Family fee-summary overdue count uses server UTC date instead of finance timezone

- **Module:** Fees / family reporting
- **Priority:** P3 — date-boundary consistency
- **Status:** Confirmed implementation inconsistency; impact is time-window dependent
- **Evidence:** `FeeReportRepositoryImpl.familySummary` calculates `today` with `dayString(new Date())`, while fee reports and late-fee operations use `todayInFinanceZone`.
- **Risk:** Around midnight, a family may see an overdue-invoice count that differs from staff ageing/late-fee calculations because the server date and school finance date can differ.
- **Recommended action:** Inject/use the same finance-zone clock/date helper as the other fee reports. Add tests around the UTC/local date boundary.
- **Owner/workstream:** Fees/reporting developer
- **Acceptance criteria:** Family overdue counts, ageing reports and late-fee calculations use the same school-local business date.

### REM-022 — Credit allocation rows can be mutated from stale snapshots

- **Module:** Payments / credit application and refund payout
- **Priority:** P1 — financial integrity under concurrency
- **Status:** Potential race established by source/repository implementation; not reproduced against PostgreSQL
- **Evidence:** `CreditService.applyToInvoice` and `PayRefundUseCase` read a credit allocation row, calculate a remaining amount and call `PaymentRepositoryImpl.setAllocationAmount`. That repository method performs an unconditional absolute update/delete by allocation ID; it has no amount/version predicate or row lock. Payment `unallocatedKobo` is changed separately using an atomic increment/decrement.
- **Risk:** Two concurrent credit applications or refund payouts can read the same starting allocation and overwrite one another's remaining amount while independently decrementing the payment's unallocated amount. Allocation totals, visible credit and the ledger liability can diverge.
- **Recommended action:** Introduce a shared atomic credit-consumption operation. Lock the payment/credit allocation rows in a tenant transaction or use conditional decrement/update predicates that guarantee the amount is still available. Ensure credit application and refund payout share the same serialization boundary. Add concurrent PostgreSQL tests for two invoices consuming one credit row and two refunds paying from one row.
- **Owner/workstream:** Payments/ledger developer
- **Acceptance criteria:** Concurrent operations cannot consume more than the original credit; payment unallocated balance, credit allocations, invoice allocations and Advance Payments ledger balance remain equal.

### REM-023 — Refund requests can over-reserve credit under concurrent requests

- **Module:** Payments / refunds
- **Priority:** P1 — financial integrity under concurrency
- **Status:** Potential race established by source ordering; not reproduced
- **Evidence:** `RequestRefundUseCase` calculates available credit after querying REQUESTED/APPROVED refunds, then creates a new refund in a separate operation. The read/check and insert are not enclosed in a transaction or serialized by a per-payment/student lock; the refund table has no aggregate constraint enforcing total open refunds <= credit.
- **Risk:** Two requests can both observe the same available credit and create reservations whose combined amount exceeds the credit. Later payouts may fail, and the approval queue can contain refunds that cannot all be paid.
- **Recommended action:** Make refund reservation atomic with credit availability. Serialize on the underlying payment/credit row or create a reservation counter with a database-enforced bound. Coordinate this with REM-022 so credit application and refund reservation/payout cannot race each other.
- **Owner/workstream:** Payments developer
- **Acceptance criteria:** Concurrent refund requests cannot reserve more than available credit; test with two requests whose combined amount exceeds the held credit.

### REM-024 — Gateway settlement response converts BigInt kobo amounts to Number

- **Module:** Payments / settlements
- **Priority:** P1 — financial precision
- **Status:** Confirmed unsafe conversion; large-value regression not present
- **Evidence:** `RecordSettlementUseCase` returns `receivedKobo`, `feeKobo` and `grossKobo` via `Number(...)`. The DTO accepts up to 18-digit kobo strings, beyond JavaScript's exact integer range.
- **Risk:** Large settlement values can be posted correctly by the BigInt ledger path but reported to the caller with rounded amounts.
- **Recommended action:** Use the shared `koboOut` serializer for all three response fields and preserve BigInt for calculations.
- **Owner/workstream:** Payments developer
- **Acceptance criteria:** A settlement with values above `Number.MAX_SAFE_INTEGER` kobo returns exact digit strings and matches the posted journal amounts.

### REM-025 — Settlement idempotency is bypassed when reference is omitted

- **Module:** Payments / settlements
- **Priority:** P2 — duplicate posting risk
- **Status:** Confirmed behavior
- **Evidence:** `RecordSettlementDto.reference` is optional. The use case uses the reference as `sourceId` for the ledger posting idempotency key, but generates a fresh UUID when reference is absent.
- **Risk:** Retrying the same settlement request without a reference creates a new idempotency key and can post the same settlement more than once.
- **Recommended action:** Require a stable gateway settlement reference or a client-supplied idempotency key. If manual settlements may lack a gateway reference, still require a stable unique operation ID and persist it.
- **Owner/workstream:** Payments developer
- **Acceptance criteria:** Repeating the same settlement operation returns/recognizes the first posting even when no external bank reference exists.

### REM-026 — Payment routes and credit/refund concurrency lack HTTP/real-DB coverage

- **Module:** Payments
- **Priority:** P2 — verification gap
- **Status:** Confirmed test inventory finding
- **Evidence:** The inspected payment tests use in-memory repositories and the posting test harness. No payment router integration test or dedicated populated-schema migration test was found in the inspected suite.
- **Risk:** The current suite does not prove middleware/tenant/permission behavior or real PostgreSQL isolation and concurrent credit/refund behavior.
- **Recommended action:** Add HTTP tests for guardian ownership, staff permissions, payment confirmation, webhook/online verification boundaries and settlement routes. Add PostgreSQL concurrency tests for REM-022/023 and populated migration tests for payment targets/refund approval columns.
- **Owner/workstream:** Payments backend/QA
- **Acceptance criteria:** HTTP and real-DB tests run in CI with disposable tenant schemas and assert financial invariants under concurrent operations.

### REM-027 — Fee-payment webhook event filtering and tenant metadata need end-to-end verification

- **Module:** Payments / Webhooks
- **Priority:** P2 — integration boundary verification
- **Status:** Verification task; no exploit established
- **Evidence:** `FeePaymentWebhookHandler.handles` accepts `charge.success` events with a reference when metadata type is not `subscription_invoice`. `handle` requires `metadata.schoolId`, resolves the tenant schema and confirms by reference; it does not use metadata `paymentId` or `invoiceId` as an additional consistency check.
- **Risk:** Unrelated successful charge events may be routed to this handler and fail for missing school metadata; metadata/reference mismatch behavior is not covered by the inspected tests.
- **Recommended action:** Verify handler ordering/filtering with all registered webhook handlers. Cross-check event metadata payment ID/invoice ID against the payment resolved by reference where those fields are required. Add tests for unrelated events, missing metadata, wrong school and mismatched payment IDs.
- **Owner/workstream:** Payments/Webhooks developer
- **Acceptance criteria:** Only intended school-fee events reach this handler, tenant resolution is verified, and metadata/reference mismatches are rejected without confirming the wrong payment.

### REM-028 — Period close can race with journal posting

- **Module:** Ledger / accounting periods
- **Priority:** P1 — accounting-period integrity
- **Status:** Potential race established by transaction boundaries; not reproduced against PostgreSQL
- **Evidence:** `PostingService.openPeriodFor` reads a period and checks `status === OPEN` without locking the period row. `ClosePeriodUseCase` computes the checklist, then `FinancePeriodRepositoryImpl.close` performs a separate conditional OPEN→CLOSED update. There is no shared lock/transaction covering the checklist, close transition and posting's period validation.
- **Risk:** A posting transaction may read OPEN, then a concurrent close may commit, after which the first transaction can still insert a journal referencing the now-closed period. That violates the rule that no journal may be posted into a closed period.
- **Recommended action:** Serialize both operations on the same FinancePeriod row. For example, acquire a row lock in the posting transaction before checking status and in close before final checklist/transition, with a consistent lock order. Ensure close re-runs the integrity/checklist under the chosen serialization boundary. Add a two-connection PostgreSQL race test.
- **Owner/workstream:** Ledger developer
- **Acceptance criteria:** A posting and close racing for the same period cannot produce a journal committed after closure; either the posting commits before close and is included in checks, or it is rejected as closed.

### REM-029 — Period-close behavior has no dedicated test or HTTP integration suite

- **Module:** Ledger
- **Priority:** P2 — verification gap
- **Status:** Confirmed test inventory finding
- **Evidence:** The inspected finance test tree contains posting, schema, books-usecase, accounts and integrity tests, but no period-close test file and no ledger HTTP router test.
- **Risk:** Blocker/warning calculation, acknowledgement, end-date checks, reconciliation setting, reopen behavior, middleware and period/posting concurrency are not covered by a focused automated suite.
- **Recommended action:** Add unit tests for checklist severity and period use cases, PostgreSQL concurrency tests for REM-028, and HTTP tests for close/reopen/checklist permissions, tenant context, validation and response envelopes.
- **Owner/workstream:** Ledger backend/QA
- **Acceptance criteria:** Period close and reopen are tested at policy, use-case, PostgreSQL and HTTP layers.

### REM-030 — Finance timezone is globally hard-coded to Africa/Lagos

- **Module:** Ledger / finance-wide date handling
- **Priority:** P2 — internationalization design decision
- **Status:** Confirmed implementation; product decision required
- **Evidence:** `FINANCE_TIMEZONE` is a module constant set to `Africa/Lagos`; posting, period close and finance date helpers use this global value. It is not loaded from school settings.
- **Risk:** A school operating outside Nigeria will have business dates, future-date validation, period closure and reports interpreted using Lagos time.
- **Recommended action:** Decide whether timezone is a per-school setting before onboarding other countries. If so, store/validate an IANA timezone during school setup and inject one shared finance clock into every finance module and worker. Do not let modules independently choose timezones.
- **Owner/workstream:** Platform architecture + finance modules
- **Acceptance criteria:** A non-Lagos tenant test proves posting, payment, late fee, period close and date reports all use the configured school timezone.

### REM-031 — Required system-account count comment says 17 while registry has 18

- **Module:** Ledger
- **Priority:** P3 — maintenance/documentation consistency
- **Status:** Confirmed inconsistency
- **Evidence:** `REQUIRED_SYSTEM_KEYS` contains 18 entries, while the comments in `ledger.constants.ts`, `ledger-integrity.ts` and `integrity.test.ts` describe 17 accounts.
- **Risk:** Future maintainers may misread the required account set or incorrectly remove/add a system key while trying to match the documented count.
- **Recommended action:** Update comments and test descriptions to refer to the actual array length or avoid hard-coded counts.
- **Owner/workstream:** Ledger developer
- **Acceptance criteria:** Comments and documentation no longer contradict the source list.

## Cross-module verification queue

These are not necessarily defects. They are unfinished verification tasks recorded so the team does not mistake source documentation for production validation.

| Area | Outstanding verification |
|---|---|
| Attendance | Execute policy, DB and populated-migration tests; run typecheck/build; add HTTP route tests; close REM-001 |
| Enrolment | Inspect remaining schema/migration/tests/runtime paths; decide and close REM-002 |
| Grades | Execute DB/migration tests, typecheck/build and add HTTP route tests; close REM-003 through REM-008 |
| Report Cards | Add two-tenant queue collision, publication concurrency, HTTP and populated-migration tests; close REM-009 through REM-014 |
| Graduation | Validate quota concurrency, audit failure policy and HTTP routes; execute DB/migration tests; close REM-015 through REM-017 |
| Fees | Fix statement arithmetic and BigInt serialization; align grace-days/timezone settings; add regression, HTTP and DB migration tests; close REM-018 through REM-021 |
| Payments | Serialize credit consumption/refund reservation; fix settlement precision/idempotency; verify webhook filtering; add HTTP and PostgreSQL concurrency tests; close REM-022 through REM-027 |
| Ledger | Serialize posting/period close; add period-close and HTTP tests; decide tenant timezone; close REM-028 through REM-031 |
| Other module guides | Complete remaining source/schema/migration/test review as stated in each guide before declaring the module fully verified |

## Developer handoff protocol

1. Reproduce or validate each finding before changing code; preserve the evidence path and current behavior.
2. Agree on product semantics where the finding is a design decision, not an objective defect.
3. Implement the smallest consistent fix; avoid unrelated refactors.
4. Add regression tests at the lowest useful layer and at the HTTP boundary where authorization/validation is involved.
5. Update the relevant module guide and this register in the same change.
6. Mark an item **Resolved** only after the fix and regression test are present; mark it **Accepted** only with an explicit rationale and owner.
7. Run the relevant test suite, migration checks, typecheck and build. Do not mark runtime verification complete based only on code review.

## Change log

- 2026-11-06: Initial register created from the attendance, enrolment and grades audits. More findings will be appended as remaining backend modules are reviewed.
- 2026-11-06: Added report-card queue isolation, publication consistency, override-policy, HTTP/migration coverage and Prisma type-safety findings.
- 2026-11-06: Added graduation plan-capacity concurrency, audit reliability and HTTP route coverage findings.
- 2026-11-06: Added fee-statement arithmetic, BigInt precision, grace-days configuration and finance-timezone findings.
- 2026-11-06: Added payment-credit concurrency, refund reservation, settlement precision/idempotency and webhook verification findings.
- 2026-11-06: Added ledger period-close concurrency, period-close test coverage, finance timezone and system-account count findings.
