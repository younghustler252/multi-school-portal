# Classes and Subjects Module

> **Verification status:** Partially source-verified. Routes, controller wiring, DTOs, DI registration, class create/update and subject-assignment use cases were inspected. Remaining query/delete/progression/default-teaching/subject use cases, repository/schema, permission registry and focused tests require review.
> **Primary source:** `apps/api/src/modules/classes/`
> **Route mount:** `/api/v1/classes`, from `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

Owns school class groups, subjects, class teachers, class progression rules and term-specific subject-teacher assignments. Enrolment owns student placement into classes; Sessions owns academic terms. Class/subject configuration is not itself an enrolment.

## 2. Data and dependencies

The module uses a tenant repository, class/subject mappers and presenters, Staff repository/lookups, Sessions repository, teaching-model readers, subject-resolution service and Audit service. The container declares dependencies on Staff, Auth user repository, Sessions, Audit and Foundation access service.

Class responses are assembled by `ClassPresenter`; subject and assignment responses use `SubjectPresenter`. Do not assume mapper-only shapes are the complete HTTP payload.

## 3. Authorization

All routes require authentication, tenant context and one of:

- `classes.view`: read classes, subjects and teaching assignments.
- `classes.manage`: create/update/delete classes and subjects, set class teacher and progression, configure teaching defaults and assignments.

The controller derives actor identity and access from the verified session. Branch-aware class management is enforced in the use cases/services as well as by route permission.

## 4. API endpoints

All paths are under `/api/v1/classes`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /` | `classes.view` | List classes; controller accepts optional termId query |
| `POST /` | `classes.manage`; CreateClassDto | Create class |
| `POST /apply-teaching-defaults` | `classes.manage` | Apply teaching defaults |
| `GET /subjects/all` | `classes.view` | List subjects |
| `POST /subjects` | `classes.manage`; CreateSubjectDto | Create subject |
| `PUT /subjects/:id` | `classes.manage`; UpdateSubjectDto | Update subject |
| `PUT /subjects/:id/default-teacher` | `classes.manage`; SetSubjectDefaultTeacherDto | Set default teacher |
| `GET /:id` | `classes.view` | Read class |
| `PUT /:id` | `classes.manage`; UpdateClassDto | Update class |
| `DELETE /:id` | `classes.manage` | Delete class |
| `PUT /:id/class-teacher` | `classes.manage`; SetClassTeacherDto | Set/clear class teacher |
| `PUT /:id/progression` | `classes.manage`; SetClassProgressionDto | Set next class or mark graduation |
| `GET /:id/subjects` | `classes.view` | List subjects and assignments for class |
| `POST /:id/subjects` | `classes.manage`; AssignSubjectDto | Assign one subject teacher for a term |
| `POST /:id/subjects/bulk-assign` | `classes.manage`; BulkAssignSubjectsDto | Assign one teacher to several subjects |
| `PATCH /:id/subjects/:classSubjectId/clear-override` | `classes.manage` | Clear a manual teaching override |
| `DELETE /:id/subjects/:classSubjectId` | `classes.manage` | Remove class-subject assignment |

## 5. Request contracts

All DTOs are strict; unknown properties are rejected.

### Classes

- `CreateClassDto`: required name (1–50 chars); optional level (max 30), capacity (integer 1–500), branchId UUID.
- `UpdateClassDto`: optional name, nullable level, nullable capacity, optional branchId UUID; at least one field.
- `SetClassTeacherDto`: `staffId` UUID or null.
- `SetClassProgressionDto`: `toClassId` UUID or null; null means the class graduates.

### Subjects and teaching assignments

- `CreateSubjectDto`: name (1–100), optional code (uppercase normalized, letters/numbers/hyphen/underscore, max 20), optional description (max 300).
- `UpdateSubjectDto`: optional name, nullable code and description; at least one field.
- `SetSubjectDefaultTeacherDto`: `staffId` UUID or null.
- `AssignSubjectDto`: required `subjectId`, `staffId`, `termId` UUIDs.
- `BulkAssignSubjectsDto`: required `staffId`, `termId` UUIDs and 1–50 `subjectIds`.

## 6. Confirmed business rules

- Class names are unique case-insensitively.
- New class branch is resolved server-side against the actor's branch access.
- A class capacity cannot be lowered below its current-term student count.
- A class cannot move branches while it has current-term enrolments.
- Moving a class must not break its configured progression chain across branches.
- Subject codes are normalized to uppercase.
- A subject-teacher assignment requires an existing class, subject and term, and an active teaching-category staff member.
- Manual subject-teacher assignments are marked as manual; teaching defaults must not overwrite an existing manual choice.
- Mutations inspected use Audit service.

## 7. Frontend integration requirements

- Keep class setup, subject catalog, class-teacher assignment, progression and term-specific subject-teacher assignment as distinct UI workflows.
- Treat `termId` as required for subject-teacher assignments; assignments are term-specific.
- Do not assume every staff member is eligible to teach: backend requires active teaching-category staff.
- Capacity is a hard constraint; show the backend conflict rather than silently reducing enrolments.
- Branch changes can be blocked by current-term enrolments or progression links.
- Render presenter response shapes from actual API responses; do not construct a class DTO from a student-enrolment payload.

## 8. Verification gaps

Remaining use cases and presenters, repository/schema constraints, permission registry sync and tests were not fully inspected. No tests/build/migrations/runtime requests were executed. Full response envelopes and error codes still need an API-contract pass.

## 9. Source files reviewed

- `routes/class.routes.ts`, `controllers/class.controller.ts`, `dtos/class.dto.ts`
- `usecases/school-admin/create-class.usecase.ts`
- `usecases/school-admin/update-class.usecase.ts`
- `usecases/school-admin/assign-subject.usecase.ts`
- `classes.container.ts`, `apps/api/src/routes/index.ts`
