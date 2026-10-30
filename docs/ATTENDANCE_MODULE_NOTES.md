# Attendance notes

Attendance is now a **class register**: a teacher marks a whole class for one day; the server decides who may, which day, and which students.

## Endpoints (mounted at `/attendance`)
| Route | Permission | What it does |
|---|---|---|
| GET `/attendance/classes/:classId/register?date=YYYY-MM-DD` | `attendance.view` | The class list for the day with each student's mark (or none), who marked, `canMark`, per-line `editable`, holiday name if any |
| POST `/attendance/classes/:classId` | `attendance.mark` | Submit the register `{ date, entries: [{ studentId, status, note? }] }` (1 to 200 students) |
| PUT `/attendance/:id` | `attendance.mark` | Correct one mark `{ status?, note? }` |
| GET `/attendance?studentId&classId&termId&from&to&status&page&limit` | `attendance.view` | Scoped list (page size at most 100). A student sees their own, a guardian their children's. **Replaces `/my-children`.** |
| GET `/attendance/summary?studentId&termId` | `attendance.view` | One student's counts and rate (term defaults to the current term) |
| GET `/attendance/classes/:classId/summary?termId` | `attendance.view` | Every student on the class list + the class rate |

**Removed:** `POST /attendance/bulk`, `GET /attendance/my-children`, the old `POST /attendance/:classId`, old `PUT`, and the old summary route. They were switched off and unsafe (no checks, `req.user`).

## Permissions (`attendance.permissions.ts`; `attendance.view` moved out of the core list)
- `attendance.view`: ALL, BRANCH (shows nobody until classes have branches), ASSIGNED, OWN.
- `attendance.mark`: ALL or ASSIGNED. **Assigned** = you lead the class, or you teach it in the term of the date. Last term's assignment gives nothing.
- `attendance.override` (sensitive, ALL only): correct marks after the edit window.
- Default roles: principal view ALL; **teacher view ASSIGNED + mark ASSIGNED (new)**; student and guardian view OWN; school admin everything.

## Rules
- **Day:** `YYYY-MM-DD` only (a time is refused). Stored as that date at 00:00 UTC, compared by date text, so one student can never get two records for one day. "Today" is the school's date (Africa/Lagos, a constant until the settings service exists), not the server's.
- **Taking a register:** the day must be real, not in the future, inside a term and not a calendar holiday (events with `isHoliday`, one day or a range). The **term is found from the date**: the browser never sends it. If two terms overlap on a date nothing is guessed (`ATTENDANCE_TERM_AMBIGUOUS`). Weekends are allowed (Saturday classes).
- **Who is on the register:** students with an `active` or `completed` enrolment in that class that term. Withdrawn and transferred students are not.
- **Submit result:** `created`, `updated`, `unchanged`, `skipped` (each with the student's name and a reason: `not_on_class_list`, `duplicate_entry`, `edit_window_closed`) and `unmarked` (students still without a mark). Valid students are saved even when others are skipped. Sending the same register again is safe.
- **Two people at once:** the class row is locked while saving, so two submissions for the same class are handled one after the other (tested: one person's answer wins as a whole, never a mix).
- **Edit window:** 48 hours from when the mark was first made (constant `EDIT_WINDOW_HOURS`). After that only `attendance.override` can change it, by `PUT` or by re-sending the register. First-time marks for a past day are allowed.
- **Marked by:** `markedById` is the login (User) id of whoever **saved the mark last** (same convention as fees and the ledger). The audit trail keeps the history. Names come from one batch lookup.
- **Rate:** `(present + late) / (present + late + absent) x 100`, one decimal. **Excused is shown separately and is left out of the rate.** No counted days means `rate: null`, never 0% or 100%. Also returned: `timesPresent` (present + late), `daysMarked` (every day with a mark), `registerDays` (days a register was taken for the class) and `unmarked` (register days the student was left without a mark). `lowAttendance` is true below 75% (constant `LOW_ATTENDANCE_PERCENT`). A school-level setting can come later.
- **Old records** (taken before registers existed) keep an empty class and an empty "marked by". They are found even if saved with a clock time, and are normalised to the school day the first time a register or a correction touches them. A teacher (ASSIGNED) cannot correct a record with no class; only ALL can.
- **Names, not ids** in every response; dates are `YYYY-MM-DD`; a missing relation is `null`.
- **Audit:** `attendance.register_submitted` (counts, and old to new for every changed student with names, up to 100) and `attendance.updated`.

## Migration `20261102090000_attendance_register`
Adds `classId` (link to the class, kept as empty if the class is deleted), `markedById`, `updatedAt` (existing rows start with their `createdAt`), and indexes `(classId, date)` and `(termId, date)`. Nothing is rewritten or invented for existing rows.

**Deploy order:** `git pull`, `git apply attendance.patch`, `npm run prisma:generate`, `npm run migrate:apply-to-existing-schools:dry-run`, `npm run migrate:apply-to-existing-schools`, then **`npm run sync:registries`** (registers `attendance.mark` and `attendance.override` and updates the teacher template) and **`npm run sync:school-roles`** (gives existing schools' teacher roles `attendance.mark`; run the `:dry-run` first). Without the last two steps teachers in existing schools can see attendance but not take it.

## Frontend changes
The old routes are gone (see above). New shapes: register view, register submit result, list rows `{ id, date, status, note, student{id,name,admissionNumber}, class{id,name}|null, term{id,name,session{id,name}}, markedBy{id,name}|null, markedAt, updatedAt }`, summaries. Error codes: `ATTENDANCE_DATE_INVALID`, `ATTENDANCE_DATE_IN_FUTURE`, `ATTENDANCE_OUTSIDE_TERM`, `ATTENDANCE_TERM_AMBIGUOUS`, `ATTENDANCE_HOLIDAY`, `ATTENDANCE_EDIT_WINDOW_CLOSED`.

## Tests (`tests/attendance/`, 40)
`attendance.policy.test.ts` (dates, Lagos "today", terms, holidays, window, rate, permissions, request shape), `attendance.db.test.ts` (24, real Postgres: who may open and take a register, last term's assignment, every date rule with nothing saved, skip reasons, safe re-send, audit, edit window and override, old records, scope on lists, summaries, two people at once), `migration.db.test.ts` (populated school upgrade). Database tests need `TEST_DATABASE_URL`.
**Not run:** HTTP calls to the routes (the app was not started); the existing-school runner for THIS migration (it was run for real for the graduation migration and is generic: run the `:dry-run` first); the report-card attendance block (report cards are switched off).

## Not in scope (as agreed)
Per-period attendance, staff attendance, excuse and leave requests, absence alerts to guardians (they need the Notifications pass).
