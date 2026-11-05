# Backend Documentation

This section documents the backend implementation for developers building and maintaining CORE.

## Reading order

1. [System and monorepo architecture](../architecture/system-and-monorepo.md)
2. [Multi-tenancy and database architecture](../architecture/multi-tenancy-and-database.md)
3. [Authentication and authorization architecture](../architecture/authentication-and-authorization.md)
4. [Background processing architecture](../architecture/background-processing.md)
5. API conventions — planned; create after the response/error middleware audit.

## Module guides

| Module | Guide | Verification |
|---|---|---|
| Auth | [Auth module](modules/auth.md) | Source-reviewed; runtime and integration verification outstanding |
| Users | [Users module](modules/users.md) | Source-reviewed; runtime and integration verification outstanding |
| School | [School module](modules/school.md) | Source-reviewed; provider/runtime verification outstanding |
| Roles and permissions | [Roles and permissions](modules/roles.md) | Source-reviewed; registry sync/runtime verification outstanding |
| Branches | [Branches module](modules/branches.md) | Partially source-verified; tests/schema/runtime verification outstanding |
| Staff | [Staff module](modules/staff.md) | Partially source-verified; remaining use cases/tests/schema/runtime verification outstanding |
| Students | [Students module](modules/students.md) | Partially source-verified; remaining lifecycle/photo/schema/test verification outstanding |
| Guardians | [Guardians module](modules/guardians.md) | Partially source-verified; update/repository/schema/test verification outstanding |
| Classes and subjects | [Classes and subjects](modules/classes.md) | Partially source-verified; remaining use cases/schema/test verification outstanding |
| Enrolment | [Enrolment module](modules/enrolment.md) | Partially source-verified; schema/migration/runtime verification outstanding |
| Sessions and calendar | [Sessions module](modules/sessions.md) | Partially source-verified; schema/migration/runtime verification outstanding |
| Attendance | [Attendance module](modules/attendance.md) | Partially source-verified; tests/runtime and summary authorization review outstanding |

## Documentation contract

Module guides describe implementation responsibilities, dependencies, data ownership, route behavior, DTOs, response shapes, permissions, business rules, background work, errors, tests and frontend integration requirements.

A guide must identify its source snapshot and distinguish:

- **Source-verified:** confirmed in the current implementation.
- **Partially verified:** some relevant implementation paths remain unchecked.
- **Open:** a known defect, design decision or missing verification.
- **Not verified:** no claim should be made until the source or runtime behavior is inspected.

Do not treat a module guide as a replacement for OpenAPI. The API specification should become the canonical cross-team HTTP contract after endpoint coverage has been audited.

## Module audit sequence

Foundation modules are being documented first because other modules depend on their identity and authorization behavior:

1. Auth
2. Users
3. School
4. Roles and permissions
5. Branches
6. Staff
7. Students
8. Guardians
9. Classes and subjects
10. Enrolment
11. Sessions and calendar
12. Attendance

The frontend is intentionally not being documented as the current implementation while it remains behind the backend. Frontend implementation documentation will follow the backend contract audit.
