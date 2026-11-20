# Attendance Module

> **Verification:** Partially source-verified  
> **Source review:** 2026-11-06, branch `refactor/modules`  
> **Scope:** Routes, controller, DTOs, permission declarations, domain policy/errors, scope/day/presenter services, use cases, repository, DI registration, route mount, tenant Prisma model, attendance migration and focused tests were inspected. Tests and typecheck were not executed; live HTTP behavior was not exercised.

## 1. Responsibility and boundaries

Attendance records daily marks for a student's class register within an academic term. The current implementation is class-register based: a staff member opens a class for a calendar day, sees the students enrolled for that term, and submits marks for some or all of them.

The module owns:
- Resolving a calendar date to exactly one academic term.
- Determining the students on a class register for that term.
- Taking and correcting attendance marks.
- Attendance visibility and marking authorization by permission scope.
- Student and class attendance summaries.
- Audit records identifying who submitted or corrected marks.

It depends on, but does not own:
- Student identity and guardian links (Students and Guardians).
- Class and class-teacher definitions (Classes).
- Term/session dates and calendar events (Sessions).
- Term-specific enrolment and teaching assignments (Enrolment and Classes).
- Login identities of staff who marked attendance (Auth/Users).

## 2. HTTP surface

The router is mounted at **`/api/v1/attendance`** by `apps/api/src/routes/index.ts`, beneath the global `/api/v1` mount in `apps/api/src/app.ts`.

All endpoints require authentication and tenant context. Route middleware applies the relevant attendance permission.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `attendance.view` | Paginated attendance marks |
| GET | `/summary` | `attendance.view` | One student's summary |
| GET | `/classes/:classId/register` | `attendance.view` | Class register for a date |
| GET | `/classes/:classId/summary` | `attendance.view` | Class summary for a term |
| POST | `/classes/:classId` | `attendance.mark` | Submit a class register |
| PUT | `/:id` | `attendance.mark` | Correct one attendance mark |

There is no dedicated attendance DELETE endpoint, no separate guardian-only endpoint, and no route-level `attendance.override` middleware. Override is checked inside the relevant use cases after the caller has passed `attendance.mark`.

### Request DTOs

All DTOs are strict Zod objects. Unknown fields are rejected.

**Register query**:
```json
{ "date": "2026-11-05" }
```
Date is required and must be a real calendar date in `YYYY-MM-DD` form. It must not include a time or timezone suffix.

**Submit register**:
```json
{
  "date": "2026-11-05",
  "entries": [
    { "studentId": "<uuid>", "status": "present", "note": "Optional note" },
    { "studentId": "<uuid>", "status": "late" }
  ]
}
```
- Entries: 1–200.
- Status: `present | absent | late | excused`.
- Each entry requires a student UUID; note is optional, nullable and max 300 characters.
- A blank note is normalized to null.
- No `termId` is accepted. The server resolves the term from the date.

**Update one mark**:
- Optional `status` from the same four-value enum.
- Optional `note`, nullable and max 300 characters.
- At least one of status or note must be supplied.
- Empty note clears the stored note.

**List query**:
- `page`: integer, default 1, minimum 1.
- `limit`: integer, default 20, range 1–100.
- Optional UUID filters: `studentId`, `classId`, `termId`.
- Optional `from` and `to` dates in `YYYY-MM-DD`.
- Optional `status` from the four-value enum.
- Filters are ANDed with the caller's permission scope; they can narrow visibility but cannot widen it.
- The DTO does not currently enforce that `from` is on or before `to`.

**Student summary query**: required `studentId`, optional `termId`; omitted term means current term.

**Class summary query**: optional `termId`; omitted term means current term.

## 3. Permission model and scope behavior

Defined in `attendance.permissions.ts`:

| Permission | Scopes | Personas | Purpose |
|---|---|---|---|
| `attendance.view` | ALL, BRANCH, ASSIGNED, OWN | STAFF, STUDENT, GUARDIAN | View registers, marks and summaries |
| `attendance.mark` | ALL, ASSIGNED | STAFF | Submit a register or correct a mark |
| `attendance.override` | ALL | STAFF | Correct a mark after the edit window; sensitive |

The focused database tests exercise these intended cases:
- ALL can see and mark any class.
- ASSIGNED staff can access classes they lead, or teach in the term of the register date.
- OWN students see their own marks.
- OWN guardians see marks belonging to linked children.
- Students and guardians cannot open class registers.
- A teacher who taught a class only in a previous term cannot open or mark its current register.

### Scope implementation details

- Register access uses `classInScope`. For ASSIGNED staff, `staffCoversClass` checks whether the staff member is the class teacher or has a class-subject assignment for that class and term.
- List and summary mark visibility uses `attendanceViewWhere`.
- For list visibility, ASSIGNED staff see classes they lead, plus classes where they teach in the current term.
- OWN student filters by `studentId`; OWN guardian filters through the student's guardian links.
- BRANCH (view only) filters by the class's `branchId`: a staff member sees the registers, marks and summaries of classes in their own branches, and nothing else. A staff member with no branches sees nothing. `attendance.mark` never offers BRANCH, and `classInScope` refuses BRANCH for marking even if a role were given it by mistake. A missing scope resolves to an empty-result predicate.

**Single-student summary:** `studentInScope` applies the same rules as the lists (ALL; OWN = yourself or a linked child; ASSIGNED/BRANCH = the student is on the list of an in-scope class in that term). A student outside the viewer's scope looks like one that does not exist (404): no name, admission number or class is returned. Covered by `tests/branch-scope/branch-scope.db.test.ts`.

## 4. School-day and term rules

The domain policy treats attendance dates as calendar days, not timestamps:
- Format is exactly `YYYY-MM-DD`; invalid calendar dates and values containing a time are rejected.
- The stored date is normalized to 00:00 UTC for new marks.
- Reads match the full UTC day range, so legacy rows with a clock time can still be found.
- "Today" is calculated in the hard-coded `Africa/Lagos` timezone. The policy explicitly describes this as a Nigeria-only v1 assumption.
- Future dates cannot be marked.
- A date must fall inside exactly one term. A date outside all terms is rejected; overlapping terms produce an explicit ambiguity error rather than guessing.
- Term start and end dates are inclusive.
- A calendar event blocks marking only when `isHoliday` is true and its date range covers the selected day. A non-holiday event does not close the register.
- A register can still be viewed on a future day or holiday; the response sets `canMark: false`.

Relevant stable domain codes include:
- `ATTENDANCE_DATE_INVALID`
- `ATTENDANCE_DATE_IN_FUTURE`
- `ATTENDANCE_OUTSIDE_TERM`
- `ATTENDANCE_TERM_AMBIGUOUS`
- `ATTENDANCE_HOLIDAY`
- `ATTENDANCE_EDIT_WINDOW_CLOSED`
- `ATTENDANCE_NOTHING_TO_CHANGE`

Not-found and forbidden errors are raised for missing classes/marks/students and unauthorized class access.

## 5. Register submission and correction rules

### Class list

The register is derived from enrolments for the selected class and resolved term. Only enrolments with status `active` or `completed` appear. Withdrawn and transferred enrolments are excluded. Students are ordered by last name and then first name.

### Submitting a register

The server:
1. Validates and resolves the date and term; rejects future days and holidays.
2. Checks that the caller may mark the class for that term.
3. Loads the class's enrolled student list.
4. De-duplicates submitted student IDs. The first entry wins; later duplicates are reported as `duplicate_entry`.
5. Skips students not on the class list with reason `not_on_class_list`.
6. Opens one database transaction and locks the class row using the shared class-seat lock helper.
7. Creates missing marks, leaves identical marks unchanged, and updates eligible changed marks.
8. Skips a changed mark outside the edit window unless the caller has override permission.
9. Returns students still unmarked after the operation.
10. Writes an audit event with a summary and up to 100 individual status changes.

The result reports `created`, `updated`, `unchanged`, `skipped` (with reasons), and `unmarked`. A repeated identical submission is safe and does not create a second mark.

The lock serializes submissions for the same class. The focused DB test asserts that two simultaneous submissions do not create duplicate rows or a mixed final register. This test was inspected, not run during this documentation pass.

### Edit window and override

The edit window is **48 hours from the mark's original `createdAt`**, not from the school-day date or last update. Within the window, a caller with marking access for that class may correct the mark. After the window, the caller must also have `attendance.override`.

A mark created before class registers existed may have `classId: null`. Such a legacy mark can only be corrected by someone with ALL marking scope; an ASSIGNED teacher cannot establish class ownership for it.

The update operation records the current actor in `markedById`, updates the mark, and audits old and new values. The audit trail preserves the prior actor/action history; the row itself shows the latest marker.

## 6. Summary calculations

Attendance statuses are:
- `present`
- `late`
- `absent`
- `excused`

The attendance rate is:

`(present + late) / (present + late + absent) × 100`

- Excused marks are displayed and counted in `daysMarked`, but excluded from the rate denominator.
- Rate is rounded to one decimal place.
- If there are no counted days, rate is null, not an artificial 0% or 100%.
- `lowAttendance` is true only when the rate is below 75%.
- `registerDays` counts distinct days with a register for the class and term.
- `unmarked` is the number of register days for which that student has no mark, bounded at zero.

Student summary defaults to the current term. Class summary returns every student on the class register, each student's counts and the aggregate class summary. Counts are grouped in the repository rather than issuing one query per student.

### Summary authorization (closed: REM-001 and its November 2026 follow-up)

Summaries use the same `attendance.view` scope as the lists and the class register; there is no separate permission model.

| Who | Student summary (`GET /attendance/summary?studentId`) | Class summary (`GET /attendance/classes/:id/summary`) |
|---|---|---|
| Student (`OWN`) | their own only | never |
| Guardian (`OWN`) | linked children only | never |
| Class teacher (`ASSIGNED`) | students enrolled in a class they lead | classes they lead |
| Subject teacher (`ASSIGNED`) | students enrolled in a class they teach **this term** | classes they teach in the term of the summary |
| Branch staff (`BRANCH`) | students in classes of their branches | classes of their branches |
| `ALL` | everyone | everything |
| anyone else | nobody | nobody |

Rules the code keeps:
- The student is found and authorized (`studentInScope`) before the class, register days or counts are looked up. A student outside the caller's scope gets the same 404 as one that does not exist, so no name, admission number, class, enrolment or count is returned.
- The term is validated first, so a bad `termId` answers the same way for existing and missing students (it used to reveal that the student exists).
- Every count is taken from rows the caller may see (`attendanceViewWhere`). A teacher sees only the marks of their own classes, so a student who moved class shows the new class's teacher only the days marked in that class, and the old class's teacher nothing.
- The class summary is class-scoped (`classInScope`); an out-of-scope class is 403, the same as opening that class's register.
- The school dashboard's attendance block (`GET /dashboard`) is filtered with the same row scope and now carries `scope` (`ALL`, `BRANCH`, `ASSIGNED`); it used to be school-wide for every staff member with `attendance.view`.

Known differences kept on purpose: the lists and the student summary count a subject teacher's classes for the current term only, while the class summary and the register use the term of the summary/date; a withdrawn or transferred student stays visible to the class they were enrolled in (their marks in that class are history), but shows no current class.

Tests: `tests/attendance/summary-scope.test.ts` (in-memory school running the real scope filters), `attendance.summary-authz.test.ts`, and the database cases in `attendance.db.test.ts`.

## 10. Open verification and design items

1. (Done) Student-summary authorization: see section 6.
2. (Done) `attendance.view` BRANCH is implemented by class branch and tested for lists, register, class and student summaries, filters that try to reach across branches, and a class moving branch.
3. Decide whether date-range DTO validation should reject `from > to`.
4. Confirm that hard-coded `Africa/Lagos` is acceptable until school timezone settings are wired into attendance.
5. Run the policy, real-database and populated-migration tests against a disposable database, then run API typecheck/build.
6. Add HTTP route tests for authentication, tenant enforcement, permission middleware and response/error envelopes; the inspected tests primarily exercise use cases/repository behavior rather than Express route integration.

## 11. Source map

- Routes: `apps/api/src/modules/attendance/routes/attendance.routes.ts`
- Controller: `apps/api/src/modules/attendance/controllers/attendance.controller.ts`
- DTOs: `apps/api/src/modules/attendance/dtos/attendance.dto.ts`
- Permissions: `apps/api/src/modules/attendance/attendance.permissions.ts`
- Domain policy/errors: `apps/api/src/modules/attendance/domain/`
- Day/scope/presenter services: `apps/api/src/modules/attendance/services/`
- Use cases: `apps/api/src/modules/attendance/usecases/`
- Repository: `apps/api/src/modules/attendance/repositories/attendance.repository.ts`
- DI: `apps/api/src/modules/attendance/attendance.container.ts`
- Tenant model: `apps/api/prisma/tenant.prisma`
- Migration: `apps/api/prisma/tenant-migrations/20261102090000_attendance_register/migration.sql`
- Tests: `apps/api/tests/attendance/`
- Route mount: `apps/api/src/routes/index.ts`
