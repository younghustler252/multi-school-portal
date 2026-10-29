# Graduation notes

## The rule
A student has two separate facts:
- `isActive`: still on the school's books (can be enrolled, invoiced, and paid for by guardians). Withdrawn students are `isActive = false`.
- `graduatedAt` (+ `graduatedTermId`): finished the last class. Set ONLY by the end-of-year promotion run, cleared ONLY by the audited "undo graduation".

**A student counts toward the plan (`students.max`) when `isActive` AND not graduated.** One constant, `ACTIVE_STUDENT_WHERE` (`students/domain/student-eligibility.ts`), is used by every plan meter and "active students" figure: the plan check (`foundation.container` meters), the two usage services, platform stats, the platform school view and the school dashboard. A test fails if anyone counts students for the plan another way.

A graduate stays `isActive` ON PURPOSE. Guardians' access to pay is `student.isActive` (`guardianChildIds`): setting graduates inactive would have locked families out of paying end-of-year balances and hidden them from reminders. History, report cards and fee records are untouched.

## What the promotion run does (all in the existing transaction)
For each student the single function `promotionOutcome` (used by BOTH preview and run, so they cannot disagree) decides: promoted, repeated, graduated, excluded, or already_enrolled.
- A student in a final class (no next class) is **graduated**: `graduatedAt` and `graduatedTermId` are set, their final-term enrolment becomes `completed` (kept, not deleted), and no place is made in the new term.
- A student who ALREADY has a place in the new term is left completely alone (never graduated). This is a change: before, they would have had their old enrolment closed anyway.
- Already-graduated and inactive students are not in the plan. Running the promotion twice cannot move a graduation date.
- The preview now shows `planImpact: { activeStudentsNow, graduating, activeStudentsAfter }` and each row's `outcome`. The run returns `activeStudentsAfter`. The audit entry lists up to 100 graduate names and the term.
- Term roll-over also refuses to carry a graduate.

## Undo graduation (audited, reason required)
`POST /students/:id/undo-graduation` with `{ reason (5 to 500 characters), reopenEnrolment?: boolean }`. Permission `students.manage` (no new permission, so no role sync).
- The student must be graduated (`STUDENT_NOT_GRADUATED`).
- They count toward the plan again, so there must be room (plan limit error otherwise, nothing changes). An inactive graduate does not count either way, so no room is needed.
- `reopenEnrolment: true` also puts them back in their final class. Only allowed while the term they graduated from is still the CURRENT term (`GRADUATION_TERM_NOT_CURRENT`), the student is active (`STUDENT_INACTIVE`), the old enrolment exists (`GRADUATION_ENROLMENT_NOT_FOUND`) and the class has a free seat under the class lock (`GRADUATION_CLASS_FULL`). Otherwise undo without reopening and enrol the student normally.
- One transaction; two people undoing at once cannot both succeed. Audit `student.graduation_undone` with the reason, who, and whether the enrolment was reopened.

## Entry points that cannot bypass it
Enrol a student, bulk-enrol (skipped with reason `graduated`) and reopening an old enrolment all refuse a graduate (`STUDENT_GRADUATED`). Promotion and roll-over exclude graduates. Reactivating a graduate does not need plan room (they do not count); reactivating anyone else still does. Student update cannot set `isActive` or graduation.

## Announcements and fee reminders
General messages to all students / all guardians skip graduates and families whose ONLY children are graduates (a guardian with at least one continuing child, or none linked, still receives them). Send `includeGraduates: true` to include them; hand-picked recipients are respected. **Fee reminders follow the balance, not the student's status** (`receivesFeeReminder`): no fee-reminder sender exists in the code yet (the notifications module is switched off), so this is a tested rule for it to use.

## Migration `20261031090000_student_graduation`
Adds `Student.graduatedAt`, `Student.graduatedTermId`, a check that they are both set or both empty, and an index. **No student is marked graduated by the migration**: even a student with a completed enrolment in the last class stays ungraduated. Past graduates are marked only by a future promotion run (or by hand with both columns).

**Deploy order:** `git pull`, `git apply graduation.patch`, `npm run prisma:generate` (the generated client is not part of the patch), `npm run migrate:apply-to-existing-schools:dry-run`, `npm run migrate:apply-to-existing-schools`. No `sync:registries` or `sync:school-roles` needed.

## Frontend changes
- Student responses: new `lifecycle` (`active | graduated | inactive`) and `graduatedAt`. `GET /students?status=graduated` (default stays `active`; `active` now means counting toward the plan; `inactive` means withdrawn and not graduated).
- Promotion preview: `summary.graduate` now counts students who will actually graduate (not those already placed); new `planImpact`; each row has `outcome` (null while it needs a decision). Show the "graduates stop counting toward your plan" line before confirming.
- Promotion result: new `activeStudentsAfter`.
- New `POST /students/:id/undo-graduation`; new error codes `STUDENT_GRADUATED`, `STUDENT_NOT_GRADUATED`, `GRADUATION_TERM_NOT_CURRENT`, `GRADUATION_ENROLMENT_NOT_FOUND`, `GRADUATION_CLASS_FULL`.
- Bulk enrol: new skip reason `graduated`. Notifications: new optional `includeGraduates`. Dashboard people block: new `graduatedStudents`.

## Tests (run against a real Postgres)
`tests/graduation/`: `graduation.db.test.ts` (18: preview and run agree, graduation + closure + no next-term place together, counts, repeat run, guardian access and payments, announcements, entry points, roll-over, undo including plan room, reopen, class full, term not current, inactive), `migration.db.test.ts` (populated school upgrade, nothing inferred), `eligibility.test.ts` (rules, no stray counts, report cards/grades do not filter graduates). Database tests run only with `TEST_DATABASE_URL` (a database with "test" in its name); the undo tests also need Redis, because the plan-limit guard loads the app container.
Also run for real, not shipped as automated tests: the existing-school runner (`apply-migration-to-existing-schools.ts`) against two populated schools: dry run changed nothing, the real run applied only this migration, counts unchanged, nobody graduated, second run "already up to date".
**Not run:** HTTP calls to the new route (the app was not started); a real fee-reminder or Paystack payment; the report-card module (switched off, not audited: we only checked it does not filter graduates).

## Known problem on the branch (not from this change)
`src/modules/payments/usecases/handle-webhook.usecase.ts` imports `../domain/payment.enums`, which does not exist, so the app container cannot load (it is in the TypeScript errors list too). The undo tests use a test-only empty stand-in (`tests/graduation/payment-enums-stub.cjs`); delete it and the hook in `graduation.db.test.ts` once the Finance work adds the file. Please tell the Finance developer.

## Not done
- A fee-reminder sender (does not exist yet).
- A "graduate by hand" action for past graduates (use a promotion run, or set both columns in the database).
- Student login access is unchanged (managed separately).
