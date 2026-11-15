# Staff Module

> **Verification status:** Partially source-verified. Routes, controller actor derivation, DTOs, query/create/branch/status/portal use cases, mapper, repository, scope helper, permission declaration and DI registration were inspected. Remaining use cases, tenant migration details, focused test coverage and runtime behavior were not fully inspected.
> **Source snapshot:** `refactor/modules`, source snapshot recorded in the foundation guides as `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).
> **Primary source:** `apps/api/src/modules/staff/`
> **Route mount:** `/api/v1/staff`, registered in `apps/api/src/routes/index.ts`.

## 1. Responsibility and boundaries

The Staff module manages a school's staff records and their school-specific portal access:

- Staff directory, individual record and current staff profile.
- Staff creation, updates, deactivation and reactivation.
- Branch assignment.
- Portal invitations and role changes.
- Staff class/subject assignments and CSV export.
- A response-level portal status describing whether a staff member has no portal access, is invited, active or suspended.

A Staff record is not the same as a global login identity. Creating a staff record does not create a User/login. Portal access is established through an invitation accepted by the staff member, which links the global identity to the tenant Staff persona.

## 2. Data ownership and dependencies

Staff records and StaffBranch links live in the school's tenant schema. The repository uses `BaseTenantRepository` with soft deletion; staff records are retained because classes, payroll and historical records may reference them.

Important dependencies:

- Auth `MembershipService` and `SendInviteUseCase` for portal membership and invitation workflows.
- Auth refresh-token repository to revoke sessions for a suspended membership.
- Foundation `AccessService` for effective authorization and cache invalidation.
- Branch records for assignment validation.
- Classes and Sessions modules for staff assignment/profile endpoints.
- Audit service for staff mutations.
- Plan feature gate for staff quantity limits.
- `NumberSequenceService` for generated employee numbers.

The container registers the Staff module after Auth/Foundation and before the Classes/Sessions-dependent query behavior is used. Its own comment explicitly lists Auth, Foundation and Audit dependencies, with Classes and Sessions required for assignment endpoints.

## 3. Authorization and scope

The Staff routes are school-realm routes. All standard routes require authentication and tenant context.

| Permission | Supported scope | Meaning |
|---|---|---|
| `staff.view` | `ALL`, `BRANCH`, `OWN` | View all staff, staff in assigned branches, or only self |
| `staff.manage` | `ALL`, `BRANCH` | Manage staff globally or within assigned branches |

Both are declared for the `STAFF` persona. The invite route additionally requires `users.invite`. `GET /assignable-roles` requires `staff.manage` only (not `roles.view`, not `users.invite`) so that a staff manager can fill the role picker without being given the wider right to browse or manage roles. The `/me` and `/me/classes` routes require the `STAFF` persona rather than a broad directory permission.

The controller derives the acting user and membership from the verified request session and loaded access. It does not accept actor identity from the body or URL. The school ID comes from the host-resolved tenant context.

The Staff scope helper applies scope to the actual query/use case:
- `ALL`: no additional staff filter.
- `BRANCH`: staff assigned to at least one branch in the caller's branch scope.
- `OWN`: only the caller's own Staff persona record.

A route-level permission check is not a substitute for this data-level scope enforcement.

## 4. API endpoints

All paths are under `/api/v1/staff`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /export` | Authenticated, tenant, `staff.view` | Export the filtered/scope-limited directory as CSV |
| `GET /me` | Authenticated, tenant, STAFF persona | Get caller's own Staff profile |
| `GET /me/classes` | Authenticated, tenant, STAFF persona | Get classes associated with caller |
| `GET /assignable-roles` | Authenticated, tenant, `staff.manage` | Roles the caller may grant when inviting a staff member or changing their roles (role-picker data) |
| `GET /` | Authenticated, tenant, `staff.view` | List, search and paginate staff |
| `POST /` | Authenticated, tenant, `staff.manage`; CreateStaffDto | Create staff record; optional immediate invite |
| `GET /:id` | Authenticated, tenant, `staff.view` | Get one staff record within caller scope |
| `GET /:id/assignments` | Authenticated, tenant, `staff.view` | Get staff assignments |
| `PUT /:id` | Authenticated, tenant, `staff.manage`; UpdateStaffDto | Update staff details |
| `PUT /:id/branches` | Authenticated, tenant, `staff.manage`; SetStaffBranchesDto | Replace caller-manageable branch assignments |
| `PUT /:id/roles` | Authenticated, tenant, `staff.manage`; ChangeStaffRolesDto | Replace staff member's portal roles |
| `POST /:id/invite` | Authenticated, tenant, `staff.manage` and `users.invite`; InviteStaffDto | Invite staff member to portal |
| `POST /:id/deactivate` | Authenticated, tenant, `staff.manage`; DeactivateStaffDto | Deactivate staff and suspend this school's access |
| `POST /:id/reactivate` | Authenticated, tenant, `staff.manage` | Reactivate staff |

Fixed routes are registered before `/:id` to avoid path capture.

## 5. Request contracts

### CreateStaffDto

Strict object; unknown properties are rejected.

| Field | Constraints |
|---|---|
| `firstName`, `lastName` | Required, trimmed, 1–50 characters |
| `middleName` | Optional, max 50 |
| `email` | Optional shared email validator |
| `phone` | Optional, 7–30 characters |
| `gender` | Optional `male` or `female` |
| `dateOfBirth` | Optional valid date in the past |
| `address` | Optional, max 200 |
| `department` | Optional, max 100 |
| `designation` | Optional, max 100 |
| `qualification` | Optional, max 200 |
| `category` | `teaching` or `non_teaching`; defaults to `non_teaching` |
| `employmentType` | `full_time`, `part_time`, `contract`, `volunteer`; defaults to `full_time` |
| `joinDate` | Optional valid date |
| `employeeId` | Optional 2–30 chars, letters/numbers/hyphen/slash; generated when omitted |
| `branchIds` | Optional array of 1–50 IDs; default is resolved from caller scope/main branch |
| `confirmNotDuplicate` | Optional boolean to confirm a possible same-name/phone duplicate |
| `invite` | Optional object containing `roleId`; requires an email |

### UpdateStaffDto

Strict partial update. Supports the staff profile/employment fields above; nullable fields can be cleared. At least one field must be supplied. Employee ID is validated but is not auto-generated on update.

### ListStaffQuery

- `page`: integer, minimum 1, default 1.
- `limit`: integer 1–100, default 20.
- `search`: max 100 characters.
- Optional `category`, `employmentType`, `department`, `branchId`.
- `status`: `active`, `inactive` or `all`; defaults to `active`.

### Other DTOs

- `SetStaffBranchesDto`: `branchIds` array of 1–50 IDs; optional `primaryBranchId`.
- `DeactivateStaffDto`: optional valid `exitDate`, optional `exitReason` max 300.
- `InviteStaffDto`: required `roleId`.
- `ChangeStaffRolesDto`: `roleIds` array of 1–5 IDs.

## 6. Response projection

The Staff mapper returns a stable projection with:

- Identity/profile: `id`, `employeeId`, `firstName`, `lastName`, `middleName`, `fullName`, `email`, `phone`, `photoUrl`.
- Personal/employment fields: `gender`, `dateOfBirth`, `address`, `department`, `designation`, `qualification`, `category`, `employmentType`, `joinDate`, `exitDate`, `exitReason`.
- Status and relationships: `isActive`, `branches`, `portal`, `createdAt`.

Each branch projection contains `id`, `name`, `code` and `isPrimary`. Portal status is `none`, `invited`, `active` or `suspended`, with role entries containing `id` and `name`.

The list controller returns `{ success, message, data, meta }`. Other controller methods use shared `sendSuccess`/`sendCreated` helpers. CSV export returns a UTF-8 CSV attachment named `staff.csv` with a BOM; the query use case neutralizes spreadsheet-formula-leading cell characters.

### Assignable roles (role-picker contract)

`GET /api/v1/staff/assignable-roles` returns the staff roles the **signed-in person** may hand out. Use it, and not `GET /roles`, to populate the role picker on the invite and change-roles forms.

- **Permission:** `staff.manage` at scope `ALL` or `BRANCH`. `roles.view` is **not** required. `users.invite` is not required to *read* the list; the invite call itself still requires it.
- **Request:** no body, no query parameters. The school comes from the host; the actor comes from the session.
- **Success:** `200`, standard envelope.

```json
{
  "success": true,
  "message": "Assignable roles retrieved successfully",
  "data": [
    { "id": "7f0c…", "name": "Class Teacher", "description": "Teaches assigned classes", "kind": "SYSTEM_EDITABLE", "grantsAll": false },
    { "id": "c21a…", "name": "Records Officer", "description": null, "kind": "CUSTOM", "grantsAll": false }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Role id. Send this as `roleId` (invite) or inside `roleIds` (change roles). |
| `name` | string | Display name. |
| `description` | string or `null` | Optional description. |
| `kind` | `"SYSTEM_LOCKED"` \| `"SYSTEM_EDITABLE"` \| `"CUSTOM"` | Where the role came from. Informational only; do not branch authorization on it. |
| `grantsAll` | boolean | The role holds every permission (School Admin). Only a School Admin ever sees one. Show it as an administrator role. |

The TypeScript shape is `AssignableStaffRole` in `@schoolos/contracts` (`packages/contracts/src/staff.ts`).

**What is in the list.** Live, `STAFF`-persona roles of this school that the caller could grant through the existing invitation / role-change rules (the same `canGrantRole` rule, shared by this endpoint, `PUT /:id/roles` and `POST /:id/invite`):

- a `grantsAll` role is included only for a School Admin;
- any other role is included only when **every** permission in it is held by the caller at a scope at least as wide (`ALL` > `BRANCH` > `ASSIGNED` > `OWN`);
- a role with no permissions is included for any caller who passes the route guard.

**What is not in the list.** Any role the caller cannot grant is omitted entirely: no placeholder, no disabled entry, no count. Student and guardian roles are never listed. Permission details of a role are never returned.

**Ordering.** System roles first, then by name (stable between calls).

**Empty list.** `data: []` with `200` is valid (the caller holds too little to grant anything). Show an empty state; do not treat it as an error.

**Errors.**

| Status | `code` | When |
|---|---|---|
| 401 | `TOKEN_MISSING`, `TOKEN_EXPIRED` or `TOKEN_INVALID` | No valid session. |
| 403 | `PERMISSION_DENIED` (`details.permission: "staff.manage"`) | The caller does not hold `staff.manage`. |

**What this does not decide.** The list answers for the *person*, not for a particular staff member. These checks still run, and can still fail, on the action itself: branch scope of the target, `CANNOT_CHANGE_OWN_ROLE`, `LAST_ADMINISTRATOR`, `NOT_A_PORTAL_USER`, `STAFF_HAS_NO_EMAIL`, and `ROLE_NOT_ALLOWED` (for example if the caller's own access changed after the list was loaded). Always handle `ROLE_NOT_ALLOWED` on submit.

## 7. Business rules and workflows

### Create

- Checks the plan's staff quantity limit.
- Resolves branch IDs within the creator's branch scope and requires every selected branch to be active.
- If branch IDs are omitted, a single branch-scoped creator defaults to their own branch; a creator with several scoped branches must choose; an ALL-scoped creator defaults to the main branch.
- Rejects duplicate email and employee ID; same first name + last name + phone triggers a possible-duplicate confirmation error unless confirmed.
- Generates the employee number inside the same transaction as the staff record and StaffBranch rows, retrying a unique-number collision.
- Staff record creation is separate from portal identity creation.
- Optional immediate invitation is attempted after staff creation. The staff record remains created if invitation delivery fails; the response reports invite status.

### Branch assignments

- At least one branch is retained.
- A branch-scoped manager can only replace assignments inside their own branch scope; existing assignments outside that scope are preserved.
- The primary branch is selected from the final set.
- The staff membership's access cache is invalidated after assignment changes.
- The change is audited.

### Portal invitation and roles

- Invitation is sent to the email stored on the Staff record.
- Staff must be active, have an email and not already have a Staff membership.
- The Auth invitation engine owns invitation expiry, single use, host binding and role delegation rules.
- Role changes require an existing portal membership.
- A user cannot change their own roles.
- Every granted role must be delegable by the actor; a `grantsAll` role requires a School Admin. This is one rule (`canGrantRole` in `foundation/access.service.ts`) used by the invitation engine (`SendInviteUseCase`), by role changes (`ChangeStaffRolesUseCase`) and by `GET /assignable-roles`; a test keeps the three in agreement.
- The last active school administrator cannot lose the administrator role.
- Effective access cache is invalidated after role replacement.

### Deactivation/reactivation

- Deactivation is school-specific; it does not deactivate the global User identity.
- Deactivation is refused for the caller's own Staff record and for the school's only administrator.
- The Staff row is marked inactive, the matching tenant Membership is suspended, that membership's refresh sessions are revoked, its access cache is invalidated and pending invitations are cancelled.
- The response includes a warning count of active class/subject assignments that still need reassignment.
- Reactivation checks the plan limit again and restores the school's access according to the use case.
- Staff records are not hard-deleted through these workflows.

## 8. Frontend integration requirements

- Create the Staff record first; do not expect a login account to be created automatically.
- Show portal state separately from employment status.
- Treat branch assignment as a dedicated operation and preserve the server-returned primary branch.
- Provide explicit duplicate confirmation when the API reports a possible duplicate.
- If immediate invitation fails, keep the created staff record and show the returned invitation failure state; do not blindly retry staff creation.
- Render the server's branch-filtered directory; do not fetch all staff and filter client-side.
- Do not assume a school-wide admin role is grantable by every manager.
- Populate the invite and change-roles role pickers from `GET /staff/assignable-roles`, not from `GET /roles` (which needs `roles.view`, a permission staff managers do not necessarily hold). Load it when the picker opens, do not cache it across users or sessions, and keep handling `ROLE_NOT_ALLOWED` on submit.
- Deactivation can leave active teaching assignments; display the warning count and provide a reassignment workflow.
- Do not interpret deactivation as deleting the user's global account or access to other schools.

## 9. Tests and verification gaps

`apps/api/tests/staff/assignable-roles.test.ts` covers `GET /assignable-roles`: which roles each kind of caller gets (School Admin, branch-limited manager, a manager holding only `staff.manage` and `users.invite`), that `grantsAll` is never offered to a non-admin, the exact response fields, that the list agrees with what the real `SendInviteUseCase` and `ChangeStaffRolesUseCase` accept, and that the route is guarded by `staff.manage` and declared before `/:id`. These use in-memory fakes. `apps/api/tests/staff/staff-portal.roles.db.test.ts` covers the tenant query (`StaffPortalService.listStaffRoles`) on a real database with two schools: only the current school's live `STAFF` roles come back (system roles first, then by name), soft-deleted and student/guardian roles are left out, a role with the same name in the other school comes back with its own permissions, and calling it outside a school context fails rather than falling back to a shared schema. It is skipped without `TEST_DATABASE_URL`.

Test files and tenant migration constraints were not fully inspected for the rest of this guide. No tests, migrations, build or runtime requests were executed. Before marking this guide fully verified, inspect the remaining update/assignment use cases, Staff portal service, assignment query implementations, schema indexes/constraints and focused Staff tests.

## 10. Source files reviewed

- `routes/staff.routes.ts`
- `controllers/staff.controller.ts`
- `dtos/staff.dto.ts`
- `usecases/create-staff.usecase.ts`
- `usecases/staff-queries.usecases.ts`
- `usecases/staff-branches.usecase.ts`
- `usecases/staff-status.usecases.ts`
- `usecases/staff-portal.usecases.ts`
- `services/staff-scope.ts`
- `services/staff-portal.service.ts`
- `repositories/staff.repository.impl.ts`
- `mappers/staff.mapper.ts`
- `staff.permissions.ts`
- `staff.container.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/container/index.ts`
