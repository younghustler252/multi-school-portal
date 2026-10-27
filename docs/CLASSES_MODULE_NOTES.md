# Classes Module Notes (part A: classes; part B: subjects and subject teachers)

> Branch `refactor/modules`. Follows `docs/ACADEMIC_STRUCTURE_AUDIT.md`. Build: no new TypeScript errors (73 before, 64 after; none left in classes). Tests: 14 new unit tests for part A and 14 for part B pass; no database or API test was run.

## What is switched on
`registerClasses` is in the container list and `/classes` is mounted. Every route now uses permissions.

| Method and path | Permission | What it does |
|---|---|---|
| GET `/classes` | `classes.view` | Classes for a term (`?termId=`, default the current term) |
| GET `/classes/:id` | `classes.view` | One class, with `nextClass` |
| POST `/classes` | `classes.manage` | Create |
| PUT `/classes/:id` | `classes.manage` | Edit name, level, capacity |
| DELETE `/classes/:id` | `classes.manage` | Delete an unused class |
| PUT `/classes/:id/class-teacher` | `classes.manage` | Body `{ staffId }` (null clears) |
| PUT `/classes/:id/progression` | `classes.manage` | Body `{ toClassId }` (null = graduates) |
| GET `/classes/subjects/all` | `classes.view` | All subjects with default teacher |
| POST `/classes/subjects` | `classes.manage` | Create a subject |
| PUT `/classes/subjects/:id` | `classes.manage` | Edit name, code, description (new route) |
| PUT `/classes/subjects/:id/default-teacher` | `classes.manage` | Body `{ staffId }` (null clears) |
| GET `/classes/:id/subjects` | `classes.view` | Subjects of a class for a term (`?termId=`, default current) |
| POST `/classes/:id/subjects` | `classes.manage` | Assign a teacher to one subject |
| POST `/classes/:id/subjects/bulk-assign` | `classes.manage` | One teacher for several subjects (max 50) |
| PATCH `/classes/:id/subjects/:classSubjectId/clear-override` | `classes.manage` | Back to the automatic rule |
| DELETE `/classes/:id/subjects/:classSubjectId` | `classes.manage` | Remove a subject from a class |
| POST `/classes/apply-teaching-defaults` | `classes.manage` | Fill this term's empty subject teachers |

## Rules
- **Permissions** (`classes.permissions.ts`): `classes.view` and `classes.manage` (sensitive). `classes.view` is on the principal, branch principal, teacher and bursar templates; only the admin manages by default. Run `npm run sync:registries`.
- **Names**: unique whatever the capitals (`CLASS_NAME_TAKEN`). Strict bodies; blanks clear `level`; `capacity` 1 to 500, null clears it.
- **Capacity** cannot be set below the students already in the class this term (`CAPACITY_BELOW_STUDENT_COUNT`).
- **Delete** is refused with `CLASS_IN_USE` and counts (`enrolments`, `subjectAssignments`, `feeStructures`, `invoices`, `promotionsInto`) while anything still points at the class. An unused class goes together with its own promotion row, in one transaction.
- **Class teacher** must be an ACTIVE staff member in the TEACHING category (`CLASS_TEACHER_INVALID`). The old `Staff.role` rule is gone. In a homeroom school the class teacher also takes this term's subjects that have no other teacher.
- **Progression**: both classes must exist, a class cannot be promoted into itself (`PROGRESSION_SAME_CLASS`), and the chain may not loop (`PROGRESSION_LOOP`, with the chain named). Enrolment's promotion will use this saved chain.
- **Teaching model** is read from the school's settings row by `TeachingModelReader`, so Classes no longer needs the school-settings module switched on (it was not, and the module's container could not resolve). When the settings service exists, change that one file.
- **Audit**: `class.created / updated / deleted / teacher_set / progression_set`, written after the change succeeds, with names (not ids) in the values.

## Responses carry names
```
class: { id, name, level, capacity, classTeacher: { id, name } | null, studentCount, nextClass?: { id, name } | null, createdAt }
progression: { class: { id, name }, nextClass: { id, name } | null }
```
`classTeacherId` / `classTeacherName` / `toClassId` / `toClassName` are replaced by these objects. Create and update answer with the real teacher and count (they used to send `null` and `0`). Staff names come from `StaffNameLookup` (two queries for a whole page) and are reused by the next passes.

## Error codes
`CLASS_NAME_TAKEN`, `CLASS_IN_USE`, `CAPACITY_BELOW_STUDENT_COUNT`, `CLASS_TEACHER_INVALID`, `PROGRESSION_SAME_CLASS`, `PROGRESSION_LOOP`, plus the shared `NOT_FOUND`, `VALIDATION_ERROR`, `PERMISSION_DENIED`.

## Roles in schools that already exist
Permission `classes.view` for the principal, branch principal, teacher and bursar. Roles in existing environments are brought up to date in two steps on every deploy: `npm run sync:registries` (updates the platform's role templates: locked ones are made exact, editable ones only gain missing permissions) and then `npm run sync:school-roles` (updates each school's own copy; roles a school has customised are skipped and listed). See `ROLE_SYNC_NOTES.md`. Until both have run, the affected roles get `PERMISSION_DENIED` on `/classes`.

## Frontend changes
- Class responses use `classTeacher` and `nextClass` objects (above).
- `PUT /classes/:id/class-teacher` and `PUT /classes/:id/progression` now return the class and `{ class, nextClass }`; their bodies are strict.
- `DELETE /classes/:id` returns `{ deleted, name }` or `409 CLASS_IN_USE`.

## Part B: subjects and subject teachers
Subjects stay inside the Classes module on purpose: a subject only matters once it is assigned to a class for a term with a teacher, and those links share one repository and one "who teaches this" service that Staff and Grades already use. Split them out later if timetable or curriculum modules arrive.

- **Subject names** are unique whatever the capitals (`SUBJECT_NAME_TAKEN`); **codes** are saved in capitals and unique (`SUBJECT_CODE_TAKEN`). Strict bodies; blank code or description clears it on update.
- **Subject teachers** (default teacher, assigned teacher, bulk teacher) must be ACTIVE staff in the TEACHING category (`SUBJECT_TEACHER_INVALID`); unknown staff is `NOT_FOUND`. The old `Staff.role` check is gone.
- **Assign** checks the class, subject, term and teacher first; a manual choice is never overwritten by the automatic rules. The same manual teacher again changes nothing.
- **Bulk assign** checks everything first, then saves in ONE transaction (all or nothing); subjects that already have a teacher are skipped, never overwritten.
- **Default teacher** change follows through this term's classes that were filled in from the old default (hand-picked teachers never change).
- **Apply teaching defaults** is set-based (one plan, one insert, one transaction) and only fills pairs that have no teacher.
- **Remove / clear override**: refused with `CLASS_SUBJECT_IN_USE` once grades were recorded against that subject in that class. Clearing an override falls back to the automatic teacher; with nothing to fall back to, the assignment is removed (unless grades exist).
- **Audit**: `subject.created / updated / default_teacher_set`, `class_subject.assigned / bulk_assigned / removed / override_cleared / defaults_applied`, with names in the values.

### Responses carry names
```
subject: { id, name, code, description, defaultTeacher: { id, name } | null }
assignment: { id, class: { id, name }, subject: { id, name, code }, teacher: { id, name } | null,
              term: { id, name, session: { id, name } } | null, assignedVia }
class subject line (GET /classes/:id/subjects): { id | null, subject: { id, name, code }, teacher | null, assignedVia | null }
bulk: { class, term, teacher, assigned: [{ id, name, code }], skipped: [{ id, name, code }] }
remove: { removed: assignment }      clear override: { removed: boolean, assignment }
```
Unlike before, the old fields (`subjectName`, `subjectCode`, `teacherName`, `staffId`, `classId`, `termId` on assignment results, and the bulk `results` array of ids) are gone.

### Part B error codes
`SUBJECT_NAME_TAKEN`, `SUBJECT_CODE_TAKEN`, `SUBJECT_TEACHER_INVALID`, `CLASS_SUBJECT_IN_USE` (details: `grades`), `NO_CURRENT_TERM`, plus the shared `NOT_FOUND` and `VALIDATION_ERROR`.

### Part B frontend changes
- Subject and assignment responses use the objects above.
- `PUT /classes/subjects/:id` is new; `GET /classes/:id/subjects` returns lines (not flat ids).
- Bodies are strict (unknown fields rejected); bulk assign is capped at 50 subjects.
- `DELETE .../subjects/:classSubjectId` returns `{ removed: assignment }` (it used to return nothing).

## Left for later
Deleting a subject; levels and arms (planned); per-period timetable.

## Next
Enrolment pass (permissions with the ASSIGNED scope, names, transactional enrol / bulk / promote using the saved chain).
