# Small fixes (hardening, part H5)

## 1. Term roll-over reports classes over capacity
Setting a term current with `carryForward` still enrols every active student in the SAME class (a roll-over must never leave a student without a class), even if the class is now over its capacity. The result now says so: `rollover.overCapacity` is a list of `{ classId, name, capacity, enrolled }`, worst first (empty when nothing is over; a class with no capacity is never listed). One extra query, only when students were carried. The same list is in the audit entry. The admin can then move students (enrolment update) or raise the capacity.
**Frontend:** show a warning after a roll-over when `rollover.overCapacity` is not empty.

## 2. "Unknown" names are null
A missing relation is `null`, not a made-up name (classes and enrolment modules only):
- enrolment responses: `student` and `class` can be `null`
- subject assignment responses: `class` and `subject` can be `null`
- promotion preview and result rows: `student` and `fromClass` can be `null`
In practice the database links make these rare (a deleted class, for example), but the screens must not break on them. Audit entries use `null` for a missing name.
**Frontend:** these fields are now nullable in the types.
Not changed (other owners, different meaning): the audit log reader's "Unknown" actor, the expenses report's "Unknown term", the subscriptions report's plan name, report-card subject names, and the staff-name lookup's "Unknown" for a staff member with no login (it still carries the staff id).

## 3. Employee id retry
An automatic employee id is now the next FREE number, chosen inside the saving transaction (like admission numbers): ids typed by hand are skipped. Before, the save failed on a taken id, the rollback undid the counter, and every retry got the same taken id, ending in a wrong "employee id taken" after 5 tries. Two requests picking the same free number at the same moment are covered by up to 3 attempts. If 100 numbers in a row are taken: `409 EMPLOYEE_ID_FAILED`. No migration.

## Tests
`tests/sessions/sessions.test.ts` (over-capacity), `tests/classes/missing-names.test.ts`, `tests/staff/employee-id.test.ts`. NOT run: the staff create against a real database (the Prisma engine cannot run here); the id logic is tested with a counter that rolls back like the real one.

## Still open from the hardening list
- Deactivate students when they graduate (decision pending).
- Student import slice; the dormant import and batch use cases.
- Class-to-branch link before the BRANCH scope.
