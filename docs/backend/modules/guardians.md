# Guardians Module

> **Verification status:** Partially source-verified. Routes, controller, DTOs, mapper, create/link/query/invite use cases and DI registration were inspected. Update implementation, repository/database constraints, permission registry sync and focused tests remain to be reviewed.
> **Primary source:** `apps/api/src/modules/guardians/`
> **Route mount:** `/api/v1/guardians`, from `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

Owns guardian contact records, guardian-to-student relationships and guardian portal invitations. A Guardian record is school-specific; it is not itself a global login identity. Portal access is granted through the Auth invitation/membership system and attaches the identity to the Guardian persona.

## 2. Data ownership and dependencies

Guardian records and guardian-student links are tenant-schema data. The module depends on:

- Students repository and StudentPhotoService for validating student links and returning child summaries.
- Auth `SendInviteUseCase` and `MembershipService` for portal access.
- Audit service for guardian and relationship changes.
- Foundation access service for current authorization context.

The repository creates/reuses guardian and link records together. Guardian email is normalized to lowercase and is used to find/reuse a guardian within the school. Existing guardian details are not overwritten when a matching email is reused.

## 3. Authorization

All routes require authentication and tenant context.

| Route guard | Purpose |
|---|---|
| `guardians.view` | List/read guardian directory and relationship details |
| `guardians.manage` | Create/update guardian, link/unlink students, invite portal access |
| GUARDIAN persona | `GET /me/children`, using the guardian identity from the signed-in access context |

The controller derives the acting user, membership, IP, user-agent and admin status from the verified request/session. Client-provided actor identity is not trusted.

Guardian child results are additionally filtered through the Students module's `studentScopeWhere` policy.

## 4. API endpoints

All paths are under `/api/v1/guardians`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /me/children` | GUARDIAN persona | Return children linked to current guardian |
| `POST /invite/bulk` | `guardians.manage` | Bulk invite up to 100 guardians |
| `GET /` | `guardians.view` | Paginated list; optional search and studentId filter |
| `POST /` | `guardians.manage`; CreateGuardianDto | Create/reuse guardian and link to student; optional invite |
| `GET /:id` | `guardians.view` | Guardian and visible linked students |
| `PUT /:id` | `guardians.manage`; UpdateGuardianDto | Update contact details |
| `POST /:id/invite` | `guardians.manage` | Send portal invitation |
| `POST /:id/link` | `guardians.manage`; LinkGuardianDto | Link existing guardian to student |
| `PUT /:id/students/:studentId` | `guardians.manage`; UpdateGuardianLinkDto | Update relationship or primary status |
| `DELETE /:id/students/:studentId` | `guardians.manage` | Remove relationship only |

## 5. Request contracts

### CreateGuardianDto

Strict object; unknown keys rejected.

| Field | Constraints |
|---|---|
| `firstName`, `lastName` | Required, trimmed, 1–50 chars |
| `email` | Required valid email, lowercased, max 254 |
| `phone` | Optional 7–20 chars; digits, plus, spaces, parentheses and hyphen |
| `occupation` | Optional, max 100 |
| `address` | Optional, max 300 |
| `studentId` | Required UUID |
| `relation` | Required member of `GUARDIAN_RELATIONS` domain enum |
| `isPrimary` | Boolean, defaults false |
| `invite` | Boolean, defaults false |

### Other DTOs

- `UpdateGuardianDto`: strict partial contact update; at least one field; nullable/blank values can clear phone, occupation and address.
- `LinkGuardianDto`: studentId UUID, relation enum, isPrimary defaults false.
- `UpdateGuardianLinkDto`: optional relation and/or isPrimary; at least one field.
- `BulkInviteGuardiansDto`: 1–100 guardian UUIDs.
- `ListGuardiansQuery`: page default 1, limit default 20 (max 100), optional search (max 100) and studentId UUID.

## 6. Response projection

Guardian response fields: `id`, `userId`, `firstName`, `lastName`, `email`, `phone`, `occupation`, `address`, `isActive`, `createdAt`.

A guardian detail response adds `students`; each linked student uses the Students response projection plus `relation` and `isPrimary`. The current guardian's `/me/children` response is deliberately smaller: `studentId`, first/last name, photo URL, active status, relation and primary flag.

Create result includes `guardian`, an `outcome` (`created`, linked/reused or already linked) and, when requested, an `invite` status. Bulk invite returns counts and per-guardian `sent | skipped | failed` results. List returns `{ success, message, data, meta }`.

## 7. Business rules and workflows

- Create requires an existing student.
- Guardian email is normalized; an existing guardian with the same email in the school is reused and their details are not overwritten by the create request.
- Guardian creation/reuse and the student link occur in one repository transaction.
- One primary guardian per student. Setting another guardian primary hands over that status; database uniqueness protects concurrent writes.
- Repeating a create for an already-linked guardian returns an `already_linked` outcome; explicit link endpoint reports an already-linked error.
- Unlink removes only the relationship; neither the Guardian nor Student record is deleted. A student may have no guardian.
- Invite uses Auth's shared invitation mechanism; token hashing, expiry and single-use semantics belong to Auth. A guardian who already has access cannot be invited again. A new invite replaces an unused prior invite.
- Optional invitation after guardian creation happens after the guardian/link commit. Invitation failure does not roll back the saved guardian; the response reports failure status.
- Bulk invite processes each guardian independently and reports per-item failures rather than failing the entire batch.
- The current children endpoint derives guardian identity from the signed-in GUARDIAN persona, never a client-supplied guardian ID.

## 8. Frontend integration requirements

- Treat Guardian record creation and portal invitation as separate outcomes.
- If invitation fails, preserve the saved guardian and offer the dedicated invite action; do not repeat create.
- A guardian may be linked to multiple students; use the relationship resource endpoints to manage each link.
- Display primary guardian status per student, not as a global guardian property.
- Unlinking does not delete either record.
- Build the parent portal's child list from `GET /me/children`; do not send a guardian ID.
- Do not assume class/attendance summaries are currently included in `/me/children`; the implementation comment says these are future additions.

## 9. Verification gaps

The guardian update use case, full repository implementation/schema constraints, exact relation enum values, permission registry synchronization and focused tests remain to be reviewed. No tests/build/migrations/runtime requests were executed.

## 10. Source files reviewed

- `routes/guardian.routes.ts`, `controllers/guardian.controller.ts`, `dtos/guardian.dto.ts`
- `usecases/create-guardian.usecase.ts`, `usecases/guardian-links.usecases.ts`
- `usecases/guardian-queries.usecases.ts`, `usecases/guardian-invites.usecases.ts`
- `mappers/guardian.mapper.ts`, `guardians.container.ts`, `apps/api/src/routes/index.ts`
