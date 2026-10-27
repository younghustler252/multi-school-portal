# Enrolment Module Notes

> Branch `refactor/modules`. Follows `docs/ACADEMIC_STRUCTURE_AUDIT.md` (the third of Sessions, Classes, Enrolment). Build: no new TypeScript errors (64 before, 64 after; none in enrolment). Tests: 18 new unit tests pass, and the Students scope test was updated; no database or API test was run.

## What is switched on
`registerEnrolment` is in the container list and `/enrolments` is mounted.

| Method and path | Permission | What it does |
|---|---|---|
| GET `/enrolments` | `enrolment.view` | Class list. Query: `page`, `limit` (max 100), `classId`, `termId` (default current), `studentId`, `status`, `search` |
| POST `/enrolments` | `enrolment.manage` | Enrol one student |
| POST `/enrolments/bulk` | `enrolment.manage` | Enrol a list into one class (max 200) |
| PUT `/enrolments/:id` | `enrolment.manage` | Change the status OR move to another class (not both) |
| GET `/enrolments/promotion-preview` | `enrolment.promote` | `?termId=` (and optional `newTermId=`): who would go where |
| POST `/enrolments/promote` | `enrolment.promote` | End-of-year promotion |

## Rules
- **Permissions** (`enrolment.permissions.ts`): `enrolment.view` (ALL, BRANCH, ASSIGNED, OWN), `enrolment.manage` and `enrolment.promote` (both sensitive, admin only by default). `enrolment.view` is on every default role: principal ALL, branch principal BRANCH, teacher ASSIGNED, bursar ALL, student and guardian OWN. Run `npm run sync:registries`.
- **Who sees what** (`services/enrolment-scope.ts`): ALL everyone; ASSIGNED a teacher sees the classes they LEAD (any term) and the classes they TEACH this term; OWN a student sees their own, a guardian their children's; BRANCH and no permission see nobody (classes are not linked to branches yet).
- **Students ASSIGNED is now unlocked** (`students/services/student-scope.ts`): a teacher sees the students enrolled THIS term in a class they lead or teach. Guardians' "my children" and Students lists follow it.
- **Enrol**: the student must exist and be active, the class and term must exist, and a student has ONE enrolment per term (`ENROLMENT_ALREADY_EXISTS` names the class and status of the existing one).
- **Room in a class**: a class with a capacity may not go over it (`CLASS_FULL`, with `capacity`, `enrolled`, `requested`). The count and the save happen in one transaction while the class row is locked, so two requests cannot take the last seat. A class with no capacity is never full.
- **Bulk enrol**: students who cannot be enrolled are skipped and reported by NAME with a reason (`not_found`, `inactive`, `already_enrolled`); the rest are saved together in one transaction. If the class cannot hold all of them, nothing is saved (`CLASS_FULL`).
- **Change an enrolment**: an ACTIVE enrolment can become `withdrawn`, `transferred` or `completed`; a closed one can only go back to `active` (the student must be active and the class must have room). Moving to another class (`classId`) works only for an active enrolment, the same term, a different class (`ENROLMENT_SAME_CLASS`, `ENROLMENT_NOT_ACTIVE`, `ENROLMENT_STATUS_INVALID`). Optional `reason` goes into the audit.
- **Promotion**: the SERVER decides from the saved class order ("promoted into"): promote, graduate (saved as none), or `needs_decision` (a class with no saved order). The browser sends only exceptions: `promote` (with `classId`), `repeat`, `graduate`, `exclude`. Refused: same term, a new term that does not start later, exceptions for students not active in the current term (`PROMOTION_UNKNOWN_STUDENT`), classes with no decision (`PROMOTION_NEEDS_DECISIONS`, with class names). Everything is saved in ONE transaction; if any target class would go over capacity nothing is saved (`CLASS_FULL` with the classes). Promoted, repeating and graduating students' old enrolments become `completed`; students who already have a place in the new term (for example from the term roll-over) are left alone and reported as `already_enrolled`.
- **Graduates stay active.** Only their enrolment is closed and they are listed in the result. Whether to deactivate graduates (they count toward the student limit while active) is an open decision.
- **Audit**: `enrolment.created / bulk_created / status_changed / moved / promotion_run`, written after the change succeeds, with names (not ids).

## Responses carry names
```
enrolment: { id, student: { id, name, admissionNumber, photoUrl }, class: { id, name },
             term: { id, name, session: { id, name } } | null, status, createdAt }
bulk:      { class, term, enrolled: [{ id, name, admissionNumber }], skipped: [{ student: { id, name | null }, reason }] }
preview:   { term, newTerm, summary: { total, promote, graduate, needsDecision, alreadyEnrolled }, classesWithoutNextClass: [{ id, name }],
             rows: [{ student: { id, name, admissionNumber }, fromClass, toClass | null, action, alreadyEnrolled }] }
promote:   { total, promoted, repeated, graduated, excluded, alreadyEnrolled, results: [{ student, outcome, fromClass, toClass | null }] }
```
`studentId`, `classId`, `termId` on enrolments are replaced by these objects. `photoUrl` is a private link that expires after one hour. One list page costs a handful of lookups (students, classes, sessions), not one per row.

## Error codes
`ENROLMENT_ALREADY_EXISTS`, `STUDENT_INACTIVE`, `CLASS_FULL`, `ENROLMENT_SAME_CLASS`, `ENROLMENT_NOT_ACTIVE`, `ENROLMENT_STATUS_INVALID`, `PROMOTION_SAME_TERM`, `PROMOTION_TERM_ORDER`, `PROMOTION_UNKNOWN_STUDENT`, `PROMOTION_NEEDS_DECISIONS`, plus the shared `NOT_FOUND`, `VALIDATION_ERROR`, `PERMISSION_DENIED`.

## Roles in schools that already exist
`student` and `guardian` are locked templates, so the sync gives them `enrolment.view` (OWN). `principal`, `branch_principal`, `teacher` and `bursar` are editable templates created once and then owned by the platform: existing schools will NOT get `enrolment.view` for them automatically (same as `sessions.view` and `classes.view`). Until it is added, those roles get `PERMISSION_DENIED` on `/enrolments`.

## Frontend changes
- Enrolment responses use `student`, `class` and `term` objects.
- `GET /enrolments/promotion-preview` takes `termId` (and optional `newTermId`) and returns the preview object above.
- `POST /enrolments/promote` takes `{ currentTermId, newTermId, overrides }` only. The old `rows` array is rejected: the server works the plan out.
- `PUT /enrolments/:id` takes `{ status }` or `{ classId }` (plus optional `reason`).
- Bulk enrol returns `{ class, term, enrolled, skipped }` (it used to return a list of ids).
- Bodies are strict (unknown fields rejected).

## Changes outside this module
- Students: `ASSIGNED` scope unlocked (and its test updated).
- Classes repository: new `findAllClassProgressions()` (one query for the whole saved class order).

## Left for later
Branch scope (needs a branch on classes); deactivating graduates; a class-by-class transfer history view; enrolment capacity as a school setting (`academic.class_capacity`, warn or block); class names on the Students list (the list can now be joined through enrolment).

## Next
Attendance, then Grades (both now have enrolment, classes and terms to stand on).
