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

## Cross-module verification queue

These are not necessarily defects. They are unfinished verification tasks recorded so the team does not mistake source documentation for production validation.

| Area | Outstanding verification |
|---|---|
| Attendance | Execute policy, DB and populated-migration tests; run typecheck/build; add HTTP route tests; close REM-001 |
| Enrolment | Inspect remaining schema/migration/tests/runtime paths; decide and close REM-002 |
| Grades | Execute DB/migration tests, typecheck/build and add HTTP route tests; close REM-003 through REM-008 |
| Report Cards | Add two-tenant queue collision, publication concurrency, HTTP and populated-migration tests; close REM-009 through REM-014 |
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
