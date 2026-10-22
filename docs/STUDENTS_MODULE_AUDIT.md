# Students Module Audit & Refactor Plan

> **Branch reviewed:** `refactor/modules`
> **Review date:** 2026-10-22
> **Purpose:** Evidence-based handoff for the Students module. This is an audit and plan, not an implementation commit. No Students source files were changed during this review.

## 1. Decision

Students is the next module to refactor, but it must not be enabled simply by uncommenting its registration and route mount. The existing code contains useful functionality, but its dependencies, access control, repository patterns, and input validation have drifted from the patterns used by the newer Staff module and Foundation.

**Recommended first delivery:** a reliable, permission-protected student-record lifecycle (create, get, list/search, update, deactivate, photo), with tenant and branch scoping, plan-limit enforcement, audit behavior, and tests. Keep bulk import and optional student-login provisioning out of the first integration slice until their dependencies and consistency guarantees are resolved.

## 2. Reference conventions

Use the current Staff and Foundation implementations as the primary references:

- Routes use `authenticate`, `requireTenant`, and `requirePermission(...)`; persona checks are explicit where a self-service persona is intended.
- Module-specific permission definitions live in the module's own `*.permissions.ts` and are gathered by `src/foundation/permissions.registry.ts`.
- Shared entitlement definitions live in `src/foundation/features.registry.ts`; active-student limit key `students.max` already exists.
- Repositories should extend `BaseTenantRepository` when its behavior fits. The Staff repository configures `modelName` and `softDelete`; module-specific query methods can be added without reimplementing generic CRUD/pagination.
- Dependency injection follows `register<Name>` functions in each module container.
- Use cases own business rules; controllers remain HTTP adapters.
- DTOs use bounded, trimmed, explicit Zod schemas; use `.strict()` where the existing API convention expects unknown keys to be rejected.
- Use the shared `NumberSequenceService` for generated sequential identifiers and pass a transaction client when the generated number and student record must commit together.
- Use the existing audit and shared API response/error conventions.
- Keep changes scoped; do not activate unrelated academic modules merely to satisfy Students' optional features.

## 3. Confirmed current-state findings

### Integration

1. `registerStudents` is imported in `src/container/index.ts` but commented out in the active registration array.
2. The student route import and `/students` mount are commented out in `src/routes/index.ts`.
3. The container registers `ImportStudentsUseCase` and `ListStudentsUseCase`, both of which inject dependencies from other modules that are currently not registered.
4. There is no Students-specific test file in the current `tests/` tree snapshot; the existing tests primarily cover finance, Foundation permissions, and tenant transaction behavior. This must be confirmed against the current tree before implementing tests.

### Authorization and permissions

1. `src/modules/students/routes/student.routes.ts` uses legacy `requireStaff` and `requireSchoolAdmin` middleware.
2. The Foundation registry already has a core `students.view` permission for STAFF, STUDENT, and GUARDIAN personas, but there is no Students-owned permission file in the registry aggregation for create/manage/import/photo actions.
3. The route applies the legacy `requirePlanLimit("student")` only to single create; bulk creation/import paths do not visibly apply the same route guard.
4. The final authorization model must use Foundation permission scopes and enforce branch visibility in data access/use cases. A route guard alone is not sufficient for record-level scoping.

### Repository and data access

1. `StudentRepositoryImpl` implements its own CRUD, pagination, mapping, and tenant-client access rather than extending `BaseTenantRepository`.
2. `searchStudents(query, params)` currently constructs a new `where` with only its OR search terms, discarding any supplied filters such as active status or branch constraints.
3. Generic repository methods accept broadly typed `Record<string, any>`; align the module interface with the shared repository conventions without forcing unrelated repository-wide changes.
4. `getStudentsBatch` accepts an arbitrary array of IDs at the use-case level; the route has no visible DTO/size validation. It must apply the caller's data scope and enforce a sensible maximum.
5. The tenant `Student` schema has optional unique `userId` and `admissionNumber`, `isActive`, and relations to enrolment, guardians, attendance, grades, fees, report cards, discounts, allocations, and refunds. Preserve these established relations unless schema audit demonstrates a necessary change.

### Validation and route safety

1. Student create/update DTOs are less strict than Staff DTOs: text is not consistently trimmed, several strings/dates have no bounds or validity checks, list pagination is string-based without explicit coercion/ranges, and schemas are not strict.
2. The CSV route uses Multer memory storage with a 3 MB file-size limit, but the route configuration shown does not include a file filter. Validate actual content/encoding/headers in the import path; do not trust file extension or client MIME alone.
3. Batch, bulk-create, and import endpoints need explicit payload/row-count limits and validation before processing.
4. `src/modules/students/routes/student.routes.ts` contains an unused `nextTick` import; clean this only as part of the scoped Students pass.

### Lifecycle and consistency

1. `deactivateStudent` currently sets `isActive: false`. This is a reversible business-status change, not a soft delete. Do not change it to `deletedAt` without deciding how historic enrolments, invoices, attendance, grades, and audit history should behave.
2. The create use case optionally creates a public User account, then a tenant Student record, and sends a welcome email. These operations cross public and tenant data contexts and cannot be assumed to be one atomic database transaction. Define a recoverable sequence and failure behavior before enabling student login.
3. The create use case checks a supplied admission number for duplicates, but there is no visible shared sequence-based generation in that flow. Use `NumberSequenceService` if automatic admission numbers are part of the agreed behavior; preserve manually supplied numbers if the product contract requires them.
4. Photo upload writes to storage and then updates the Student record. Review compensation/cleanup behavior if the database update fails, and follow the shared storage validation conventions.
5. Import performs student creation, class/enrolment matching, guardian creation, and audit logging. Its injected dependencies include Classes, Enrolment, Sessions, Guardians, and Audit. Do not register or enable it until those dependencies are intentionally available and the import failure/partial-success contract is tested.
6. `ListStudentsUseCase` injects Enrolment, Classes, Sessions, and Attendance to enrich list rows. Separate core student listing from optional academic enrichment if needed so the base Students module does not require unfinished academic modules merely to list records.
7. The Student mapper imports `GuardianResponseData`, creating a type-level dependency on Guardians. Keep module boundaries clean by using a shared contract/type or a dedicated response mapper if needed; avoid making basic Student CRUD depend on Guardian implementation.

## 4. Domain decisions to preserve/resolve

### Student vs login account

The current schema explicitly permits `Student.userId` to be null. Treat the Student record as the school's student record and a portal login as optional. Do not make account creation mandatory. If student login is enabled, define how account provisioning, invite/password setup, and linking to the Student record fit the current Auth/membership design; do not assume the old temporary-password flow is still correct.

### Admission number

- Decide the initial format and whether schools can supply their own number.
- Use a tenant-scoped sequence and a uniqueness constraint to handle concurrent creation safely.
- Generate within the same tenant transaction as student creation where possible.
- Define what happens when a manually entered number collides.
- Do not silently change numbers on existing students.

### Branch scope

Students do not currently have a direct `branchId`; their branch may be determined through enrolment/class relationships. Before enforcing branch-level access, agree on the authoritative relationship and behavior for students not yet enrolled. Do not invent a second, conflicting branch ownership field without a domain decision.

### Duplicate-person handling

Do not automatically merge records based only on names or phone numbers. Define a duplicate warning/confirmation workflow; keep admission number and other hard uniqueness constraints enforced in the database.

### Student deactivation

Keep `isActive` as a business lifecycle status unless product requirements explicitly call for archival/deletion. Define whether inactive students count toward `students.max`, whether they remain searchable, and what reactivation requires.

## 5. Proposed first-slice scope

### In scope

- Student domain/entity, DTOs, mapper, repository and repository interface.
- Create, get, list/search, update, deactivate, photo use cases and controller.
- Foundation permission definitions and registry aggregation.
- `students.max` enforcement for creation, including safe handling of concurrent/bulk operations if bulk is included.
- Tenant isolation, branch/data scope, audit events, request validation and error behavior.
- Container and route integration for the supported first-slice endpoints.
- Unit tests for business rules and repository/use-case edge cases; API/tenant tests where test infrastructure supports them.
- Updated module notes and `docs/SCHOOLOS_PLATFORM_DOCUMENTATION.md`.

### Deferred until dependency contracts are agreed

- CSV/Excel bulk import and shared import engine.
- Creating/linking Guardian records during student creation.
- Automatic enrolment into Class/Session and class/attendance enrichment in the list response.
- Optional student portal account provisioning, unless the Auth contract is confirmed and a recoverable cross-context flow is designed.
- Enabling Guardians, Classes, Sessions, Enrolment, Attendance, or other modules solely to satisfy the current Students container.

### Explicit non-goals

- Broad refactor of Auth, Staff, Branches, Foundation, or the shared repository.
- Unrelated schema cleanup.
- Activating every currently commented-out module.
- Changing established fee/ledger relationships without a demonstrated requirement.
- Claiming production readiness before build, tests, migrations, registry sync, and integration behavior have been verified.

## 6. Implementation order

1. **Architecture and dependency map:** inspect all Students files and trace constructor dependencies to registrations. Confirm actual public/tenant client behavior and transaction APIs.
2. **Domain and API contract:** decide student lifecycle, admission-number policy, optional login behavior, branch ownership/scope, list filters, and response shape.
3. **Repository alignment:** migrate to shared tenant repository conventions where compatible; preserve student-specific search and relation queries; fix filter merging and pagination.
4. **Permission and entitlement design:** add Students-owned permissions, scope definitions, role-template implications, and consistent `students.max` enforcement. Run registry validation/sync only after reviewing its impact.
5. **Core use cases:** implement transactional create/admission-number behavior, safe updates, deactivation, scoped reads, and photo-upload failure handling.
6. **Routes/controller/container:** replace legacy role guards with permission-based access, validate all input, integrate only supported dependencies, then mount the module.
7. **Tests and verification:** run focused tests, `npm run build`, and the relevant registry/test commands. Do not run destructive database tests against development/production.
8. **Import as a separate slice:** once the core API is stable and Guardian/Class/Session/Enrolment contracts are available, design the shared import engine and partial-success reporting.
9. **Documentation handoff:** record changed files, migration and registry-sync requirements, exact checks run, unresolved risks, and the next module.

## 7. Acceptance criteria for the first slice

- All enabled endpoints use current authentication, tenant, permission and scope conventions.
- No request can access another school's student records by guessing an ID.
- List/search filters combine rather than overwrite each other, pagination is bounded, and batch endpoints are capped.
- Admission numbers remain unique under concurrent requests.
- Student record creation does not leave an unexplained orphan login or send credentials for a failed student creation.
- Plan limits cannot be bypassed through supported creation paths.
- Photo upload validates content and has a defined failure/cleanup path.
- Deactivation preserves the required historical links.
- Foundation permission registry validates; build and relevant tests are reported honestly.
- The module is documented as integrated only after container registration and route mounting are verified.

## 8. Verification limits

This audit was based on source inspection of branch `refactor/modules`; no code was changed and no build/test command was executed during this audit. Findings should be rechecked against the working tree immediately before implementation.
