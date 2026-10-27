# Sessions Module Notes (first of three: Sessions, then Classes, then Enrolment)

> Branch `refactor/modules`. Follows `docs/ACADEMIC_STRUCTURE_AUDIT.md`. Build: no new TypeScript errors (126 before, 126 after, none in sessions). Tests: 20 new unit tests pass; no database or API test was run.

## What is switched on
`registerSessions` is in the container list and `/sessions` is mounted.

| Method and path | Permission | What it does |
|---|---|---|
| GET `/sessions` | `sessions.view` | All sessions, newest first, with their terms |
| GET `/sessions/current` | `sessions.view` | `{ session, currentTerm }`; either may be null until chosen |
| POST `/sessions` | `sessions.manage` | Create a session |
| PUT `/sessions/:id` | `sessions.manage` | Edit name or dates (new) |
| PUT `/sessions/:id/set-current` | `sessions.manage` | Make a session current |
| POST `/sessions/terms` | `sessions.manage` | Create a term (body has `sessionId`) |
| PUT `/sessions/terms/:termId` | `sessions.manage` | Change a term's dates (the name cannot change) |
| PUT `/sessions/terms/:termId/set-current` | `sessions.manage` | Make a term (and its session) current; optional body `{ carryForward }` (default true) |
| GET / POST `/sessions/calendar/events` | view / manage | List (filters `termId`, `sessionId`, `type`, `from`, `to`) and create |
| PUT / DELETE `/sessions/calendar/events/:eventId` | `sessions.manage` | Edit and delete (new) |

## Rules
- **Permissions** (`sessions.permissions.ts`): `sessions.view` (ALL, every persona) and `sessions.manage` (staff, sensitive). `sessions.view` is on every default role template (admin gets it by grants-all). Run `npm run sync:registries`.
- **Session name** must look like `2025/2026` (the second year follows the first); unique in any capitals. Dates: end after start; a session may not overlap another (`SESSION_DATES_OVERLAP`, with the other session's name in `details`).
- **Terms**: one `first`, `second`, `third` per session; dates must lie inside the session and may not overlap another term (`TERM_OUTSIDE_SESSION`, `TERM_DATES_OVERLAP`, `TERM_NAME_TAKEN`). A session cannot be shrunk past one of its terms (`SESSION_EXCLUDES_TERMS`).
- **Current session / term are always switched in ONE transaction** (never "no current term"). Making a term current also makes its session current. Making a session current clears the current term if it belongs to another session.
- **Term roll-over** (when a term becomes current and `carryForward` is not false), in the same transaction, set-based (a handful of queries for the whole school, not one per student):
  - every ACTIVE student enrolled last term in the same session is enrolled in the same class (capacity is not re-checked: same class as before)
  - last term's subject teachers are copied as they were, then missing class and subject pairs get the subject's default teacher, or (homeroom schools) the class teacher
  - safe to repeat: anything already there is skipped, nothing is overwritten. Calling set-current on the term that is already current only repeats this step ("carry forward again")
  - the planning rules are in `classes/services/class-subject-plan.ts` (pure, tested) and are reused by the Classes pass
  - it reads `SchoolSettings.teachingModel` until the settings service exists
- **Calendar**: an event belongs to a term, a session, or the whole school. Giving a term sets its session; a term and a different session is refused (`EVENT_SCOPE_MISMATCH`). A `holiday` event is always a holiday. The old create wrote a column that does not exist; that is fixed.
- **Audit**: `session.created / updated / set_current`, `term.created / updated / set_current` (with roll-over counts), `calendar_event.created / updated / deleted`, written after the change succeeds, with names (not only ids) in the values.
- **Repository**: method names unchanged for other modules. `setCurrentSession` and `setCurrentTerm` are now atomic. `calendar.repository,impl.ts` is renamed `calendar.repository.impl.ts`.

## Error codes
`SESSION_NAME_TAKEN`, `SESSION_DATES_OVERLAP`, `TERM_NAME_TAKEN`, `TERM_DATES_OVERLAP`, `TERM_OUTSIDE_SESSION`, `SESSION_EXCLUDES_TERMS`, `END_BEFORE_START`, `EVENT_SCOPE_MISMATCH`, plus the shared `NOT_FOUND`, `VALIDATION_ERROR`, `PERMISSION_DENIED`.

## Roles in schools that already exist
Permission `sessions.view` for student, guardian, principal, branch principal, teacher and bursar. Roles in existing environments are brought up to date in two steps on every deploy: `npm run sync:registries` (updates the platform's role templates: locked ones are made exact, editable ones only gain missing permissions) and then `npm run sync:school-roles` (updates each school's own copy; roles a school has customised are skipped and listed). See `ROLE_SYNC_NOTES.md`. Until both have run, the affected roles get `PERMISSION_DENIED` on `/sessions/current`.

## Frontend changes
- `GET /sessions/current` returns `{ session, currentTerm }` (before: the session).
- Terms carry `session: { id, name }` instead of `sessionId` (terms listed inside a session omit it). Calendar events carry `term: { id, name }` and `session: { id, name }` instead of `termId` and `sessionId`.
- `PUT /sessions/terms/:termId/set-current` returns `{ term, rollover: { enrolmentsCarried, assignmentsCarried, assignmentsSeeded } | null }` and also makes the term's session current. Send `{ "carryForward": false }` to switch without copying.
- Calendar routes are new, under `/sessions/calendar/events`.
- Bodies are strict: unknown fields (for example `isCurrent`) are rejected. Session names must look like `2025/2026`.

## Left for later
Deleting sessions, terms; term "locking" when records exist; the Classes and Enrolment passes (they will reuse the plan and add the permission scopes); `createdBy` name on calendar events.

## Next step
Classes pass (permissions, class teacher rules, safe delete, filled-in responses, audit).
