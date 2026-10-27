# Guardians Module Notes (first slice)

> Branch `refactor/modules`. Follows `docs/GUARDIANS_MODULE_AUDIT.md`. Build: no new TypeScript errors (the guardians module's 2 old errors are gone; the rest are in other modules). Tests: 22 guardian unit tests pass; no database or API test was run.

## What is switched on
`registerGuardians` is in the container list and `/guardians` is mounted.

| Method and path | Who | What it does |
|---|---|---|
| GET `/guardians/me/children` | GUARDIAN persona | The signed-in guardian's children (one query, signed photo links) |
| POST `/guardians/invite/bulk` | `guardians.manage` | Body `guardianIds` (max 100). One result per guardian: sent, skipped or failed (with a code) |
| GET `/guardians` | `guardians.view` | List. Query: `page`, `limit` (max 100), `search` (name, email, phone), `studentId` |
| POST `/guardians` | `guardians.manage` | Create + link to a student (see rules). Optional `invite: true` |
| GET `/guardians/:id` | `guardians.view` | Guardian with `students[]` (limited to the students the viewer may see) |
| PUT `/guardians/:id` | `guardians.manage` | Update; only changed fields are written and audited |
| POST `/guardians/:id/invite` | `guardians.manage` | Portal invitation through Auth |
| POST `/guardians/:id/link` | `guardians.manage` | Link to another student |
| PUT `/guardians/:id/students/:studentId` | `guardians.manage` | Change relation or primary |
| DELETE `/guardians/:id/students/:studentId` | `guardians.manage` | Unlink (guardian and student stay) |

## Rules
- **Permissions** (`guardians.permissions.ts`): `guardians.view` and `guardians.manage`, both sensitive and ALL-only. Only the School Admin (grants-all) holds them until the platform ticks them for another role. Every endpoint, including "guardians of a student" (`?studentId=`), needs `guardians.view`. Run `npm run sync:registries`.
- **Create** (`services/guardian-linking.ts`): one transaction. The guardian is found by email (trimmed, lower-case, any capitals, this school only) or created, then linked. An existing guardian is reused as it is: name, phone and other details are never overwritten. Response: `{ guardian, outcome: "created" | "reused" | "already_linked", invite? }` (201 for created or reused, 200 for already_linked).
- **No login is created.** The old temporary-password email is gone. A guardian gets a login by accepting an invitation.
- **Invitations** use Auth's `SendInviteUseCase` (persona GUARDIAN, `personaEntityId` = the guardian record, sent to the guardian's own email; saved, hashed, expiring, single use). This module has no token, link or email code of its own. A guardian who already has a login or membership is refused (`GUARDIAN_ALREADY_HAS_ACCESS`); a second invite replaces an unused one, so retries are safe.
- **Invite after the save.** The invitation runs only after the transaction commits. If it fails, the guardian stays saved and `invite.status` is `"failed"` with a `code`; it is never reported as sent. Statuses: `sent`, `not_needed` (already has access), `failed`.
- **One primary guardian per student**, enforced twice: the use case hands the primary over, and a database partial unique index (`prisma/tenant-migrations/20261023150000_guardian_primary_unique`) refuses a second primary even if two requests arrive together. That refusal becomes `PRIMARY_GUARDIAN_CONFLICT` (try again). Prisma cannot declare this index in the schema file, so it exists only in the migration.
- **Email change**: refused with `GUARDIAN_HAS_LOGIN` if the guardian has a portal login (until the User module has an email-change flow). Allowed otherwise; refused with `GUARDIAN_EMAIL_TAKEN` if another guardian has that email.
- **Unlink** is allowed even for a student's last guardian.
- **Children**: loaded in one query, limited by the Students scope rules (`studentScopeWhere`), with photo links from `StudentPhotoService` (private storage, short-lived links). `me/children` takes the guardian from the session, not from the request.
- **Audit**: `guardian.created`, `.linked`, `.updated` (old and new), `.link_updated`, `.unlinked`, written after the change succeeds.
- **Repository**: method names unchanged for other modules (attendance, grades, report cards, payments, notifications). `findByEmail` is now case-insensitive, `findByStudentId` is one query, `searchGuardians` is new, and the `console.log` that wrote student ids to the logs is removed.

## Error codes
`GUARDIAN_ALREADY_LINKED`, `GUARDIAN_NOT_LINKED`, `GUARDIAN_HAS_LOGIN`, `GUARDIAN_EMAIL_TAKEN`, `GUARDIAN_ALREADY_HAS_ACCESS`, `PRIMARY_GUARDIAN_CONFLICT`, plus the shared `NOT_FOUND`, `VALIDATION_ERROR`, `PERMISSION_DENIED`.

## Migration

**`20261027090000_guardian_email_unique`**: one guardian per email in a school, enforced by the database (unique index on `lower(email)`; Prisma cannot declare it, so it exists only in the SQL). Before building the index it lower-cases emails and merges existing duplicates: the keeper is the guardian with a portal login, else the oldest; blank phone/occupation/address are filled from the duplicates; student links and payments move to the keeper (if the removed guardian was a student's primary, the keeper becomes primary); then the duplicates are deleted. If two guardians with the same email BOTH have a login, the migration stops with a clear message and nothing is guessed: fix those by hand, then run it again. Invitations already sent to a removed duplicate point at a record that no longer exists: send them again from the keeper.
Two requests creating the same new email at the same moment: the second is refused by the database, the create runs once more, and the guardian made by the first request is reused. A changed email that hits the rule answers `409 GUARDIAN_EMAIL_TAKEN`.
Tested: unit tests (`tests/guardians/guardian-hardening.test.ts`) and, on a scratch Postgres, the merge (links, primary hand-over, payments, login holder kept, two logins refused) and a real race (second insert refused with the index name). NOT run: the create retry against the real app (needs the Prisma engine); it is covered by the error-recognition tests only.
Apply `20261023150000_guardian_primary_unique` to every existing school schema (new schemas get it through provisioning). It first clears extra primaries (keeps the earliest per student), then adds the index.

## Frontend changes
- `POST /guardians` now returns `{ guardian, outcome, invite? }` instead of the guardian alone. It no longer creates a login or emails a password.
- Create and update bodies are strict (unknown fields rejected); `email` is lower-cased; `phone` must look like a phone number.
- `POST /guardians/:id/link`, `PUT` and `DELETE /guardians/:id/students/:studentId` now return names, not bare ids. Link and update: `{ guardian: { id, name }, student: { id, name, admissionNumber }, relation, isPrimary }`. Unlink: `{ guardian: { id, name }, student: { id, name, admissionNumber } }`. (Before: `{ guardianId, studentId, relation, isPrimary }`.) A repeat link is still `409 GUARDIAN_ALREADY_LINKED`.
- New: `PUT` and `DELETE /guardians/:id/students/:studentId`.
- `GET /guardians/me/children` no longer has `classId` and `className` (they return with Classes and Enrolment). `photoUrl` is a link that expires after 1 hour.
- Guardian detail `students[]` items are student responses (with signed `photoUrl`) plus `relation` and `isPrimary`.
- The list no longer returns an unpaginated array for `?studentId=`; it is paginated like the rest.
- Invite and bulk-invite now send a working Auth invitation. Bulk returns `results[]` with `code` instead of `reason`.

## Left for later
Class and attendance on "my children", guardian deactivate/reactivate, a guardian editing their own contact details, pickup authorization, contact preferences, duplicate-guardian merge, an index on guardian email (optional, needs a tenant migration), a database-level guard against two simultaneous creates of the same new email (rare; would need an advisory lock or a unique index on lower(email)).
- `students/usecases/import-students.usecase.ts` is still switched off. Its guardian columns now throw "not supported yet" instead of calling the old create signature. Rebuild them in the import slice.
- Other modules still read `guardian.userId` through `guardianRepository`; it is set when an invite is accepted.

## Next step
Classes, Sessions and Enrolment (they unlock class names on "my children" and the branch and assigned scopes for Students).
