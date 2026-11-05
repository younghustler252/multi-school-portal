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
- BRANCH and missing scopes resolve to an empty-result predicate. The permission catalog includes BRANCH for future use, but attendance classes are not currently branch-filtered by this service.

**Important:** A permission's declared scope is not proof that its data filter is implemented. Do not enable branch-scoped attendance access on the assumption that BRANCH currently returns branch records.

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

### Summary authorization review item

The student-summary use case applies `attendanceViewWhere` to the attendance aggregation, but it separately fetches the requested student and their enrolment/class/register-day information. For a caller who is not authorized to see that student, the current implementation can therefore return zero attendance counts while still returning student/class/term metadata and register-day totals. The focused test currently checks that a guardian receives zero `daysMarked` for another child; it does not assert that the rest of the response is suppressed.

Treat this as an **open privacy review item**, not as a confirmed exploit: the intended behavior needs a product/security decision and a test that verifies unauthorized summary requests reveal no student/class metadata or attendance-volume information. The use case should enforce access to the target student/class before returning the summary.

## 7. Response shapes and frontend integration

### Class register

The register response contains:
- `class: { id, name }`
- `date` as `YYYY-MM-DD`
- `term: { id, name, session: { id, name } | null }`
- `holiday` as a title or null
- `canMark`
- `students[]`, each with student identity/name/admission number, nullable mark ID/status/note, marker name/time and `editable`
- `summary` counts for present, absent, late, excused and unmarked

### Attendance mark presenter

List and update responses are presented as:
```ts
{
  id: string;
  date: string; // YYYY-MM-DD
  status: string;
  note: string | null;
  student: { id: string; name: string; admissionNumber: string | null } | null;
  class: { id: string; name: string } | null;
  term: { id: string; name: string; session: { id: string; name: string } | null } | null;
  markedBy: { id: string; name: string } | null;
  markedAt: Date;
  updatedAt: Date;
}
```

The presenter batches student, class, term and marker lookups for the page. Missing related records are represented as null. The list endpoint returns `{ success, message, data, meta }`; other read/write endpoints use the shared success response helper.

Frontend implementation guidance:
- Send calendar dates only, without browser-local time conversion or a timezone suffix.
- Do not send a term ID when taking a register; the API derives it from the selected date.
- Build the register from the returned class list; do not construct it from the whole student directory.
- Show skipped entries and their reasons, plus the remaining unmarked students.
- Use `canMark` and per-row `editable` as server-calculated capabilities, but still handle authorization/domain errors.
- Display marker identity and mark/update timestamps as returned.
- Explain the 48-hour correction limit and the need for authorized override after it.
- Keep excused counts separate from the attendance-rate calculation.
- Handle null rates and null class/term references for legacy rows.
- Treat `ATTENDANCE_TERM_AMBIGUOUS` as an academic-calendar data issue for an administrator, not as a reason to guess a term.

## 8. Persistence and migration

The tenant Prisma model `Attendance` contains:
- `studentId`, `termId`, optional `classId`, calendar `date`, `status`, optional `note`, optional `markedById`, `createdAt`, `updatedAt`.
- Unique constraint `[studentId, date]`, enforcing one row per student per stored date value.
- Indexes `[classId, date]` and `[termId, date]`.
- Student and term relations; optional class relation uses `ON DELETE SET NULL`.
- `markedById` is a login ID scalar; the current model does not declare a User relation for it.

Migration `20261102090000_attendance_register` adds class and marker columns plus `updatedAt`. Existing rows keep their prior date/status/note; class and marker remain null because historical values are not invented. Existing `updatedAt` is initialized from `createdAt`. The migration adds the class foreign key and class/date and term/date indexes.

A populated-tenant migration test explicitly applies earlier migrations, seeds old attendance rows (including one with a clock time), then applies only the attendance migration and checks historical preservation and new constraints/indexes. It runs only when `TEST_DATABASE_URL` is set and the configured database name contains `test`.

## 9. Dependencies, registration and tests

The module registers its repository, presenter, register/list/update/summary use cases and controller in `attendance.container.ts`. It is registered in the shared API container after the foundation and before grades/report cards. The repository uses the request's tenant Prisma client and imports the shared `lockClass` helper from Enrolment.

Inspected tests:
- `apps/api/tests/attendance/attendance.policy.test.ts`: pure date/term/holiday/edit-window/summary rules, permission registry/default role templates and request validation.
- `apps/api/tests/attendance/attendance.db.test.ts`: real-database class access, register submission, skip reasons, idempotency, audit, correction/override, scoped lists, summaries, legacy timestamp normalization and concurrent submissions.
- `apps/api/tests/attendance/migration.db.test.ts`: migration against a populated tenant.

The test sources were inspected but not executed. The database and migration tests are conditional on a test database URL. No typecheck, build, migration run or live API request was performed.

## 10. Open verification and design items

1. Resolve the student-summary authorization gap described above and add tests asserting unauthorized summaries return no identifying or aggregate metadata.
2. Decide whether `attendance.view` BRANCH should remain unavailable until class-branch scoping is implemented; ensure role templates do not grant it prematurely.
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
