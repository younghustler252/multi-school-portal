# Staff, Access Control, Branches and Timetable API Operation Inventory

> **Source snapshot:** `refactor/modules`, reviewed 2026-11-06. This is a route-level operation inventory, not a canonical OpenAPI contract and not runtime-verified. It completes the remaining route groups in the current module route index that were not covered by the academic, finance and platform/communications operation inventories.

## Scope and count

| Area | Route files / exported routers | Operations |
|---|---:|---:|
| Staff | 1 | 13 |
| Roles | 1 | 6 |
| Permission catalogue | 1 exported router | 1 |
| Branches | 1 | 9 |
| Classes and subjects | 1 | 17 |
| Attendance | 1 | 6 |
| Sessions, terms and calendar | 1 | 12 |
| **Total** | **7** | **64** |

The roles source file exports both the `/roles` router and a separate `/permissions` router. The count includes both.

## Shared contract rules

- All operations are mounted under `/api/v1` and use school tenant context.
- Route-level guards shown below are not the entire authorization policy. Use cases apply scope, ownership, persona, lifecycle and plan-limit checks.
- The acting user is derived from the authenticated session.
- Only writes with explicit `validate(...)` middleware are identified as route-validated DTOs. Read query parsing and unvalidated path IDs must be checked in controllers/use cases.
- List response envelopes and pagination are not assumed uniform; inspect controller output before defining shared OpenAPI schemas.

## Staff — 13 operations

Mount: `/staff`.

| Method | Path | Access / DTO / behavior |
|---|---|---|
| GET | `/export` | `staff.view`; export current visible staff scope |
| GET | `/me` | STAFF persona; current staff profile |
| GET | `/me/classes` | STAFF persona; own teaching classes |
| GET | `/` | `staff.view`; scoped staff list |
| POST | `/` | `staff.manage`; `CreateStaffDto`; plan staff limit enforced in use case |
| GET | `/:id` | `staff.view`; scope-aware detail |
| GET | `/:id/assignments` | `staff.view`; teaching/role assignments |
| PUT | `/:id` | `staff.manage`; `UpdateStaffDto` |
| PUT | `/:id/branches` | `staff.manage`; `SetStaffBranchesDto` |
| PUT | `/:id/roles` | `staff.manage`; `ChangeStaffRolesDto` |
| POST | `/:id/invite` | `staff.manage` AND `users.invite`; `InviteStaffDto` |
| POST | `/:id/deactivate` | `staff.manage`; `DeactivateStaffDto` |
| POST | `/:id/reactivate` | `staff.manage`; plan staff limit enforced in use case |

The route comments define ALL/branch/self visibility based on permission scope. Branch assignment is performed through the staff module rather than branch endpoints.

## Roles and permission catalogue — 7 operations

### Roles — mount `/roles`

| Method | Path | Access / behavior |
|---|---|---|
| GET | `/` | `roles.view`; list roles |
| POST | `/` | `roles.manage`; create role |
| GET | `/:id` | `roles.view`; role detail |
| GET | `/:id/members` | `roles.view`; role membership |
| PUT | `/:id` | `roles.manage`; update role |
| DELETE | `/:id` | `roles.manage`; delete role subject to use-case constraints |

### Permission catalogue — mount `/permissions`

| Method | Path | Access / behavior |
|---|---|---|
| GET | `/` | `roles.view`; permission catalogue available for role composition |

The role route comments state that a user may only assign permissions they personally hold; this is enforced in the use cases and is an important privilege-escalation boundary. The permission catalogue is a separate exported router from the same source file, not `/roles/permissions`.

## Branches — 9 operations

Mount: `/branches`.

| Method | Path | Access / DTO / behavior |
|---|---|---|
| GET | `/` | `branches.view`; branch list subject to caller's scope |
| GET | `/mine` | `branches.view`; caller's own branch assignments |
| POST | `/` | `branches.manage`; `CreateBranchDto`; plan `branches.max` limit checked in use case |
| GET | `/:id` | `branches.view`; scope-aware branch detail |
| GET | `/:id/members` | `branches.manage`; branch members |
| PUT | `/:id` | `branches.manage`; `UpdateBranchDto` |
| PUT | `/:id/deactivate` | `branches.manage` |
| PUT | `/:id/reactivate` | `branches.manage` |
| DELETE | `/:id` | `branches.manage`; usage constraints enforced downstream |

Branch visibility is scope-sensitive. Staff-to-branch placement is managed through `PUT /staff/:id/branches`.

## Classes and subjects — 17 operations

Mount: `/classes`.

| Method | Path | Access / DTO / behavior |
|---|---|---|
| GET | `/` | `classes.view`; class list |
| POST | `/` | `classes.manage`; `CreateClassDto` |
| POST | `/apply-teaching-defaults` | `classes.manage`; apply teaching defaults |
| GET | `/subjects/all` | `classes.view`; subject catalogue |
| POST | `/subjects` | `classes.manage`; `CreateSubjectDto` |
| PUT | `/subjects/:id` | `classes.manage`; `UpdateSubjectDto` |
| PUT | `/subjects/:id/default-teacher` | `classes.manage`; `SetSubjectDefaultTeacherDto` |
| GET | `/:id` | `classes.view`; class detail |
| PUT | `/:id` | `classes.manage`; `UpdateClassDto` |
| DELETE | `/:id` | `classes.manage`; delete subject to enrolment/assignment constraints |
| PUT | `/:id/class-teacher` | `classes.manage`; `SetClassTeacherDto` |
| PUT | `/:id/progression` | `classes.manage`; `SetClassProgressionDto` |
| GET | `/:id/subjects` | `classes.view`; assigned subjects |
| POST | `/:id/subjects` | `classes.manage`; `AssignSubjectDto` |
| POST | `/:id/subjects/bulk-assign` | `classes.manage`; `BulkAssignSubjectsDto` |
| PATCH | `/:id/subjects/:classSubjectId/clear-override` | `classes.manage`; clear subject-level override |
| DELETE | `/:id/subjects/:classSubjectId` | `classes.manage`; remove class subject assignment |

Fixed paths such as `/subjects/all` are declared before `/:id`, avoiding accidental interpretation as a class identifier.

## Attendance — 6 operations

Mount: `/attendance`.

| Method | Path | Access / DTO / behavior |
|---|---|---|
| GET | `/` | `attendance.view`; attendance list |
| GET | `/summary` | `attendance.view`; student summary |
| GET | `/classes/:classId/register` | `attendance.view`; class register |
| GET | `/classes/:classId/summary` | `attendance.view`; class summary |
| POST | `/classes/:classId` | `attendance.mark`; `SubmitRegisterDto`; submit register |
| PUT | `/:id` | `attendance.mark`; `UpdateAttendanceDto`; correct attendance |

The route comments state that scope controls which students/classes are visible or markable. The 48-hour edit window and `attendance.override` permission are enforced inside use cases, not expressed as a distinct route-level guard in this file. OpenAPI must describe the effective rule without suggesting that the route middleware alone implements it.

## Sessions, terms and calendar — 12 operations

Mount: `/sessions`.

| Method | Path | Access / DTO / behavior |
|---|---|---|
| GET | `/current` | `sessions.view`; current session/term context |
| GET | `/calendar/events` | `sessions.view`; calendar events |
| POST | `/calendar/events` | `sessions.manage`; `CreateCalendarEventDto` |
| PUT | `/calendar/events/:eventId` | `sessions.manage`; `UpdateCalendarEventDto` |
| DELETE | `/calendar/events/:eventId` | `sessions.manage` |
| POST | `/terms` | `sessions.manage`; `CreateTermDto` |
| PUT | `/terms/:termId` | `sessions.manage`; `UpdateTermDto` |
| PUT | `/terms/:termId/set-current` | `sessions.manage`; `SetCurrentTermDto` |
| GET | `/` | `sessions.view`; list sessions |
| POST | `/` | `sessions.manage`; `CreateSessionDto` |
| PUT | `/:id` | `sessions.manage`; `UpdateSessionDto` |
| PUT | `/:id/set-current` | `sessions.manage`; set current session |

Current session/term transitions and date/calendar invariants require use-case inspection; the route table alone does not establish how overlapping dates or historical records are handled.

## Findings to reconcile with the central remediation register

The single issue handoff remains `docs/backend/BACKEND_REMEDIATION_REGISTER.md`. Relevant pre-existing findings include:
- REM-001 — Attendance student-summary authorization and related metadata boundary.
- REM-002 / REM-003 — Enrolment and Grades BRANCH-scope behavior (cross-module RBAC consistency).
- REM-007 / REM-008 — Grades HTTP and release verification gaps.
- REM-016 — Promotion/undo-graduation audit writes after lifecycle commits.
- REM-077 to REM-080 — Audit transaction, date filtering, redaction and access tests.
- REM-086 — Platform Settings and School Settings database-backed integration tests.

Do not duplicate these as new findings. Update the existing entries when fixes or new test evidence are delivered.

## Contract verification still required

1. Inspect staff and branch controllers/use cases for scope resolution, filtering and export content type.
2. Verify role permission assignment cannot grant permissions the acting principal does not hold, including concurrent role edits.
3. Verify branch membership and class/staff assignment interactions after branch changes or deactivation.
4. Inspect class progression semantics and whether progression settings are consumed by enrolment/promotion.
5. Verify attendance summary authorization before any student/class metadata lookup; add route-level tests for staff, student and guardian scopes.
6. Inspect the 48-hour attendance edit-window boundary, override permission, and audit behavior.
7. Inspect session/term overlap, current-term switching, date boundaries and calendar timezone semantics.
8. Verify every list's pagination, filtering, status codes and response envelope from controllers.
9. No HTTP tests, typecheck, build, DB migration tests or concurrency tests were run for this route inventory.

## Source files reviewed

- `apps/api/src/modules/staff/routes/staff.routes.ts`
- `apps/api/src/modules/roles/routes/roles.routes.ts`
- `apps/api/src/modules/branches/routes/branch.routes.ts`
- `apps/api/src/modules/classes/routes/class.routes.ts`
- `apps/api/src/modules/attendance/routes/attendance.routes.ts`
- `apps/api/src/modules/sessions/routes/session.routes.ts`
- `apps/api/src/routes/index.ts`
