# Enrolment Module

> **Verification:** Partially source-verified  
> **Source review:** 2026-11-05, branch `refactor/modules`  
> **Scope:** Routes, controller, DTOs, domain errors, permissions, use cases, supporting services, DI registration, route mount and focused tests were inspected. The database schema/migrations, all repository behavior and live API behavior were not independently verified. Tests were read, not executed.

## 1. Responsibility

The Enrolment module assigns a student to a class for a specific academic term. It owns the term-specific enrolment record and its lifecycle:

- List enrolments within the caller's visibility scope.
- Enrol one student or bulk-enrol a list into one class.
- Change an enrolment's status or move an active enrolment to another class.
- Preview and execute end-of-year promotion using the saved class progression rules.
- Present enrolment data with student, class, term and session names rather than exposing only foreign-key IDs.

It does not own student identity/lifecycle, class definitions, subject teaching assignments, academic term definitions or branch transfers. Those remain in Students, Classes and Subjects, Sessions, and Students respectively.

## 2. HTTP surface

The router is mounted at **`/api/v1/enrolments`** by `apps/api/src/routes/index.ts`, under the global `/api/v1` prefix in `apps/api/src/app.ts`.

All routes are school-realm routes and require authentication, tenant resolution and the relevant permission.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `enrolment.view` | Paginated, scoped enrolment list |
| POST | `/` | `enrolment.manage` | Enrol one student |
| POST | `/bulk` | `enrolment.manage` | Bulk-enrol up to 200 submitted student IDs |
| GET | `/promotion-preview` | `enrolment.promote` | Preview a term's promotion plan |
| POST | `/promote` | `enrolment.promote` | Execute promotion |
| PUT | `/:id` | `enrolment.manage` | Change status or move enrolment |

There are no separate DELETE, withdraw or reactivate routes in this router. Status changes use `PUT /:id`.

### Query and request DTOs

All body DTOs are strict Zod objects; unknown fields are rejected.

**List query** (`ListEnrolmentsQuery`):
- `page`: integer, default 1, minimum 1.
- `limit`: integer, default 20, range 1–100.
- Optional UUID filters: `classId`, `termId`, `studentId`.
- Optional `status`: `active | withdrawn | transferred | completed`.
- Optional `search`: trimmed, max 100 characters. The use case splits it into at most five words and applies each word as a separate student-name/admission-number match.
- When `termId` is omitted, the current term is used if one exists. If there is no current term, the query is not automatically restricted to a term.

**Single enrolment**:
```json
{ "studentId": "<uuid>", "classId": "<uuid>", "termId": "<uuid>" }
```

**Bulk enrolment**:
```json
{ "studentIds": ["<uuid>"], "classId": "<uuid>", "termId": "<uuid>" }
```
`studentIds` must contain 1–200 UUIDs. Duplicate IDs are de-duplicated by the use case.

**Update**: send exactly one of:
- `status`: `active | withdrawn | transferred | completed`, optionally with `reason` (trimmed, max 300 characters); or
- `classId`: target class UUID, optionally with `reason`.

A request cannot change status and class in the same operation. Empty updates are rejected.

**Promotion preview query**: required `termId`, optional `newTermId`.

**Promotion command**:
```json
{
  "currentTermId": "<uuid>",
  "newTermId": "<uuid>",
  "overrides": [
    { "studentId": "<uuid>", "action": "promote", "classId": "<uuid>" }
  ]
}
```
`overrides` defaults to an empty array and is limited to 500. Actions are `promote`, `repeat`, `graduate`, or `exclude`. A `classId` is required only for `promote`. The client sends exceptions, not the complete promotion plan.

## 3. Permissions and visibility

Defined in `enrolment.permissions.ts`:

| Permission | Scopes | Personas | Intended use |
|---|---|---|---|
| `enrolment.view` | ALL, BRANCH, ASSIGNED, OWN | STAFF, STUDENT, GUARDIAN | Read class lists and enrolments |
| `enrolment.manage` | ALL | STAFF | Enrol, bulk enrol, move, withdraw/reactivate |
| `enrolment.promote` | ALL | STAFF | Preview and run promotion |

The focused test asserts that default role templates grant view scopes as follows: principal = ALL, branch principal = BRANCH, teacher = ASSIGNED, bursar = ALL, student = OWN, guardian = OWN. The test also asserts that the default templates do not grant manage or promote.

Read filtering is applied in `enrolmentScopeWhere`:
- ALL: no additional enrolment predicate.
- ASSIGNED staff: classes they lead, plus classes where they teach a subject in the current term.
- OWN student: records whose `studentId` is the caller's persona entity ID.
- OWN guardian: records whose student has a guardian link to the caller's persona entity ID.
- BRANCH currently resolves to an empty result predicate; the scope helper explicitly says classes are not yet linked to branches for this query. Do not interpret the permission declaration as proof branch filtering is implemented.

The actor for mutations comes from the verified session (`req.auth.userId`); the school ID comes from resolved tenant context. Neither is accepted from the request body.

## 4. Business rules and invariants

### Enrolment creation

A student must exist, be active and not graduated. The class and term must exist. Student and class must have the same `branchId`; cross-branch placement is rejected with `STUDENT_BRANCH_MISMATCH`. Moving a student between branches is a Students-module transfer, not an enrolment operation.

A student may have only one enrolment per term. The use case checks for an existing record and translates a Prisma unique-conflict race into the domain-level already-enrolled error.

### Class capacity and concurrency

A class without a capacity limit is never full. For limited classes, the implementation locks the class row, counts active enrolments for the target term and performs the write in the same tenant transaction. This is intended to prevent two concurrent requests from both consuming the last seat.

Single enrolment, bulk enrolment, class moves, reopening a closed enrolment and promotion all use the class-seat helpers. Bulk enrolment is all-or-nothing for the eligible students: if the class cannot fit the entire eligible batch, the request is rejected and none of that batch is saved.

### Bulk behavior

The use case de-duplicates IDs and reports skipped records by student name and reason:
- `not_found`
- `inactive`
- `graduated`
- `wrong_branch`
- `already_enrolled`

Eligible students are created together in one transaction. The result contains the target class, term, enrolled student summaries and skipped rows. Audit is written when at least one student is enrolled.

### Updating an enrolment

An active enrolment can be changed to withdrawn, transferred or completed. A closed enrolment can only be reopened to active; reopening requires the student still to be active and not graduated, and checks class capacity.

Only an active enrolment can be moved to another class. The destination must exist, belong to the student's branch and have room for the student. A same-class move is rejected. Each actual change is audited with the before/after student, class and status names and optional reason.

### Promotion

The server derives the default destination from each class's saved `promoted into` progression:
- A class pointing to another class promotes students there.
- A class with no next class graduates students.
- A class with no saved progression decision requires an explicit decision before the run can proceed.

Overrides can promote to a chosen class, repeat in the same class, graduate or exclude. The preview can identify students already enrolled in the destination term and flags branch mismatches. The preview is read-only.

The promotion command checks that the terms exist, the destination term starts later, all override students are in the active source-term plan, all required decisions exist, and target classes exist. It refuses cross-branch placement, including override destinations. It locks destination classes and checks their capacity before writing. The transaction creates destination-term enrolments, completes the source-term enrolments for movers/repeaters/graduates, and marks graduating students with `graduatedAt` and `graduatedTermId`. A branch mismatch or capacity failure aborts the entire transaction.

Graduation does not set the student's `isActive` flag to false. Graduated students retain historical records, while student eligibility rules exclude them from active enrolment/promotion planning.

## 5. Response shape and frontend integration

The presenter returns names alongside IDs. The core enrolment response is:

```ts
{
  id: string;
  student: { id: string; name: string; admissionNumber: string | null; photoUrl: string | null } | null;
  class: { id: string; name: string } | null;
  term: { id: string; name: string; session: { id: string; name: string } | null } | null;
  status: string;
  createdAt: Date;
}
```

Student photo URLs are produced by the private student-photo service and are short-lived signed links. Treat them as temporary display URLs, not permanent asset identifiers.

List returns `{ success, message, data, meta }`; create returns the shared created-response helper; bulk, update and promotion use the shared success-response helper. Promotion preview/result have dedicated summary and row structures in `promotion.usecases.ts`.

Frontend rules:
- Use the returned student/class/term names for display; do not issue one lookup per enrolment row.
- Keep the term ID for filters and commands, but show the session and term names returned by the API.
- Handle bulk skipped rows separately from a failed whole-batch capacity check.
- Build the promotion review UI from `GET /promotion-preview`; submit only explicit overrides to `POST /promote`.
- Treat `CLASS_FULL`, `STUDENT_BRANCH_MISMATCH`, `PROMOTION_NEEDS_DECISIONS`, `PROMOTION_UNKNOWN_STUDENT` and `ENROLMENT_ALREADY_EXISTS` as actionable domain errors. Error envelope details are governed by the global error handler and API conventions guide.

## 6. Dependencies and registration

The module registers its mapper, tenant-scoped repository and presenter, list/create/bulk/update/promotion use cases, and controller in `enrolment.container.ts`.

It depends on:
- Students repository and student-photo service.
- Classes repository and saved class progression.
- Sessions repository for term lookup and ordering.
- Audit service.
- Foundation access object for read scoping.
- Tenant Prisma client for multi-step transactions.

The enrolment repository is also consumed by other modules, including attendance, report cards and student import. Its public method names are cross-module dependencies; change them only with a coordinated audit.

## 7. Tests and verification gaps

Inspected focused test: `apps/api/tests/enrolment/enrolment.test.ts`. It covers permission registry/templates, DTO validation, visibility scopes, capacity helper, promotion planning, list filtering/presentation, single and bulk enrolment, update behavior, promotion and branch constraints.

The test file was inspected but not executed in this documentation pass. The following remain unverified:
- Tenant Prisma schema and migration constraints/indexes, including the one-enrolment-per-student-per-term invariant.
- Route-level middleware behavior and actual HTTP response/error envelopes.
- Database concurrency behavior under real concurrent requests.
- Full test execution and typecheck.
- Whether BRANCH enrolment visibility is intentionally deferred or should be implemented before branch-scoped roles are enabled.

## 8. Source map

- Routes: `apps/api/src/modules/enrolment/routes/enrolment.routes.ts`
- Controller: `apps/api/src/modules/enrolment/controllers/enrolment.controller.ts`
- DTOs: `apps/api/src/modules/enrolment/dtos/enrolment.dto.ts`
- Permissions: `apps/api/src/modules/enrolment/enrolment.permissions.ts`
- Use cases: `apps/api/src/modules/enrolment/usecases/`
- Scope/capacity/branch/promotion rules: `apps/api/src/modules/enrolment/services/`
- Presenter: `apps/api/src/modules/enrolment/services/enrolment-presenter.ts`
- DI: `apps/api/src/modules/enrolment/enrolment.container.ts`
- Tests: `apps/api/tests/enrolment/enrolment.test.ts`
- Route mount: `apps/api/src/routes/index.ts`
