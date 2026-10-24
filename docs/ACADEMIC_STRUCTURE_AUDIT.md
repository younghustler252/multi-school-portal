# Sessions, Classes and Enrolment: Audit & Plan

> Branch `refactor/modules`, commit `7ca53b2`. Source inspection only: no code changed, no build or test run. Recheck against the working tree before implementing.

## 1. Decision
Do these three modules next, one patch each, in this order: **Sessions, then Classes, then Enrolment** (each one needs the one before it). None of them can be switched on as they are: they use the old role checks, have no permissions, return raw ids, and several write paths are unsafe.

## 2. Why now (current problems outside these modules)
1. **Staff's two assignment endpoints already break.** `GET /staff/me/classes` and the staff-assignments endpoint need `sessionRepository` and `classRepository`, which are not registered, so they fail with a container error at request time.
2. **Students scopes are waiting for Enrolment.** BRANCH and ASSIGNED see nobody until enrolments and class assignments are available. `Class` has no branch field in the schema, so BRANCH needs a decision (section 6).
3. Other modules already call these repositories (staff, attendance, grades, report cards, students import): `findCurrentTerm` (10 uses), `findClassById` (9), `findClassSubject`, `assignSubject`, `findByStudentAndTerm`... Keep those method names.

## 3. Responses: no raw ids
Your concern is right for these modules, and partly for what we already built.

| Where | Now | Problem |
|---|---|---|
| Enrolment (list, enrol, bulk, update) | `{ studentId, classId, termId, status }` | Ids only. The frontend must fetch every student, class and term to show a row |
| Enrolment bulk `skipped`, promotion `results` | arrays of student ids | Ids only |
| Classes create/update/delete | `classTeacherName: null`, `studentCount: 0` | Wrong placeholder values |
| Class-subject assign/update | `classId, subjectId, staffId, termId` | Ids only (the GET versions are enriched with names) |
| Term | `sessionId` only | No session name |
| Guardians link, update-link, unlink (my pass) | `guardianId, studentId` | Ids only: **I will fix this too** |

**Convention to adopt:** every reference becomes an object with its name, filled in with ONE batch query per page, never one query per row:
- student: `{ id, name, admissionNumber, photoUrl }` (photo through `StudentPhotoService`)
- class: `{ id, name }`; term: `{ id, name, session: { id, name } }`; staff: `{ id, name }`
Raw ids stay only as the `id` of the object itself (needed for links and actions).
Staff names live in the public login table, so I would add one shared "names lookup" for staff (two queries for a whole page) instead of the copy that sits inside `get-classes` today.

## 4. Findings

### Sessions
1. Not wired. Routes use `requireStaff` / `requireSchoolAdmin`.
2. DTOs are loose: dates are plain strings, no check that end is after start, term dates may lie outside the session or overlap another term, session name format ("2025/2026") unchecked, duplicates allowed. `UpdateSessionDto` exists but there is no update-session route.
3. **Set current session / term are two separate writes** (clear old, set new). A failure in between leaves no current session or term. Setting a term current does not check it belongs to the current session.
4. **Set current term does the term roll-over inside the request, one student at a time**: for every active enrolment of the previous term it runs 2 to 3 queries, creates enrolments with no capacity check, then seeds class subjects class by class. Not transactional (the term is already switched if it fails halfway), not audited, and it re-runs if an older term is set current.
5. **Calendar events cannot be created**: the use case writes `calendarId`, which is not a column (Prisma error). The controller and use cases exist but no routes are mounted. It also saves the login id as `createdById` while naming it `staffId`.
6. No audit entries. Repository file is named `calendar.repository,impl.ts` (comma).

### Classes
1. Not wired; legacy guards. `GET /classes/:id` is open to any staff.
2. Uses the old model: `Staff.role` ("teacher" or "principal") to decide who may be class teacher (breaks for custom roles and the field is being removed), and `SchoolSettings.teachingModel` (moving to a setting).
3. **Delete class is a hard delete** with no check. With enrolments, fee structures or invoices it fails with a raw database error; the use case returns the deleted class.
4. Name uniqueness is a check only (no database rule, no case handling).
5. DTOs not strict; `level` is free text (planned: levels and arms); capacity cannot be cleared and can be lowered below the current student count.
6. Responses: see section 3. Teacher names are looked up with a copy of the same two-query code in several use cases.
7. Progression: not checked for loops or for pointing at itself (verify in the pass).
8. No audit, no tests.

### Enrolment
1. Not wired; `GET /enrolments` is open to any staff (every student's class).
2. Enrol: does not check the term exists, the student is active, or the term is open. The capacity check and the insert are separate, so two requests can overfill a class. No audit.
3. Bulk: one student at a time (several queries each), no transaction (half done if it fails), no upper limit on the list, the capacity check counts students who will be skipped, and a withdrawn student is quietly put back into the new class.
4. Update status: any status to any status, including re-activating with no capacity check; "transferred" does not move the student; no reason, no audit.
5. **Promote trusts the client**: it accepts `fromClassId` and `toClassId` from the request instead of using the class progression, never checks the student was in that class, ignores capacity, does not mark the old enrolment `completed`, does not record graduation, is not transactional, counts "already enrolled" as "excluded". No audit.
6. Filters in the list are plain strings with no validation or page-size cap.
7. No tests.

## 5. Proposed plan

**Permissions** (all in each module's own `*.permissions.ts`, sensitive ones marked):
- `sessions.view` (ALL; every persona), `sessions.manage`
- `classes.view` (ALL; staff), `classes.manage`
- `enrolment.view` (ALL, ASSIGNED, OWN), `enrolment.manage`, `enrolment.promote`
School Admin holds all. Teacher template: `sessions.view`, `classes.view`, `enrolment.view` ASSIGNED (needs a decision on templates, section 6).

**Sessions pass:** strict DTOs with date rules (end after start, terms inside the session and not overlapping, unique session name); update session; set current session/term in ONE transaction (and a term must belong to the current session); term roll-over made set-based (a few queries, not one per student), capacity-aware, audited and returning a summary; calendar events fixed, routed and permission-protected; audit entries; tests.

**Classes pass:** permissions; class teacher must be an active teaching-category staff member (no `Staff.role`); delete refused when the class is in use; case-insensitive unique name; strict DTOs; filled-in responses; progression loop check; audit; tests.

**Enrolment pass:** permissions with ASSIGNED scope (students in classes the teacher teaches or leads this term, which then unlocks Students and Guardians ASSIGNED views); filled-in responses; enrol, bulk, update and promote in transactions with a capacity check inside the transaction; promote driven by the saved class progression, not by ids from the client; old enrolment marked `completed`; audit; tests. Class names and attendance then return on "my children" and the student list.

**Not in scope:** levels and arms (D7), per-period timetable, changing Fees, Grades or Attendance.

## 6. Decisions needed
1. **Term roll-over on "set current term"**: keep it automatic, but make it fast and safe (recommended), or turn it into a separate button.
2. **Branch scope for students**: needs `Class.branchId` (a small migration). Recommend: unlock ASSIGNED now, add the class-to-branch link in its own small pass later.
3. **Teacher role template**: give teachers `classes.view`, `sessions.view` and `enrolment.view` (ASSIGNED)? Recommend yes.
4. **Delete a class that is in use**: refuse (recommended) versus archive.
