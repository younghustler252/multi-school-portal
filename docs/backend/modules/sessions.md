# Sessions Module

> **Verification:** Partially source-verified  
> **Source review:** 2026-11-05, branch `refactor/modules`  
> **Scope:** Routes, controller, DTOs, date policies, permission declarations, use cases, rollover service, repositories, mappers, DI registration, route mount and focused tests were inspected. The tenant Prisma schema/migrations and live API behavior were not independently verified. Tests were read, not executed.

## 1. Responsibility

The Sessions module owns the school's academic calendar:
- Academic sessions (school years), e.g. `2025/2026`.
- Terms within a session (first, second, third).
- The current session and current term.
- School calendar events scoped to a term, a session or the whole school.
- Optional term rollover: carry active students forward and carry/seed subject-teacher assignments when a term becomes current.

It does not own student enrolment records or class/subject definitions. Rollover coordinates with Enrolment and Classes to copy records into the new term.

## 2. HTTP surface

The router is mounted at **`/api/v1/sessions`** by `apps/api/src/routes/index.ts`, under the global `/api/v1` prefix in `apps/api/src/app.ts`.

All routes require authentication, tenant resolution and a school permission.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/current` | `sessions.view` | Current session and current term |
| GET | `/` | `sessions.view` | List sessions with terms |
| POST | `/` | `sessions.manage` | Create session |
| PUT | `/:id` | `sessions.manage` | Update session name/dates |
| PUT | `/:id/set-current` | `sessions.manage` | Set current session |
| POST | `/terms` | `sessions.manage` | Create term |
| PUT | `/terms/:termId` | `sessions.manage` | Update term dates |
| PUT | `/terms/:termId/set-current` | `sessions.manage` | Set current term and optionally roll over records |
| GET | `/calendar/events` | `sessions.view` | List calendar events |
| POST | `/calendar/events` | `sessions.manage` | Create calendar event |
| PUT | `/calendar/events/:eventId` | `sessions.manage` | Update calendar event |
| DELETE | `/calendar/events/:eventId` | `sessions.manage` | Delete calendar event |

### Session and term DTOs

All command DTOs are strict Zod objects.

**Create session**:
```json
{ "name": "2025/2026", "startDate": "2025-09-01", "endDate": "2026-07-20" }
```
- Name must be two four-digit years separated by `/`, with the second exactly one year after the first.
- End date must be after start date.
- Session dates may not overlap another session; the overlap check treats both endpoints as included.

**Update session** accepts one or more of `name`, `startDate`, `endDate`; an empty update is rejected. New dates must continue to contain every existing term and may not overlap another session.

**Create term**:
```json
{ "sessionId": "<uuid>", "name": "first", "startDate": "2025-09-08", "endDate": "2025-12-12" }
```
Term names are `first | second | third`. A term must be inside its parent session, its name must be unique within that session, and its dates may not overlap another term in the same session.

**Update term** accepts only `startDate` and/or `endDate`. The term name cannot be changed because records are stored against the term. Updated dates must remain inside the parent session and not overlap sibling terms.

**Set current term** accepts `{ "carryForward": true | false }`. The field defaults to true, including when the request has no body. False switches the current term without copying student enrolments or subject assignments.

### Calendar DTOs

Event types: `holiday | event | exam | break | other`.

Create accepts:
- Required `title` (1–120 characters) and `startDate`.
- Optional `description` (max 500), `endDate`, `type` (default `event`), `isHoliday`, `termId`, and/or `sessionId`.
- End date cannot precede start date.
- An event belongs to a term, a session, or neither (school-wide). A term implies its parent session; supplying a different session is rejected.

Update accepts only event content/date/type/holiday fields. Scope IDs are not mutable through the update DTO. Empty updates are rejected; a blank description/end date clears that value.

List query supports optional `termId`, `sessionId`, `type`, `from` and `to`.

## 3. Permissions

Defined in `sessions.permissions.ts`:

| Permission | Scope | Personas | Intended use |
|---|---|---|---|
| `sessions.view` | ALL | STAFF, STUDENT, GUARDIAN | View sessions, terms, current academic period and calendar |
| `sessions.manage` | ALL | STAFF | Create/edit sessions, terms and events; choose current session/term |

The focused test verifies that every default role can view sessions and that the default templates do not grant `sessions.manage`. The manage permission is marked sensitive.

Mutations derive the acting user from the verified session and school ID from resolved tenant context.

## 4. Business rules

### Academic date boundaries

Session names follow the consecutive-year convention. Session ranges cannot overlap. Term ranges are inclusive, must fit inside their parent session and cannot overlap another term in that session. A session cannot be shortened so that one of its terms falls outside the new range.

The pure date rules live in `domain/session.policy.ts`; DTO validation handles request shape and basic date parsing, while use cases enforce cross-record constraints.

### Current session and term

Setting a session current updates the selected session and clears the previous current session in a transaction. If the current term belongs to a different session, it is cleared. This operation does not perform term rollover.

Setting a term current also makes its parent session current and clears the previous current term/session in one transaction. The use case identifies the previous term within the selected session and passes it to the repository's transactional rollover operation.

The `GET /current` response may contain a null session and/or current term until the school selects them. The response returns the current session with its terms and the current term with its parent session name.

### Term rollover

With `carryForward: true` (the default), the repository calls `rolloverInTx` inside the same database transaction that switches the current session and term.

Student carry-forward:
- Reads active enrolments from the previous term for active, non-graduated students.
- Skips any student who already has an enrolment in the destination term.
- Creates destination-term enrolments in the same class.
- Does not silently move students between classes or branches.
- Is idempotent for existing destination enrolments.

Capacity is deliberately treated differently during rollover than during manual enrolment: the rollover preserves the student's existing class even if the class is now over capacity. It reports over-capacity classes in the rollover result so school staff can resolve them. This prevents a term switch from leaving a student without a class.

Subject-teacher carry-forward:
- Copies previous-term class-subject teacher assignments that remain applicable.
- Fills missing assignments from the current teaching model/default teacher rules through the Classes module's `planTermAssignments`.
- Does not overwrite destination-term assignments already present.
- Returns counts for assignments carried and seeded.

The rollover result contains `enrolmentsCarried`, `assignmentsCarried`, `assignmentsSeeded` and `overCapacity`.

The operation uses set-based queries and is executed inside the term-switch transaction. If rollover fails, the current-term switch is rolled back too. Setting the already-current term again is intentionally usable to carry forward newly added classes/assignments; existing destination rows are skipped.

With `carryForward: false`, the term switch occurs without copying enrolments or subject assignments.

### Calendar events

An event can be term-scoped, session-scoped or school-wide. When a term is supplied, the use case resolves its parent session and stores both IDs consistently. Event type `holiday` forces `isHoliday: true`. Responses include term and session name references rather than only IDs.

## 5. Response shape and frontend integration

Session responses contain:
```ts
{
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
  terms: Array<{
    id: string; name: string; startDate: Date; endDate: Date;
    isCurrent: boolean; createdAt: Date;
  }>;
}
```

A standalone term response includes the parent `session: { id, name }` when the mapper is given that context.

Calendar event response:
```ts
{
  id: string; title: string; description: string | null;
  startDate: Date; endDate: Date | null;
  type: string; isHoliday: boolean;
  term: { id: string; name: string } | null;
  session: { id: string; name: string } | null;
  createdAt: Date;
}
```

Frontend rules:
- Treat session and term IDs as stable references; display the returned names.
- Use `GET /current` for the active academic context; handle null values during initial school setup.
- Do not assume changing the current session automatically rolls over enrolments. The rollover path is the current-term endpoint.
- Before setting a new term current, show the user that carry-forward defaults to true and summarize the returned counts/over-capacity classes.
- If the school needs a term switch without copying records, explicitly send `carryForward: false`.
- Do not treat an over-capacity rollover result as a failed switch; it is a reported exception the school must resolve.
- Calendar filters can be by term, session, type and date range. Events return resolved term/session names.

## 6. Dependencies and registration

The module registers session and calendar mappers/repositories, session/term commands and queries, current-period use cases, calendar use cases and the controller in `sessions.container.ts`.

It depends on:
- Audit service.
- Foundation and tenant database infrastructure.
- Classes module's `planTermAssignments` and teaching model/default assignment rules.
- Enrolment module's class-capacity helper and tenant enrolment records.

The session repository is consumed by Staff, Students, Fees and other modules. Its method names are cross-module dependencies and should be changed only with a coordinated audit.

## 7. Tests and verification gaps

Inspected focused test: `apps/api/tests/sessions/sessions.test.ts`. It covers permission registry/default roles, date overlap and containment, session naming, DTO validation, calendar DTOs, rollover planning, idempotent carry-forward planning, over-capacity reporting, session/term command behavior and calendar-event creation/scope.

The test file was inspected but not executed in this documentation pass. Remaining verification:
- Tenant Prisma schema/migrations and unique/current-period constraints.
- Full test execution and typecheck.
- Route-level middleware and actual HTTP response/error envelopes.
- Real database transaction behavior and concurrent current-term changes.
- Calendar event update/delete route behavior against a live tenant database.
- Product decision on whether the school-wide calendar should include any recurrence/time-zone behavior not represented by the current DTO/model.

## 8. Source map

- Routes: `apps/api/src/modules/sessions/routes/session.routes.ts`
- Controller: `apps/api/src/modules/sessions/controllers/session.controller.ts`
- Session/term DTOs and date policy: `dtos/session.dto.ts`, `domain/session.policy.ts`
- Calendar DTOs: `dtos/calendar.dto.ts`
- Permissions: `sessions.permissions.ts`
- Session and term use cases: `usecases/session-commands.usecases.ts`, `session-queries.usecases.ts`, `set-current.usecases.ts`
- Calendar use cases: `usecases/calendar.usecases.ts`
- Rollover: `services/term-rollover.ts`
- Repositories/mappers: `repositories/`, `mappers/`
- DI: `sessions.container.ts`
- Tests: `apps/api/tests/sessions/sessions.test.ts`
- Route mount: `apps/api/src/routes/index.ts`
