# Student Graduation Lifecycle

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. There is no standalone `graduation` API module in the current source tree. Graduation is implemented across Students, Enrolment and Sessions. This guide documents those integration boundaries; tests and migration files were inspected but not executed during this review.

## Responsibility and ownership

Graduation is a lifecycle state of a student, not a separate record/module. The canonical fields are:

- `Student.isActive`: whether the student remains on the school's books.
- `Student.graduatedAt`: when the student was graduated by an end-of-year promotion.
- `Student.graduatedTermId`: the term whose final enrolment was completed.

A graduate intentionally remains `isActive=true`. Graduation does not erase enrolments, grades, attendance, report cards, fee invoices or guardian payment access. It removes the student from the plan's active-student count and from future enrolment/promotion/rollover flows.

The shared rule is `ACTIVE_STUDENT_WHERE = { isActive: true, graduatedAt: null }` in `students/domain/student-eligibility.ts`. The same file provides lifecycle classification and announcement/reminder eligibility helpers.

## API entry points

There is no `/graduation` router. The operations are exposed through existing student and enrolment routes.

### Student lifecycle

Mounted under `/api/v1/students`:

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/` | `students.view` | Filter students by lifecycle status |
| GET | `/:id` | `students.view` | Read a student within caller scope |
| POST | `/:id/undo-graduation` | `students.manage` | Clear graduation with a reason; optionally reopen final-term enrolment |

Undo request:
- `reason`: trimmed, 5–500 characters, required.
- `reopenEnrolment`: boolean, defaults to false.
- Unknown properties are rejected.

Student list status values:
- `active`: `isActive=true` and not graduated; this is the plan-counting population.
- `graduated`: `graduatedAt` is set.
- `inactive`: `isActive=false` and not graduated.
- `all`: no lifecycle filter.

The graduated state takes precedence in lifecycle presentation even if a graduate is inactive.

### End-of-year promotion

Mounted under `/api/v1/enrolments`:

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/promotion-preview?termId=...&newTermId=...` | `enrolment.promote` | Read-only preview of promotion outcomes and plan impact |
| POST | `/promote` | `enrolment.promote` | Execute promotion and graduation in one tenant transaction |

The request supplies `currentTermId`, `newTermId`, and optional `overrides` (maximum 500). The server derives normal progression from saved class progression. An override can promote to a selected class, repeat, graduate or exclude; a class ID is required only for the promote action.

The current term and new term must exist, differ, and the new term must start later. Every class without a saved progression decision needs an explicit decision before the run can proceed.

## Promotion rules

The pure `planPromotion` and `promotionOutcome` functions are shared by preview and execution.

- Active, non-graduated students with active enrolments in the selected term form the plan.
- A saved next class means promote; a saved null next class means graduate; no saved progression means a decision is required.
- An explicit override may promote, repeat, graduate or exclude a student.
- A student already enrolled in the new term is left alone and is not graduated or moved.
- Promotion never crosses branches. The target class must belong to the student's branch.
- Target classes are locked and checked for capacity inside the transaction. If any target class would overflow, the whole run is rejected.
- The student's branch is checked again inside the transaction to prevent a concurrent branch transfer from slipping through.
- Promoted and repeated students receive an active enrolment in the new term. The old active enrolment is marked completed.
- Graduating students receive `graduatedAt` and `graduatedTermId`; their final-term enrolment is marked completed; no new-term enrolment is created.
- Excluded students are not moved or graduated.
- A student who already has a new-term place is left completely alone.
- A repeated promotion run does not move the original graduation timestamp.

The preview reports summary counts, per-student action/outcome, branch mismatch indicators, classes without next-class decisions, and `planImpact` with current, graduating and projected active-student counts. The run returns promoted/repeated/graduated/excluded/already-enrolled counts and `activeStudentsAfter`.

## Undo graduation

`UndoGraduationUseCase` requires the student to be graduated and audits the reason. If the student is active, it checks plan capacity before undoing. An inactive graduate does not count toward the plan and therefore does not require plan room to clear graduation.

When `reopenEnrolment=true`, additional conditions apply:

1. Student must be active.
2. The graduation term must still be the current term.
3. A completed enrolment for the student in that term must exist.
4. The final class must have a free seat.

The repository performs the enrolment reopen and graduation clear in one transaction. It locks the class before checking capacity. A failed reopen rolls back the entire operation. Two concurrent undo attempts cannot both clear the same graduation because the update is conditional on `graduatedAt IS NOT NULL`.

Undo without reopening is allowed after the graduation term is no longer current; the student can then be enrolled through the normal enrolment workflow.

## Entry-point enforcement

- Single enrolment rejects inactive and graduated students.
- Bulk enrolment skips graduates with reason `graduated`.
- Reopening a closed enrolment rejects a graduated student.
- Reactivating an inactive graduate does not add them to the plan count; reactivating a non-graduate checks plan capacity.
- Term rollover carries only students whose prior-term enrolment is active and whose student is active and not graduated.
- Student update DTO does not allow clients to set lifecycle fields.
- Undo is the supported audited API path for clearing graduation.

## Plan eligibility, guardian access and notifications

The shared eligibility predicate is intended for plan meters and active-student figures. Graduation does not switch off guardian payment access: payment child lookup is based on the student's `isActive` status, not graduation. This preserves the ability to settle outstanding fees after graduation.

The eligibility domain also defines:
- General announcements skip graduates unless `includeGraduates` is requested.
- Guardians are excluded from general announcements only when all linked students are graduates; guardians with a continuing child or no linked child remain eligible.
- Fee reminders follow outstanding balance rather than graduation status.

These are domain rules and test expectations. This review did not verify a live announcement or fee-reminder sender end-to-end; do not infer that a sender exists merely because the policy helper exists.

## Persistence and migration

Tenant migration `20261031090000_student_graduation` adds nullable `graduatedAt` and `graduatedTermId`, a check constraint requiring both to be set or both null, and an index on `graduatedAt`.

The migration intentionally does not infer past graduates from completed enrolments. Existing student records remain ungraduated until an explicit promotion run or controlled data correction marks both fields.

The schema stores `graduatedTermId` as a scalar field rather than a Prisma relation. This preserves a historical term identifier without making student lifecycle dependent on a Term relation's delete behavior.

## Tests and verification status

Test source inspected:

- `apps/api/tests/graduation/eligibility.test.ts`
- `apps/api/tests/graduation/graduation.db.test.ts`
- `apps/api/tests/graduation/migration.db.test.ts`
- `apps/api/tests/graduation/fixtures.ts`

Coverage includes:
- Plan-count eligibility and lifecycle classification.
- Shared promotion preview/run outcome rules.
- Promotion and final enrolment closure in one transaction.
- Already-enrolled students, repeated runs and branch/capacity constraints.
- Guardian payment access for graduates.
- Announcement and fee-reminder eligibility helpers.
- Single/bulk enrolment and old-enrolment reopening rejection.
- Term-rollover exclusion.
- Undo with/without reopening, plan limits, class capacity and current-term requirements.
- Migration on populated tenant schemas without inferring graduates.

**Not executed in this review:** tests, typecheck, build, migration runner, live API requests, real plan-provider calls, announcement dispatch or fee-reminder dispatch. The legacy `docs/GRADUATION_NOTES.md` records prior operational claims and deployment instructions; those instructions are historical until independently revalidated against current tooling.

## Open implementation and verification items

1. **Plan limit check and undo transaction are separate.** `UndoGraduationUseCase` calls `assertWithinPlanLimit` before `studentRepository.undoGraduation` opens its transaction. Two concurrent undo operations can both observe available capacity and then both restore eligibility, potentially exceeding the plan limit. Decide whether the quota must be concurrency-safe and enforce it with a reservation/locking strategy or durable counter shared by all student-creation/reactivation/undo paths.
2. **Audit is written after graduation state commits.** Promotion and undo commit lifecycle/enrolment changes before calling the audit service. Align failure semantics with the shared audit policy and test audit failure.
3. **No HTTP route tests were found in the inspected graduation test folder.** Add route tests for `students.manage`, `enrolment.promote`, DTO validation, tenant context, preview and undo error/status behavior.
4. **Execute the conditional real-Postgres graduation and migration tests** and verify the existing-school migration runner in a disposable environment before relying on old deployment notes.
5. **Notification sender integration is not established by policy tests.** Verify whether announcement and fee-reminder senders consume the eligibility helpers and whether the current notification module is active for those channels.

## Source paths reviewed

- `apps/api/src/modules/enrolment/routes/enrolment.routes.ts`
- `apps/api/src/modules/enrolment/usecases/promotion.usecases.ts`
- `apps/api/src/modules/enrolment/services/promotion-plan.ts`
- `apps/api/src/modules/enrolment/usecases/enrol-student.usecase.ts`
- `apps/api/src/modules/enrolment/usecases/bulk-enrol.usecase.ts`
- `apps/api/src/modules/enrolment/usecases/update-enrolment.usecase.ts`
- `apps/api/src/modules/enrolment/enrolment.permissions.ts`
- `apps/api/src/modules/students/routes/student.routes.ts`
- `apps/api/src/modules/students/controllers/student.controller.ts`
- `apps/api/src/modules/students/dtos/student.dto.ts`
- `apps/api/src/modules/students/usecases/undo-graduation.usecase.ts`
- `apps/api/src/modules/students/usecases/reactivate-student.usecase.ts`
- `apps/api/src/modules/students/usecases/student-queries.usecases.ts`
- `apps/api/src/modules/students/repositories/student.repository.ts`
- `apps/api/src/modules/students/repositories/student.repository.impl.ts`
- `apps/api/src/modules/students/domain/student-eligibility.ts`
- `apps/api/src/modules/sessions/services/term-rollover.ts`
- `apps/api/prisma/tenant.prisma`
- `apps/api/prisma/tenant-migrations/20261031090000_student_graduation/migration.sql`
- `apps/api/tests/graduation/`
