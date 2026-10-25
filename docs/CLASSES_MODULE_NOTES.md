# Classes Module Notes (part A: classes themselves; part B, subjects and subject teachers, comes next)

> Branch `refactor/modules`. Follows `docs/ACADEMIC_STRUCTURE_AUDIT.md`. Build: no new TypeScript errors (73 before, 64 after; none left in classes). Tests: 14 new unit tests pass; no database or API test was run.

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
| subject and teacher-assignment routes | view / manage | Only the permission guards changed in this part (see "Part B") |

## Rules
- **Permissions** (`classes.permissions.ts`): `classes.view` and `classes.manage` (sensitive). `classes.view` is on the principal, branch principal, teacher and bursar templates; only the admin manages by default. Run `npm run sync:registries`.
- **Names**: unique whatever the capitals (`CLASS_NAME_TAKEN`). Strict bodies; blanks clear `level`; `capacity` 1 to 500, null clears it.
- **Capacity** cannot be set below the students already in the class this term (`CAPACITY_BELOW_STUDENT_COUNT`).
- **Delete** is refused with `CLASS_IN_USE` and counts (`enrolments`, `subjectAssignments`, `feeStructures`, `invoices`, `promotionsInto`) while anything still points at the class. An unused class goes together with its own promotion row, in one transaction.
- **Class teacher** must be an ACTIVE staff member in the TEACHING category (`CLASS_TEACHER_INVALID`). The old `Staff.role` rule is gone. In a homeroom school the class teacher also takes this term's subjects that have no other teacher.
- **Progression**: both classes must exist, a class cannot be promoted into itself (`PROGRESSION_SAME_CLASS`), and the chain may not loop (`PROGRESSION_LOOP`, with the chain named). Enrolment's promotion will use this saved chain.
- **Teaching model** is read from the school's settings row by `TeachingModelReader`, so Classes no longer needs the school-settings module switched on (it was not, and the module's container could not resolve). When the settings service exists, change that one file.
- **Audit**: `class.created / updated / deleted / teacher_set / progression_set`, written after the change succeeds, with names (not ids) in the values.
- **Two lookups still open from before** (fixed minimally so the module no longer breaks at runtime; reworked in part B): class subjects' teacher names used a user lookup that does not exist, and updating a subject's default teacher checked `Staff.role`.

## Responses carry names
```
class: { id, name, level, capacity, classTeacher: { id, name } | null, studentCount, nextClass?: { id, name } | null, createdAt }
progression: { class: { id, name }, nextClass: { id, name } | null }
```
`classTeacherId` / `classTeacherName` / `toClassId` / `toClassName` are replaced by these objects. Create and update answer with the real teacher and count (they used to send `null` and `0`). Staff names come from `StaffNameLookup` (two queries for a whole page) and are reused by the next passes.

## Error codes
`CLASS_NAME_TAKEN`, `CLASS_IN_USE`, `CAPACITY_BELOW_STUDENT_COUNT`, `CLASS_TEACHER_INVALID`, `PROGRESSION_SAME_CLASS`, `PROGRESSION_LOOP`, plus the shared `NOT_FOUND`, `VALIDATION_ERROR`, `PERMISSION_DENIED`.

## Roles in schools that already exist
Same as Sessions: the principal, branch principal, teacher and bursar templates are created once and then owned by the platform, so existing schools will NOT get `classes.view` for them automatically; until it is added, those roles get `PERMISSION_DENIED` on `/classes`. New schools get it through provisioning.

## Frontend changes
- Class responses use `classTeacher` and `nextClass` objects (above).
- `PUT /classes/:id/class-teacher` and `PUT /classes/:id/progression` now return the class and `{ class, nextClass }`; their bodies are strict.
- `DELETE /classes/:id` returns `{ deleted, name }` or `409 CLASS_IN_USE`.

## Part B (next)
Subjects and subject teachers: strict bodies, case-insensitive unique subject names and codes, teaching-category rule for default and assigned teachers, audit, names instead of ids on assign / bulk-assign / clear-override responses, safe subject removal, tests.

## Then
Enrolment pass (permissions with the ASSIGNED scope, names, transactional enrol / bulk / promote using the saved chain).
