# Students Module Notes (first slice)

> Branch `refactor/modules`. Follows `docs/STUDENTS_MODULE_AUDIT.md`. Build: no new TypeScript errors (the 83 existing ones are in other modules). Tests: 22 new unit tests pass; no database or API test was run.

## What is switched on
`registerStudents` is in the container list and `/students` is mounted. Only the core student record is live.

| Method and path | Permission | What it does |
|---|---|---|
| GET `/students` | `students.view` | List. Query: `page`, `limit` (max 100), `search`, `gender`, `status` (active, inactive, all; default active) |
| GET `/students/me` | STUDENT persona | The signed-in student's own record |
| GET `/students/:id` | `students.view` | One student (outside the viewer's scope = 404) |
| POST `/students` | `students.manage` | Create |
| PUT `/students/:id` | `students.manage` | Update; only changed fields are written and audited |
| POST `/students/:id/deactivate` | `students.manage` | Body: optional `reason` |
| POST `/students/:id/reactivate` | `students.manage` | Checks the student limit again |
| POST `/students/:id/photo` | `students.manage` | Multipart field `photo`, JPG/PNG/WebP, 2 MB max |

## Rules
- **Permissions** (`students.permissions.ts`): `students.view` (ALL, BRANCH, ASSIGNED, OWN) and `students.manage` (ALL). `students.view` moved out of the core list in `permissions.registry.ts`. Run `npm run sync:registries`. School admin holds both (grantsAll). Other role templates are unchanged, so nobody else can manage students until a template grants `students.manage`.
- **Who sees which students** (`services/student-scope.ts`): ALL = everyone; OWN = a student sees themselves, a guardian sees linked children. BRANCH and ASSIGNED see nobody until Enrolment is switched on (a student has no branch of their own).
- **Plan limit** (`students.max`): checked inside create and reactivate. Inactive students do not count.
- **Admission number**: automatic `YEAR/0001` (restarts yearly, Nigerian time, year of the admission date), made inside the same transaction as the student; a typed number is allowed. Format lives in `domain/student.policy.ts` until the settings service exists.
- **Duplicates**: same name + same date of birth returns 409 `POSSIBLE_DUPLICATE_STUDENT`; resend with `confirmNotDuplicate: true`.
- **No login on create.** The old temporary-password flow is removed. A portal login comes later through an invitation, like Staff.
- **Deactivate** keeps the record and all history. **Audit** entries: `student.created`, `.updated` (old and new values), `.deactivated`, `.reactivated`, `.photo_changed`.
- **Photo**: checked by real file content, stored under a generated name in the public bucket, removed again if the database update fails.
- **DTOs are strict**: unknown fields are rejected (for example `email` and guardian fields on create). Blank strings count as "not sent" on create and "clear it" on update.

## Error codes
`ADMISSION_NUMBER_TAKEN`, `ADMISSION_NUMBER_FAILED`, `POSSIBLE_DUPLICATE_STUDENT` (details: `existingStudentId`), `INVALID_IMAGE`, plus the shared `NOT_FOUND`, `PLAN_LIMIT_REACHED`, `PERMISSION_DENIED`, `CONFLICT` (already active / inactive).

## Frontend changes
- Deactivate is now `POST /students/:id/deactivate` (was `DELETE /students/:id`); new `POST /students/:id/reactivate`.
- List filter is `status` (was `isActive`). The list no longer has `classId`, `className` or `attendancePercentage` (they come back with Classes, Enrolment and Attendance).
- Student detail no longer includes `guardians` (comes back with Guardians).
- Removed for now: `POST /students/batch`, `/students/import`, `/students/bulk-create`.
- Create and update no longer accept `email` or guardian fields.

## Left for later
- `usecases/import-students.usecase.ts` and `get-students-batch.usecase.ts` stay in the folder but are not registered or routed (import needs Guardians, Classes, Sessions, Enrolment). Import will need its own `students.import` permission.
- Guardians on the student detail, class and attendance on the list, student portal invitation, branch/assigned scopes.
- Old photo files are not deleted from storage when a photo is replaced. Photos go to the public bucket (random file names); a private bucket with signed links is stricter.
- Student has no `createdById` column, so the actor is recorded in the audit log only.

## Known issue found in Staff (not changed)
`CreateStaffUseCase` retries on a number clash, but the sequence number rolls back with the failed transaction, so the retry gets the same number again. Students avoids this by skipping taken numbers inside the transaction.

## Next step
Guardians (it already depends on `studentRepository`), then Classes, Sessions and Enrolment.
